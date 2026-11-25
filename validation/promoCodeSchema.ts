// validation/promoCodeSchema.ts
// Промо кодын шалгалт. Админ сайтын форм болон API хоёулаа адил ашиглана
// (дараа нь клиент сайт кодыг шалгахдаа ижил дүрмээр цэгцэлнэ).
import { z } from "zod";

export const PROMO_CODE_MIN_LENGTH = 3;
export const PROMO_CODE_MAX_LENGTH = 24;
export const PROMO_PARTNER_NAME_MAX = 80;
export const PROMO_NOTE_MAX = 200;
export const PROMO_BONUS_DAYS_DEFAULT = 3;
export const PROMO_BONUS_DAYS_MAX = 365;

// Том латин үсэг, тоо. Дундаа "-" эсвэл "_" байж болно, гэхдээ эхлэх/төгсөх тэмдэгт нь үсэг эсвэл тоо.
// Урт: 3-24 тэмдэгт. Кирилл үсэг зөвшөөрөхгүй (латин А/Α-тай андуурагдахаас сэргийлнэ).
export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,22}[A-Z0-9]$/;

/** Хэрэглэгчийн бичсэн кодыг цэгцэлнэ: захын зайг хасаад том үсэг болгоно. Баримтын ID нь энэ утга. */
export const normalizePromoCode = (input: string): string => input.trim().toUpperCase();

export const isValidPromoCode = (code: string): boolean => PROMO_CODE_PATTERN.test(code);

export const PROMO_CODE_FORMAT_MESSAGE = `Код ${PROMO_CODE_MIN_LENGTH}-${PROMO_CODE_MAX_LENGTH} тэмдэгт байх ба зөвхөн A-Z, 0-9, "-" эсвэл "_" агуулна`;

const codeSchema = z
  .string({ required_error: "Кодыг оруулна уу", invalid_type_error: "Код буруу байна" })
  .transform(normalizePromoCode)
  .refine(isValidPromoCode, PROMO_CODE_FORMAT_MESSAGE);

const partnerNameSchema = z
  .string({ required_error: "Хамтрагчийн нэрийг оруулна уу", invalid_type_error: "Хамтрагчийн нэр буруу байна" })
  .trim()
  .min(1, "Хамтрагчийн нэрийг оруулна уу")
  .max(PROMO_PARTNER_NAME_MAX, `Хамтрагчийн нэр ${PROMO_PARTNER_NAME_MAX} тэмдэгтээс хэтрэхгүй`);

const bonusDaysSchema = z
  .number({ invalid_type_error: "Нэмэлт хоног тоо байх ёстой" })
  .int("Нэмэлт хоног бүхэл тоо байх ёстой")
  .min(0, "Нэмэлт хоног 0-с бага байж болохгүй")
  .max(PROMO_BONUS_DAYS_MAX, `Нэмэлт хоног ${PROMO_BONUS_DAYS_MAX}-аас их байж болохгүй`);

const noteSchema = z
  .string({ invalid_type_error: "Тэмдэглэл буруу байна" })
  .trim()
  .max(PROMO_NOTE_MAX, `Тэмдэглэл ${PROMO_NOTE_MAX} тэмдэгтээс хэтрэхгүй`);

export const promoCodeCreateSchema = z.object({
  code: codeSchema,
  partnerName: partnerNameSchema,
  bonusDays: bonusDaysSchema.default(PROMO_BONUS_DAYS_DEFAULT),
  note: noteSchema.optional(),
});

// Код өөрөө (баримтын ID) хэзээ ч солигдохгүй. Засахад бусад талбар сонголттой, гэхдээ ядаж нэг нь байх ёстой.
export const promoCodeUpdateSchema = z
  .object({
    partnerName: partnerNameSchema.optional(),
    bonusDays: bonusDaysSchema.optional(),
    note: noteSchema.optional(),
    isActive: z.boolean({ invalid_type_error: "Төлөв буруу байна" }).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Өөрчлөх талбар байхгүй байна",
  });

export type PromoCodeCreateInput = z.infer<typeof promoCodeCreateSchema>;
export type PromoCodeUpdateInput = z.infer<typeof promoCodeUpdateSchema>;