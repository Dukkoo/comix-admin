// components/admin/user-management-modal.tsx
"use client";

import { useState } from "react";
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
import { Crown, Zap, Calendar, Mail, User } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  createdAt: string;
}

interface UserManagementModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

export default function UserManagementModal({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}: UserManagementModalProps) {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState<number>(0);
  const [xpAmount, setXpAmount] = useState<number>(0);

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

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          subscriptionDays: subscriptionDays || undefined,
          xp: xpAmount || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      toast.success("User updated successfully");
      onUserUpdated();
      onClose();
      setSubscriptionDays(0);
      setXpAmount(0);
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

  const formatDate = (dateString: string) => {
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

  if (!user) {
    console.log("Modal: No user provided"); // Debug log
    return null;
  }

  console.log("Modal: Rendering for user:", user.username, "isOpen:", isOpen); // Debug log

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-800 border-zinc-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Manage User
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update subscription and XP for {user.username}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{user.username}</h3>
                <p className="text-sm text-zinc-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Status</p>
                {getSubscriptionBadge()}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Current XP</p>
                <div className="flex items-center gap-1 text-yellow-400">
                  <Zap className="w-4 h-4" />
                  <span className="font-medium">{formatXP(user.xp)}</span>
                </div>
              </div>
            </div>

            {user.subscriptionStatus === "subscribed" && user.subscriptionDaysLeft !== undefined && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                <p className="text-sm text-emerald-400">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {user.subscriptionDaysLeft === 0 
                    ? "Expires today" 
                    : user.subscriptionDaysLeft === 1 
                    ? "1 day remaining" 
                    : `${user.subscriptionDaysLeft} days remaining`
                  }
                </p>
                {user.subscriptionEndDate && (
                  <p className="text-xs text-emerald-300">
                    Expires: {formatDate(user.subscriptionEndDate)}
                  </p>
                )}
                {user.subscriptionStartDate && (
                  <p className="text-xs text-emerald-300">
                    Started: {formatDate(user.subscriptionStartDate)}
                  </p>
                )}
              </div>
            )}

            <div className="text-xs text-zinc-500">
              Member since: {formatDateOnly(user.createdAt)}
            </div>
          </div>

          <Separator className="bg-zinc-700" />

          {/* Management Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscriptionDays" className="text-sm font-medium text-zinc-300">
                Subscription Management
              </Label>
              <Input
                id="subscriptionDays"
                type="number"
                min="0"
                max="365"
                value={subscriptionDays}
                onChange={(e) => setSubscriptionDays(parseInt(e.target.value) || 0)}
                placeholder="Enter days to add (0 to remove subscription)"
                className="bg-zinc-700/50 border-zinc-600 text-white placeholder-zinc-400"
              />
              <div className="space-y-1 text-xs text-zinc-500">
                <p>• Enter days to add to current subscription</p>
                <p>• Set to 0 to remove subscription immediately</p>
                <p>• Maximum 365 days per transaction</p>
                <p>• Time starts from the moment you click "Update User"</p>
              </div>
              
              {subscriptionDays > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-sm text-blue-400">
                    Preview: Subscription will expire on{" "}
                    {new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000).toLocaleString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="xpAmount" className="text-sm font-medium text-zinc-300">
                Set XP Amount
              </Label>
              <Input
                id="xpAmount"
                type="number"
                min="0"
                value={xpAmount}
                onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
                placeholder="Enter new XP amount"
                className="bg-zinc-700/50 border-zinc-600 text-white placeholder-zinc-400"
              />
              <p className="text-xs text-zinc-500">
                Current XP: {user.xp.toLocaleString()}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || (subscriptionDays === 0 && xpAmount === 0)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </div>
                ) : (
                  "Update User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}