'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, CreditCard, Calendar, User, Clock, ChevronLeft, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { toast } from 'sonner';

interface PaymentLog {
  id: string;
  userEmail: string;
  userId: string;
  amount: number;
  planDays: number;
  subscriptionEndDate: string;
  processedAt: string;
  paymentType: 'desktop_qr' | 'mobile_bank_app';
  source: string;
  invoiceId: string;
  isDuplicate?: boolean;
}

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [filtered, setFiltered] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [total, setTotal] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/payment-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Татахад алдаа гарлаа');
      const data = await res.json();
      setLogs(data.logs || []);
      setFiltered(data.logs || []);
      setTotal(data.total || 0);
      setDuplicateCount(data.duplicateCount || 0);
    } catch (e) {
      toast.error('Төлбөрийн бүртгэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser === undefined) return;
    if (currentUser === null) { setLoading(false); return; }
    fetchLogs();
  }, [currentUser, fetchLogs]);

  useEffect(() => {
    let result = logs;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(l => l.userEmail?.toLowerCase().includes(q));
    if (showDuplicatesOnly) result = result.filter(l => l.isDuplicate);
    setFiltered(result);
    setPage(1);
    setSelected(new Set());
  }, [search, logs, showDuplicatesOnly]);

  const handleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const pageIds = paginated.map(l => l.id).filter(Boolean);
    const allSelected = pageIds.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0 || !currentUser) return;
    if (!confirm(`${selected.size} бүртгэл устгах уу?`)) return;

    setDeleting(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/payment-logs', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });

      if (!res.ok) throw new Error('Устгахад алдаа гарлаа');
      const data = await res.json();
      toast.success(`${data.deleted} бүртгэл устгагдлаа`);
      await fetchLogs();
    } catch (e) {
      toast.error('Устгахад алдаа гарлаа');
    } finally {
      setDeleting(false);
    }
  };

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageIds = paginated.map(l => l.id).filter(Boolean);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatDays = (days: number) => {
    if (days <= 31) return '1 сар';
    if (days <= 92) return '3 сар';
    return '6 сар';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Төлбөрийн бүртгэл</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Нийт {total} бүртгэл
            {search && ` • "${search}" хайлтын үр дүн`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              <Trash2 className="h-4 w-4" />
              <span>{deleting ? 'Устгаж байна...' : `${selected.size} устгах`}</span>
            </button>
          )}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Шинэчлэх</span>
          </button>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateCount > 0 && (
        <div
          onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200 ${
            showDuplicatesOnly
              ? 'bg-red-500/20 border-red-500/50'
              : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
          }`}
        >
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 font-medium text-sm">
              {duplicateCount} давхар бүртгэл илэрлээ — 60 хоног сунгагдах шалтгаан байж болно
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              Нэг invoice-д 2 удаа бүртгэгдсэн. Checkbox-оор сонгоод устгаж болно.
            </p>
          </div>
          <span className="text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap">
            {showDuplicatesOnly ? 'Бүгдийг харах' : 'Зөвхөн давхарыг харах'}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="И-мэйлээр хайх..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            {search ? 'Хайлтын үр дүн олдсонгүй' : 'Бүртгэл байхгүй байна'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/50 bg-zinc-900/50">
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 accent-cyan-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" />И-мэйл</div>
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" />Дүн</div>
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />Эрх</div>
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Идэвхжсэн огноо</div>
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Дуусах огноо
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Эх үүсвэр
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/30">
                {paginated.map((log, i) => (
                  <tr
                    key={log.id || i}
                    onClick={() => log.id && handleSelect(log.id)}
                    className={`transition-colors cursor-pointer ${
                      selected.has(log.id)
                        ? 'bg-cyan-500/10'
                        : log.isDuplicate
                        ? 'bg-red-500/5 hover:bg-red-500/10'
                        : 'hover:bg-zinc-700/20'
                    }`}
                  >
                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(log.id)}
                        onChange={() => log.id && handleSelect(log.id)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 accent-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {log.isDuplicate && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        )}
                        <span className={`font-medium ${log.isDuplicate ? 'text-red-300' : 'text-white'}`}>
                          {log.userEmail || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-cyan-400 font-bold">
                        {(log.amount || 0).toLocaleString()}₮
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {formatDays(log.planDays)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-zinc-300 text-sm">{formatDate(log.processedAt)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-zinc-300 text-sm">{formatDate(log.subscriptionEndDate)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        log.source === 'qpay_callback'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {log.source === 'qpay_callback' ? 'Callback' : 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-zinc-500">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                      page === p
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}