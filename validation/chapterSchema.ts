import { z } from "zod";

export const chapterSchema = z.object({
  chapterNumber: z.number().min(0, "Chapter number must be at least 0"),
  mangaId: z.string().min(1, "Manga ID is required"),
});

export const chapterDataSchema = chapterSchema.extend({
  id: z.string().optional(), // Will be the same as chapterNumber
});

export type ChapterFormData = z.infer<typeof chapterSchema>;
export type ChapterData = z.infer<typeof chapterDataSchema>;

