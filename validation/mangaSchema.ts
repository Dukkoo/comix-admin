import { z } from "zod";

export const mangaGenreEnum = z.enum([
  "action",
  "adventure",
  "comedy",
  "romance",
  "horror",
  "fantasy",
  "sci-fi",
  "mystery",
  "thriller",
  "drama",
  "sports",
  "regression",
  "system",
  "villain",
  "murim",
  "reincarnation",
  "magic",
]);

export type MangaGenre = z.infer<typeof mangaGenreEnum>;

export const GENRE_LABELS: Record<MangaGenre, string> = {
  action: "Тулаант",
  adventure: "Адал явдалт",
  comedy: "Инээдмийн",
  romance: "Романс",
  horror: "Аймшиг",
  fantasy: "Фантази",
  "sci-fi": "Шинжлэх ухааны",
  mystery: "Нууцлаг",
  thriller: "Триллер",
  drama: "Драма",
  sports: "Спорт",
  regression: "Регресс",
  system: "Систем",
  villain: "Хорон санаатан",
  murim: "Мурим",
  reincarnation: "Дахин төрөлт",
  magic: "Ид шид",
};

export const mangaSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon", "comic"], {
    required_error: "Type is required",
  }),
  status: z
    .enum(["ongoing", "finished"], {
      required_error: "Status is required",
    })
    .default("ongoing"),
  genres: z
    .array(mangaGenreEnum)
    .min(1, "At least one genre is required")
    .max(5, "Maximum 5 genres allowed"),
  coverImage: z.string().optional(),
  mangaImage: z.string().optional(),
  avatarImage: z.string().optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
});

export const mangaDataSchema = z.object({
  id: z.string().min(1, "ID is required"),
  title: z.string().min(1, "Title is required"),
  type: z.enum(["manga", "manhwa", "manhua", "webtoon", "comic"], {
    required_error: "Type is required",
  }),
  status: z
    .enum(["ongoing", "finished"], {
      required_error: "Status is required",
    })
    .default("ongoing"),
  genres: z.array(mangaGenreEnum).optional(),
  coverImage: z.string().optional(),
  mangaImage: z.string().optional(),
  avatarImage: z.string().optional(),
  description: z.string().optional(),
  chapters: z.number().min(0).optional(),
});

export type MangaFormData = z.infer<typeof mangaSchema>;
export type MangaData = z.infer<typeof mangaDataSchema>;