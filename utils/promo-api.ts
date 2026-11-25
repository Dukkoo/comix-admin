// utils/promo-api.ts
// Админ сайтын браузер талаас промо кодын API-г дуудах туслахууд, мөн төрлүүд.
// АНХААР: энэ файлыг серверийн lib/promo-codes.ts ч (type-only) ашигладаг тул firebase-admin импортлохгүй.

export type PromoCodeStats = {
  /** Энэ кодоор хийсэн худалдан авалтын тоо */
  purchases: number;
  /** Энэ кодыг ашигласан өөр өөр хэрэглэгчийн тоо */
  uniqueUsers: number;
  /** Нийт төлсөн дүн (₮) */
  totalAmount: number;
  /** Нийт олгосон нэмэлт хоног */
  bonusDaysGiven: number;
  lastUsedAt: string | null;
};

export type PromoCode = {
  code: string;
  partnerName: string;
  note: string;
  bonusDays: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  stats: PromoCodeStats;
};

export type PromoSummary = {
  purchases: number;
  uniqueUsers: number;
  totalAmount: number;
  bonusDaysGiven: number;
  /** Ашиглалтын бүртгэл хэт олон тул тоо бүрэн биш (хязгаарт хүрсэн) */
  truncated: boolean;
};

export type PromoUsage = {
  id: string;
  code: string;
  userId: string;
  userName: string;
  amount: number;
  bonusDays: number;
  planName: string;
  createdAt: string | null;
};

export type PromoCodesResponse = {
  data: PromoCode[];
  summary: PromoSummary;
};

export type PromoUsagesResponse = {
  data: PromoUsage[];
  hasMore: boolean;
};

export type PromoApiResult = {
  error: boolean;
  message: string;
  data?: PromoCode;
};

export type PromoCreateInput = {
  code: string;
  partnerName: string;
  bonusDays: number;
  note?: string;
};

export type PromoUpdateInput = {
  partnerName?: string;
  bonusDays?: number;
  note?: string;
  isActive?: boolean;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

const messageOf = (json: Record<string, unknown>, fallback: string) =>
  typeof json.message === "string" && json.message ? json.message : fallback;

async function getJson<T>(url: string, token: string, failMessage: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({} as Record<string, unknown>));

  if (!response.ok || json.error) {
    throw new Error(messageOf(json, `${failMessage} (${response.status})`));
  }

  return json as T;
}

async function send(url: string, init: RequestInit): Promise<PromoApiResult> {
  try {
    const response = await fetch(url, init);
    const json = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok || json.error) {
      return { error: true, message: messageOf(json, `Алдаа гарлаа (${response.status})`) };
    }

    return {
      error: false,
      message: messageOf(json, "OK"),
      data: (json.data as PromoCode | undefined) ?? undefined,
    };
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Сүлжээний алдаа гарлаа",
    };
  }
}

/** Бүх промо код + код бүрийн статистик + нийт дүн. Алдаа гарвал throw хийнэ. */
export const fetchPromoCodes = (token: string) =>
  getJson<PromoCodesResponse>("/api/promo-codes", token, "Промо кодуудыг ачаалж чадсангүй");

/** Ашиглалтын түүх (хамгийн сүүлийнх нь эхэнд). `code` өгвөл зөвхөн тэр кодынх. */
export function fetchPromoUsages(token: string, options: { code?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.code) params.set("code", options.code);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();

  return getJson<PromoUsagesResponse>(
    `/api/promo-usages${query ? `?${query}` : ""}`,
    token,
    "Ашиглалтын түүхийг ачаалж чадсангүй"
  );
}

export const createPromoCode = (input: PromoCreateInput, token: string) =>
  send("/api/promo-codes", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

export const updatePromoCode = (code: string, changes: PromoUpdateInput, token: string) =>
  send(`/api/promo-codes/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(changes),
  });

/** Ашиглалтын нэг бичлэгийг (түүх + статистикаас) устгана. Хэрэглэгчийн эрх өөрчлөгдөхгүй. */
export const deletePromoUsage = (id: string, token: string) =>
  send(`/api/promo-usages/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

/** Ашиглалтын олон бичлэгийг нэг дор устгана (нэг batch: бүгд эсвэл огт). Хэрэглэгчийн эрх өөрчлөгдөхгүй. */
export const deletePromoUsages = (ids: string[], token: string) =>
  send("/api/promo-usages/bulk-delete", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });

export const deletePromoCode = (code: string, token: string) =>
  send(`/api/promo-codes/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });