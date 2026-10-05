// app/users/page.tsx
"use client";
import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useAuth } from '@/app/providers';
import { useRouter } from "next/navigation";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  userId?: number;
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  createdAt: string;
  lastLogin?: string;
}

interface UsersResponse {
  data: User[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

const STATUS_OPTIONS = [
  { key: "all", label: "Бүгд" },
  { key: "subscribed", label: "Идэвхжүүлсэн" },
  { key: "not_subscribed", label: "Идэвхжүүлээгүй" },
] as const;

const TH =
  "bg-[#0b0e1c] px-4 py-3 text-left text-xs font-semibold text-zinc-400 border-b border-white/10";

// Аура icon: цөм ба түүнээс цацрах цагирагууд
function AuraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
      style={{ filter: "drop-shadow(0 0 5px rgba(255,51,85,0.75))" }}
    >
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="5.6" opacity="0.8" />
      <circle cx="12" cy="12" r="9.4" opacity="0.45" strokeDasharray="3 3" />
    </svg>
  );
}

export default function AdminUsersPage() {
  const auth = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const pageSize = 25;

  const fetchUsers = async (page: number = 1, search?: string, status?: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Authentication required");
        setError("Нэвтрээгүй байна");
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (search && search.trim()) {
        // Хайлтын төрлийг автоматаар тодорхойлно
        if (search.includes('@')) {
          params.append('searchType', 'email');
          params.append('search', search.trim());
        } else if (/^\d+$/.test(search.trim())) {
          params.append('searchType', 'userId');
          params.append('search', search.trim());
        } else {
          params.append('searchType', 'username');
          params.append('search', search.trim());
        }
      }

      if (status && status !== 'all') {
        params.append('status', status);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data: UsersResponse = await response.json();
      setUsers(data.data);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
      setTotalCount(data.totalCount);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error instanceof Error ? error.message : "Unknown error");
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // Анхны ачаалалт: auth бэлэн болтол хүлээнэ (хуудсыг refresh хийхэд currentUser эхлээд null байдаг)
  useEffect(() => {
    if (auth.loading) return;
    fetchUsers(1, "", "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading]);

  // Хайлт (debounce). Анхны render-ийг алгасна.
  // Хайлтыг цэвэрлэхэд (×) жагсаалт дахин ачаалагдана.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }

    const delayDebounce = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers(1, searchTerm, filterStatus);
    }, 500);

    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Төлвийн шүүлтүүр
  const filterMounted = useRef(false);
  useEffect(() => {
    if (!filterMounted.current) {
      filterMounted.current = true;
      return;
    }

    setCurrentPage(1);
    fetchUsers(1, searchTerm, filterStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers(1, searchTerm, filterStatus);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchUsers(page, searchTerm, filterStatus);
  };

  const getSubscriptionBadge = (user: User) => {
    if (user.subscriptionStatus === "subscribed") {
      return (
        <span className="inline-flex border border-[#00f0ff]/40 bg-[#00f0ff]/10 px-2.5 py-0.5 text-xs font-medium text-[#00f0ff]">
          Идэвхжүүлсэн
        </span>
      );
    }
    return (
      <span className="inline-flex border border-white/15 bg-white/[0.03] px-2.5 py-0.5 text-xs font-medium text-zinc-400">
        Идэвхжүүлээгүй
      </span>
    );
  };

  const getDaysLeftText = (user: User) => {
    if (user.subscriptionStatus === "subscribed" && user.subscriptionDaysLeft !== undefined) {
      const d = user.subscriptionDaysLeft;
      if (d === 0) {
        return <span className="text-sm font-medium text-[#ff2e88]">Өнөөдөр дуусна</span>;
      } else if (d === 1) {
        return <span className="text-sm font-medium text-[#ff9f43]">1 өдөр дутуу</span>;
      } else if (d <= 7) {
        return <span className="text-sm font-medium text-[#ffd23f]">{d} өдөр үлдсэн</span>;
      }
      return <span className="text-sm font-medium text-[#00f0ff]">{d} өдөр үлдсэн</span>;
    }
    return <span className="text-zinc-600">-</span>;
  };

  const formatAura = (xp: number) => {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(1)}M`;
    } else if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
  };

  const getSearchPlaceholder = () => {
    if (searchTerm.includes('@')) {
      return "Цахим шуудангаар хайх...";
    } else if (searchTerm && /^\d/.test(searchTerm)) {
      return "ID-аар хайх (жнь: 12345)";
    }
    return "ID, цахим шуудан эсвэл нэрээр хайх...";
  };

  const initialLoading = loading && users.length === 0;
  const cell = "border-b border-white/5 px-4 py-3";

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              placeholder={getSearchPlaceholder()}
              aria-label="Хэрэглэгч хайх"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full border border-white/10 bg-black/30 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Хайлт цэвэрлэх"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Төлвийн шүүлтүүр */}
          <div role="group" aria-label="Төлвөөр шүүх" className="flex gap-1 border border-white/10 bg-black/30 p-1">
            {STATUS_OPTIONS.map((option) => {
              const isOn = filterStatus === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => setFilterStatus(option.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    isOn
                      ? "bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Нийт тоо */}
          <div
            className="cyber-panel cyber-stat flex items-baseline gap-2 px-4 py-2"
            style={{ '--accent': '#00f0ff' } as CSSProperties}
          >
            <span className="text-xs text-zinc-400">Нийт</span>
            <span className="cyber-glow font-display text-lg font-bold tabular-nums">{totalCount}</span>
          </div>
        </div>

        {/* Хүснэгт */}
        <section className="cyber-panel">
          {initialLoading ? (
            <div className="flex items-center justify-center py-24">
              <span className="loader"></span>
            </div>
          ) : error && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <p className="font-display font-semibold text-[#ff2e88]">Хэрэглэгчдийг ачаалж чадсангүй</p>
              <p className="max-w-md text-sm text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={() => fetchUsers(1, searchTerm, filterStatus)}
                className="cyber-btn px-5 py-2 text-sm"
              >
                Дахин оролдох
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-24 text-zinc-400">
              Хэрэглэгч олдсонгүй
            </div>
          ) : (
            <div
              className={`cyber-scroll overflow-x-auto transition-opacity ${
                loading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <table className="w-full min-w-[820px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={TH}>ID</th>
                    <th className={TH}>Нэр</th>
                    <th className={TH}>Цахим шуудан</th>
                    <th className={TH}>Төлөв</th>
                    <th className={TH}>Хугацаа</th>
                    <th className={TH}>Аура</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-white/[0.04]">
                      <td className={cell}>
                        {user.userId ? (
                          <span className="font-display text-sm font-bold text-[#00f0ff]">#{user.userId}</span>
                        ) : (
                          <span className="text-xs text-[#ff9f43]" title={user.id}>
                            Firebase UID
                          </span>
                        )}
                      </td>
                      <td className={`${cell} text-sm font-medium text-white`}>{user.username}</td>
                      <td className={`${cell} text-sm text-zinc-300`}>{user.email}</td>
                      <td className={cell}>{getSubscriptionBadge(user)}</td>
                      <td className={cell}>{getDaysLeftText(user)}</td>
                      <td className={cell}>
                        <div className="flex items-center gap-1.5 text-[#ff3355]">
                          <AuraIcon className="h-4 w-4 shrink-0" />
                          <span
                            className="font-display font-semibold tabular-nums"
                            style={{ textShadow: "0 0 10px rgba(255,51,85,0.45)" }}
                          >
                            {formatAura(user.xp)}
                          </span>
                        </div>
                      </td>
                      <td className={`${cell} text-right`}>
                        <button
                          type="button"
                          onClick={() => router.push(`/users/${user.id}`)}
                          className="cyber-btn px-3 py-1.5 text-xs font-medium"
                        >
                          Засварлах
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!initialLoading && totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3">
              <p className="font-display text-sm tabular-nums text-zinc-400">
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} / {totalCount}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  aria-label="Өмнөх"
                  className="cyber-btn p-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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
                        onClick={() => handlePageChange(p as number)}
                        disabled={loading}
                        aria-current={currentPage === p ? 'page' : undefined}
                        className={`font-display h-9 w-9 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed ${
                          currentPage === p
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
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
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