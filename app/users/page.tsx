// app/admin/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from '@/app/providers';
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Crown, Calendar, Zap } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
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
  const pageSize = 25; // Fixed page size

  const fetchUsers = async (page: number = 1, search?: string, status?: string) => {
    try {
      setLoading(true);
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (search && search.trim()) {
        params.append('search', search.trim());
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
        throw new Error('Failed to fetch users');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.data);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
      setTotalCount(data.totalCount);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, searchTerm, filterStatus);
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
    switch (user.subscriptionStatus) {
      case "subscribed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            Идэвхжүүлсэн
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
            Идэвхжүүлээгүй
          </Badge>
        );
    }
  };

  const getDaysLeftText = (user: User) => {
    if (user.subscriptionStatus === "subscribed" && user.subscriptionDaysLeft !== undefined) {
      if (user.subscriptionDaysLeft === 0) {
        return (
          <span className="text-red-400 font-medium">
            Expires today
          </span>
        );
      } else if (user.subscriptionDaysLeft === 1) {
        return (
          <span className="text-orange-400 font-medium">
            1 өдөр дутуу
          </span>
        );
      } else if (user.subscriptionDaysLeft <= 7) {
        return (
          <span className="text-yellow-400 font-medium">
            {user.subscriptionDaysLeft} өдөр үлдсэн 
          </span>
        );
      } else {
        return (
          <span className="text-emerald-400 font-medium">
            {user.subscriptionDaysLeft} өдөр үлдсэн
          </span>
        );
      }
    }
    return <span className="text-zinc-500">-</span>;
  };

  const formatXP = (xp: number) => {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(1)}M`;
    } else if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="max-w-[1400px] mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2 bg-zinc-800" />
            <Skeleton className="h-4 w-96 bg-zinc-800" />
          </div>

          {/* Search and Filters Skeleton */}
          <Card className="bg-zinc-800/50 border-zinc-700/50 mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Skeleton className="h-10 flex-1 bg-zinc-700" />
                <Skeleton className="h-10 w-32 bg-zinc-700" />
                <Skeleton className="h-10 w-24 bg-zinc-700" />
              </div>
            </CardContent>
          </Card>

          {/* Table Skeleton */}
          <Card className="bg-zinc-800/50 border-zinc-700/50">
            <CardContent className="p-0">
              <div className="space-y-4 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-16 bg-zinc-700" />
                    <Skeleton className="h-4 w-32 bg-zinc-700" />
                    <Skeleton className="h-4 w-48 bg-zinc-700" />
                    <Skeleton className="h-6 w-20 bg-zinc-700" />
                    <Skeleton className="h-4 w-24 bg-zinc-700" />
                    <Skeleton className="h-4 w-16 bg-zinc-700" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">ХЭРЭГЛЭГЧИЙН УДИРДЛАГА</h1>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-zinc-800/50 border-zinc-700/50 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
                <Input
                  placeholder="Хэрэглэгчийг ID-аар хайх"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-zinc-700/50 border-zinc-600/50 text-white placeholder-zinc-400"
                />
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 bg-zinc-700/50 border-zinc-600/50 text-white cursor-pointer">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem className="cursor-pointer" value="all">Бүх хэрэглэгч</SelectItem>
                  <SelectItem className="cursor-pointer" value="subscribed">Идэвхжүүлсэн</SelectItem>
                  <SelectItem className="cursor-pointer" value="not_subscribed">Идэвхжүүлээгүй</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleSearch} className="bg-cyan-600 hover:bg-cyan-700 cursor-pointer">
                Хайх
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-zinc-800/50 border-zinc-700/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-700/50 hover:bg-transparent">
                  <TableHead className="text-zinc-300">ID</TableHead>
                  <TableHead className="text-zinc-300">Нэр</TableHead>
                  <TableHead className="text-zinc-300">Цахим шуудан</TableHead>
                  <TableHead className="text-zinc-300">Төлөв</TableHead>
                  <TableHead className="text-zinc-300">Хугацаа</TableHead>
                  <TableHead className="text-zinc-300">Оноо</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-700/50">
                      <TableCell><Skeleton className="h-4 w-16 bg-zinc-700" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 bg-zinc-700" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32 bg-zinc-700" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 bg-zinc-700" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 bg-zinc-700" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 bg-zinc-700" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 bg-zinc-700" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                      Хэрэглэгч олдсонгүй...
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="border-zinc-700/50 hover:bg-zinc-800/30">
                      <TableCell className="text-zinc-300 font-mono text-sm">
                        {user.id}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {getSubscriptionBadge(user)}
                      </TableCell>
                      <TableCell>
                        {getDaysLeftText(user)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">{formatXP(user.xp)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/admin/users/${user.id}`)}
                          className="bg-zinc-700/50 border-zinc-600 text-white hover:bg-zinc-600 cursor-pointer"
                        >
                          Засварлах
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Previous
            </Button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    disabled={loading}
                    className={
                      currentPage === page
                        ? "bg-cyan-600 text-white"
                        : "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                    }
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}