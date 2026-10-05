// app/users/[userId]/page.tsx
"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import {
  ArrowLeft,
  Ban,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Globe,
  Plus,
  Edit,
  Minus,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getUser, removeDevice, banUser, unbanUser } from "./actions";

interface Device {
  deviceId: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  firstSeen?: string;
  lastUsed?: string;
  lastActive?: string; // Legacy field
}

interface User {
  id: string;
  userId?: number;
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string | null;
  subscriptionStartDate?: string | null;
  createdAt: string;
  devices: Device[];
  deviceCount: number;
  banned: boolean;
  banExpiry: string | null;
  banReason: string;
}

interface UserEditPageProps {
  params: Promise<{
    userId: string;
  }>;
}

const USERS_PATH = "/users";
const COLORS = {
  cyan: "#00f0ff",
  magenta: "#ff2e88",
  violet: "#8b6cff",
  amber: "#ffd23f",
  red: "#ff3355",
  muted: "#71717a",
};

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

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Буруу огноо date-fns-д орвол хуудас бүхэлдээ унадаг тул хамгаална
const timeAgo = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
};

const formatAura = (xp: number) => {
  if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
};

const getDeviceIcon = (deviceName?: string) => {
  const name = (deviceName || "").toLowerCase();
  if (name.includes("android") || name.includes("iphone")) {
    return <Smartphone className="h-5 w-5 text-[#00f0ff]" />;
  }
  if (name.includes("ipad") || name.includes("tablet")) {
    return <Tablet className="h-5 w-5 text-[#8b6cff]" />;
  }
  return <Monitor className="h-5 w-5 text-[#00f0ff]" />;
};

const INPUT =
  "w-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#00f0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40";

export default function UserEditPage({ params }: UserEditPageProps) {
  const router = useRouter();
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banning, setBanning] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState<string>("");
  const [xpAmount, setXpAmount] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [mode, setMode] = useState<"add" | "set">("add");

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setUserId(resolvedParams.userId);
    };
    resolveParams();
  }, [params]);

  // auth бэлэн болтол хүлээнэ (refresh хийхэд currentUser эхлээд null байдаг)
  useEffect(() => {
    if (userId && !auth.loading) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, auth.loading]);

  // silent = true бол бүтэн хуудсыг skeleton болгохгүй (хадгалсны дараах шинэчлэлт)
  const fetchUser = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна");
        router.push(USERS_PATH);
        return;
      }

      const result = await getUser(userId, token);

      if (!result.success || !result.data) {
        toast.error(result.error || "Хэрэглэгч татаж чадсангүй");
        router.push(USERS_PATH);
        return;
      }

      setUser(result.data);
      setXpAmount(result.data.xp.toString());
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Хэрэглэгч татаж чадсангүй");
      router.push(USERS_PATH);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const subDays = subscriptionDays !== "" ? parseInt(subscriptionDays, 10) : undefined;
    const parsedXp = xpAmount !== "" ? parseInt(xpAmount, 10) : undefined;

    if (subDays !== undefined && isNaN(subDays)) {
      toast.error("Хоногийн тоо буруу байна");
      return;
    }

    const xpChanged = parsedXp !== undefined && !isNaN(parsedXp) && parsedXp !== user.xp;

    if (subDays === undefined && !xpChanged) {
      toast.error("Хадгалахаасаа өмнө өөрчлөлт хийнэ үү");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна");
        return;
      }

      // Server action биш, шалгалт, transaction, аудитын бүртгэлтэй PATCH API ашиглана
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          subscriptionDays: subDays,
          xp: xpChanged ? parsedXp : undefined,
          mode,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(result.error || "Хадгалж чадсангүй");
        return;
      }

      const parts: string[] = [];
      if (subDays !== undefined) {
        if (subDays === 0) parts.push("Эрх цуцлагдлаа");
        else if (mode === "set") parts.push(`Эрх ${subDays} хоногоор тохируулагдлаа`);
        else parts.push(`${subDays} хоног нэмэгдлээ`);
      }
      if (xpChanged) parts.push(`Аура ${parsedXp} боллоо`);
      toast.success(parts.join(", ") || "Хадгалагдлаа");

      setSubscriptionDays("");
      await fetchUser(true);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Хадгалж чадсангүй");
    } finally {
      setSaving(false);
    }
  };

  const handleBan = async (days: number) => {
    if (!user) return;
    if (!confirm(`${days} хоногийн бан өгөх үү?`)) return;

    setBanning(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна");
        return;
      }

      const result = await banUser(
        user.id,
        days,
        "Account sharing detected - multiple devices",
        token
      );

      if (!result.success) {
        toast.error(result.error || "Бан өгч чадсангүй");
        return;
      }

      toast.success(`${days} хоногийн бан амжилттай өгөгдлөө`);
      await fetchUser(true);
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Бан өгч чадсангүй");
    } finally {
      setBanning(false);
    }
  };

  const handleUnban = async () => {
    if (!user) return;
    if (!confirm("Бан цуцлах уу?")) return;

    setBanning(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна");
        return;
      }

      const result = await unbanUser(user.id, token);

      if (!result.success) {
        toast.error(result.error || "Бан цуцалж чадсангүй");
        return;
      }

      toast.success("Бан амжилттай цуцлагдлаа");
      await fetchUser(true);
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Бан цуцалж чадсангүй");
    } finally {
      setBanning(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;
    if (!confirm("Төхөөрөмжийг устгахыг хүсэж байна уу?")) return;

    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error("Нэвтрээгүй байна");
        return;
      }

      const result = await removeDevice(user.id, deviceId, token);

      if (!result.success) {
        toast.error(result.error || "Төхөөрөмж устгаж чадсангүй");
        return;
      }

      toast.success("Төхөөрөмж устгагдлаа");
      await fetchUser(true);
    } catch (error) {
      console.error("Error removing device:", error);
      toast.error("Төхөөрөмж устгаж чадсангүй");
    }
  };

  if (loading) {
    return (
      <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
        <div className="relative z-10 mx-auto max-w-6xl space-y-6">
          <div className="h-10 w-40 animate-pulse bg-white/5" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse bg-white/5" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-72 animate-pulse bg-white/5 lg:col-span-2" />
            <div className="h-72 animate-pulse bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cyber-bg flex min-h-screen w-full items-center justify-center p-6">
        <div className="cyber-panel relative z-10 p-8 text-center">
          <p className="mb-4 text-white">Хэрэглэгч олдсонгүй</p>
          <button type="button" onClick={() => router.push(USERS_PATH)} className="cyber-btn px-5 py-2 text-sm">
            Буцах
          </button>
        </div>
      </div>
    );
  }

  const isSuspicious = user.deviceCount >= 3;
  const isSubscribed = user.subscriptionStatus === "subscribed";

  const stats: Array<{ label: string; color: string; content: React.ReactNode; sub?: string }> = [
    {
      label: "Төлөв",
      color: isSubscribed ? COLORS.cyan : COLORS.muted,
      content: (
        <span className={`font-display text-lg font-bold ${isSubscribed ? "text-[#00f0ff]" : "text-zinc-400"}`}>
          {isSubscribed ? "Идэвхжүүлсэн" : "Идэвхжүүлээгүй"}
        </span>
      ),
      sub:
        isSubscribed && user.subscriptionDaysLeft !== undefined
          ? `${user.subscriptionDaysLeft} өдөр үлдсэн, ${formatDate(user.subscriptionEndDate)}`
          : undefined,
    },
    {
      label: "Аура",
      color: COLORS.red,
      content: (
        <div className="flex items-center gap-2 text-[#ff3355]">
          <AuraIcon className="h-5 w-5" />
          <span
            className="font-display text-2xl font-bold tabular-nums"
            style={{ textShadow: "0 0 12px rgba(255,51,85,0.45)" }}
          >
            {formatAura(user.xp)}
          </span>
        </div>
      ),
    },
    {
      label: "ID",
      color: COLORS.violet,
      content: (
        <span className="cyber-glow font-display text-2xl font-bold tabular-nums">
          #{user.userId || "N/A"}
        </span>
      ),
    },
    {
      label: "Төхөөрөмж",
      color: isSuspicious ? COLORS.amber : COLORS.cyan,
      content: (
        <span className="cyber-glow font-display text-2xl font-bold tabular-nums">
          {user.deviceCount} <span className="text-zinc-500">/ 2</span>
        </span>
      ),
    },
  ];

  return (
    <div className="cyber-bg min-h-screen w-full p-4 sm:p-6">
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(USERS_PATH)}
            aria-label="Буцах"
            className="cyber-btn p-2.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display flex flex-wrap items-center gap-2 text-2xl font-bold text-white">
              <span className="truncate">{user.username}</span>
              {user.banned && (
                <span className="inline-flex items-center border border-[#ff2e88]/50 bg-[#ff2e88]/15 px-2 py-0.5 text-xs font-medium text-[#ff2e88]">
                  <Ban className="mr-1 h-3 w-3" /> Бандуулсан
                </span>
              )}
              {isSuspicious && !user.banned && (
                <span className="inline-flex items-center border border-[#ffd23f]/50 bg-[#ffd23f]/15 px-2 py-0.5 text-xs font-medium text-[#ffd23f]">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Сэжигтэй
                </span>
              )}
            </h1>
            <p className="truncate text-sm text-zinc-400">{user.email}</p>
          </div>
        </div>

        {/* Бан мэдэгдэл */}
        {user.banned && (
          <div className="cyber-panel cyber-panel-warn p-4">
            <p className="font-medium text-[#ff2e88]">Бан дуусах: {formatDate(user.banExpiry)}</p>
            {user.banReason && <p className="mt-1 text-sm text-zinc-400">{user.banReason}</p>}
          </div>
        )}

        {/* Статистик */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="cyber-panel cyber-stat p-4"
              style={{ "--accent": stat.color } as CSSProperties}
            >
              <p className="mb-1 text-xs text-zinc-400">{stat.label}</p>
              {stat.content}
              {stat.sub && <p className="mt-1 text-xs text-zinc-500">{stat.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Төхөөрөмжүүд */}
          <section className="cyber-panel lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 p-4">
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-white">
                <Monitor className="h-5 w-5 text-[#00f0ff]" />
                Төхөөрөмжүүд
                <span className="cyber-glow tabular-nums">{user.deviceCount}</span>
              </h2>
              {isSuspicious && (
                <span className="border border-[#ffd23f]/50 bg-[#ffd23f]/15 px-2 py-0.5 text-xs font-medium text-[#ffd23f]">
                  3+ төхөөрөмж
                </span>
              )}
            </div>

            <div className="p-4">
              {user.devices.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">Төхөөрөмж бүртгэгдээгүй байна</p>
              ) : (
                <div className="space-y-3">
                  {user.devices.map((device, index) => (
                    <div
                      key={`${device.deviceId}-${index}`}
                      className="border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-[#00f0ff]/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5">{getDeviceIcon(device.deviceName)}</div>
                          <div className="min-w-0">
                            <h3 className="truncate font-medium text-white">
                              {device.deviceName || "Unknown Device"}
                            </h3>
                            <p className="text-sm text-zinc-400">
                              {device.browser || "Unknown"} · {device.os || "Unknown"}
                            </p>
                            {device.ipAddress && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {device.ipAddress}
                                </span>
                                {device.timezone && (
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    {device.timezone}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {index === 0 && (
                          <span className="shrink-0 border border-[#00f0ff]/40 bg-[#00f0ff]/10 px-2 py-0.5 text-xs font-medium text-[#00f0ff]">
                            Үндсэн
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs text-zinc-400">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          {device.firstSeen && (
                            <span>Анх: {formatDate(device.firstSeen).slice(0, 10)}</span>
                          )}
                          <span>Сүүлд: {timeAgo(device.lastUsed || device.lastActive)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDevice(device.deviceId)}
                          aria-label="Төхөөрөмж устгах"
                          title="Устгах"
                          className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Удирдлага */}
          <div className="space-y-6">
            <section className="cyber-panel">
              <div className="border-b border-white/5 p-4">
                <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-white">
                  <Edit className="h-5 w-5 text-[#00f0ff]" />
                  Тохируулах
                </h2>
              </div>

              <div className="space-y-5 p-4">
                {/* Эрх */}
                <div className="space-y-3">
                  <label htmlFor="days" className="block text-sm font-medium text-zinc-300">
                    Эрхийн хугацаа
                  </label>

                  <div role="group" aria-label="Горим" className="flex gap-1 border border-white/10 bg-black/30 p-1">
                    {(
                      [
                        { key: "add", label: "Нэмэх", icon: Plus },
                        { key: "set", label: "Тохируулах", icon: Edit },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const isOn = mode === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => setMode(option.key)}
                          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                            isOn
                              ? "bg-[#00f0ff]/20 text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                              : "text-zinc-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    id="days"
                    type="number"
                    min="0"
                    max="365"
                    value={subscriptionDays}
                    onChange={(e) => setSubscriptionDays(e.target.value)}
                    placeholder="Хоногийн тоо"
                    className={INPUT}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setSubscriptionDays("7")} className="cyber-btn py-1.5 text-sm">
                      7 өдөр
                    </button>
                    <button type="button" onClick={() => setSubscriptionDays("30")} className="cyber-btn py-1.5 text-sm">
                      30 өдөр
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubscriptionDays("0")}
                      className="flex items-center justify-center gap-1 border border-[#ff2e88]/50 bg-[#ff2e88]/10 py-1.5 text-sm text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/25"
                    >
                      <Minus className="h-3 w-3" />
                      Дуусгах
                    </button>
                  </div>
                </div>

                {/* Аура */}
                <div>
                  <label htmlFor="aura" className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <AuraIcon className="h-4 w-4 text-[#ff3355]" />
                    Аура
                  </label>
                  <input
                    id="aura"
                    type="number"
                    min="0"
                    value={xpAmount}
                    onChange={(e) => setXpAmount(e.target.value)}
                    className={INPUT}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="cyber-btn flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
                  style={{ borderColor: "rgba(0,240,255,0.6)", backgroundColor: "rgba(0,240,255,0.15)" }}
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </section>

            {/* Бан: идэвхтэй эрхтэй ЭСВЭЛ бандуулсан хэрэглэгчид (хугацаа нь дууссан ч бан цуцлах боломжтой) */}
            {(isSubscribed || user.banned) && (
              <section className="cyber-panel cyber-panel-warn">
                <div className="border-b border-white/5 p-4">
                  <h2 className="font-display text-lg font-semibold text-white">Бан</h2>
                </div>
                <div className="p-4">
                  {user.banned ? (
                    <button
                      type="button"
                      onClick={handleUnban}
                      disabled={banning}
                      className="cyber-btn flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Бан цуцлах
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleBan(7)}
                        disabled={banning}
                        className="flex items-center justify-center gap-2 border border-[#ffd23f]/50 bg-[#ffd23f]/10 py-2.5 text-sm font-medium text-[#ffd23f] transition-colors hover:bg-[#ffd23f]/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />7 хоног
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBan(30)}
                        disabled={banning}
                        className="flex items-center justify-center gap-2 border border-[#ff2e88]/60 bg-[#ff2e88]/15 py-2.5 text-sm font-medium text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />30 хоног
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}