// app/users/[userId]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/app/providers';
import { ArrowLeft, Crown, Calendar, Mail, User, Zap, Edit, Plus, Minus, Hash, Monitor, Trash2, Ban, RotateCcw, AlertTriangle, MapPin, Globe, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { updateUser, getUser, removeDevice, banUser, unbanUser } from "./actions";
import { formatDistanceToNow } from "date-fns";

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
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
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
        router.push("/admin/users");
        return;
      }

      const result = await getUser(userId, token);
      
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to fetch user");
        router.push("/admin/users");
        return;
      }

      setUser(result.data);
      setXpAmount(result.data.xp.toString());
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error("Failed to fetch user data");
      router.push("/admin/users");
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

  const handleBan = async (days: number) => {
    if (!user) return;
    if (!confirm(`${days} хоногийн бан өгөх үү?`)) return;

    setBanning(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const result = await banUser(
        user.id,
        days,
        "Account sharing detected - multiple devices",
        token
      );

      if (!result.success) {
        toast.error(result.error || "Failed to ban user");
        return;
      }

      toast.success(`${days} хоногийн бан амжилттай өгөгдлөө`);
      await fetchUser();
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user");
    } finally {
      setBanning(false);
    }
  };

  const handleUnban = async () => {
    if (!user) return;
    if (!confirm("Бан цуцлах уу?")) return;

    setBanning(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const result = await unbanUser(user.id, token);

      if (!result.success) {
        toast.error(result.error || "Failed to unban user");
        return;
      }

      toast.success("Бан амжилттай цуцлагдлаа");
      await fetchUser();
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Failed to unban user");
    } finally {
      setBanning(false);
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

  const getDeviceIcon = (deviceName?: string) => {
    // Handle undefined or null deviceName
    if (!deviceName) {
      return <Monitor className="w-5 h-5 text-gray-400" />;
    }
    
    const name = deviceName.toLowerCase();
    
    if (name.includes("android") || name.includes("iphone")) {
      return <Smartphone className="w-5 h-5 text-cyan-400" />;
    }
    if (name.includes("ipad") || name.includes("tablet")) {
      return <Tablet className="w-5 h-5 text-purple-400" />;
    }
    return <Monitor className="w-5 h-5 text-blue-400" />;
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
          <Skeleton className="h-10 w-32 bg-zinc-800" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-zinc-800/50 border-zinc-700/50">
              <CardContent className="p-6">
                <Skeleton className="h-32 w-full bg-zinc-700" />
              </CardContent>
            </Card>
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full bg-zinc-700" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6 flex items-center justify-center">
        <Card className="bg-zinc-800/50 border-zinc-700/50">
          <CardContent className="p-8 text-center">
            <p className="text-white mb-4">User not found</p>
            <Button onClick={() => router.push("/admin/users")}>
              Буцах
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuspicious = user.deviceCount >= 3;

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
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {user.username}
              {user.banned && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  <Ban className="w-3 h-3 mr-1" /> BANNED
                </Badge>
              )}
              {isSuspicious && !user.banned && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" /> SUSPICIOUS
                </Badge>
              )}
            </h1>
            <p className="text-sm text-zinc-400">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Info Card */}
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="w-5 h-5 text-cyan-400" />
                  Хэрэглэгчийн мэдээлэл
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Төлөв</p>
                    {getSubscriptionBadge()}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Оноо</p>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Zap className="w-4 h-4" />
                      <span className="font-medium">{formatXP(user.xp)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">ID</p>
                    <p className="text-cyan-400 font-mono">#{user.userId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Төхөөрөмж</p>
                    <p className="font-bold text-white">{user.deviceCount} / 2</p>
                  </div>
                </div>

                {user.banned && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 font-medium">
                      Бан дуусах: {user.banExpiry ? formatDate(user.banExpiry) : "N/A"}
                    </p>
                    <p className="text-sm text-zinc-400 mt-1">Шалтгаан: {user.banReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Devices Card */}
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-cyan-400" />
                    Бүртгэлтэй төхөөрөмжүүд ({user.deviceCount})
                  </span>
                  {isSuspicious && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      ⚠️ 2+ төхөөрөмж
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {user.devices.length === 0 ? (
                  <p className="text-zinc-400 text-sm">Төхөөрөмж бүртгэгдээгүй байна</p>
                ) : (
                  <div className="space-y-4">
                    {user.devices.map((device, index) => (
                      <div
                        key={`${device.deviceId}-${index}`}
                        className="p-4 bg-zinc-700/30 rounded-lg border border-zinc-700"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">{getDeviceIcon(device.deviceName)}</div>
                            <div>
                              <h4 className="text-white font-medium">
                                {device.deviceName || "Unknown Device"}
                              </h4>
                              <p className="text-sm text-zinc-400">
                                {device.browser || "Unknown"} · {device.os || "Unknown"}
                              </p>
                              {device.ipAddress && (
                                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {device.ipAddress}
                                  </span>
                                  {device.timezone && (
                                    <span className="flex items-center gap-1">
                                      <Globe className="w-3 h-3" />
                                      {device.timezone}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {index === 0 && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              Үндсэн
                            </Badge>
                          )}
                        </div>
                        <Separator className="my-3 bg-zinc-700" />
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <div className="flex items-center gap-4">
                            {device.firstSeen && (
                              <span>Анх: {new Date(device.firstSeen).toLocaleDateString()}</span>
                            )}
                            <span>
                              Сүүлд: {device.lastUsed || device.lastActive 
                                ? formatDistanceToNow(new Date(device.lastUsed || device.lastActive!), { addSuffix: true })
                                : "N/A"
                              }
                            </span>
                          </div>
                          <Button
                            onClick={() => handleRemoveDevice(device.deviceId)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Management */}
          <div className="space-y-6">
            {/* Subscription & XP Management */}
            <Card className="bg-zinc-800/50 border-zinc-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Edit className="w-5 h-5 text-cyan-400" />
                  Хэрэглэгчийг тохируулах
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subscription */}
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
                          ? "bg-cyan-600 hover:bg-cyan-700" 
                          : "bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
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
                          ? "bg-cyan-600 hover:bg-cyan-700" 
                          : "bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
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
                      placeholder="Хоногийн тоо"
                      className="bg-zinc-700/50 border-zinc-600 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSubscriptionDays("7")}
                      className="bg-zinc-700/50 border-zinc-600 text-white"
                    >
                      7 өдөр
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSubscriptionDays("30")}
                      className="bg-zinc-700/50 border-zinc-600 text-white"
                    >
                      30 өдөр
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSubscriptionDays("0")}
                      className="bg-red-700/50 border-red-600 text-red-300"
                    >
                      <Minus className="w-3 h-3 mr-1" />
                      Дуусгах
                    </Button>
                  </div>
                </div>

                {/* XP */}
                <div>
                  <label className="text-sm font-medium text-zinc-300 block mb-2">
                    Онооны хэмжээ
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={xpAmount}
                    onChange={(e) => setXpAmount(e.target.value)}
                    className="bg-zinc-700/50 border-zinc-600 text-white"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                >
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </Button>
              </CardContent>
            </Card>

            {/* Ban Controls */}
            {user.subscriptionStatus === "subscribed" && (
              <Card className="bg-zinc-800/50 border-zinc-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Ban удирдлага</CardTitle>
                </CardHeader>
                <CardContent>
                  {user.banned ? (
                    <Button
                      onClick={handleUnban}
                      disabled={banning}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Бан цуцлах
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleBan(7)}
                        disabled={banning}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        7 хоног бан
                      </Button>
                      <Button
                        onClick={() => handleBan(30)}
                        disabled={banning}
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        30 хоног бан
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}