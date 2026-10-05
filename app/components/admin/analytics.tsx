// app/admin/components/admin/analytics.tsx
'use client';

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type ComponentType,
} from 'react';
import {
  Users,
  CreditCard,
  BarChart3,
  BookOpen,
  RefreshCw,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';
import SubscriptionDetailsModal from './SubscriptionDetailsModal';

interface StatCard {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  clickable?: boolean;
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

// Cyberpunk палитр
const NEON = {
  cyan: '#00f0ff',
  magenta: '#ff2e88',
  violet: '#8b6cff',
  amber: '#ffd23f',
  dim: '#2b2f52',
};

function DashboardStats({
  data,
  onSubscriptionClick,
}: {
  data: AnalyticsData;
  onSubscriptionClick: () => void;
}) {
  const stats: StatCard[] = [
    {
      title: 'Нийт хэрэглэгч',
      value: (data.stats.totalUsers || 0).toLocaleString(),
      icon: Users,
      color: NEON.cyan,
    },
    {
      title: 'Яг одоо идэвхжүүлсэн хэрэглэгчийн тоо',
      value: (data.stats.subscribedUsers || 0).toLocaleString(),
      icon: CreditCard,
      color: NEON.magenta,
      clickable: true,
    },
    {
      title: 'Нийт зурагт ном',
      value: (data.stats.totalMangas || 0).toLocaleString(),
      icon: BookOpen,
      color: NEON.violet,
    },
    {
      title: 'Нийт бүлэг',
      value: (data.stats.totalChapters || 0).toLocaleString(),
      icon: BarChart3,
      color: NEON.amber,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const interactive = stat.clickable
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: onSubscriptionClick,
              onKeyDown: (e: React.KeyboardEvent) => {
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
                </p>
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

function SubscriptionPieChart({ data }: { data: AnalyticsData['pieData'] }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const subscribedPercentage = total > 0 ? Math.round(((data[0]?.value ?? 0) / total) * 100) : 0;
  const colors = [NEON.cyan, NEON.dim];

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
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={4}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index] ?? entry.color}
                  stroke="none"
                  style={
                    index === 0
                      ? { filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.6))' }
                      : undefined
                  }
                />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>

        {/* Дугуйн голд идэвхжсэн хувь */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="cyber-glow font-display text-3xl font-bold tabular-nums">
            {subscribedPercentage}%
          </span>
          <span className="text-xs text-zinc-400">идэвхжсэн</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: NEON.cyan }} />
          <span className="text-sm text-white">Идэвхжүүлсэн ({subscribedPercentage}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5" style={{ backgroundColor: NEON.dim }} />
          <span className="text-sm text-white">
            Идэвхжүүлээгүй ({total > 0 ? 100 - subscribedPercentage : 0}%)
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

export default function Analytics({ sidePanel, children }: AnalyticsProps) {
  const { currentUser, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // true = амжилттай, false = алдаа
  const fetchAnalytics = useCallback(async (force = false): Promise<boolean> => {
    if (!currentUser) {
      setError('Нэвтэрч орно уу');
      return false;
    }

    setError(null);

    try {
      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/admin/analytics${force ? '?refresh=1' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const analyticsData = await response.json();
      setData(analyticsData);
      setLastUpdated(new Date());
      return true;
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      const errorMessage = err.message || 'Failed to load analytics data';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    }
  }, [currentUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const ok = await fetchAnalytics(true);
    setRefreshing(false);
    if (ok) toast.success('Мэдээлэл шинэчлэгдлээ');
  };

  // Auth бэлэн болмогц нэг удаа татна
  useEffect(() => {
    if (authLoading) return;
    fetchAnalytics().finally(() => setLoading(false));
  }, [authLoading, fetchAnalytics]);

  const statsArea = (() => {
    if (loading) return <LoadingSpinner />;

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

    return <DashboardStats data={data} onSubscriptionClick={() => setIsModalOpen(true)} />;
  })();

  const pieArea = data ? (
    <SubscriptionPieChart data={data.pieData} />
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
        <div className="flex items-center justify-end gap-3">
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