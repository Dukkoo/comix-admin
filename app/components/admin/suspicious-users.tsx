// components/admin/suspicious-users.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import {
  AlertTriangle,
  Monitor,
  Ban,
  Eye,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SuspiciousUser {
  id: string;
  username: string;
  email: string;
  deviceCount: number;
  subscriptionStatus: string;
}

export default function SuspiciousUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<SuspiciousUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [banning, setBanning] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingUser, setClearingUser] = useState<string | null>(null);
  // Анхнаасаа хаалттай. Нээх үед л (эхний удаа) өгөгдөл татна.
  const [isOpen, setIsOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const getAuthToken = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
      return null;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  };

  const fetchSuspiciousUsers = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch("/api/admin/suspicious-users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      setUsers(data.users || []);
      setHasFetched(true);
    } catch (error) {
      console.error("Error fetching suspicious users:", error);
      toast.error("Failed to fetch suspicious users");
    } finally {
      setLoading(false);
    }
  };

  // Нээх үед л, зөвхөн эхний удаа татна
  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);

    if (next && !hasFetched) {
      fetchSuspiciousUsers();
    }
  };

  const handleQuickBan = async (userId: string, days: number) => {
    if (!confirm(`${days} хоногийн бан өгөх үү?`)) return;

    setBanning(userId);
    try {
      const token = await getAuthToken();

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          days,
          reason: "Account sharing detected - multiple devices",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to ban user");
      }

      toast.success(`${days} хоногийн бан амжилттай өгөгдлөө`);
      await fetchSuspiciousUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user");
    } finally {
      setBanning(null);
    }
  };

  // Нэг хэрэглэгчийн бүх device устгах
  const handleClearUserDevices = async (userId: string, email: string) => {
    if (!confirm(`${email} хэрэглэгчийн бүх төхөөрөмжийг устгах уу?`)) return;

    setClearingUser(userId);
    try {
      const token = await getAuthToken();

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/admin/users/${userId}/clear-devices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to clear devices");
      }

      toast.success(`${email} хэрэглэгчийн бүх төхөөрөмж устгагдлаа`);
      await fetchSuspiciousUsers();
    } catch (error) {
      console.error("Error clearing devices:", error);
      toast.error("Failed to clear devices");
    } finally {
      setClearingUser(null);
    }
  };

  // Бүх сэжигтэй хэрэглэгчдийн device устгах
  const handleClearAllDevices = async () => {
    if (!confirm(`${users.length} хэрэглэгчийн БҮГДИЙН төхөөрөмжийг устгах уу?`)) return;
    if (!confirm("Итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй!")) return;

    setClearingAll(true);
    try {
      const token = await getAuthToken();

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch("/api/admin/clear-all-suspicious-devices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to clear all devices");
      }

      const data = await response.json();
      toast.success(`${data.clearedCount ?? 0} хэрэглэгчийн төхөөрөмж устгагдлаа`);
      await fetchSuspiciousUsers();
    } catch (error) {
      console.error("Error clearing all devices:", error);
      toast.error("Failed to clear all devices");
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <section className="cyber-panel cyber-panel-warn flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 p-4">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#ffd23f]" />
          <span className="font-display text-lg font-semibold text-white">
            Сэжигтэй хэрэглэгчид (3+ төхөөрөмж)
          </span>
          {hasFetched && users.length > 0 && (
            <Badge className="border-[#ff2e88]/40 bg-[#ff2e88]/15 text-[#ff2e88]">
              {users.length}
            </Badge>
          )}
          <span className="ml-auto">
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-400" />
            )}
          </span>
        </button>

        {isOpen && (
          <button
            type="button"
            onClick={fetchSuspiciousUsers}
            disabled={loading}
            aria-label="Шинэчлэх"
            className="cyber-btn p-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {!isOpen && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-400">
            Жагсаалтыг одоогоор ачаалаагүй байна
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleToggle}
            className="cyber-btn"
          >
            <Eye className="mr-2 h-4 w-4" />
            Жагсаалт харах
          </Button>
        </div>
      )}

      {isOpen && (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {/* Бүх device устгах товч */}
          {users.length > 0 && (
            <Button
              onClick={handleClearAllDevices}
              disabled={clearingAll}
              className="mb-4 w-full border border-[#8b6cff]/60 bg-[#8b6cff]/15 text-[#c4b5ff] hover:bg-[#8b6cff]/30"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {clearingAll
                ? "Устгаж байна..."
                : `Бүх хэрэглэгчийн төхөөрөмж устгах (${users.length})`}
            </Button>
          )}

          {loading && users.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full bg-white/5" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
              <p className="text-zinc-300">Сэжигтэй хэрэглэгч олдсонгүй</p>
              <p className="mt-1 text-sm text-zinc-500">
                3+ төхөөрөмжтэй subscribed хэрэглэгч байхгүй байна
              </p>
            </div>
          ) : (
            <div className="cyber-scroll max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {users.map((user) => {
                const isBanning = banning === user.id;
                const isClearing = clearingUser === user.id;

                return (
                  <div
                    key={user.id}
                    className="border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-[#ff2e88]/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-white" title={user.email}>
                        {user.email}
                      </p>
                      <Badge className="shrink-0 border-[#ff2e88]/40 bg-[#ff2e88]/15 text-[#ff2e88]">
                        <Monitor className="mr-1 h-3 w-3" />
                        {user.deviceCount}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClearUserDevices(user.id, user.email)}
                        disabled={isClearing}
                        className="border-[#8b6cff]/50 bg-[#8b6cff]/10 text-[#c4b5ff] hover:bg-[#8b6cff]/30 hover:text-white"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        {isClearing ? "..." : "Device"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/users/${user.id}`)}
                        className="cyber-btn"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Дэлгэрэнгүй
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickBan(user.id, 7)}
                        disabled={isBanning}
                        className="border-[#ffd23f]/50 bg-[#ffd23f]/10 text-[#ffd23f] hover:bg-[#ffd23f]/25 hover:text-white"
                      >
                        <Ban className="mr-1 h-3 w-3" />
                        {isBanning ? "..." : "7 хоног"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickBan(user.id, 30)}
                        disabled={isBanning}
                        className="border-[#ff2e88]/60 bg-[#ff2e88]/15 text-[#ff2e88] hover:bg-[#ff2e88]/35 hover:text-white"
                      >
                        <Ban className="mr-1 h-3 w-3" />
                        {isBanning ? "..." : "30 хоног"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}