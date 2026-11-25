// lib/promo-codes.ts
// Промо кодын серверийн туслах функцууд (зөвхөн админ сайтын API route дуудна).
//
// Хадгалах газар:
//   promoCodes/{КОД}      - код өөрөө. Баримтын ID = том үсгээр цэгцэлсэн код (ингэснээр давхардал боломжгүй)
//   promoUsages/{ID}      - код ашиглан хийсэн худалдан авалт бүр. ЭНИЙГ клиент сайтын төлбөр боловсруулах хэсэг бичнэ
//                           (баримтын ID-д төлбөрийн ID-г ашиглавал QPay callback давтагдсан ч нэг л удаа бүртгэгдэнэ).
//
// promoUsages баримтын талбарууд (клиент сайт бичихдээ яг ингэж бичнэ):
//   code: string       - том үсгээр цэгцэлсэн код
//   userId: string     - эрх авсан хэрэглэгчийн uid
//   userName: string   - тухайн үеийн харагдах нэр (админд харуулна)
//   amount: number     - төлсөн дүн (₮)
//   bonusDays: number  - олгосон нэмэлт хоног
//   planName?: string  - сонгосон багц
//   createdAt: string  - ISO огноо
//
// Firestore rules-ийн catch-all (allow read, write: if false) нь клиентийн хандалтыг хаадаг тул rules өөрчлөхгүй.
import { firestore } from "@/firebase/server";
import { NovelApiError, jsonError } from "@/lib/novel-chapters";
import {
  PROMO_BONUS_DAYS_DEFAULT,
  PROMO_CODE_FORMAT_MESSAGE,
  isValidPromoCode,
  normalizePromoCode,
} from "@/validation/promoCodeSchema";
import type {
  PromoCode,
  PromoCodeStats,
  PromoCodesResponse,
  PromoUsage,
  PromoUsagesResponse,
} from "@/utils/promo-api";

// Эрх шалгах, JSON унших, алдааны хариу: novel-тэй нэг ижил байх тул нэг газраас дахин экспортолно
// (дараа нь moderator эрх нэмэхэд энд л нэг удаа солино)
export { requireAdmin, readJsonBody, jsonError } from "@/lib/novel-chapters";

export class PromoApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const promoCodesCollection = () => firestore.collection("promoCodes");
export const promoUsagesCollection = () => firestore.collection("promoUsages");

// Нийт статистикийг гаргахдаа уншдаг ашиглалтын бүртгэлийн дээд тоо. Хэтэрвэл `truncated: true` гэж мэдэгдэнэ.
const USAGE_SCAN_LIMIT = 10_000;
// Код сонгож түүх харахад нэг кодын бүртгэлийг дээд тал нь ингэж уншина
const USAGE_CODE_FETCH_LIMIT = 1_000;

export const USAGE_LOG_DEFAULT_LIMIT = 50;
export const USAGE_LOG_MAX_LIMIT = 200;

const toIsoString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === "function") return maybeTimestamp.toDate().toISOString();
  return null;
};

const numberOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const stringOr = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const emptyStats = (): PromoCodeStats => ({
  purchases: 0,
  uniqueUsers: 0,
  totalAmount: 0,
  bonusDaysGiven: 0,
  lastUsedAt: null,
});

export const toPromoCode = (
  id: string,
  data: Record<string, any>,
  stats: PromoCodeStats = emptyStats()
): PromoCode => ({
  code: stringOr(data.code) || id,
  partnerName: stringOr(data.partnerName),
  note: stringOr(data.note),
  bonusDays: Number.isInteger(data.bonusDays) ? data.bonusDays : PROMO_BONUS_DAYS_DEFAULT,
  isActive: data.isActive === true,
  createdAt: toIsoString(data.createdAt),
  updatedAt: toIsoString(data.updatedAt),
  stats,
});

export const toPromoUsage = (id: string, data: Record<string, any>): PromoUsage => ({
  id,
  code: stringOr(data.code),
  userId: stringOr(data.userId),
  userName: stringOr(data.userName),
  amount: numberOr(data.amount, 0),
  bonusDays: numberOr(data.bonusDays, 0),
  planName: stringOr(data.planName),
  createdAt: toIsoString(data.createdAt),
});

/** URL дахь кодыг цэгцэлж шалгана. Буруу бол 400. */
export function parseCodeParam(raw: string): string {
  const code = normalizePromoCode(raw);
  if (!isValidPromoCode(code)) {
    throw new PromoApiError(400, PROMO_CODE_FORMAT_MESSAGE);
  }
  return code;
}

type Accumulator = {
  purchases: number;
  users: Set<string>;
  totalAmount: number;
  bonusDaysGiven: number;
  lastUsedAt: string | null;
};

/**
 * Бүх промо код + код бүрийн статистик + нийт дүн.
 * Статистикийг ашиглалтын бүртгэлээс (promoUsages) шууд тооцдог тул тоо хэзээ ч зөрөхгүй.
 * Зөвхөн 5 талбарыг (code, userId, amount, bonusDays, createdAt) уншина.
 */
export async function loadPromoCodesWithStats(): Promise<PromoCodesResponse> {
  const [codesSnapshot, usageSnapshot] = await Promise.all([
    promoCodesCollection().get(),
    promoUsagesCollection()
      .select("code", "userId", "amount", "bonusDays", "createdAt")
      .limit(USAGE_SCAN_LIMIT)
      .get(),
  ]);

  const perCode = new Map<string, Accumulator>();
  const allUsers = new Set<string>();
  let purchases = 0;
  let totalAmount = 0;
  let bonusDaysGiven = 0;

  for (const doc of usageSnapshot.docs) {
    const data = doc.data();
    const code = stringOr(data.code).toUpperCase();
    const userId = stringOr(data.userId);
    const amount = numberOr(data.amount, 0);
    const bonus = numberOr(data.bonusDays, 0);
    const createdAt = toIsoString(data.createdAt);

    purchases += 1;
    totalAmount += amount;
    bonusDaysGiven += bonus;
    if (userId) allUsers.add(userId);

    let acc = perCode.get(code);
    if (!acc) {
      acc = { purchases: 0, users: new Set(), totalAmount: 0, bonusDaysGiven: 0, lastUsedAt: null };
      perCode.set(code, acc);
    }

    acc.purchases += 1;
    acc.totalAmount += amount;
    acc.bonusDaysGiven += bonus;
    if (userId) acc.users.add(userId);
    if (createdAt && (!acc.lastUsedAt || createdAt > acc.lastUsedAt)) acc.lastUsedAt = createdAt;
  }

  const data = codesSnapshot.docs
    .map((doc) => {
      const acc = perCode.get(doc.id.toUpperCase());
      const stats: PromoCodeStats = acc
        ? {
            purchases: acc.purchases,
            uniqueUsers: acc.users.size,
            totalAmount: acc.totalAmount,
            bonusDaysGiven: acc.bonusDaysGiven,
            lastUsedAt: acc.lastUsedAt,
          }
        : emptyStats();
      return toPromoCode(doc.id, doc.data(), stats);
    })
    // Шинэ үүсгэсэн нь эхэнд
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return {
    data,
    summary: {
      purchases,
      uniqueUsers: allUsers.size,
      totalAmount,
      bonusDaysGiven,
      truncated: usageSnapshot.size >= USAGE_SCAN_LIMIT,
    },
  };
}

/**
 * Ашиглалтын түүх, хамгийн сүүлийнх нь эхэнд.
 * `code` өгвөл зөвхөн тэр кодынх. (where + orderBy хослуулахад Firestore-д тусгай index шаардлагатай тул
 * код сонгосон үед баримтуудыг уншаад дарааллыг нь энд өөрөө эрэмбэлдэг.)
 */
export async function loadPromoUsages(options: { code?: string; limit: number }): Promise<PromoUsagesResponse> {
  const { code, limit } = options;
  let rows: PromoUsage[];

  if (code) {
    const snapshot = await promoUsagesCollection()
      .where("code", "==", code)
      .limit(USAGE_CODE_FETCH_LIMIT)
      .get();

    rows = snapshot.docs
      .map((doc) => toPromoUsage(doc.id, doc.data()))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  } else {
    // Нэгийг илүү авч, "цааш бий юу" гэдгийг мэднэ
    const snapshot = await promoUsagesCollection().orderBy("createdAt", "desc").limit(limit + 1).get();
    rows = snapshot.docs.map((doc) => toPromoUsage(doc.id, doc.data()));
  }

  return { data: rows.slice(0, limit), hasMore: rows.length > limit };
}

// Ашиглалтын бичлэгийн ID = клиент сайтын төлбөрийн нэхэмжлэхийн ID (QPay-ийн UUID г.м.).
// Firestore-ийн замыг эвдэх тэмдэгт (/ г.м.) оруулахгүй.
const USAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** URL дахь ашиглалтын бичлэгийн ID-г шалгана. Буруу бол 400. */
export function parseUsageIdParam(raw: string): string {
  const id = raw.trim();
  if (!USAGE_ID_PATTERN.test(id)) {
    throw new PromoApiError(400, "Ашиглалтын бүртгэлийн ID буруу байна");
  }
  return id;
}

/**
 * Ашиглалтын нэг бичлэгийг устгана (жишээ нь туршилтын төлбөр). Олдохгүй бол 404.
 * АНХААР: зөвхөн энэ түүх болон статистикаас хасна. Хэрэглэгчийн олгогдсон эрх, төлбөрийн түүх
 * (pending_payments, payment_logs) өөрчлөгдөхгүй. Нэхэмжлэх аль хэдийн "completed" тул дахин бичигдэхгүй.
 * Устгасан бичлэгийг буцаана (аудитын лог бичихэд).
 */
export async function deletePromoUsage(id: string): Promise<PromoUsage> {
  const reference = promoUsagesCollection().doc(id);
  const snapshot = await reference.get();

  if (!snapshot.exists) {
    throw new PromoApiError(404, "Ашиглалтын бүртгэл олдсонгүй");
  }

  const usage = toPromoUsage(snapshot.id, snapshot.data() ?? {});
  await reference.delete();
  return usage;
}

// Нэг удаад устгах бичлэгийн дээд хязгаар (Firestore-ийн нэг batch 500 үйлдэл)
export const USAGE_BULK_DELETE_MAX = 500;

/** Олноор устгах хүсэлтийн `ids`-г шалгана (давхардлыг хасна). Буруу бол 400. */
export function parseUsageIds(body: unknown): string[] {
  const raw = (body as { ids?: unknown } | null)?.ids;

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new PromoApiError(400, "Устгах бичлэгээ сонгоно уу");
  }
  if (raw.length > USAGE_BULK_DELETE_MAX) {
    throw new PromoApiError(400, `Нэг удаад дээд тал нь ${USAGE_BULK_DELETE_MAX} бичлэг устгана`);
  }

  const ids = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") {
      throw new PromoApiError(400, "Ашиглалтын бүртгэлийн ID буруу байна");
    }
    ids.add(parseUsageIdParam(item));
  }
  return [...ids];
}

/**
 * Ашиглалтын олон бичлэгийг НЭГ batch-ээр устгана: бүгд устах эсвэл огт устахгүй.
 * Аль хэдийн устсан (олдоогүй) ID-г чимээгүй алгасна. Бүгд олдохгүй бол 404.
 * Хэрэглэгчийн олгогдсон эрх, төлбөрийн түүхэд хөндөхгүй (deletePromoUsage-тэй адил).
 * Устгасан бичлэгүүдийг буцаана (аудитын лог бичихэд).
 */
export async function deletePromoUsages(ids: string[]): Promise<PromoUsage[]> {
  const references = ids.map((id) => promoUsagesCollection().doc(id));
  const snapshots = await firestore.getAll(...references);
  const existing = snapshots.filter((snapshot) => snapshot.exists);

  if (existing.length === 0) {
    throw new PromoApiError(404, "Ашиглалтын бүртгэл олдсонгүй");
  }

  const batch = firestore.batch();
  for (const snapshot of existing) batch.delete(snapshot.ref);
  await batch.commit();

  return existing.map((snapshot) => toPromoUsage(snapshot.id, snapshot.data() ?? {}));
}

/** Энэ кодоор ядаж нэг удаа худалдан авалт хийгдсэн эсэх */
export async function promoCodeHasUsages(code: string): Promise<boolean> {
  const snapshot = await promoUsagesCollection().where("code", "==", code).limit(1).get();
  return snapshot.size > 0;
}

export function handlePromoError(error: unknown, context: string) {
  if (error instanceof PromoApiError || error instanceof NovelApiError) {
    return jsonError(error.status, error.message);
  }

  const code = (error as { code?: unknown } | null)?.code;
  if (code === 5 || code === "not-found") return jsonError(404, "Промо код олдсонгүй");
  if (code === 6 || code === "already-exists") return jsonError(409, "Энэ код аль хэдийн байна");

  console.error(`${context}:`, error);
  return jsonError(500, "Серверийн алдаа гарлаа");
}