// components/admin/enhanced-user-management-modal.tsx
"use client";

import { useState, useEffect } from "react";
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
import { Crown, Zap, Calendar, Mail, User, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  username?: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  createdAt: string;
}

interface EnhancedUserManagementModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

export default function EnhancedUserManagementModal({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}: EnhancedUserManagementModalProps) {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState<number>(0);
  const [xpAmount, setXpAmount] = useState<number>(0);
  const [mode, setMode] = useState<"add" | "set">("add");

  useEffect(() => {
    if (user) {
      setXpAmount(user.xp || 0);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const payload: any = {
        userId: user.id,
      };

      if (subscriptionDays !== 0) {
        payload.subscriptionDays = subscriptionDays;
        payload.mode = mode;
      }

      if (xpAmount !== user.xp) {
        payload.xp = xpAmount;
      }

      if (Object.keys(payload).length === 1) {
        toast.error("No changes to apply");
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      const messages = [];

      if (subscriptionDays !== 0) {
        if (subscriptionDays > 0) {
          messages.push(mode === "add"
            ? `Added ${subscriptionDays} days to subscription`
            : `Set subscription to ${subscriptionDays} days`);
        } else {
          messages.push(`Reduced subscription by ${Math.abs(subscriptionDays)} days`);
        }
      }

      if (xpAmount !== user.xp) {
        messages.push(`Updated XP to ${xpAmount.toLocaleString()}`);
      }

      toast.success("User updated successfully", {
        description: messages.join(" and "),
      });

      onUserUpdated();
      onClose();
      setSubscriptionDays(0);
      setXpAmount(user.xp || 0);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionBadge = () => {
    if (!user) return null;

    switch (user.subscriptionStatus) {
      case "subscribed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Crown className="w-3 h-3 mr-1" />
            Subscribed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
            Not Subscribed
          </Badge>
        );
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatXP = (xp: number) => {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(1)}M`;
    } else if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
  };

  const getPreviewEndDate = () => {
    if (subscriptionDays === 0) return null;

    if (mode === "set") {
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
      return newEndDate;
    } else {
      const baseDate =
        user?.subscriptionStatus === "subscribed" && user?.subscriptionEndDate
          ? new Date(user.subscriptionEndDate)
          : new Date();
      const newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + subscriptionDays);
      return newEndDate;
    }
  };

  const getCurrentSubscriptionInfo = () => {
    if (user?.subscriptionStatus === "subscribed" && user?.subscriptionEndDate) {
      const endDate = new Date(user.subscriptionEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { endDate, daysLeft: Math.max(0, daysLeft) };
    }
    return null;
  };

  const isExpiringSoon = () => {
    if (!user) return false;
    return user.subscriptionDaysLeft !== undefined && user.subscriptionDaysLeft <= 7 && user.subscriptionDaysLeft > 0;
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-800 border-zinc-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Manage User
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update subscription and XP for {user?.username || "Unknown"}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
