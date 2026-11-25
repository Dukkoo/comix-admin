// components/admin/enhanced-user-management-modal.tsx
"use client";

import { useState, useEffect, useMemo, type ComponentType, type FormEvent } from "react";
import { useAuth } from '@/app/providers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  Zap,
  Calendar,
  Mail,
  User as UserIcon,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// lucide-ийн `User` icon-той нэр давхцахгүйн тулд ManagedUser гэж нэрлэв
export interface ManagedUser {
  id: string;
  username?: string;
  email: string;
  xp: number;
  // Өгөгдөлд "free" гэх мэт өөр утга ч байж болно
  subscriptionStatus: "subscribed" | "not_subscribed" | (string & {});
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  createdAt: string;
}

interface EnhancedUserManagementModalProps {
  user: ManagedUser | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

const MAX_DAYS = 3650;
const MAX_XP = 1_000_000_000;
const DAY_MS = 1000 * 60 * 60 * 24;
const DAY_PRESETS = [7, 30, 90, 365];

// "" → null (хоосон), буруу формат → NaN, бусад → бүхэл тоо
function parseInteger(value: string): number | null {
  const t = value.trim();
  if (t === "" || t === "-") return null;
  if (!/^-?\d+$/.test(t)) return NaN;
  return Number(t);
}

function toValidDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const formatDateTime = (value?: string | Date | null) => {
  const d = toValidDate(value);
  return d
    ? d.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
};

const formatDateOnly = (value?: string | Date | null) => {
  const d = toValidDate(value);
  return d
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";
};

const formatXP = (xp: number) => {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="truncate text-right text-zinc-100">{value}</span>
    </div>
  );
}

export default function EnhancedUserManagementModal({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}: EnhancedUserManagementModalProps) {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [daysInput, setDaysInput] = useState("");
  const [xpInput, setXpInput] = useState("");
  const [mode, setMode] = useState<"add" | "set">("add");

  // Modal нээгдэх бүрт эсвэл өөр хэрэглэгч сонгоход формыг цэвэрлэнэ
  useEffect(() => {
    if (isOpen && user) {
      setDaysInput("");
      setXpInput(String(user.xp ?? 0));
      setMode("add");
    }
  }, [isOpen, user?.id, user?.xp]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentXp = user?.xp ?? 0;
  const parsedDays = parseInteger(daysInput);
  const days = parsedDays ?? 0;
  const parsedXp = parseInteger(xpInput);

  const daysError = (() => {
    if (Number.isNaN(parsedDays)) return "Days must be a whole number";
    if (Math.abs(days) > MAX_DAYS) return `Days must be between -${MAX_DAYS} and ${MAX_DAYS}`;
    if (mode === "set" && days < 0) return "In \"set\" mode days must be positive";
    return null;
  })();

  const xpError = (() => {
    if (parsedXp === null) return "XP is required";
    if (Number.isNaN(parsedXp)) return "XP must be a whole number";
    if (parsedXp < 0) return "XP cannot be negative";
    if (parsedXp > MAX_XP) return `XP cannot exceed ${MAX_XP.toLocaleString()}`;
    return null;
  })();

  const xpChanged = !xpError && parsedXp !== currentXp;
  const daysChanged = !daysError && days !== 0;
  const hasChanges = xpChanged || daysChanged;

  const subscriptionInfo = useMemo(() => {
    if (user?.subscriptionStatus !== "subscribed") return null;
    const endDate = toValidDate(user.subscriptionEndDate);
    if (!endDate) {
      return typeof user.subscriptionDaysLeft === "number"
        ? { endDate: null, daysLeft: Math.max(0, user.subscriptionDaysLeft) }
        : null;
    }
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / DAY_MS));
    return { endDate, daysLeft };
  }, [user?.subscriptionStatus, user?.subscriptionEndDate, user?.subscriptionDaysLeft]);

  const isExpiringSoon =
    !!subscriptionInfo && subscriptionInfo.daysLeft > 0 && subscriptionInfo.daysLeft <= 7;

  // Сервертэй ижил логик: "set" = өнөөдрөөс, "add" = идэвхтэй бол дуусах өдрөөс
  const previewEndDate = useMemo(() => {
    if (!daysChanged) return null;
    let base: Date;
    if (mode === "set") {
      base = new Date();
    } else {
      const end = user?.subscriptionStatus === "subscribed" ? toValidDate(user.subscriptionEndDate) : null;
      base = end ?? new Date();
    }
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  }, [daysChanged, mode, days, user?.subscriptionStatus, user?.subscriptionEndDate]);

  const willExpire = !!previewEndDate && previewEndDate.getTime() <= Date.now();

  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;

    if (daysError || xpError) {
      toast.error(daysError || xpError || "Invalid input");
      return;
    }
    if (!hasChanges) {
      toast.error("No changes to apply");
      return;
    }

    setLoading(true);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const payload: {
        userId: string;
        subscriptionDays?: number;
        mode?: "add" | "set";
        xp?: number;
      } = { userId: user.id };

      if (daysChanged) {
        payload.subscriptionDays = days;
        payload.mode = mode;
      }
      if (xpChanged && parsedXp !== null) {
        payload.xp = parsedXp;
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Failed to update user (HTTP ${response.status})`);
      }

      const messages: string[] = [];
      if (daysChanged) {
        if (days > 0) {
          messages.push(
            mode === "add" ? `Added ${days} days to subscription` : `Set subscription to ${days} days`
          );
        } else {
          messages.push(`Reduced subscription by ${Math.abs(days)} days`);
        }
      }
      if (xpChanged && parsedXp !== null) {
        messages.push(`Updated XP to ${parsedXp.toLocaleString()}`);
      }

      toast.success("User updated successfully", {
        description: messages.join(" and "),
      });

      onUserUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionBadge = () => {
    if (!user) return null;
    if (user.subscriptionStatus === "subscribed") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Subscribed
        </Badge>
      );
    }
    return (
      <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Not Subscribed</Badge>
    );
  };

  if (!user) return null;

  const modeButtonClass = (active: boolean) =>
    active
      ? "border-cyan-500 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-200"
      : "border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-700 hover:text-white";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-zinc-800 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-cyan-400" />
            Manage User
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update subscription and XP for {user.username || user.email || "Unknown"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Хэрэглэгчийн мэдээлэл */}
          <div className="space-y-2 rounded-md border border-zinc-700 bg-zinc-900/50 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{user.username || "Unknown"}</span>
              {getSubscriptionBadge()}
            </div>
            <InfoRow icon={Mail} label="Email" value={user.email || "—"} />
            <InfoRow icon={Calendar} label="Joined" value={formatDateTime(user.createdAt)} />
            <InfoRow icon={Zap} label="XP" value={formatXP(currentXp)} />
            {subscriptionInfo && (
              <InfoRow
                icon={Clock}
                label="Subscription ends"
                value={
                  subscriptionInfo.endDate
                    ? `${formatDateOnly(subscriptionInfo.endDate)} (${subscriptionInfo.daysLeft} days left)`
                    : `${subscriptionInfo.daysLeft} days left`
                }
              />
            )}
            {isExpiringSoon && subscriptionInfo && (
              <div className="flex items-center gap-2 pt-1 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Subscription expires in {subscriptionInfo.daysLeft} day
                {subscriptionInfo.daysLeft === 1 ? "" : "s"}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-700" />

          {/* Subscription */}
          <div className="space-y-3">
            <Label htmlFor="subscription-days" className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              Subscription
            </Label>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                aria-pressed={mode === "add"}
                className={modeButtonClass(mode === "add")}
                onClick={() => setMode("add")}
              >
                Add / reduce days
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                aria-pressed={mode === "set"}
                className={modeButtonClass(mode === "set")}
                onClick={() => setMode("set")}
              >
                Set from today
              </Button>
            </div>

            <Input
              id="subscription-days"
              inputMode="numeric"
              autoComplete="off"
              placeholder={mode === "add" ? "e.g. 30 or -7" : "e.g. 30"}
              value={daysInput}
              disabled={loading}
              onChange={(e) => setDaysInput(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
            />

            <div className="flex flex-wrap gap-2">
              {DAY_PRESETS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  className="border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  onClick={() => setDaysInput(String(d))}
                >
                  {mode === "add" ? "+" : ""}
                  {d}d
                </Button>
              ))}
            </div>

            {daysError ? (
              <p className="text-xs text-red-400">{daysError}</p>
            ) : previewEndDate ? (
              <p className="text-xs text-zinc-400">
                New end date: <span className="text-white">{formatDateOnly(previewEndDate)}</span>
                {willExpire && <span className="ml-1 text-red-400">(subscription will expire)</span>}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">Leave empty to keep the current subscription.</p>
            )}
          </div>

          <Separator className="bg-zinc-700" />

          {/* XP */}
          <div className="space-y-2">
            <Label htmlFor="xp-amount" className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              XP
            </Label>
            <Input
              id="xp-amount"
              inputMode="numeric"
              autoComplete="off"
              value={xpInput}
              disabled={loading}
              onChange={(e) => setXpInput(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
            />
            {xpError ? (
              <p className="text-xs text-red-400">{xpError}</p>
            ) : xpChanged && parsedXp !== null ? (
              <p className="text-xs text-zinc-400">
                {formatXP(currentXp)} → <span className="text-white">{formatXP(parsedXp)}</span>
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleClose}
              className="border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !hasChanges || !!daysError || !!xpError}
              className="bg-cyan-600 text-white hover:bg-cyan-500"
            >
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}