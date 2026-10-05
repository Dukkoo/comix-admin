// app/client/page.tsx
'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  Image as ImageIcon,
  Star,
  Hash,
  Search,
  Plus,
  Trash2,
  GripVertical,
  Save,
  BookOpen,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Төрөл ба тохиргоо                                                  */
/* ------------------------------------------------------------------ */

type TabKey = 'carousel' | 'popular' | 'featured';

interface Manga {
  id: string;
  title: string;
  type?: string;
  image?: string;
  hasCover?: boolean; // coverImage эсвэл avatarImage байгаа эсэх (carousel-д шаардлагатай)
}

interface TabConfig {
  label: string;
  max: number | null; // null = хязгааргүй
  icon: React.ComponentType<{ className?: string; style?: CSSProperties }>;
  accent: string;
  endpoint: string;
  needsCover?: boolean;
}

const TABS: Record<TabKey, TabConfig> = {
  carousel: {
    label: 'Carousel',
    max: 6,
    icon: ImageIcon,
    accent: '#00f0ff',
    endpoint: '/api/admin/carousel-mangas',
    needsCover: true,
  },
  popular: {
    label: 'Алдартай',
    max: 3,
    icon: Star,
    accent: '#ffd23f',
    endpoint: '/api/admin/popular-mangas',
  },
  featured: {
    label: 'Онцлох',
    max: null,
    icon: Hash,
    accent: '#ff2e88',
    endpoint: '/api/admin/featured-mangas',
  },
};

const TAB_ORDER: TabKey[] = ['carousel', 'popular', 'featured'];

const TYPE_LABEL: Record<string, string> = {
  manga: 'Манга',
  manhwa: 'Манхва',
  manhua: 'Манхуа',
  webtoon: 'Вебтүүн',
  comic: 'Комик',
};

/* ------------------------------------------------------------------ */
/* Туслах функцүүд                                                    */
/* ------------------------------------------------------------------ */

// Гурван API өөр өөр хэлбэртэй өгөгдөл буцаадаг тул нэг хэлбэрт оруулна
const toManga = (raw: any): Manga => ({
  id: raw.id ?? raw.mangaId,
  title: raw.title ?? raw.mangaTitle ?? '',
  type: raw.type,
  image: raw.mangaImage || raw.coverImage || raw.avatarImage,
  hasCover: Boolean(raw.coverImage || raw.avatarImage),
});

const idsKey = (items: Manga[]) => items.map((m) => m.id).join('|');

// Хадгалах үед API бүрийн хүлээн авдаг хэлбэр
const buildBody = (tab: TabKey, items: Manga[]) => {
  switch (tab) {
    case 'carousel':
      return { mangaIds: items.map((m) => m.id) };
    case 'popular':
      return { mangas: items.map((m, i) => ({ mangaId: m.id, order: i + 1 })) };
    case 'featured':
      return { mangas: items.map((m, i) => ({ mangaId: m.id, order: i })) };
  }
};

const loadTab = async (tab: TabKey, token?: string): Promise<Manga[]> => {
  const res = await fetch(TABS[tab].endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const raw: any[] = json.data || [];
  if (raw.length > 0 && typeof raw[0].order === 'number') {
    raw.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return raw.map(toManga);
};

/* ------------------------------------------------------------------ */
/* Жижиг компонентууд                                                 */
/* ------------------------------------------------------------------ */

function Thumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/40">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <BookOpen className="h-4 w-4 text-zinc-600" />
      )}
    </div>
  );
}

interface PanelProps {
  tab: TabKey;
  items: Manga[];
  allMangas: Manga[];
  onChange: (next: Manga[]) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Нэг табын агуулга: зүүн талд сонгогдсон, баруун талд нэмэх         */
/* ------------------------------------------------------------------ */

function ManagerPanel({ tab, items, allMangas, onChange, dirty, saving, onSave, error }: PanelProps) {
  const cfg = TABS[tab];
  const [query, setQuery] = useState('');
  const full = cfg.max !== null && items.length >= cfg.max;

  const candidates = useMemo(() => {
    const selected = new Set(items.map((m) => m.id));
    const q = query.trim().toLowerCase();
    return allMangas.filter(
      (m) =>
        !selected.has(m.id) &&
        (!cfg.needsCover || m.hasCover) &&
        (!q || m.title.toLowerCase().includes(q))
    );
  }, [allMangas, items, query, cfg.needsCover]);

  const shown = candidates.slice(0, 100);

  const add = (manga: Manga) => {
    if (full) {
      toast.error(`Хамгийн ихдээ ${cfg.max} манга сонгох боломжтой`);
      return;
    }
    onChange([...items, manga]);
  };

  const remove = (id: string) => onChange(items.filter((m) => m.id !== id));

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = Array.from(items);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onChange(next);
  };

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-1"
      style={{ '--accent': cfg.accent } as CSSProperties}
    >
      {/* Зүүн: сонгогдсон жагсаалт */}
      <section className="cyber-panel flex min-h-[420px] max-h-[75vh] flex-col lg:max-h-none lg:min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 p-4">
          <div className="flex items-baseline gap-3">
            <h3 className="font-display text-lg font-semibold text-white">Сонгогдсон</h3>
            <span className="cyber-glow font-display text-lg font-bold tabular-nums">
              {items.length}
              {cfg.max !== null && <span className="text-zinc-500">/{cfg.max}</span>}
            </span>
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="cyber-btn flex items-center gap-2 px-4 py-2 text-sm"
            style={
              dirty && !saving
                ? {
                    color: cfg.accent,
                    borderColor: `${cfg.accent}99`,
                    backgroundColor: `${cfg.accent}1f`,
                  }
                : undefined
            }
          >
            <Save className="h-4 w-4" />
            {saving ? 'Хадгалж байна...' : dirty ? 'Хадгалах' : 'Хадгалагдсан'}
          </button>
        </div>

        <div className="cyber-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 border border-[#ff2e88]/40 bg-[#ff2e88]/10 px-3 py-2 text-sm text-[#ff2e88]">
              Жагсаалт ачаалж чадсангүй ({error}). Хадгалахаас өмнө хуудсыг дахин ачаална уу.
            </p>
          )}

          {items.length === 0 ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
              <cfg.icon className="mb-3 h-10 w-10 text-zinc-700" />
              <p className="text-zinc-300">Манга сонгоогүй байна</p>
              <p className="mt-1 text-sm text-zinc-500">Баруун талаас манга нэмнэ үү</p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`list-${tab}`}>
                {(dropProvided) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className="space-y-2"
                  >
                    {items.map((manga, index) => (
                      <Draggable key={manga.id} draggableId={manga.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 border bg-[#0b0e1c] p-2.5 transition-colors ${
                              snapshot.isDragging
                                ? 'border-[var(--accent)] shadow-[0_0_24px_rgba(0,240,255,0.25)]'
                                : 'border-white/10 hover:border-white/25'
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              aria-label="Чирж эрэмбэлэх"
                              className="cursor-grab text-zinc-500 hover:text-white"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>

                            <span className="cyber-glow font-display w-8 shrink-0 text-center text-lg font-bold tabular-nums">
                              {index + 1}
                            </span>

                            <Thumb src={manga.image} />

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-white" title={manga.title}>
                                {manga.title}
                              </p>
                              {manga.type && (
                                <p className="text-xs text-zinc-400">
                                  {TYPE_LABEL[manga.type] ?? manga.type}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => remove(manga.id)}
                              aria-label={`${manga.title} хасах`}
                              className="h-8 w-8 shrink-0 border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
                            >
                              <Trash2 className="mx-auto h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </section>

      {/* Баруун: манга хайж нэмэх */}
      <section className="cyber-panel flex min-h-[420px] max-h-[75vh] flex-col lg:max-h-none lg:min-h-0">
        <div className="shrink-0 space-y-3 border-b border-white/5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">Манга нэмэх</h3>
            {full && <span className="text-sm text-[#ffd23f]">Дүүрсэн, нэгийг нь хасаад нэмнэ</span>}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Манга нэрээр хайх..."
              aria-label="Манга хайх"
              className="w-full border border-white/10 bg-black/30 py-2 pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40"
            />
          </div>
        </div>

        <div className="cyber-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
          {shown.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">
              {query.trim()
                ? `"${query}" хайлтаар илэрц олдсонгүй`
                : cfg.needsCover
                ? 'Зурагтай манга олдсонгүй'
                : 'Нэмэх манга үлдсэнгүй'}
            </div>
          ) : (
            shown.map((manga) => (
              <button
                key={manga.id}
                type="button"
                onClick={() => add(manga)}
                disabled={full}
                className="flex w-full items-center gap-3 border border-transparent bg-white/[0.02] p-2.5 text-left transition-colors hover:border-[var(--accent)]/50 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Thumb src={manga.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white" title={manga.title}>
                    {manga.title}
                  </p>
                  {manga.type && (
                    <p className="text-xs text-zinc-400">{TYPE_LABEL[manga.type] ?? manga.type}</p>
                  )}
                </div>
                <Plus className="h-4 w-4 shrink-0" style={{ color: cfg.accent }} />
              </button>
            ))
          )}
          {candidates.length > shown.length && (
            <p className="pt-2 text-center text-xs text-zinc-500">
              Эхний {shown.length} харагдаж байна. Хайлтаар нарийсгана уу.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Хуудас                                                             */
/* ------------------------------------------------------------------ */

export default function ClientManagementPage() {
  const { currentUser, loading: authLoading } = useAuth();

  const [active, setActive] = useState<TabKey>('carousel');
  const [lists, setLists] = useState<Record<TabKey, Manga[]>>({
    carousel: [],
    popular: [],
    featured: [],
  });
  // Сүүлд хадгалагдсан эрэмбийн snapshot (өөрчлөлт илрүүлэхэд)
  const [saved, setSaved] = useState<Record<TabKey, string>>({
    carousel: '',
    popular: '',
    featured: '',
  });
  const [allMangas, setAllMangas] = useState<Manga[]>([]);
  const [errors, setErrors] = useState<Partial<Record<TabKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<TabKey | null>(null);

  // Auth бэлэн болмогц бүх өгөгдлийг нэг дор татна
  useEffect(() => {
    if (authLoading) return;

    const load = async () => {
      const token = await currentUser?.getIdToken();

      // Нэг endpoint унавал бусад нь ажилласаар байна
      const [carousel, popular, featured, mangas] = await Promise.allSettled([
        loadTab('carousel', token),
        loadTab('popular', token),
        loadTab('featured', token),
        fetch('/api/mangas?pageSize=100&limit=1000').then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return (json.data || []).map(toManga) as Manga[];
        }),
      ]);

      const results = { carousel, popular, featured };
      const nextLists = { carousel: [] as Manga[], popular: [] as Manga[], featured: [] as Manga[] };
      const nextErrors: Partial<Record<TabKey, string>> = {};

      for (const tab of TAB_ORDER) {
        const r = results[tab];
        if (r.status === 'fulfilled') nextLists[tab] = r.value;
        else nextErrors[tab] = r.reason instanceof Error ? r.reason.message : 'Unknown error';
      }

      if (mangas.status === 'fulfilled') {
        setAllMangas(mangas.value);
      } else {
        toast.error('Мангануудын жагсаалт ачаалж чадсангүй');
      }

      setLists(nextLists);
      setSaved({
        carousel: idsKey(nextLists.carousel),
        popular: idsKey(nextLists.popular),
        featured: idsKey(nextLists.featured),
      });
      setErrors(nextErrors);
      setLoading(false);
    };

    load();
  }, [authLoading, currentUser]);

  const isDirty = (tab: TabKey) => idsKey(lists[tab]) !== saved[tab];
  const anyDirty = TAB_ORDER.some(isDirty);

  // Хадгалаагүй өөрчлөлттэй хуудас хаахаас сэрэмжлүүлнэ
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  const handleSave = async (tab: TabKey) => {
    if (!currentUser) {
      toast.error('Нэвтэрч орно уу');
      return;
    }

    setSaving(tab);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(TABS[tab].endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildBody(tab, lists[tab])),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || result.error || `HTTP ${res.status}`);

      setSaved((prev) => ({ ...prev, [tab]: idsKey(lists[tab]) }));
      toast.success(`${TABS[tab].label} амжилттай хадгалагдлаа`);
    } catch (error) {
      console.warn('Failed to save', tab, error);
      toast.error(`${TABS[tab].label} хадгалж чадсангүй`);
    } finally {
      setSaving(null);
    }
  };

  return (
    // Desktop дээр хуудас дэлгэцэнд яг багтана (page scroll байхгүй), card дотроо scroll хийнэ.
    // Жижиг дэлгэц дээр card-ууд өөрсдийн өндөртэй, хуудас хэвийн scroll хийнэ.
    <div className="cyber-bg flex min-h-screen w-full flex-col p-4 sm:p-6 lg:h-screen">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-6">
        {/* Табууд */}
        <div
          role="tablist"
          aria-label="Client удирдлага"
          className="flex shrink-0 gap-2 overflow-x-auto pb-1"
        >
          {TAB_ORDER.map((tab) => {
            const t = TABS[tab];
            const Icon = t.icon;
            const isActive = tab === active;
            const dirty = isDirty(tab);

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab)}
                className={`relative flex shrink-0 items-center gap-3 border px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff] ${
                  isActive ? 'text-white' : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-white'
                }`}
                style={
                  isActive
                    ? {
                        borderColor: `${t.accent}99`,
                        backgroundColor: `${t.accent}14`,
                        boxShadow: `0 0 20px ${t.accent}26`,
                      }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" style={{ color: isActive ? t.accent : undefined }} />
                <span>{t.label}</span>
                <span
                  className="font-display tabular-nums"
                  style={{ color: isActive ? t.accent : '#71717a' }}
                >
                  {lists[tab].length}
                  {t.max !== null && `/${t.max}`}
                </span>
                {dirty && (
                  <span
                    title="Хадгалаагүй өөрчлөлттэй"
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-[#ffd23f] shadow-[0_0_6px_#ffd23f]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="cyber-panel flex h-64 shrink-0 items-center justify-center">
            <span className="loader"></span>
          </div>
        ) : (
          <ManagerPanel
            key={active}
            tab={active}
            items={lists[active]}
            allMangas={allMangas}
            onChange={(next) => setLists((prev) => ({ ...prev, [active]: next }))}
            dirty={isDirty(active)}
            saving={saving === active}
            onSave={() => handleSave(active)}
            error={errors[active]}
          />
        )}
      </div>
    </div>
  );
}