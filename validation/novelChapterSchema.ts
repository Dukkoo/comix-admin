// validation/novelChapterSchema.ts
import { z } from "zod";

// Нэг бүлгийн текстийн дээд хэмжээ. Кирилл үсэг UTF-8-д 2 байт тул 150,000 тэмдэгт ≈ 300KB,
// Firestore-ын 1MiB-ийн документийн хязгаараас хол доогуур.
export const NOVEL_CONTENT_MAX_LENGTH = 150_000;
export const NOVEL_CHAPTER_NUMBER_MAX = 99_999;

// Үл үзэгдэх тэмдэгтүүд: BOM, zero-width space / non-joiner / joiner, word joiner.
// (Тэмдэгтийг код дотор шууд бичихгүй, кодоор үүсгэнэ: хуулах/буулгахад алдагддаггүй байхын тулд)
const INVISIBLE_CHARS = new RegExp(
  "[" + String.fromCharCode(0xfeff, 0x200b, 0x200c, 0x200d, 0x2060) + "]",
  "g"
);
// Мөр бүрийн төгсгөлд байх зай, tab, NBSP (0xa0)
const TRAILING_SPACES = new RegExp("[ " + String.fromCharCode(0x09, 0xa0) + "]+$", "gm");

/**
 * Хадгалахын өмнө текстийг цэгцэлнэ (форм болон сервер хоёулаа адил ашиглана):
 *  - Windows мөр таслалт (\r\n) -> \n
 *  - Word/Docs-оос хуулахад орж ирдэг үл үзэгдэх тэмдэгтүүдийг (BOM, zero-width) хасна
 *  - мөр бүрийн төгсгөлийн зайг хасна
 *  - 2-оос олон хоосон мөрийг 1 хоосон мөр болгоно
 *  - эхний/сүүлийн хоосон зайг хасна
 */
export const normalizeNovelContent = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE_CHARS, "")
    .replace(TRAILING_SPACES, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const chapterNumberSchema = z
  .number()
  .int("Бүлгийн дугаар бүхэл тоо байх ёстой")
  .min(0, "Бүлгийн дугаар 0-с бага байж болохгүй")
  .max(NOVEL_CHAPTER_NUMBER_MAX, `Бүлгийн дугаар ${NOVEL_CHAPTER_NUMBER_MAX}-аас их байж болохгүй`);

const contentSchema = z
  .string()
  .transform(normalizeNovelContent)
  .refine((value) => value.length > 0, "Зохиолын текст хоосон байна")
  .refine(
    (value) => value.length <= NOVEL_CONTENT_MAX_LENGTH,
    `Текст хэт урт байна (дээд тал нь ${NOVEL_CONTENT_MAX_LENGTH.toLocaleString("en-US")} тэмдэгт)`
  );

export const novelChapterCreateSchema = z.object({
  chapterNumber: chapterNumberSchema,
  content: contentSchema,
  isFree: z.boolean().optional(),
});

// Засахад бүх талбар сонголттой, гэхдээ ядаж нэг нь байх ёстой
export const novelChapterUpdateSchema = z
  .object({
    chapterNumber: chapterNumberSchema.optional(),
    content: contentSchema.optional(),
    isFree: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "Өөрчлөх талбар өгөөгүй байна"
  );

export type NovelChapterCreateInput = z.infer<typeof novelChapterCreateSchema>;
export type NovelChapterUpdateInput = z.infer<typeof novelChapterUpdateSchema>;