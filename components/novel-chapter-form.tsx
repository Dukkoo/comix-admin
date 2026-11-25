// components/novel-chapter-form.tsx
// Novel бүлэг нэмэх БОЛОН засах нэг форм (зөвхөн текст, зураггүй).
// "Харагдах байдал" tab нь клиент сайтын reader-т текст хэрхэн харагдахыг урьдчилан үзүүлнэ.
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Eye, Monitor, PlusCircleIcon, SaveIcon, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import {
  createNovelChapter,
  updateNovelChapter,
  type NovelChapterChanges,
} from "@/utils/novel-chapter-api";
import { NOVEL_CONTENT_MAX_LENGTH, normalizeNovelContent } from "@/validation/novelChapterSchema";

type Props = {
  mode: "create" | "edit";
  mangaId: string;
  mangaTitle: string;
  // edit горимд л хэрэгтэй
  chapterId?: string;
  initial?: {
    chapterNumber: number;
    content: string;
  };
};

type View = "write" | "preview";
type Device = "mobile" | "desktop";

const formatNumber = (value: number) => value.toLocaleString("en-US");

// Дан ганц "***", "* * *", "---", "———" гэх мэт мөр = үйл явдал тусгаарлагч
const DIVIDER_PATTERN = /^(?:[*\-—–=~_]\s*){3,}$/;

// Догол мөр бүрийн эхний мөрийн догол зай. Зөвхөн харуулалтын хэв маяг тул хадгалагдсан
// текстэд ордоггүй: дараа нь хэмжээг энд (мөн клиент дээр) нэг дор солиход болно.
const PARAGRAPH_INDENT = "2em";

/**
 * Текстийг уншигчид харуулах дүрэм (клиент сайт ЯГ ИНГЭЖ харуулна):
 *  - хоосон биш мөр бүр нэг догол мөр, догол мөр хооронд ижил зай
 *  - догол мөр бүр эхний мөрөндөө догол зайтай (text-indent: 2em) эхэлнэ
 *  - хоосон мөрүүд зай нэмэхгүй (хэн хэрхэн бичсэнээс үл хамааран хэв ижил)
 *  - "***" гэх мэт мөр голлосон тусгаарлагч болно (догол зайгүй)
 */
function NovelText({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  return (
    <>
      {lines.map((line, index) =>
        DIVIDER_PATTERN.test(line.trim()) ? (
          <div key={index} role="separator" className="my-8 text-center tracking-[0.6em] text-zinc-600">
            * * *
          </div>
        ) : (
          <p key={index} className="mb-5 break-words" style={{ textIndent: PARAGRAPH_INDENT }}>
            {line}
          </p>
        )
      )}
    </>
  );
}

function ReaderPreview({
  mangaTitle,
  chapterNumber,
  text,
  device,
}: {
  mangaTitle: string;
  chapterNumber: number | null;
  text: string;
  device: Device;
}) {
  const label = chapterNumber === null ? "Бүлэг" : `Бүлэг ${chapterNumber}`;

  return (
    <div className="flex justify-center border border-white/10 bg-black/40 p-3 sm:p-6">
      <div
        className={`w-full overflow-hidden border border-zinc-800 bg-[#0f0f12] text-zinc-200 shadow-2xl ${
          device === "mobile" ? "max-w-[390px]" : "max-w-3xl"
        }`}
      >
        {/* Reader-ийн дээд мөр */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <span className="min-w-0 truncate text-sm font-semibold text-zinc-300">{mangaTitle}</span>
          <span className="shrink-0 pl-3 text-sm text-cyan-400">{label}</span>
        </div>

        {/* Текст */}
        <article className={`py-8 text-[17px] leading-8 ${device === "mobile" ? "px-5" : "px-10"}`}>
          <h2 className="mb-8 text-center text-xl font-bold text-white">{label}</h2>
          {text ? (
            <NovelText text={text} />
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">Текст оруулсны дараа энд харагдана</p>
          )}
        </article>

        {/* Өмнөх / Дараах */}
        <div className="flex justify-between border-t border-zinc-800 px-5 py-4 text-sm">
          <span className="border border-zinc-700 bg-zinc-800 px-4 py-2 text-zinc-400">Өмнөх</span>
          <span className="border border-zinc-700 bg-zinc-800 px-4 py-2 text-zinc-400">Дараах</span>
        </div>
      </div>
    </div>
  );
}

export default function NovelChapterForm({ mode, mangaId, mangaTitle, chapterId, initial }: Props) {
  const auth = useAuth();
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(chapterId) && Boolean(initial);

  const [loading, setLoading] = useState(false);
  const [chapterNumber, setChapterNumber] = useState<string>(initial ? String(initial.chapterNumber) : "");
  const [content, setContent] = useState<string>(initial?.content ?? "");
  const [view, setView] = useState<View>("write");
  const [device, setDevice] = useState<Device>("mobile");

  const listUrl = `/projects/chapters/${mangaId}?type=novel`;

  const handleChapterNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === "" || /^\d+$/.test(value)) {
      setChapterNumber(value);
    }
  };

  const parsedNumber = parseInt(chapterNumber, 10);
  const numberValid = chapterNumber !== "" && !isNaN(parsedNumber) && parsedNumber >= 0;

  // Сервер хадгалах текстийг яг ингэж цэгцэлдэг тул тоо болон preview-г үүгээр нь харуулна
  const normalizedContent = useMemo(() => normalizeNovelContent(content), [content]);
  const charCount = normalizedContent.length;
  const paragraphCount = useMemo(
    () => normalizedContent.split("\n").filter((line) => line.trim().length > 0).length,
    [normalizedContent]
  );
  const tooLong = charCount > NOVEL_CONTENT_MAX_LENGTH;

  const numberChanged = isEdit && numberValid && parsedNumber !== initial!.chapterNumber;
  const contentChanged = isEdit && normalizedContent !== initial!.content;
  const hasChanges = numberChanged || contentChanged;

  const canSubmit = !loading && numberValid && charCount > 0 && !tooLong && (isEdit ? hasChanges : true);

  // Урт текстийг санамсаргүйгээр алдахаас сэргийлнэ (tab хаах / refresh хийх үед)
  const dirty = isEdit ? hasChanges : content.trim() !== "";
  useEffect(() => {
    if (!dirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numberValid) {
      toast.error("Бүлгийн дугаар оруулна уу (0-с эхлэх боломжтой)");
      return;
    }

    if (charCount === 0) {
      toast.error("Зохиолын текст оруулна уу");
      return;
    }

    if (tooLong) {
      toast.error(`Текст хэт урт байна (дээд тал нь ${formatNumber(NOVEL_CONTENT_MAX_LENGTH)} тэмдэгт)`);
      return;
    }

    if (isEdit && !hasChanges) {
      toast.info("Өөрчлөлт алга байна");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(isEdit ? "Хадгалж байна..." : "Бүлэг үүсгэж байна...");

    try {
      const token = await auth?.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна", { id: toastId });
        return;
      }

      let response;

      if (isEdit && chapterId) {
        // Зөвхөн өөрчлөгдсөн талбаруудыг илгээнэ
        const changes: NovelChapterChanges = {};
        if (numberChanged) changes.chapterNumber = parsedNumber;
        if (contentChanged) changes.content = normalizedContent;

        response = await updateNovelChapter(mangaId, chapterId, changes, token);
      } else {
        response = await createNovelChapter(
          mangaId,
          { chapterNumber: parsedNumber, content: normalizedContent },
          token
        );
      }

      if (response.error) {
        toast.error(isEdit ? "Хадгалж чадсангүй" : "Бүлэг үүсгэж чадсангүй", {
          id: toastId,
          description: response.message,
        });
        return;
      }

      toast.success(isEdit ? "Хадгалагдлаа" : "Novel бүлэг нэмэгдлээ", {
        id: toastId,
        description: `Бүлэг ${parsedNumber}, ${formatNumber(charCount)} тэмдэгт`,
      });

      router.push(listUrl);
    } catch (error) {
      console.error("Error saving novel chapter:", error);
      toast.error("Алдаа гарлаа", {
        id: toastId,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: View; label: string; Icon: typeof Edit2 }[] = [
    { id: "write", label: "Бичих", Icon: Edit2 },
    { id: "preview", label: "Харагдах байдал", Icon: Eye },
  ];

  const devices: { id: Device; label: string; Icon: typeof Smartphone }[] = [
    { id: "mobile", label: "Утас", Icon: Smartphone },
    { id: "desktop", label: "Компьютер", Icon: Monitor },
  ];

  const segmentClass = (active: boolean) =>
    `flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-[#8b6cff]/70 bg-[#8b6cff]/20 text-white"
        : "border-transparent text-zinc-400 hover:text-white"
    }`;

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10 mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={listUrl} aria-label="Буцах" className="cyber-btn p-2.5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-white">
              {isEdit ? "Novel бүлэг засварлах" : "Шинэ novel бүлэг"}
            </h1>
            <p className="truncate text-sm text-zinc-400" title={mangaTitle}>
              {mangaTitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* fieldset disabled: хадгалж байх үед бүх талбар, товчийг хаана */}
          <fieldset
            disabled={loading}
            className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:grid-cols-[280px_minmax(0,1fr)]"
          >
            {/* Зүүн: дугаар, тоо, хадгалах. Урт текстийн үед ч товч харагдсан хэвээр */}
            <div className="cyber-panel space-y-5 p-5 lg:sticky lg:top-6 lg:self-start">
              <div className="space-y-2">
                <label htmlFor="novelChapterNumber" className="text-sm font-medium text-zinc-300">
                  Бүлгийн дугаар
                </label>
                <input
                  id="novelChapterNumber"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={chapterNumber}
                  onChange={handleChapterNumberChange}
                  required
                  className="font-display w-full border border-white/10 bg-black/30 px-3 py-3 text-2xl font-bold tabular-nums text-[#8b6cff] focus:border-[#8b6cff]/60 focus:outline-none focus:ring-1 focus:ring-[#8b6cff]/40 disabled:opacity-50"
                />
                {numberChanged && (
                  <p className="font-display text-sm tabular-nums text-[#ffd23f]">
                    {initial!.chapterNumber} → {parsedNumber}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="cyber-panel cyber-stat px-3 py-2" style={{ "--accent": "#8b6cff" } as CSSProperties}>
                  <p className="text-xs text-zinc-400">Тэмдэгт</p>
                  <p
                    className={`cyber-glow font-display text-xl font-bold tabular-nums ${
                      tooLong ? "text-[#ff2e88]" : ""
                    }`}
                  >
                    {formatNumber(charCount)}
                  </p>
                </div>
                <div className="cyber-panel cyber-stat px-3 py-2">
                  <p className="text-xs text-zinc-400">Догол мөр</p>
                  <p className="cyber-glow font-display text-xl font-bold tabular-nums">
                    {formatNumber(paragraphCount)}
                  </p>
                </div>
              </div>

              <p className={`text-xs ${tooLong ? "text-[#ff2e88]" : "text-zinc-500"}`}>
                Дээд хэмжээ: {formatNumber(NOVEL_CONTENT_MAX_LENGTH)} тэмдэгт
              </p>

              <button
                type="submit"
                disabled={!canSubmit}
                className="cyber-btn flex w-full items-center justify-center gap-2 px-6 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: "rgba(139,108,255,0.7)", backgroundColor: "rgba(139,108,255,0.2)" }}
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#8b6cff] border-b-transparent" />
                    {isEdit ? "Хадгалж байна..." : "Нэмж байна..."}
                  </>
                ) : isEdit ? (
                  <>
                    <SaveIcon className="h-5 w-5" />
                    Хадгалах
                  </>
                ) : (
                  <>
                    <PlusCircleIcon className="h-5 w-5" />
                    Бүлэг нэмэх
                  </>
                )}
              </button>
            </div>

            {/* Баруун: бичих / харагдах байдал */}
            <div className="cyber-panel space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="tablist" aria-label="Харагдац" className="flex gap-0.5 border border-white/15 bg-black/30 p-0.5">
                  {tabs.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={view === id}
                      onClick={() => setView(id)}
                      className={segmentClass(view === id)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {view === "preview" && (
                  <div role="group" aria-label="Төхөөрөмж" className="flex gap-0.5 border border-white/15 bg-black/30 p-0.5">
                    {devices.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={device === id}
                        onClick={() => setDevice(id)}
                        className={segmentClass(device === id)}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* textarea үргэлж байрлана (preview-аас буцахад курсор, scroll алдагдахгүй) */}
              <textarea
                id="novelContent"
                aria-label="Зохиолын текст"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                placeholder="Бүлгийн текстээ энд буулгана уу. Догол мөр бүрийг шинэ мөрөөр салгана."
                className={`cyber-scroll min-h-[60vh] w-full resize-y border bg-black/30 p-4 text-[15px] leading-7 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 disabled:opacity-50 ${
                  view === "write" ? "" : "hidden"
                } ${
                  tooLong
                    ? "border-[#ff2e88]/60 focus:border-[#ff2e88]/70 focus:ring-[#ff2e88]/40"
                    : "border-white/10 focus:border-[#8b6cff]/60 focus:ring-[#8b6cff]/40"
                }`}
              />

              {view === "preview" && (
                <div className="space-y-2">
                  <ReaderPreview
                    mangaTitle={mangaTitle}
                    chapterNumber={numberValid ? parsedNumber : null}
                    text={normalizedContent}
                    device={device}
                  />
                  <p className="text-xs text-zinc-500">
                    Клиент сайтад ингэж харагдана. Шинэ мөр бүр догол зайтай шинэ догол мөр болно. <span className="text-zinc-400">***</span>{" "}
                    гэж бичсэн мөр тусгаарлагч болно.
                  </p>
                </div>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}