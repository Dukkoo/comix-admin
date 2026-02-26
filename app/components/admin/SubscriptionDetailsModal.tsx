// app/admin/components/SubscriptionDetailsModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, Users, DollarSign, Clock, Activity, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
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

export default function SubscriptionDetailsModal({ isOpen, onClose }: SubscriptionDetailsModalProps) {
  const { currentUser } = useAuth();
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 30 | 90>(30);

  const fetchDetails = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      
      const response = await fetch('/api/admin/subscription-details', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription details');
      }

      const details = await response.json();
      setData(details);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Дэлгэрэнгүй мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchDetails();
    toast.success('Мэдээлэл шинэчлэгдлээ');
  };

  useEffect(() => {
    if (isOpen && !data && !loading) {
      fetchDetails();
    }
    // Only fetch when modal opens and data doesn't exist
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const getFilteredTimeline = () => {
    if (!data) return [];
    
    const days = selectedPeriod;
    return data.timeline.slice(-days);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 rounded-2xl shadow-2xl border border-cyan-500/20 w-full max-w-6xl max-h-[90vh] overflow-hidden animate-slideUp"
        style={{
          boxShadow: '0 0 60px rgba(6, 182, 212, 0.15), 0 20px 40px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-6 border-b border-cyan-500/30">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
          
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Subscription Analytics
              </h2>
              <p className="text-cyan-100 text-sm">Дэлгэрэнгүй төлбөрийн мэдээлэл</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-50 p-2 rounded-lg transition-all duration-200 flex items-center space-x-2"
                title="Шинэчлэх"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-400">Уншиж байна...</p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-8">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Expiring Soon */}
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-6 hover:scale-105 transition-transform duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-orange-500/20 p-3 rounded-lg">
                      <Clock className="h-6 w-6 text-orange-400" />
                    </div>
                    <span className="text-xs text-orange-400 bg-orange-500/20 px-2 py-1 rounded-full">
                      Анхааруулга
                    </span>
                  </div>
                  <p className="text-4xl font-bold text-white mb-2">
                    {data.expiringSoon.count}
                  </p>
                  <p className="text-sm text-orange-300">{data.expiringSoon.label}</p>
                </div>

                {/* New Subscribers */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-xl p-6 hover:scale-105 transition-transform duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-emerald-500/20 p-3 rounded-lg">
                      <Users className="h-6 w-6 text-emerald-400" />
                    </div>
                    <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                      Шинэ
                    </span>
                  </div>
                  <p className="text-4xl font-bold text-white mb-2">
                    {data.newSubscribers.count}
                  </p>
                  <p className="text-sm text-emerald-300">{data.newSubscribers.label}</p>
                </div>

                {/* MRR */}
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6 hover:scale-105 transition-transform duration-200 lg:col-span-2">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-cyan-500/20 p-3 rounded-lg">
                      <DollarSign className="h-6 w-6 text-cyan-400" />
                    </div>
                    <span className="text-xs text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded-full">
                      MRR
                    </span>
                  </div>
                  <p className="text-4xl font-bold text-white mb-2">
                    {data.mrr.amount.toLocaleString()}{data.mrr.currency}
                  </p>
                  <p className="text-sm text-cyan-300">
                    Сарын дундаж орлого • {data.mrr.activeCount} идэвхтэй хэрэглэгч
                  </p>
                </div>
              </div>

              {/* Trends Bar Chart */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-500/20 p-2 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Идэвхжүүлэлтийн тренд</h3>
                      <p className="text-sm text-zinc-400">Хугацаагаар харьцуулалт</p>
                    </div>
                  </div>
                </div>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis 
                        dataKey="period" 
                        stroke="#a1a1aa"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#a1a1aa"
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#27272a',
                          border: '1px solid #52525b',
                          borderRadius: '8px',
                          color: '#f4f4f5',
                        }}
                        labelStyle={{ color: '#06b6d4' }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="url(#barGradient)" 
                        radius={[8, 8, 0, 0]}
                      />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Timeline Chart */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-cyan-500/20 p-2 rounded-lg">
                      <Activity className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Өдөр тутмын идэвхжүүлэлт</h3>
                      <p className="text-sm text-zinc-400">Хугацааны дагуу</p>
                    </div>
                  </div>

                  {/* Period Selector */}
                  <div className="flex space-x-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-700">
                    {[7, 30, 90].map((period) => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period as 7 | 30 | 90)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                          selectedPeriod === period
                            ? 'bg-cyan-600 text-white shadow-lg'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {period} хоног
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getFilteredTimeline()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#a1a1aa"
                        style={{ fontSize: '11px' }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis 
                        stroke="#a1a1aa"
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#27272a',
                          border: '1px solid #52525b',
                          borderRadius: '8px',
                          color: '#f4f4f5',
                        }}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('mn-MN');
                        }}
                        formatter={(value: any) => [value, 'Идэвхжүүлэлт']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={{ fill: '#06b6d4', r: 4 }}
                        activeDot={{ r: 6, fill: '#06b6d4' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
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

        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}