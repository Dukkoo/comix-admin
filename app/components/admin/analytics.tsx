// app/admin/components/admin/analytics.tsx
'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
  type ComponentType,
  type KeyboardEvent,
} from 'react';
import {
  Users,
  CreditCard,
  BarChart3,
  BookOpen,
  RefreshCw,
  Activity,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';
import SubscriptionDetailsModal from './SubscriptionDetailsModal';
import { useOnlineCount } from '@/lib/use-online-count';

interface StatCard {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  clickable?: boolean;
  live?: boolean;
  subtitle?: string;
}

interface OnlineStats {
  count: number | null;
  users: number | null;
  guests: number | null;
}

interface AnalyticsData {
  stats: {
    totalUsers: number;
    subscribedUsers: number;
    freeUsers: number;
    totalMangas: number;
    totalChapters: number;
    averageXP: number;
    subscriptionRate: number;
  };
  pieData: Array<{ name: string; value: number; color: string }>;
  weeklyData: Array<{ week: string; users: number }>;
}

// Tab нээлттэй байх үед Firestore-ийн статистикийг (нийт хэрэглэгч, идэвхжүүлсэн, ном, бүлэг)
// 30 минут тутам автоматаар шинэчилнэ. Шинэчлэлт бүр ~150 + номын тоо орчим Firestore уншилт
// зарцуулдаг тул хэт ойр тавихгүй. "Одоо онлайн" нь Realtime Database-ээс шууд ирдэг тул
// энэ тохиргооноос хамаарахгүй, үргэлж real-time. 0 болговол автомат шинэчлэлт унтарна.
const AUTO_REFRESH_MS = 30 * 60 * 1000;

// Cyberpunk палитр
const NEON = {
  cyan: '#00f0ff',
  magenta: '#ff2e88',
  violet: '#8b6cff',
  amber: '#ffd23f',
  mint: '#3ddc97',
  dim: '#2b2f52',
};

const toNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const fmtOrDash = (v: number | null) => (v === null ? '—' : v.toLocaleString());

function DashboardStats({
  data,
  online,
  onSubscriptionClick,
}: {
  data: AnalyticsData;
  online: OnlineStats;
  onSubscriptionClick: () => void;
}) {
  const stats: StatCard[] = [
    {
      title: 'Нийт хэрэглэгч',
      value: toNum(data.stats?.totalUsers).toLocaleString(),
      icon: Users,
      color: NEON.cyan,
    },
    {
      title: 'Одоо онлайн',
      value: fmtOrDash(online.count),
      icon: Activity,
      color: NEON.mint,
      live: true,
      // Нэвтэрсэн / зочин задаргаа
      subtitle:
        online.count === null
          ? undefined
          : `Нэвтэрсэн ${fmtOrDash(online.users)} · Зочин ${fmtOrDash(online.guests)}`,
    },
    {
      title: 'Яг одоо идэвхжүүлсэн хэрэглэгчийн тоо',
      value: toNum(data.stats?.subscribedUsers).toLocaleString(),
      icon: CreditCard,
      color: NEON.magenta,
      clickable: true,
    },
    {
      title: 'Нийт зурагт ном',
      value: toNum(data.stats?.totalMangas).toLocaleString(),
      icon: BookOpen,
      color: NEON.violet,
    },
    {
      title: 'Нийт бүлэг',
      value: toNum(data.stats?.totalChapters).toLocaleString(),
      icon: BarChart3,
      color: NEON.amber,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const interactive = stat.clickable
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': `${stat.title} — дэлгэрэнгүй харах`,
              onClick: onSubscriptionClick,
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSubscriptionClick();
                }
              },
            }
          : {};

        return (
          <div
            key={stat.title}
            {...interactive}
            style={{ '--accent': stat.color } as CSSProperties}
            className={`cyber-panel cyber-stat p-5 ${
              stat.clickable ? 'cyber-panel-hover cursor-pointer' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-400">{stat.title}</p>
                <p className="cyber-glow font-display mt-2 text-4xl font-bold tabular-nums">
                  {stat.value}
                  {stat.live && stat.value !== '—' && (
                    <span className="relative ml-2 inline-flex h-2.5 w-2.5 align-middle" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ddc97] opacity-60 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3ddc97]" />
                    </span>
                  )}
                </p>
                {stat.subtitle && (
                  <p className="mt-2 text-xs text-zinc-400 tabular-nums">{stat.subtitle}</p>
                )}
                {stat.clickable && (
                  <p className="mt-2 text-xs font-medium" style={{ color: stat.color }}>
                    Дэлгэрэнгүй харах
                  </p>
                )}
              </div>
              <Icon className="h-6 w-6 shrink-0" style={{ color: stat.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// pieData-ийн дарааллаас хамаарахгүйн тулд stats-аас шууд тооцно
function SubscriptionPieChart({
  subscribed,
  notSubscribed,
}: {
  subscribed: number;
  notSubscribed: number;
}) {
  const total = subscribed + notSubscribed;
  const subscribedPercentage = total > 0 ? Math.round((subscribed / total) * 100) : 0;
  const hasData = total > 0;

  const chartData = hasData
    ? [
        { name: 'Идэвхжүүлсэн', value: subscribed, color: NEON.cyan },
        { name: 'Идэвхжүүлээгүй', value: notSubscribed, color: NEON.dim },
      ]
    : [{ name: 'Мэдээлэл алга', value: 1, color: NEON.dim }];

  const bothNonZero = subscribed > 0 && notSubscribed > 0;

  return (
    <div className="cyber-panel flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">Хэрэглэгчийн график</h3>
        <PieChartIcon className="h-5 w-5" style={{ color: NEON.cyan }} />
      </div>

      <div className="relative min-h-60 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={bothNonZero ? 4 : 0}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
              stroke="none"
              isAnimationActive={hasData}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={entry.color}
                  stroke="none"
                  style={
                    hasData && index === 0
                      ? { filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.6))' }
                      : undefined
                  }
                />
              ))}
            </Pie>
            {hasData && (
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0d18',
                  border: '1px solid rgba(0,240,255,0.4)',
                  borderRadius: '2px',
                  color: '#f4f4f5',
                }}
                itemStyle={{ color: '#f4f4f5' }}
                formatter={(value: any, name: any) => [Number(value).toLocaleString(), name]}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        {/* Дугуйн голд идэвхжсэн хувь */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="cyber-glow font-display text-3xl font-bold tabular-nums">
            {hasData ? `${subscribedPercentage}%` : '—'}
          </span>
          <span className="text-xs text-zinc-400">идэвхжсэн</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: NEON.cyan }} />
          <span className="text-sm text-white">
            Идэвхжүүлсэн: {subscribed.toLocaleString()} ({subscribedPercentage}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: NEON.dim }} />
          <span className="text-sm text-white">
            Идэвхжүүлээгүй: {notSubscribed.toLocaleString()} (
            {hasData ? 100 - subscribedPercentage : 0}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="cyber-panel flex h-40 items-center justify-center">
      <span className="loader"></span>
    </div>
  );
}

interface AnalyticsProps {
  /** Pie chart-ын баруун талд харагдах панел (Сэжигтэй хэрэглэгчид) */
  sidePanel?: ReactNode;
  /** Дээрх хэсгүүдийн доор харагдах агуулга (Сэтгэгдлүүд) */
  children?: ReactNode;
}

type FetchOptions = { force?: boolean; silent?: boolean };

export default function Analytics({ sidePanel, children }: AnalyticsProps) {
  const { currentUser, loading: authLoading } = useAuth();
  const { count: onlineCount, users: onlineUsers, guests: onlineGuests } = useOnlineCount();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Token шинэчлэгдэх бүрт currentUser-ийн reference өөрчлөгдөж дахин fetch хийхээс сэргийлнэ
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const uid = currentUser?.uid ?? null;

  const mountedRef = useRef(true);
  // Хамгийн сүүлд эхэлсэн хүсэлтийн хариуг л хэрэглэнэ (хуучин хариу шинийг дарахгүй)
  const requestIdRef = useRef(0);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // true = амжилттай, false = алдаа / хуучирсан хүсэлт
  const fetchAnalytics = useCallback(
    async ({ force = false, silent = false }: FetchOptions = {}): Promise<boolean> => {
      const user = currentUserRef.current;
      if (!user) {
        setError('Нэвтэрч орно уу');
        return false;
      }

      const requestId = ++requestIdRef.current;
      const isCurrent = () => mountedRef.current && requestId === requestIdRef.current;

      try {
        const token = await user.getIdToken();

        const response = await fetch(`/api/admin/analytics${force ? '?refresh=1' : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || `HTTP ${response.status}`);
        }

        const analyticsData = (await response.json()) as AnalyticsData;
        if (!isCurrent()) return false;

        setData(analyticsData);
        setError(null);
        setLastUpdated(new Date());
        lastFetchAtRef.current = Date.now();
        return true;
      } catch (err: unknown) {
        if (!isCurrent()) return false;
        console.error('Error fetching analytics:', err);
        const errorMessage =
          err instanceof Error && err.message ? err.message : 'Failed to load analytics data';
        setError(errorMessage);
        // Автомат шинэчлэлт дээр минут тутам toast гаргахгүй
        if (!silent) toast.error(errorMessage);
        return false;
      }
    },
    []
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    const ok = await fetchAnalytics({ force: true });
    if (mountedRef.current) setRefreshing(false);
    if (ok) toast.success('Мэдээлэл шинэчлэгдлээ');
  };

  // Auth бэлэн болмогц (эсвэл өөр хэрэглэгчээр нэвтэрвэл) татна
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    fetchAnalytics().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, uid, fetchAnalytics]);

  // Tab харагдаж байх үед автоматаар шинэчилнэ, буцаж ирэхэд хуучирсан бол шууд татна
  useEffect(() => {
    if (authLoading || !uid || AUTO_REFRESH_MS <= 0) return;

    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchAtRef.current < AUTO_REFRESH_MS - 1000) return;
      fetchAnalytics({ silent: true });
    };

    const timer = window.setInterval(refreshIfStale, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [authLoading, uid, fetchAnalytics]);

  const subscribed = toNum(data?.stats?.subscribedUsers);
  const notSubscribed = Math.max(0, toNum(data?.stats?.totalUsers) - subscribed);

  const statsArea = (() => {
    if (loading && !data) return <LoadingSpinner />;

    if (error && !data) {
      return (
        <div className="cyber-panel cyber-panel-warn mx-auto w-full max-w-md p-8 text-center">
          <p className="mb-2 font-display font-semibold" style={{ color: NEON.magenta }}>
            Алдаа гарлаа
          </p>
          <p className="mb-6 text-sm text-zinc-300">{error}</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="cyber-btn px-5 py-2 text-sm"
          >
            {refreshing ? 'Дахин оролдож байна...' : 'Дахин оролдох'}
          </button>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="cyber-panel p-8 text-center text-zinc-400">Үзүүлэлт олдсонгүй.</div>
      );
    }

    return (
      <DashboardStats
        data={data}
        online={{ count: onlineCount, users: onlineUsers, guests: onlineGuests }}
        onSubscriptionClick={() => setIsModalOpen(true)}
      />
    );
  })();

  const pieArea = data ? (
    <SubscriptionPieChart subscribed={subscribed} notSubscribed={notSubscribed} />
  ) : (
    <div className="cyber-panel flex min-h-60 items-center justify-center p-5">
      {loading ? (
        <span className="loader"></span>
      ) : (
        <p className="text-sm text-zinc-500">График харуулах мэдээлэл алга</p>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Шинэчлэх товч */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {error && data && (
            <span className="text-xs" style={{ color: NEON.magenta }}>
              Сүүлийн шинэчлэлт амжилтгүй болсон
            </span>
          )}
          {lastUpdated && (
            <span className="text-xs text-zinc-500">
              Сүүлд шинэчлэгдсэн:{' '}
              {lastUpdated.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="cyber-btn flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Шинэчилж байна...' : 'Шинэчлэх'}</span>
          </button>
        </div>

        {statsArea}

        {/* Pie chart (нарийн) + Сэжигтэй хэрэглэгчид */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          {pieArea}
          {sidePanel}
        </div>

        {/* Доор нь: Сэтгэгдлүүд */}
        {children}
      </div>

      <SubscriptionDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}