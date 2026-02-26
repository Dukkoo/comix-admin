// app/admin/components/Analytics.tsx
'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, CreditCard, BarChart3, PieChart, ArrowUpIcon, ArrowDownIcon, BookOpen, RefreshCw } from 'lucide-react';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Pie } from 'recharts';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';
import SubscriptionDetailsModal from './SubscriptionDetailsModal';

// Types for better type safety
interface StatCard {
  title: string;
  value: string;
  change: number;
  icon: React.ComponentType<any>;
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

function DashboardStats({ data, onSubscriptionClick }: { data: AnalyticsData; onSubscriptionClick: () => void }) {
  const stats: StatCard[] = [
    {
      title: 'Нийт хэрэглэгч',
      value: (data.stats.totalUsers || 0).toLocaleString(),
      change: 0,
      icon: Users,
      color: 'text-cyan-400',
      clickable: false,
    },
    {
      title: 'Яг одоо идэвхжүүлсэн хэрэглэгчийн тоо',
      value: (data.stats.subscribedUsers || 0).toLocaleString(),
      change: 0,
      icon: CreditCard,
      color: 'text-emerald-400',
      clickable: true,
    },
    {
      title: 'Нийт зурагт ном',
      value: (data.stats.totalMangas || 0).toLocaleString(),
      change: 0,
      icon: BookOpen,
      color: 'text-blue-400',
      clickable: false,
    },
    {
      title: 'Нийт бүлэг',
      value: (data.stats.totalChapters || 0).toLocaleString(),
      change: 0,
      icon: BarChart3,
      color: 'text-purple-400',
      clickable: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        
        return (
          <div 
            key={stat.title} 
            onClick={() => stat.clickable && onSubscriptionClick()}
            className={`bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 transition-all duration-200 ${
              stat.clickable 
                ? 'hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/20 cursor-pointer hover:scale-105' 
                : 'hover:border-zinc-600/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-zinc-400 mb-1 font-roboto">{stat.title}</p>
                <p className="text-2xl font-bold text-white mb-2 font-roboto">{stat.value}</p>
                {stat.clickable && (
                  <p className="text-xs text-emerald-400 font-medium">Дэлгэрэнгүй харах →</p>
                )}
              </div>
              <div className={`bg-zinc-700/50 p-3 rounded-lg ${stat.clickable ? 'group-hover:bg-emerald-500/20' : ''}`}>
                <Icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Enhanced pie chart with animation and hover effect
function SubscriptionPieChart({ data }: { data: AnalyticsData['pieData'] }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const subscribedPercentage = total > 0 ? Math.round((data[0]?.value / total) * 100) : 0;

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 hover:border-zinc-600/50 transition-all duration-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white font-roboto">Хэрэглэгчийн график</h3>
        </div>
        <PieChart className="h-5 w-5 text-cyan-400" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#27272a', 
                border: '1px solid #52525b',
                borderRadius: '8px',
                color: '#f4f4f5',
                fontFamily: 'Roboto, sans-serif'
              }}
              formatter={(value: any) => [value.toLocaleString(), 'Users']}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center space-x-6 mt-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-cyan-600 rounded-full"></div>
          <span className="text-sm text-white font-roboto">Идэвхжүүлсэн ({subscribedPercentage}%)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-zinc-600 rounded-full"></div>
          <span className="text-sm text-white font-roboto">Идэвхжүүлээгүй ({100 - subscribedPercentage}%)</span>
        </div>
      </div>
    </div>
  );
}

// Loading component
function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <span className="loader"></span>
    </div>
  );
}

// Main Analytics component with real data
export default function Analytics() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!currentUser) {
      setError('Нэвтэрч орно уу');
      return;
    }

    setError(null);

    try {
      const token = await currentUser.getIdToken();
      
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const analyticsData = await response.json();
      setData(analyticsData);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      const errorMessage = error.message || 'Failed to load analytics data';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    if (!error) {
      toast.success('Мэдээлэл шинэчлэгдлээ');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchAnalytics();
      setLoading(false);
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - fetch only once on mount

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md mx-auto">
          <p className="text-red-400 font-roboto mb-4">⚠️ Алдаа гарлаа</p>
          <p className="text-zinc-300 text-sm mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-700 text-white px-6 py-2 rounded-lg transition-all duration-200"
          >
            {refreshing ? 'Дахин оролдож байна...' : 'Дахин оролдох'}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-zinc-400 py-12">
        <p className="font-roboto">Үзүүлэлт олдсонгүй.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 font-roboto">
        {/* Header with Refresh Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
            <p className="text-sm text-zinc-400 mt-1">Системийн ерөнхий үзүүлэлтүүд</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Шинэчилж байна...' : 'Шинэчлэх'}</span>
          </button>
        </div>

        {/* Dashboard Stats */}
        <DashboardStats 
          data={data} 
          onSubscriptionClick={() => setIsModalOpen(true)}
        />

        {/* Single Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <SubscriptionPieChart data={data.pieData} />
        </div>
      </div>

      {/* Subscription Details Modal */}
      <SubscriptionDetailsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}