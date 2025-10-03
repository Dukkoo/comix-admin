// app/admin/components/Analytics.tsx
'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, CreditCard, BarChart3, PieChart, ArrowUpIcon, ArrowDownIcon, BookOpen } from 'lucide-react';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Pie } from 'recharts';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';

// Types for better type safety
interface StatCard {
  title: string;
  value: string;
  change: number;
  icon: React.ComponentType<any>;
  color: string;
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

function DashboardStats({ data }: { data: AnalyticsData }) {
  const stats: StatCard[] = [
    {
      title: 'Нийт хэрэглэгч',
      value: (data.stats.totalUsers || 0).toLocaleString(),
      change: 0,
      icon: Users,
      color: 'text-cyan-400',
    },
    {
      title: 'Яг одоо идэвхжүүлсэн хэрэглэгчийн тоо',
      value: (data.stats.subscribedUsers || 0).toLocaleString(),
      change: 0,
      icon: CreditCard,
      color: 'text-emerald-400',
    },
    {
      title: 'Нийт зурагт ном',
      value: (data.stats.totalMangas || 0).toLocaleString(),
      change: 0,
      icon: BookOpen,
      color: 'text-blue-400',
    },
    {
      title: 'Нийт бүлэг',
      value: (data.stats.totalChapters || 0).toLocaleString(),
      change: 0,
      icon: BarChart3,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        
        return (
          <div key={stat.title} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 hover:border-zinc-600/50 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-zinc-400 mb-1 font-roboto">{stat.title}</p>
                <p className="text-2xl font-bold text-white mb-2 font-roboto">{stat.value}</p>
              </div>
              <div className="bg-zinc-700/50 p-3 rounded-lg">
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
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      <p className="ml-4 text-zinc-400 font-roboto">Уншиж байна...</p>
    </div>
  );
}

// Main Analytics component with real data
export default function Analytics() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentUser) return;

      try {
        const token = await currentUser.getIdToken();
        
        const response = await fetch('/api/admin/analytics', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [currentUser]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <div className="text-center text-zinc-400 py-12">
        <p className="font-roboto">Үзүүлэлт уншиж чадсангүй.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-roboto">
      {/* Dashboard Stats */}
      <DashboardStats data={data} />

      {/* Single Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <SubscriptionPieChart data={data.pieData} />
      </div>
    </div>
  );
}