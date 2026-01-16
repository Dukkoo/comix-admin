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
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (newIsOpen && !hasFetched) {
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
      toast.success(`${data.clearedCount || users.length} хэрэглэгчийн төхөөрөмж устгагдлаа`);
      await fetchSuspiciousUsers();
    } catch (error) {
      console.error("Error clearing all devices:", error);
      toast.error("Failed to clear all devices");
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <Card className="bg-zinc-800/50 border-zinc-700/50">
      <CardHeader 
        className="flex flex-row items-center justify-between cursor-pointer hover:bg-zinc-700/20 transition-colors rounded-t-lg"
        onClick={handleToggle}
      >
        <CardTitle className="flex items-center gap-2 text-white">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Сэжигтэй хэрэглэгчид (3+ төхөөрөмж)
          {hasFetched && users.length > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-2">
              {users.length}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {isOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fetchSuspiciousUsers();
              }}
              className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-zinc-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-400" />
          )}
        </div>
      </CardHeader>
      
      {isOpen && (
        <CardContent>
          {/* Бүх device устгах товч */}
          {users.length > 0 && (
            <div className="mb-4">
              <Button
                onClick={handleClearAllDevices}
                disabled={clearingAll}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {clearingAll 
                  ? "Устгаж байна..." 
                  : `Бүх хэрэглэгчийн төхөөрөмж устгах (${users.length})`
                }
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-zinc-700" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">Сэжигтэй хэрэглэгч олдсонгүй</p>
              <p className="text-zinc-500 text-sm mt-1">
                3+ төхөөрөмжтэй subscribed хэрэглэгч байхгүй байна
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {users.map((user) => {
                const isBanning = banning === user.id;
                const isClearing = clearingUser === user.id;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-zinc-700/30 rounded-lg border border-zinc-700 hover:border-yellow-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <p className="text-white">{user.email}</p>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <Monitor className="w-3 h-3 mr-1" />
                        {user.deviceCount}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Device устгах товч */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClearUserDevices(user.id, user.email)}
                        disabled={isClearing}
                        className="bg-purple-600/20 border-purple-500/50 text-purple-400 hover:bg-purple-600 hover:text-white"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {isClearing ? "..." : "Device"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/users/${user.id}`)}
                        className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Дэлгэрэнгүй
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleQuickBan(user.id, 7)}
                        disabled={isBanning}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        {isBanning ? "..." : "7 хоног"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleQuickBan(user.id, 30)}
                        disabled={isBanning}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        {isBanning ? "..." : "30 хоног"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}