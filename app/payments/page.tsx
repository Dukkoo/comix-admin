// app/payments/page.tsx
'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Trash2, X } from 'lucide-react';
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
  internalUserId?: number;
  isDuplicate?: boolean;
}

const PAGE_SIZE = 20;

const TH =
  'sticky top-0 z-10 bg-[#0b0e1c] px-4 py-3 text-left text-xs font-semibold text-zinc-400 border-b border-white/10';

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
    const ids = paginated.map(l => l.id).filter(Boolean);
    const allSelected = ids.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
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
    // Desktop дээр хуудас дэлгэцэнд багтаж, хүснэгт card дотроо scroll хийнэ
    <div className="cyber-bg flex min-h-screen w-full flex-col p-4 sm:p-6 lg:h-screen">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="И-мэйлээр хайх..."
              aria-label="И-мэйлээр хайх"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-white/10 bg-black/30 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Хайлт цэвэрлэх"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Нийт тоо */}
          <div className="cyber-panel cyber-stat flex items-baseline gap-2 px-4 py-2" style={{ '--accent': '#00f0ff' } as CSSProperties}>
            <span className="text-xs text-zinc-400">Нийт</span>
            <span className="cyber-glow font-display text-lg font-bold tabular-nums">{total}</span>
          </div>

          {/* Давхар бүртгэлийн шүүлтүүр */}
          {duplicateCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDuplicatesOnly(v => !v)}
              aria-pressed={showDuplicatesOnly}
              title="Нэг invoice-д давхар бүртгэгдсэн"
              className={`flex items-center gap-2 border px-4 py-2.5 text-sm font-medium transition-colors ${
                showDuplicatesOnly
                  ? 'border-[#ff2e88]/70 bg-[#ff2e88]/25 text-white shadow-[0_0_16px_rgba(255,46,136,0.3)]'
                  : 'border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] hover:bg-[#ff2e88]/20'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Давхар
              <span className="font-display tabular-nums">{duplicateCount}</span>
            </button>
          )}

          {selected.size > 0 && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 border border-[#ff2e88]/70 bg-[#ff2e88]/25 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#ff2e88]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Устгаж байна...' : `${selected.size} устгах`}
            </button>
          )}

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            aria-label="Шинэчлэх"
            title="Шинэчлэх"
            className="cyber-btn p-2.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Хүснэгт */}
        <section className="cyber-panel flex min-h-[420px] max-h-[75vh] flex-1 flex-col lg:max-h-none lg:min-h-0">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <span className="loader"></span>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-20 text-zinc-400">
              {search ? 'Хайлтын үр дүн олдсонгүй' : 'Бүртгэл байхгүй байна'}
            </div>
          ) : (
            <div className="cyber-scroll min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={`${TH} w-10`}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={handleSelectAll}
                        aria-label="Бүгдийг сонгох"
                        className="h-4 w-4 cursor-pointer accent-[#00f0ff]"
                      />
                    </th>
                    <th className={TH}>И-мэйл</th>
                    <th className={TH}>ID</th>
                    <th className={TH}>Дүн</th>
                    <th className={TH}>Эрх</th>
                    <th className={TH}>Идэвхжсэн</th>
                    <th className={TH}>Дуусах</th>
                    <th className={TH}>Эх үүсвэр</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((log, i) => {
                    const isSelected = selected.has(log.id);
                    const cell = 'border-b border-white/5 px-4 py-3';
                    return (
                      <tr
                        key={log.id || i}
                        onClick={() => log.id && handleSelect(log.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#00f0ff]/10'
                            : log.isDuplicate
                            ? 'bg-[#ff2e88]/[0.06] hover:bg-[#ff2e88]/10'
                            : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <td className={cell} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => log.id && handleSelect(log.id)}
                            aria-label="Сонгох"
                            className="h-4 w-4 cursor-pointer accent-[#00f0ff]"
                          />
                        </td>
                        <td className={cell}>
                          <div className="flex items-center gap-2">
                            {log.isDuplicate && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#ff2e88]" />}
                            <span className={`text-sm font-medium ${log.isDuplicate ? 'text-[#ff7fb3]' : 'text-white'}`}>
                              {log.userEmail || '—'}
                            </span>
                          </div>
                        </td>
                        <td className={cell}>
                          <span className="font-mono text-sm text-zinc-400">{log.internalUserId || '—'}</span>
                        </td>
                        <td className={cell}>
                          <span className="cyber-glow font-display font-bold tabular-nums" style={{ '--accent': '#00f0ff' } as CSSProperties}>
                            {(log.amount || 0).toLocaleString()}₮
                          </span>
                        </td>
                        <td className={cell}>
                          <span className="inline-flex border border-[#00f0ff]/30 bg-[#00f0ff]/10 px-2.5 py-0.5 text-xs font-medium text-[#00f0ff]">
                            {formatDays(log.planDays)}
                          </span>
                        </td>
                        <td className={cell}>
                          <span className="font-mono text-xs text-zinc-300">{formatDate(log.processedAt)}</span>
                        </td>
                        <td className={cell}>
                          <span className="font-mono text-xs text-zinc-300">{formatDate(log.subscriptionEndDate)}</span>
                        </td>
                        <td className={cell}>
                          <span
                            className={`inline-flex border px-2.5 py-0.5 text-xs font-medium ${
                              log.source === 'qpay_callback'
                                ? 'border-[#8b6cff]/40 bg-[#8b6cff]/10 text-[#b9a7ff]'
                                : 'border-[#ffd23f]/40 bg-[#ffd23f]/10 text-[#ffd23f]'
                            }`}
                          >
                            {log.source === 'qpay_callback' ? 'Callback' : 'Manual'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/5 px-4 py-3">
              <p className="font-display text-sm tabular-nums text-zinc-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Өмнөх"
                  className="cyber-btn p-2"
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
                      <span key={`ellipsis-${i}`} className="px-1.5 text-zinc-500">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        aria-current={page === p ? 'page' : undefined}
                        className={`font-display h-9 w-9 text-sm font-medium tabular-nums transition-colors ${
                          page === p
                            ? 'border border-[#00f0ff]/60 bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                            : 'border border-white/10 text-zinc-400 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Дараах"
                  className="cyber-btn p-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}