// lib/use-online-count.ts  (АДМИН сайт)
"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue, update, type Database } from "firebase/database";
import { useAuth } from "@/app/providers";

/**
 * Client сайтаас бүртгэгдэж буй хоёр мод дээр real-time сонсож, яг одоо онлайн байгаа хүнийг тоолно:
 *   presence/{uid}/{connectionId}             -> нэвтэрсэн хэрэглэгч
 *   presence_guests/{guestId}/{connectionId}  -> нэвтрээгүй зочин
 * Нэг хүн олон tab нээсэн ч 1 гэж тоологдоно.
 *
 * count        -> нийт онлайн (нэвтэрсэн + зочин)
 * users        -> нэвтэрсэн хэрэглэгч (уншиж чадаагүй бол null)
 * guests       -> зочин (уншиж чадаагүй бол null)
 * connections  -> нийт нээлттэй tab/холболт
 * count === null -> ачаалж байна, эсвэл Realtime Database тохируулаагүй / эрх байхгүй (error === true)
 */

// Client 3 минут тутам цагаа шинэчилдэг. Үүнээс удаан шинэчлэгдээгүй бичлэгийг тоолохгүй.
const STALE_MS = 10 * 60 * 1000;
// Үүнээс хуучин бичлэгийг (onDisconnect ажиллаагүй, эсвэл хуурамч) өгөгдлийн сангаас устгана
const PURGE_AFTER_MS = 30 * 60 * 1000;
const PURGE_INTERVAL_MS = 10 * 60 * 1000;
const MAX_PURGE_PER_RUN = 500;
// Шинэ event ирээгүй ч бичлэгүүд хуучирдаг тул тоог тогтмол дахин тооцно
const RECOUNT_INTERVAL_MS = 30 * 1000;

type PresenceTree = Record<string, unknown> | null;

interface OnlineState {
  count: number | null;
  users: number | null;
  guests: number | null;
  connections: number | null;
  error: boolean;
}

const EMPTY: OnlineState = { count: null, users: null, guests: null, connections: null, error: false };

const sameState = (a: OnlineState, b: OnlineState) =>
  a.count === b.count &&
  a.users === b.users &&
  a.guests === b.guests &&
  a.connections === b.connections &&
  a.error === b.error;

function countTree(
  tree: PresenceTree,
  now: number,
  rootPath: string,
  purgePaths: string[]
): { people: number; connections: number } {
  let people = 0;
  let connections = 0;
  if (!tree || typeof tree !== "object") return { people, connections };

  for (const [id, conns] of Object.entries(tree)) {
    if (!conns || typeof conns !== "object") continue;

    let fresh = 0;
    for (const [connectionId, value] of Object.entries(conns as Record<string, unknown>)) {
      if (value === true) {
        // Хуучин хувилбарын client (цаггүй) — onDisconnect-оор устах тул тоолно
        fresh += 1;
      } else if (typeof value === "number") {
        const age = now - value;
        if (age < STALE_MS) fresh += 1;
        else if (age > PURGE_AFTER_MS) purgePaths.push(`${rootPath}/${id}/${connectionId}`);
      }
    }

    if (fresh > 0) {
      people += 1;
      connections += fresh;
    }
  }

  return { people, connections };
}

export function useOnlineCount(): OnlineState {
  const { currentUser } = useAuth();
  // Token шинэчлэгдэх бүрт дахин subscribe хийхгүйн тулд зөвхөн uid-аас хамааруулна
  const uid = currentUser?.uid ?? null;
  const [state, setState] = useState<OnlineState>(EMPTY);

  useEffect(() => {
    if (!uid) {
      // Admin гарсан бол хуучин тоог харуулахгүй
      setState(EMPTY);
      return;
    }

    let database: Database;
    try {
      // Анхдагч Firebase app-ийг ашиглана (@/firebase/client-д databaseURL заавал байх ёстой)
      database = getDatabase();
    } catch (err) {
      console.warn("[online] Realtime Database тохируулаагүй байна:", err);
      setState({ ...EMPTY, error: true });
      return;
    }

    let usersTree: PresenceTree = null;
    let guestsTree: PresenceTree = null;
    let usersStatus: "loading" | "ok" | "failed" = "loading";
    let guestsStatus: "loading" | "ok" | "failed" = "loading";
    let serverOffset = 0;
    let lastPurgeAt = 0;

    const apply = (next: OnlineState) => setState((prev) => (sameState(prev, next) ? prev : next));

    const purge = (paths: string[]) => {
      if (paths.length === 0 || Date.now() - lastPurgeAt < PURGE_INTERVAL_MS) return;
      lastPurgeAt = Date.now();
      const updates: Record<string, null> = {};
      paths.slice(0, MAX_PURGE_PER_RUN).forEach((p) => {
        updates[p] = null;
      });
      update(ref(database), updates).catch((err) =>
        console.warn("[online] хуучирсан бичлэг цэвэрлэж чадсангүй:", err?.message ?? err)
      );
    };

    const recount = () => {
      // Хоёр мод хоёулаа хариу өгөхийг хүлээнэ (эхний тоо дутуу харагдахаас сэргийлнэ)
      if (usersStatus === "loading" || guestsStatus === "loading") return;

      if (usersStatus === "failed" && guestsStatus === "failed") {
        apply({ ...EMPTY, error: true });
        return;
      }

      const now = Date.now() + serverOffset;
      const purgePaths: string[] = [];
      const u = usersStatus === "ok" ? countTree(usersTree, now, "presence", purgePaths) : null;
      const g = guestsStatus === "ok" ? countTree(guestsTree, now, "presence_guests", purgePaths) : null;

      apply({
        count: (u?.people ?? 0) + (g?.people ?? 0),
        users: u ? u.people : null,
        guests: g ? g.people : null,
        connections: (u?.connections ?? 0) + (g?.connections ?? 0),
        error: false,
      });

      purge(purgePaths);
    };

    // Admin-ий компьютерийн цаг буруу байсан ч серверийн цагаар харьцуулна
    const unsubscribeOffset = onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => {
      serverOffset = Number(snapshot.val()) || 0;
    });

    const unsubscribeUsers = onValue(
      ref(database, "presence"),
      (snapshot) => {
        usersTree = snapshot.val();
        usersStatus = "ok";
        recount();
      },
      (err) => {
        console.warn("[online] presence уншиж чадсангүй:", err.message);
        usersTree = null;
        usersStatus = "failed";
        recount();
      }
    );

    const unsubscribeGuests = onValue(
      ref(database, "presence_guests"),
      (snapshot) => {
        guestsTree = snapshot.val();
        guestsStatus = "ok";
        recount();
      },
      (err) => {
        console.warn("[online] presence_guests уншиж чадсангүй:", err.message);
        guestsTree = null;
        guestsStatus = "failed";
        recount();
      }
    );

    const timer = setInterval(recount, RECOUNT_INTERVAL_MS);

    return () => {
      unsubscribeOffset();
      unsubscribeUsers();
      unsubscribeGuests();
      clearInterval(timer);
    };
  }, [uid]);

  return state;
}