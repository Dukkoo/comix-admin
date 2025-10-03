import { z } from "zod";

export const mangaSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon", "comic"], {
    required_error: "Type is required",
  }),
  status: z.enum(["ongoing", "finished"], {
    required_error: "Status is required",
  }).default("ongoing"),
  coverImage: z.string().optional(),
  mangaImage: z.string().optional(),
  avatarImage: z.string().optional(), // Added this field
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
});

export const mangaDataSchema = z.object({
  id: z.string().min(1, "ID is required"),
  title: z.string().min(1, "Title is required"),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon", "comic"], {
    required_error: "Type is required",
  }),
  status: z.enum(["ongoing", "finished"], {
    required_error: "Status is required",
  }).default("ongoing"),
  coverImage: z.string().optional(),
  mangaImage: z.string().optional(),
  avatarImage: z.string().optional(), // Added this field
  description: z.string().optional(),
  chapters: z.number().min(0).optional(),
});

export type MangaFormData = z.infer<typeof mangaSchema>;
export type MangaData = z.infer<typeof mangaDataSchema>;