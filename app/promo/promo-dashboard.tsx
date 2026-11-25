// app/promo/promo-dashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Check, Copy, Edit2, History, Plus, Power, RefreshCw, Search, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/app/providers";
import {
  createPromoCode,
  deletePromoCode,
  deletePromoUsage,
  deletePromoUsages,
  fetchPromoCodes,
  fetchPromoUsages,
  updatePromoCode,
  type PromoCode,
  type PromoSummary,
  type PromoUpdateInput,
  type PromoUsage,
} from "@/utils/promo-api";
import {
  PROMO_BONUS_DAYS_DEFAULT,
  PROMO_BONUS_DAYS_MAX,
  PROMO_CODE_MAX_LENGTH,
  PROMO_NOTE_MAX,
  PROMO_PARTNER_NAME_MAX,
  promoCodeCreateSchema,
} from "@/validation/promoCodeSchema";

const USAGE_PAGE_SIZE = 50;

// Андуурагддаг тэмдэгтгүй (0/O, 1/I/L байхгүй) тул утсаар уншиж хэлэхэд амар
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

type FormState = {
  code: string;
  partnerName: string;
  bonusDays: string;
  note: string;
};

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; promo: PromoCode }
  | { kind: "delete"; promo: PromoCode }
  | { kind: "deleteUsage"; usage: PromoUsage }
  | { kind: "deleteUsages" }
  | null;

const emptyForm = (): FormState => ({
  code: "",
  partnerName: "",
  bonusDays: String(PROMO_BONUS_DAYS_DEFAULT),
  note: "",
});

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatMoney = (value: number) => `${formatNumber(value)}₮`;

const pad = (value: number) => String(value).padStart(2, "0");
const formatDateTime = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function generateCode(length = 8): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

const inputClass =
  "w-full border border-white/10 bg-black/30 px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-[#8b6cff]/60 focus:outline-none focus:ring-1 focus:ring-[#8b6cff]/40 disabled:opacity-50";

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="cyber-panel cyber-stat px-4 py-3" style={{ "--accent": accent } as CSSProperties}>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="cyber-glow font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-white/10 bg-black/25 px-2 py-1.5">
      <p className="truncate text-[10px] text-zinc-500">{label}</p>
      <p className="truncate font-display text-sm font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

export default function PromoDashboard() {
  const auth = useAuth();
  // callback-ууд тогтвортой байхын тулд auth-ыг ref-д хадгална
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [summary, setSummary] = useState<PromoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // Эхний ачаалалт дуустал бүтэн дэлгэцийн spinner. Дараа нь "Шинэчлэх" дарахад хуудас анивчихгүй.
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [usages, setUsages] = useState<PromoUsage[]>([]);
  const [usageHasMore, setUsageHasMore] = useState(false);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageCode, setUsageCode] = useState("");
  const [usageLimit, setUsageLimit] = useState(USAGE_PAGE_SIZE);
  const usageRequestId = useRef(0);
  const usageRef = useRef<HTMLElement>(null);
  // Олноор устгахад сонгосон бичлэгүүдийн ID. Shift дарж сонговол сүүлд дарсан мөрөөс хүртэлх мөрүүдийг сонгоно.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lastToggledIndex = useRef<number | null>(null);

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = useCallback(async () => {
    const token = await authRef.current?.currentUser?.getIdToken();
    if (!token) throw new Error("Нэвтрээгүй байна");
    return token;
  }, []);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await fetchPromoCodes(await getToken());
      setCodes(result.data);
      setSummary(result.summary);
    } catch (error) {
      console.error("Error loading promo codes:", error);
      setLoadError(error instanceof Error ? error.message : "Промо кодуудыг ачаалж чадсангүй");
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [getToken]);

  const loadUsages = useCallback(
    async (code: string, limit: number) => {
      // Хурдан солих үед хоцорч ирсэн хуучин хариу шинийг дарахаас сэргийлнэ
      const requestId = ++usageRequestId.current;
      setUsageLoading(true);
      setUsageError(null);

      try {
        const result = await fetchPromoUsages(await getToken(), { code: code || undefined, limit });
        if (requestId !== usageRequestId.current) return;
        setUsages(result.data);
        setUsageHasMore(result.hasMore);
        // Жагсаалтад байхаа больсон (устсан/шүүлтүүрээс гарсан) бичлэгийг сонголтоос хасна
        const visibleIds = new Set(result.data.map((usage) => usage.id));
        setSelectedIds((prev) => {
          const next = new Set([...prev].filter((id) => visibleIds.has(id)));
          return next.size === prev.size ? prev : next;
        });
      } catch (error) {
        if (requestId !== usageRequestId.current) return;
        console.error("Error loading promo usages:", error);
        setUsageError(error instanceof Error ? error.message : "Ашиглалтын түүхийг ачаалж чадсангүй");
      } finally {
        if (requestId === usageRequestId.current) setUsageLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    loadUsages(usageCode, usageLimit);
  }, [loadUsages, usageCode, usageLimit]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const handleRefresh = () => {
    loadCodes();
    loadUsages(usageCode, usageLimit);
  };

  const activeCount = useMemo(() => codes.filter((promo) => promo.isActive).length, [codes]);

  // Сонгосон бичлэгүүд (жагсаалтын дарааллаар) ба тэдгээрийн нийлбэр
  const selectedUsages = useMemo(() => usages.filter((usage) => selectedIds.has(usage.id)), [usages, selectedIds]);
  const selectedSummary = useMemo(() => {
    const perCode = new Map<string, number>();
    let amount = 0;
    let bonusDays = 0;
    for (const usage of selectedUsages) {
      amount += usage.amount;
      bonusDays += usage.bonusDays;
      perCode.set(usage.code, (perCode.get(usage.code) ?? 0) + 1);
    }
    return { amount, bonusDays, perCode: [...perCode.entries()] };
  }, [selectedUsages]);
  const allUsagesSelected = usages.length > 0 && selectedUsages.length === usages.length;

  const visibleCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter(
      (promo) =>
        promo.code.toLowerCase().includes(q) ||
        promo.partnerName.toLowerCase().includes(q) ||
        promo.note.toLowerCase().includes(q)
    );
  }, [codes, search]);

  // ------------------------------------------------------------- dialog

  const closeDialog = () => {
    if (submitting) return;
    setDialog(null);
    setFormError(null);
  };

  const openCreate = () => {
    setForm({ ...emptyForm(), code: generateCode() });
    setFormError(null);
    setDialog({ kind: "create" });
  };

  const openEdit = (promo: PromoCode) => {
    setForm({
      code: promo.code,
      partnerName: promo.partnerName,
      bonusDays: String(promo.bonusDays),
      note: promo.note,
    });
    setFormError(null);
    setDialog({ kind: "edit", promo });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dialog || (dialog.kind !== "create" && dialog.kind !== "edit") || submitting) return;

    if (form.bonusDays.trim() === "") {
      setFormError("Нэмэлт хоногийг оруулна уу");
      return;
    }

    const validation = promoCodeCreateSchema.safeParse({
      code: dialog.kind === "edit" ? dialog.promo.code : form.code,
      partnerName: form.partnerName,
      bonusDays: Number(form.bonusDays),
      note: form.note,
    });

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? "Өгөгдөл буруу байна");
      return;
    }

    const parsed = validation.data;
    setFormError(null);
    setSubmitting(true);

    try {
      const token = await getToken();

      if (dialog.kind === "create") {
        const response = await createPromoCode(
          { code: parsed.code, partnerName: parsed.partnerName, bonusDays: parsed.bonusDays, note: parsed.note ?? "" },
          token
        );

        if (response.error) {
          setFormError(response.message);
          return;
        }

        toast.success("Промо код үүслээ", { description: parsed.code });
        setDialog(null);

        if (response.data) {
          const created = response.data;
          setCodes((prev) => [created, ...prev.filter((promo) => promo.code !== created.code)]);
        } else {
          loadCodes();
        }
        return;
      }

      // Засах: зөвхөн өөрчлөгдсөн талбарыг илгээнэ
      const original = dialog.promo;
      const changes: PromoUpdateInput = {};
      if (parsed.partnerName !== original.partnerName) changes.partnerName = parsed.partnerName;
      if (parsed.bonusDays !== original.bonusDays) changes.bonusDays = parsed.bonusDays;
      if ((parsed.note ?? "") !== original.note) changes.note = parsed.note ?? "";

      if (Object.keys(changes).length === 0) {
        toast.info("Өөрчлөлт алга");
        setDialog(null);
        return;
      }

      const response = await updatePromoCode(original.code, changes, token);

      if (response.error) {
        setFormError(response.message);
        return;
      }

      toast.success("Хадгалагдлаа", { description: original.code });
      setCodes((prev) => prev.map((promo) => (promo.code === original.code ? { ...promo, ...changes } : promo)));
      setDialog(null);
    } catch (error) {
      console.error("Error saving promo code:", error);
      setFormError(error instanceof Error ? error.message : "Хадгалж чадсангүй");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (promo: PromoCode) => {
    if (busyCode) return;
    setBusyCode(promo.code);

    try {
      const nextActive = !promo.isActive;
      const response = await updatePromoCode(promo.code, { isActive: nextActive }, await getToken());

      if (response.error) {
        toast.error("Өөрчилж чадсангүй", { description: response.message });
        return;
      }

      setCodes((prev) => prev.map((item) => (item.code === promo.code ? { ...item, isActive: nextActive } : item)));
      toast.success(nextActive ? `${promo.code} идэвхжлээ` : `${promo.code} идэвхгүй боллоо`);
    } catch (error) {
      console.error("Error toggling promo code:", error);
      toast.error("Өөрчилж чадсангүй", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusyCode(null);
    }
  };

  const handleDelete = async () => {
    if (!dialog || dialog.kind !== "delete" || submitting) return;
    const target = dialog.promo;
    setSubmitting(true);

    try {
      const response = await deletePromoCode(target.code, await getToken());

      if (response.error) {
        toast.error("Устгаж чадсангүй", { description: response.message });
        return;
      }

      toast.success("Устгагдлаа", { description: target.code });
      setCodes((prev) => prev.filter((promo) => promo.code !== target.code));
      if (usageCode === target.code) setUsageCode("");
      setDialog(null);
    } catch (error) {
      console.error("Error deleting promo code:", error);
      toast.error("Устгаж чадсангүй", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  // Ашиглалтын нэг бичлэгийг устгана. Зөвхөн түүх, статистикаас хасна: хэрэглэгчийн эрх өөрчлөгдөхгүй.
  const handleDeleteUsage = async () => {
    if (!dialog || dialog.kind !== "deleteUsage" || submitting) return;
    const target = dialog.usage;
    setSubmitting(true);

    try {
      const response = await deletePromoUsage(target.id, await getToken());

      if (response.error) {
        toast.error("Устгаж чадсангүй", { description: response.message });
      } else {
        toast.success("Ашиглалтын бүртгэл устгагдлаа", {
          description: `${target.code} · ${target.userName || target.userId || "-"}`,
        });
        setUsages((prev) => prev.filter((usage) => usage.id !== target.id));
      }

      setDialog(null);
      // Алдаа гарсан ч (жишээ нь өөр цонхоос аль хэдийн устгасан) жагсаалт, статистикийг сервертэй тааруулна
      loadCodes();
      loadUsages(usageCode, usageLimit);
    } catch (error) {
      console.error("Error deleting promo usage:", error);
      toast.error("Устгаж чадсангүй", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastToggledIndex.current = null;
  };

  // Мөр сонгох/болиулах. Shift дарвал сүүлд дарсан мөрөөс энэ мөр хүртэл бүгдийг нэг дор сонгоно.
  const toggleUsage = (index: number, checked: boolean, shiftKey: boolean) => {
    const last = lastToggledIndex.current;
    const from = shiftKey && last !== null ? Math.min(last, index) : index;
    const to = shiftKey && last !== null ? Math.max(last, index) : index;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        const id = usages[i]?.id;
        if (!id) continue;
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    lastToggledIndex.current = index;
  };

  // Толгойн checkbox: харагдаж буй бүх мөрийг сонгох / бүгдийг болиулах
  const toggleAllUsages = () => {
    if (allUsagesSelected) {
      clearSelection();
    } else {
      setSelectedIds(new Set(usages.map((usage) => usage.id)));
      lastToggledIndex.current = null;
    }
  };

  // Сонгосон бичлэгүүдийг нэг дор устгана (сервер дээр нэг batch). Зөвхөн түүх, статистикаас хасна.
  const handleDeleteSelected = async () => {
    if (!dialog || dialog.kind !== "deleteUsages" || submitting) return;
    const ids = selectedUsages.map((usage) => usage.id);
    if (ids.length === 0) return;
    setSubmitting(true);

    try {
      const response = await deletePromoUsages(ids, await getToken());

      if (response.error) {
        toast.error("Устгаж чадсангүй", { description: response.message });
      } else {
        toast.success("Ашиглалтын бүртгэл устгагдлаа", { description: response.message });
        const removed = new Set(ids);
        setUsages((prev) => prev.filter((usage) => !removed.has(usage.id)));
        clearSelection();
      }

      setDialog(null);
      // Алдаа гарсан ч жагсаалт, статистикийг сервертэй тааруулна (сонголт нь жагсаалтад үлдсэнээр цэвэрлэгдэнэ)
      loadCodes();
      loadUsages(usageCode, usageLimit);
    } catch (error) {
      console.error("Error deleting promo usages:", error);
      toast.error("Устгаж чадсангүй", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      toast.error("Хуулж чадсангүй");
    }
  };

  const handleShowHistory = (code: string) => {
    clearSelection();
    setUsageCode(code);
    setUsageLimit(USAGE_PAGE_SIZE);
    requestAnimationFrame(() => usageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleUsageCodeChange = (value: string) => {
    clearSelection();
    setUsageCode(value);
    setUsageLimit(USAGE_PAGE_SIZE);
  };

  // ------------------------------------------------------------- render

  if (!initialized) {
    return (
      <div className="cyber-bg flex min-h-screen w-full items-center justify-center">
        <span className="loader relative z-10"></span>
      </div>
    );
  }

  const isFormDialog = dialog?.kind === "create" || dialog?.kind === "edit";
  const isEdit = dialog?.kind === "edit";

  return (
    <div className={`cyber-bg min-h-screen w-full p-4 sm:p-6 ${selectedUsages.length > 0 ? "pb-24 sm:pb-24" : ""} [&_a]:rounded-[3px] [&_button]:rounded-[3px] [&_.cyber-panel::after]:hidden [&_.cyber-panel::before]:hidden`}>
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        {/* Toolbar: доош scroll хийхэд дээр нь тогтоно */}
        <div className="sticky top-0 z-20 -mx-4 -mt-4 flex flex-col gap-3 bg-[#04050a]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3 lg:flex-1">
            <Ticket className="h-6 w-6 shrink-0 text-[#00f0ff]" style={{ filter: "drop-shadow(0 0 6px rgba(0,240,255,0.6))" }} />
            <div className="min-w-0">
              <h1 className="font-display truncate text-xl font-bold text-white sm:text-2xl">Промо код</h1>
              <p className="truncate text-xs text-zinc-400">Хамтрагчдад өгсөн кодууд болон тэдгээрээр хийсэн худалдан авалт</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Код, хамтрагчаар хайх"
                aria-label="Код, хамтрагчаар хайх"
                className={`${inputClass} py-2 pl-9 text-sm`}
              />
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Шинэчлэх"
              title="Шинэчлэх"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 bg-white/[0.03] text-zinc-300 transition-colors hover:border-[#00f0ff]/50 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading || usageLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="cyber-btn flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold"
              style={{ borderColor: "rgba(139,108,255,0.7)", backgroundColor: "rgba(139,108,255,0.2)" }}
            >
              <Plus className="h-4 w-4" />
              Шинэ код
            </button>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="cyber-panel flex flex-wrap items-center justify-between gap-3 border-[#ff2e88]/40 p-4">
            <p className="text-sm text-[#ff2e88]">{loadError}</p>
            <button type="button" onClick={loadCodes} className="cyber-btn px-4 py-2 text-sm">
              Дахин оролдох
            </button>
          </div>
        )}

        {/* Нийт статистик */}
        <section aria-label="Нийт статистик" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Нийт код" value={formatNumber(codes.length)} accent="#8b6cff" />
          <StatTile label="Идэвхтэй код" value={formatNumber(activeCount)} accent="#3ddc97" />
          <StatTile label="Худалдан авалт" value={formatNumber(summary?.purchases ?? 0)} accent="#00f0ff" />
          <StatTile label="Ашигласан хүн" value={formatNumber(summary?.uniqueUsers ?? 0)} accent="#00f0ff" />
          <StatTile label="Нийт дүн" value={formatMoney(summary?.totalAmount ?? 0)} accent="#ffd23f" />
          <StatTile label="Олгосон хоног" value={formatNumber(summary?.bonusDaysGiven ?? 0)} accent="#ff2e88" />
        </section>

        {summary?.truncated && (
          <p role="status" className="border border-[#ffd23f]/40 bg-[#ffd23f]/10 px-3 py-2 text-xs text-[#ffd23f]">
            Ашиглалтын бүртгэл маш олон болсон тул дээрх нийт тоо бүрэн биш байж магадгүй.
          </p>
        )}

        {/* Кодууд */}
        <section aria-label="Промо кодууд" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">Кодууд</h2>
            {search.trim() && (
              <span className="text-xs text-zinc-400">
                {visibleCodes.length}/{codes.length}
              </span>
            )}
          </div>

          {codes.length === 0 && loadError ? null : codes.length === 0 ? (
            <div className="cyber-panel flex flex-col items-center gap-3 px-4 py-12 text-center">
              <Ticket className="h-10 w-10 text-[#8b6cff]" />
              <p className="text-zinc-300">Промо код үүсгээгүй байна</p>
              <button
                type="button"
                onClick={openCreate}
                className="cyber-btn flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                style={{ borderColor: "rgba(139,108,255,0.7)", backgroundColor: "rgba(139,108,255,0.2)" }}
              >
                <Plus className="h-4 w-4" />
                Шинэ код үүсгэх
              </button>
            </div>
          ) : visibleCodes.length === 0 ? (
            <p className="cyber-panel px-4 py-8 text-center text-sm text-zinc-400">Хайлтад тохирох код олдсонгүй</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCodes.map((promo) => {
                const used = promo.stats.purchases > 0;

                return (
                  <article
                    key={promo.code}
                    data-code={promo.code}
                    className={`cyber-panel flex flex-col gap-3 p-4 transition-opacity ${promo.isActive ? "" : "opacity-70"}`}
                    style={promo.isActive ? { borderColor: "rgba(61,220,151,0.3)" } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display truncate text-2xl font-extrabold tracking-wider text-[#00f0ff] [text-shadow:0_0_14px_rgba(0,240,255,0.5)]">
                            {promo.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(promo.code)}
                            aria-label={`${promo.code} кодыг хуулах`}
                            title="Хуулах"
                            className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/15 text-zinc-400 transition-colors hover:border-[#00f0ff]/50 hover:text-white"
                          >
                            {copiedCode === promo.code ? (
                              <Check className="h-3.5 w-3.5 text-[#3ddc97]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="truncate text-sm font-medium text-white" title={promo.partnerName}>
                          {promo.partnerName}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-medium ${
                          promo.isActive
                            ? "border-[#3ddc97]/40 bg-[#3ddc97]/10 text-[#3ddc97]"
                            : "border-white/15 bg-white/5 text-zinc-400"
                        }`}
                      >
                        {promo.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 text-xs">
                      <span className="shrink-0 border border-[#ffd23f]/40 bg-[#ffd23f]/10 px-1.5 py-0.5 font-medium text-[#ffd23f]">
                        +{promo.bonusDays} хоног
                      </span>
                      {promo.note && (
                        <span className="min-w-0 truncate text-zinc-500" title={promo.note}>
                          {promo.note}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat label="Худалдан авалт" value={formatNumber(promo.stats.purchases)} />
                      <MiniStat label="Хүн" value={formatNumber(promo.stats.uniqueUsers)} />
                      <MiniStat label="Нийт дүн" value={formatMoney(promo.stats.totalAmount)} />
                    </div>

                    <p className="text-xs text-zinc-500">
                      {used ? `Сүүлд ашигласан: ${formatDateTime(promo.stats.lastUsedAt)}` : "Хараахан ашиглаагүй"}
                    </p>

                    <div className="mt-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(promo)}
                        disabled={busyCode === promo.code}
                        className={`flex h-8 flex-1 items-center justify-center gap-1.5 border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          promo.isActive
                            ? "border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff7aae] hover:bg-[#ff2e88]/25 hover:text-white"
                            : "border-[#3ddc97]/40 bg-[#3ddc97]/10 text-[#3ddc97] hover:bg-[#3ddc97]/25 hover:text-white"
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {promo.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShowHistory(promo.code)}
                        aria-label={`${promo.code} кодын түүх`}
                        title="Түүх"
                        className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#00f0ff]/40 bg-[#00f0ff]/10 text-[#00f0ff] transition-colors hover:bg-[#00f0ff]/25 hover:text-white"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(promo)}
                        aria-label={`${promo.code} кодыг засах`}
                        title="Засах"
                        className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#8b6cff]/50 bg-[#8b6cff]/10 text-[#c4b5ff] transition-colors hover:bg-[#8b6cff]/25 hover:text-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "delete", promo })}
                        disabled={used}
                        aria-label={`${promo.code} кодыг устгах`}
                        title={used ? "Ашиглагдсан код устгагдахгүй. Идэвхгүй болгоно уу (эсвэл эхлээд ашиглалтын бичлэгүүдийг устгана)" : "Устгах"}
                        className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-[#ff2e88]/10 disabled:hover:text-[#ff2e88]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Ашиглалтын түүх */}
        <section ref={usageRef} aria-label="Ашиглалтын түүх" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">Ашиглалтын түүх</h2>
            <select
              value={usageCode}
              onChange={(e) => handleUsageCodeChange(e.target.value)}
              aria-label="Кодоор шүүх"
              className="border border-white/10 bg-[#0b0e1c] px-3 py-2 text-sm text-white focus:border-[#8b6cff]/60 focus:outline-none focus:ring-1 focus:ring-[#8b6cff]/40"
            >
              <option value="">Бүх код</option>
              {codes.map((promo) => (
                <option key={promo.code} value={promo.code}>
                  {promo.code} ({promo.partnerName})
                </option>
              ))}
              {usageCode && !codes.some((promo) => promo.code === usageCode) && (
                <option value={usageCode}>{usageCode}</option>
              )}
            </select>
          </div>

          <div className="cyber-panel overflow-hidden">
            {usageError ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-[#ff2e88]">{usageError}</p>
                <button type="button" onClick={() => loadUsages(usageCode, usageLimit)} className="cyber-btn px-4 py-2 text-sm">
                  Дахин оролдох
                </button>
              </div>
            ) : usageLoading && usages.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-400">Ачаалж байна...</p>
            ) : usages.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-400">
                {usageCode
                  ? `${usageCode} кодоор худалдан авалт хийгдээгүй байна`
                  : "Одоогоор промо кодоор худалдан авалт хийгдээгүй байна"}
              </p>
            ) : (
              <div className={`overflow-x-auto transition-opacity ${usageLoading ? "opacity-60" : ""}`}>
                <table className="w-full min-w-[740px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-zinc-500">
                      <th scope="col" className="w-10 py-2.5 pl-4 pr-0 font-medium">
                        <input
                          type="checkbox"
                          checked={allUsagesSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = selectedUsages.length > 0 && !allUsagesSelected;
                          }}
                          onChange={() => {}}
                          onClick={toggleAllUsages}
                          aria-label="Харагдаж буй бүх бичлэгийг сонгох"
                          title="Бүгдийг сонгох"
                          className="h-4 w-4 cursor-pointer accent-[#00f0ff] align-middle"
                        />
                      </th>
                      <th className="px-4 py-2.5 font-medium">Огноо</th>
                      <th className="px-4 py-2.5 font-medium">Хэрэглэгч</th>
                      <th className="px-4 py-2.5 font-medium">Код</th>
                      <th className="px-4 py-2.5 text-right font-medium">Дүн</th>
                      <th className="px-4 py-2.5 text-right font-medium">Нэмэлт хоног</th>
                      {/* sr-only ашиглахгүй: absolute элемент overflow-x-auto контейнерт хавчигдахгүй, утсан дээр хуудсыг хэвтээ сунгадаг */}
                      <th scope="col" aria-label="Үйлдэл" className="w-14 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {usages.map((usage, index) => {
                      const selected = selectedIds.has(usage.id);
                      return (
                      <tr
                        key={usage.id}
                        data-selected={selected ? "true" : undefined}
                        className={`border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] ${selected ? "bg-[#ff2e88]/[0.07]" : ""}`}
                      >
                        <td className="w-10 py-2.5 pl-4 pr-0">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {}}
                            onMouseDown={(e) => {
                              // Shift+click-ийн үед текст сонгогдохоос сэргийлнэ
                              if (e.shiftKey) e.preventDefault();
                            }}
                            onClick={(e) => toggleUsage(index, !selected, e.shiftKey)}
                            aria-label={`${usage.userName || usage.userId || "Хэрэглэгч"} (${usage.code}) бичлэгийг сонгох`}
                            className="h-4 w-4 cursor-pointer accent-[#00f0ff] align-middle"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-zinc-300">
                          {formatDateTime(usage.createdAt)}
                        </td>
                        <td className="max-w-[260px] px-4 py-2.5">
                          <p className="truncate text-white" title={usage.userName || usage.userId}>
                            {usage.userName || usage.userId || "-"}
                          </p>
                          {usage.userName && usage.userId && (
                            <p className="truncate font-mono text-[10px] text-zinc-600" title={usage.userId}>
                              {usage.userId}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-display font-bold tracking-wide text-[#00f0ff]">{usage.code}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-white">
                          {formatMoney(usage.amount)}
                          {usage.planName && <span className="block text-[10px] text-zinc-500">{usage.planName}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[#ffd23f]">
                          +{usage.bonusDays}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "deleteUsage", usage })}
                            aria-label={`${usage.userName || usage.userId || "Хэрэглэгч"} (${usage.code}) бичлэгийг устгах`}
                            title="Бичлэгийг устгах"
                            className="inline-flex h-8 w-8 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {usageHasMore && !usageError && (
              <div className="border-t border-white/5 p-3 text-center">
                <button
                  type="button"
                  onClick={() => setUsageLimit((limit) => limit + USAGE_PAGE_SIZE)}
                  disabled={usageLoading}
                  className="cyber-btn px-5 py-2 text-sm disabled:opacity-50"
                >
                  {usageLoading ? "Ачаалж байна..." : "Дахиад харах"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Сонгосон бичлэгийн самбар: дэлгэцийн доор тогтоно (хүснэгтийг түлхэхгүй) */}
      {selectedUsages.length > 0 && (
        <div
          role="region"
          aria-label="Сонгосон бичлэгүүд"
          className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2 border border-[#ff2e88]/50 bg-[#0b0e1c]/95 px-3 py-2.5 shadow-lg backdrop-blur-md sm:w-auto sm:max-w-none sm:gap-3 sm:px-4"
        >
          <p className="min-w-0 flex-1 truncate text-sm text-white sm:flex-none">
            <span className="font-display font-bold tabular-nums text-[#ff2e88]">{selectedUsages.length}</span> бичлэг сонгосон
          </p>
          <button type="button" onClick={clearSelection} className="cyber-btn shrink-0 rounded-[3px] px-3 py-1.5 text-sm">
            Болих
          </button>
          <button
            type="button"
            onClick={() => setDialog({ kind: "deleteUsages" })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Устгах
          </button>
        </div>
      )}

      {/* Шинээр үүсгэх / засах */}
      <Dialog
        open={isFormDialog}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border border-[#8b6cff]/40 bg-[#0b0e1c] text-white sm:max-w-lg">
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle className="font-display">{isEdit ? "Промо код засах" : "Шинэ промо код"}</DialogTitle>
              <DialogDescription className="text-zinc-400">
                {isEdit
                  ? "Код өөрөө солигдохгүй. Нэмэлт хоногийг өөрчилбөл зөвхөн дараагийн худалдан авалтад үйлчилнэ."
                  : "Хэрэглэгч энэ кодоор эрх авах бүрдээ нэмэлт хоног авна."}
              </DialogDescription>
            </DialogHeader>

            <fieldset disabled={submitting} className="m-0 grid min-w-0 gap-4 border-0 px-0 py-4">
              <div className="space-y-1.5">
                <label htmlFor="promoCode" className="text-sm font-medium text-zinc-300">
                  Код
                </label>
                <div className="flex gap-2">
                  <input
                    id="promoCode"
                    type="text"
                    value={form.code}
                    readOnly={isEdit}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s/g, "") }))}
                    maxLength={PROMO_CODE_MAX_LENGTH}
                    autoComplete="off"
                    spellCheck={false}
                    className={`${inputClass} font-display text-lg font-bold tracking-wider text-[#00f0ff] ${
                      isEdit ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  />
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, code: generateCode() }))}
                      aria-label="Санамсаргүй код үүсгэх"
                      title="Санамсаргүй код"
                      className="flex shrink-0 items-center gap-1.5 border border-white/15 px-3 text-xs text-zinc-300 transition-colors hover:border-[#00f0ff]/50 hover:text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Санамсаргүй
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="promoPartner" className="text-sm font-medium text-zinc-300">
                  Хамтрагчийн нэр
                </label>
                <input
                  id="promoPartner"
                  type="text"
                  value={form.partnerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, partnerName: e.target.value }))}
                  maxLength={PROMO_PARTNER_NAME_MAX}
                  placeholder="Жишээ нь: ABC байгууллага"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="promoBonus" className="text-sm font-medium text-zinc-300">
                  Нэмэлт хоног
                </label>
                <input
                  id="promoBonus"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.bonusDays}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || (/^\d+$/.test(value) && Number(value) <= PROMO_BONUS_DAYS_MAX)) {
                      setForm((prev) => ({ ...prev, bonusDays: value }));
                    }
                  }}
                  className={`${inputClass} font-display text-lg font-bold tabular-nums text-[#ffd23f]`}
                />
                <p className="text-xs text-zinc-500">Худалдан авалт бүрт нэмэгдэх хоног (0-{PROMO_BONUS_DAYS_MAX})</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="promoNote" className="text-sm font-medium text-zinc-300">
                  Тэмдэглэл <span className="text-zinc-500">(заавал биш)</span>
                </label>
                <textarea
                  id="promoNote"
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  maxLength={PROMO_NOTE_MAX}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </fieldset>

            {formError && (
              <p role="alert" className="mb-3 border border-[#ff2e88]/40 bg-[#ff2e88]/10 px-3 py-2 text-sm text-[#ff7aae]">
                {formError}
              </p>
            )}

            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={submitting}
                className="cyber-btn rounded-[3px] px-5 py-2 text-sm"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-[3px] border border-[#8b6cff]/70 bg-[#8b6cff]/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8b6cff]/45 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Хадгалж байна..." : isEdit ? "Хадгалах" : "Үүсгэх"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Устгах */}
      <Dialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="border border-[#ff2e88]/40 bg-[#0b0e1c] text-white">
          <DialogHeader>
            <DialogTitle className="font-display">Промо код устгах</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {dialog?.kind === "delete" ? dialog.promo.code : ""} кодыг устгана. Сэргээх боломжгүй.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              className="cyber-btn rounded-[3px] px-5 py-2 text-sm"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="rounded-[3px] border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Устгаж байна..." : "Устгах"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Сонгосон олон бичлэг устгах */}
      <Dialog
        open={dialog?.kind === "deleteUsages"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="border border-[#ff2e88]/40 bg-[#0b0e1c] text-white">
          <DialogHeader>
            <DialogTitle className="font-display">{selectedUsages.length} бичлэг устгах</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Сонгосон бичлэгүүд зөвхөн «Ашиглалтын түүх» болон статистикаас хасагдана. Хэрэглэгчийн авсан эрх, төлбөрийн
              түүх өөрчлөгдөхгүй. Сэргээх боломжгүй.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border border-white/10 bg-black/30 px-3 py-2.5 text-sm">
            <dt className="text-zinc-500">Бичлэг</dt>
            <dd className="tabular-nums text-white">{selectedUsages.length}</dd>
            <dt className="text-zinc-500">Нийт дүн</dt>
            <dd className="tabular-nums text-white">{formatMoney(selectedSummary.amount)}</dd>
            <dt className="text-zinc-500">Нэмэлт хоног</dt>
            <dd className="tabular-nums text-[#ffd23f]">+{selectedSummary.bonusDays}</dd>
            <dt className="text-zinc-500">Код</dt>
            <dd className="min-w-0 break-words font-display font-bold tracking-wide text-[#00f0ff]">
              {selectedSummary.perCode.map(([code, count]) => `${code} ×${count}`).join(", ")}
            </dd>
          </dl>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              className="cyber-btn rounded-[3px] px-5 py-2 text-sm"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={submitting || selectedUsages.length === 0}
              className="rounded-[3px] border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Устгаж байна..." : `${selectedUsages.length} бичлэг устгах`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ашиглалтын бичлэг устгах */}
      <Dialog
        open={dialog?.kind === "deleteUsage"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="border border-[#ff2e88]/40 bg-[#0b0e1c] text-white">
          <DialogHeader>
            <DialogTitle className="font-display">Ашиглалтын бүртгэл устгах</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Энэ бичлэг зөвхөн «Ашиглалтын түүх» болон статистикаас хасагдана. Хэрэглэгчийн авсан эрх, төлбөрийн түүх
              өөрчлөгдөхгүй. Сэргээх боломжгүй.
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "deleteUsage" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border border-white/10 bg-black/30 px-3 py-2.5 text-sm">
              <dt className="text-zinc-500">Хэрэглэгч</dt>
              <dd className="min-w-0 truncate text-white">
                {dialog.usage.userName || dialog.usage.userId || "-"}
              </dd>
              <dt className="text-zinc-500">Код</dt>
              <dd className="font-display font-bold tracking-wide text-[#00f0ff]">{dialog.usage.code}</dd>
              <dt className="text-zinc-500">Огноо</dt>
              <dd className="tabular-nums text-zinc-300">{formatDateTime(dialog.usage.createdAt)}</dd>
              <dt className="text-zinc-500">Дүн</dt>
              <dd className="tabular-nums text-white">
                {formatMoney(dialog.usage.amount)} · +{dialog.usage.bonusDays} хоног
              </dd>
            </dl>
          )}
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              className="cyber-btn rounded-[3px] px-5 py-2 text-sm"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleDeleteUsage}
              disabled={submitting}
              className="rounded-[3px] border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Устгаж байна..." : "Устгах"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}