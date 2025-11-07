"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/app/providers';
import { ArrowLeft, Crown, Calendar, Mail, User, Zap, Edit, Plus, Minus, Hash, Monitor, Trash2, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { updateUser, getUser, removeDevice, unsuspendUser } from "./actions";

interface Device {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  lastActive: string;
}

interface SuspensionInfo {
  isSuspended: boolean;
  suspendedUntil?: string;
  reason?: string;
}

interface User {
  id: string;
  userId?: number;
  username: string;
  email: string;
  xp: number;
  subscriptionStatus: "subscribed" | "not_subscribed";
  subscriptionDaysLeft?: number;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  createdAt: string;
}

interface UserEditPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default function UserEditPage({ params }: UserEditPageProps) {
  const router = useRouter();
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [suspensionInfo, setSuspensionInfo] = useState<SuspensionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState<string>("");
  const [xpAmount, setXpAmount] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [mode, setMode] = useState<"add" | "set">("add");
  const [suspendingDays, setSuspendingDays] = useState<string>("");

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setUserId(resolvedParams.userId);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        router.push("/users");
        return;
      }

      const result = await getUser(userId, token);
      
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to fetch user");
        router.push("/users");
        return;
      }

      setUser(result.data);
      setDevices(result.data.devices || []);
      setSuspensionInfo(result.data.suspensionInfo || null);
      setXpAmount(result.data.xp.toString());
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error("Failed to fetch user data");
      router.push("/users");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const subDays = subscriptionDays ? parseInt(subscriptionDays) : undefined;
    const newXp = xpAmount ? parseInt(xpAmount) : undefined;

    if (subDays === undefined && (newXp === undefined || newXp === user.xp)) {
      toast.error("Хадгалахаасаа өмнө өөрчлөлт хийнэ үү");
      return;
    }

    setSaving(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const result = await updateUser({
        userId: user.id,
        subscriptionDays: subDays,
        xp: newXp !== user.xp ? newXp : undefined,
        mode,
        authToken: token,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to update user");
        return;
      }

      toast.success("User updated successfully", {
        description: result.message,
      });

      await fetchUser();
      setSubscriptionDays("");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm("Төхөөрөмжийг устгахыг хүсэж байна уу?")) return;

    try {
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const result = await removeDevice(user!.id, deviceId, token);

      if (!result.success) {
        toast.error(result.error || "Failed to remove device");
        return;
      }

      toast.success("Төхөөрөмж устгагдлаа");
      await fetchUser();
    } catch (error) {
      console.error("Error removing device:", error);
      toast.error("Failed to remove device");
    }
  };

  const handleUnsuspend = async () => {
    if (!user) return;

    if (!confirm("Хэрэглэгчийг BAN-аас чөлөөлөхөд хүсэж байна уу?")) return;

    try {
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const result = await unsuspendUser(user.id, token);

      if (!result.success) {
        toast.error(result.error || "Failed to unsuspend user");
        return;
      }

      toast.success("Хэрэглэгч BAN-аас чөлөөллөө");
      await fetchUser();
    } catch (error) {
      console.error("Error unsuspending user:", error);
      toast.error("Failed to unsuspend user");
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

  const formatXP = (xp: number) => {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(1)}M`;
    } else if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
  };

  const getSubscriptionBadge = () => {
    if (!user) return null;
    
    if (user.subscriptionStatus === "subscribed") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-pointer">
          Идэвхжүүлсэн
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
        Идэвхжүүлээгүй
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 bg-zinc-800" />
            <div>
              <Skeleton className="h-8 w-32 mb-2 bg-zinc-800" />
              <Skeleton className="h-4 w-48 bg-zinc-800" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <Skeleton className="h-6 w-32 bg-zinc-700" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-16 w-full bg-zinc-700" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-12 bg-zinc-700" />
                  <Skeleton className="h-12 bg-zinc-700" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <Skeleton className="h-6 w-32 bg-zinc-700" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full bg-zinc-700" />
                <Skeleton className="h-10 w-full bg-zinc-700" />
                <Skeleton className="h-10 w-full bg-zinc-700" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-zinc-800/50 border-zinc-700/50">
            <CardContent className="p-8 text-center">
              <p className="text-white mb-4">User not found</p>
              <Button onClick={() => router.push("/admin/users")}>
                Буцах
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/admin/users")}
            className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Хэрэглэгчийн удирдлага</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Information Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="w-5 h-5 text-cyan-400" />
                  Хэрэглэгчийн мэдээлэл
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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
                    {user.userId && (
                      <p className="text-sm text-cyan-400 font-mono flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        ID: {user.userId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Төлөв</p>
                    {getSubscriptionBadge()}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Оноо</p>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Zap className="w-4 h-4" />
                      <span className="font-medium">{formatXP(user.xp)}</span>
                      <span className="text-xs text-zinc-500">({user.xp.toLocaleString()})</span>
                    </div>
                  </div>
                </div>

                {user.subscriptionStatus === "subscribed" && user.subscriptionDaysLeft !== undefined && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-emerald-400 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {user.subscriptionDaysLeft === 0 
                        ? "Өнөөдөр дуусна." 
                        : user.subscriptionDaysLeft === 1 
                        ? "1 өдөр дутуу байна." 
                        : `${user.subscriptionDaysLeft} өдөр дутуу байна.`
                      }
                    </p>
                    {user.subscriptionEndDate && (
                      <p className="text-xs text-emerald-300">
                        Дуусах огноо: {formatDate(user.subscriptionEndDate)}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-700">
                  Хэрэглэгч болсон огноо: {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Devices Card */}
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Monitor className="w-5 h-5 text-cyan-400" />
                  Бүртгэгдсэн төхөөрөмжүүд ({devices.length}/2)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {devices.length === 0 ? (
                  <p className="text-zinc-400 text-sm">Төхөөрөмж бүртгэгдээгүй байна</p>
                ) : (
                  <div className="space-y-3">
                    {devices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="bg-zinc-900/50 border border-zinc-700/30 rounded-lg p-4 flex justify-between items-start"
                      >
                        <div>
                          <p className="text-white font-medium">{device.deviceName}</p>
                          <p className="text-sm text-zinc-400">
                            {device.browser} • {device.os}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Сүүлд идэвхтэй: {new Date(device.lastActive).toLocaleString('mn-MN')}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleRemoveDevice(device.deviceId)}
                          variant="outline"
                          size="sm"
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Management Form Card */}
          <Card className="bg-zinc-800/50 border-zinc-700/50 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Edit className="w-5 h-5 text-cyan-400" />
                Хэрэглэгчийг тохируулах
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Suspension Status */}
              {suspensionInfo?.isSuspended && (
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    BAN-д шатаатай байна
                  </p>
                  {suspensionInfo.suspendedUntil && (
                    <p className="text-xs text-red-300">
                      Дуусах: {formatDate(suspensionInfo.suspendedUntil)}
                    </p>
                  )}
                  {suspensionInfo.reason && (
                    <p className="text-xs text-red-300">
                      Шалтгаан: {suspensionInfo.reason}
                    </p>
                  )}
                  <Button
                    onClick={handleUnsuspend}
                    size="sm"
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    BAN чөлөөлөх
                  </Button>
                </div>
              )}

              {/* Subscription Management */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-300 mb-2 block">
                    Эрхийн хугацаа
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={mode === "add" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode("add")}
                      className={mode === "add"
                        ? "bg-cyan-600 hover:bg-cyan-700 cursor-pointer" 
                        : "bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600 cursor-pointer"
                      }
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Нэмэх
                    </Button>
                    <Button
                      type="button"
                      variant={mode === "set" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode("set")}
                      className={mode === "set" 
                        ? "bg-cyan-600 hover:bg-cyan-700 cursor-pointer" 
                        : "bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600 cursor-pointer"
                      }
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Тохируулах
                    </Button>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={subscriptionDays}
                    onChange={(e) => setSubscriptionDays(e.target.value)}
                    placeholder={mode === "add" ? "Хоногийн тоо оруулах" : "Total days"}
                    className="bg-zinc-700/50 border-zinc-600 text-white placeholder-zinc-400"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {mode === "add" 
                      ? "Хоногийн тоо нэмэх" 
                      : "Хоногийн тоог шууд оруулах"
                    }
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSubscriptionDays("7")}
                    className="bg-zinc-700/50 border-zinc-600 text-white hover:bg-zinc-600"
                  >
                    7 өдөр
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSubscriptionDays("30")}
                    className="bg-zinc-700/50 border-zinc-600 text-white hover:bg-zinc-600"
                  >
                    30 өдөр
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSubscriptionDays("0")}
                    className="bg-red-700/50 border-red-600 text-red-300 hover:bg-red-600"
                  >
                    <Minus className="w-3 h-3 mr-1" />
                    Дуусгах
                  </Button>
                </div>
              </div>

              {/* XP Management */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 block">
                  Онооны хэмжээ
                </label>
                <Input
                  type="number"
                  min="0"
                  value={xpAmount}
                  onChange={(e) => setXpAmount(e.target.value)}
                  placeholder="Онооны хэмжээ оруулах"
                  className="bg-zinc-700/50 border-zinc-600 text-white placeholder-zinc-400"
                />
                <p className="text-xs text-zinc-500">
                  Одоогоор {user.xp.toLocaleString()} оноотой байна.
                </p>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving || (!subscriptionDays && (!xpAmount || parseInt(xpAmount) === user.xp))}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Хадгалж байна...
                  </>
                ) : (
                  "Хадгалах"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}