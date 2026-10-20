// lib/use-online-count.ts  (АДМИН сайт)
"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { useAuth } from "@/app/providers";

/**
 * Client сайтаас бүртгэгдэж буй `presence/{uid}/{connectionId}` мод дээр real-time сонсож,
 * яг одоо онлайн байгаа хэрэглэгчийн тоог буцаана (нэг хэрэглэгч олон tab нээсэн ч 1 гэж тоологдоно).
 *
 * count === null  -> ачаалж байна, эсвэл Realtime Database тохируулаагүй / эрх байхгүй (error === true)
 */
export function useOnlineCount() {
  const { currentUser } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe: () => void = () => {};

    try {
      // Анхдагч Firebase app-ийг ашиглана (@/firebase/client-д databaseURL заавал байх ёстой)
      const database = getDatabase();

      unsubscribe = onValue(
        ref(database, "presence"),
        (snapshot) => {
          // Түлхүүр бүр = нэг онлайн хэрэглэгч (uid)
          setCount(snapshot.size);
          setError(false);
        },
        (err) => {
          console.warn("[online] presence уншиж чадсангүй:", err.message);
          setCount(null);
          setError(true);
        }
      );
    } catch (err) {
      console.warn("[online] Realtime Database тохируулаагүй байна:", err);
      setError(true);
    }

    return () => unsubscribe();
  }, [currentUser]);

  return { count, error };
}