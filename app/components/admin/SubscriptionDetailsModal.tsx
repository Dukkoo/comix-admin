// app/admin/components/SubscriptionDetailsModal.tsx
'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Users, Clock, Activity, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';

interface SubscriptionDetails {
  expiringSoon: {
    count: number;
    label: string;
  };
  newSubscribers: {
    count: number;
    label: string;
  };
  trends: Array<{
    period: string;
    count: number;
    days: number;
  }>;
  mrr: {
    amount: number;
    activeCount: number;
    currency: string;
  };
  timeline: Array<{
    date: string;
    count: number;
  }>;
}

interface SubscriptionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NEON = {
  cyan: '#00f0ff',
  magenta: '#ff2e88',
  violet: '#8b6cff',
  amber: '#ffd23f',
};

const AXIS_COLOR = '#8a93b8';
const GRID_COLOR = 'rgba(0, 240, 255, 0.10)';

const tooltipStyle: CSSProperties = {
  backgroundColor: '#0a0d18',
  border: '1px solid rgba(0, 240, 255, 0.4)',
  borderRadius: '2px',
  color: '#f4f4f5',
};

export default function SubscriptionDetailsModal({ isOpen, onClose }: SubscriptionDetailsModalProps) {
  const { currentUser } = useAuth();
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 30 | 90>(30);

  // true = амжилттай, false = алдаа
  const fetchDetails = async (force = false): Promise<boolean> => {
    if (!currentUser) return false;

    setLoading(true);
    try {
      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/admin/subscription-details${force ? '?refresh=1' : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const details = await response.json();
      setData(details);
      return true;
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error(
        `Дэлгэрэнгүй мэдээлэл татахад алдаа гарлаа: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const ok = await fetchDetails(true);
    if (ok) toast.success('Мэдээлэл шинэчлэгдлээ');
  };

  useEffect(() => {
    if (isOpen && !data && !loading) {
      fetchDetails();
    }
    // Зөвхөн modal нээгдэх үед, өгөгдөл байхгүй бол татна
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Esc дарахад хаах
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getFilteredTimeline = () => {
    if (!data) return [];
    return data.timeline.slice(-selectedPeriod);
  };

  // Portal ашиглаж байгаа нь sidebar зэрэг бусад элементийн дээр найдвартай гарахад хэрэгтэй
  return createPortal(
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Идэвхжүүлэлтийн дэлгэрэнгүй мэдээлэл"
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel animate-slideUp flex max-h-[90vh] w-full max-w-6xl flex-col"
        style={{ boxShadow: '0 0 70px rgba(0, 240, 255, 0.12), 0 24px 48px rgba(0, 0, 0, 0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-end gap-2 border-b border-white/5 px-6 py-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            title="Шинэчлэх"
            aria-label="Шинэчлэх"
            className="cyber-btn p-2"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Хаах"
            aria-label="Хаах"
            className="cyber-btn p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="cyber-scroll min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          {loading && !data ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <span className="loader"></span>
                <p className="text-zinc-400">Уншиж байна...</p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Expiring Soon */}
                <div
                  className="cyber-panel cyber-stat p-5"
                  style={{ '--accent': NEON.amber } as CSSProperties}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <Clock className="h-6 w-6" style={{ color: NEON.amber }} />
                    <span
                      className="border px-2 py-0.5 text-xs"
                      style={{
                        color: NEON.amber,
                        borderColor: 'rgba(255, 210, 63, 0.4)',
                        backgroundColor: 'rgba(255, 210, 63, 0.1)',
                      }}
                    >
                      Анхааруулга
                    </span>
                  </div>
                  <p className="cyber-glow font-display text-4xl font-bold tabular-nums">
                    {data.expiringSoon.count}
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">{data.expiringSoon.label}</p>
                </div>

                {/* New Subscribers */}
                <div
                  className="cyber-panel cyber-stat p-5"
                  style={{ '--accent': NEON.cyan } as CSSProperties}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <Users className="h-6 w-6" style={{ color: NEON.cyan }} />
                    <span
                      className="border px-2 py-0.5 text-xs"
                      style={{
                        color: NEON.cyan,
                        borderColor: 'rgba(0, 240, 255, 0.4)',
                        backgroundColor: 'rgba(0, 240, 255, 0.1)',
                      }}
                    >
                      Шинэ
                    </span>
                  </div>
                  <p className="cyber-glow font-display text-4xl font-bold tabular-nums">
                    {data.newSubscribers.count}
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">{data.newSubscribers.label}</p>
                </div>

                {/* MRR */}
                <div
                  className="cyber-panel cyber-stat p-5 lg:col-span-2"
                  style={{ '--accent': NEON.magenta } as CSSProperties}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <span
                      className="font-display text-2xl font-bold leading-6"
                      style={{ color: NEON.magenta }}
                    >
                      ₮
                    </span>
                    <span
                      className="border px-2 py-0.5 text-xs"
                      style={{
                        color: NEON.magenta,
                        borderColor: 'rgba(255, 46, 136, 0.4)',
                        backgroundColor: 'rgba(255, 46, 136, 0.1)',
                      }}
                    >
                      MRR
                    </span>
                  </div>
                  <p className="cyber-glow font-display text-4xl font-bold tabular-nums">
                    {data.mrr.amount.toLocaleString()}
                    {data.mrr.currency}
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    Энэ сарын орлого, {data.mrr.activeCount} идэвхжүүлэлт
                  </p>
                </div>
              </div>

              {/* Trends Bar Chart */}
              <div className="cyber-panel p-6">
                <div className="mb-6 flex items-center gap-3">
                  <TrendingUp className="h-5 w-5" style={{ color: NEON.violet }} />
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white">
                      Идэвхжүүлэлтийн тренд
                    </h3>
                    <p className="text-sm text-zinc-400">Хугацаагаар харьцуулалт</p>
                  </div>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trends}>
                      <defs>
                        <linearGradient id="cyBarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={NEON.cyan} />
                          <stop offset="100%" stopColor={NEON.violet} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="period" stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                      <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: '#f4f4f5' }}
                        labelStyle={{ color: NEON.cyan, fontWeight: 600 }}
                        cursor={{ fill: 'rgba(0, 240, 255, 0.06)' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="url(#cyBarGradient)"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Timeline Chart */}
              <div className="cyber-panel p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5" style={{ color: NEON.cyan }} />
                    <div>
                      <h3 className="font-display text-lg font-semibold text-white">
                        Өдөр тутмын идэвхжүүлэлт
                      </h3>
                      <p className="text-sm text-zinc-400">Хугацааны дагуу</p>
                    </div>
                  </div>

                  {/* Period Selector */}
                  <div
                    role="group"
                    aria-label="Хугацаа сонгох"
                    className="flex gap-1 border border-white/10 bg-black/30 p-1"
                  >
                    {[7, 30, 90].map((period) => {
                      const active = selectedPeriod === period;
                      return (
                        <button
                          key={period}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedPeriod(period as 7 | 30 | 90)}
                          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                              : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {period} хоног
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getFilteredTimeline()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis
                        dataKey="date"
                        stroke={AXIS_COLOR}
                        style={{ fontSize: '11px' }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis stroke={AXIS_COLOR} style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: '#f4f4f5' }}
                        labelStyle={{ color: NEON.cyan, fontWeight: 600 }}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('mn-MN');
                        }}
                        formatter={(value: any) => [value, 'Идэвхжүүлэлт']}
                        cursor={{ stroke: 'rgba(0, 240, 255, 0.3)', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={NEON.cyan}
                        strokeWidth={3}
                        dot={{ fill: NEON.cyan, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: NEON.magenta, stroke: NEON.magenta }}
                        style={{ filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.7))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-zinc-400">Мэдээлэл олдсонгүй</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-fadeIn,
          .animate-slideUp {
            animation: none;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}