"use client";
import { useState, useEffect } from "react";
import { useAuth } from '@/app/providers';
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Search, Users, Zap } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  userId?: number; // 5 оронтой ID
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
  const [searchType, setSearchType] = useState<"id" | "email">("id");
  
  const pageSize = 25;

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
        sortBy: 'createdAt', // Sort by creation date
        sortOrder: 'desc', // Newest first
      });

      if (search && search.trim()) {
        // Determine search type automatically
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

  // Debounced search - triggers automatically as user types
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm.trim().length >= 2 || searchTerm.trim().length === 0) {
        setCurrentPage(1);
        fetchUsers(1, searchTerm, filterStatus);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

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
            Өнөөдөр дуусна
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

  const getSearchPlaceholder = () => {
    if (searchTerm.includes('@')) {
      return "Цахим шуудангаар хайх...";
    } else if (searchTerm && /^\d/.test(searchTerm)) {
      return "ID-аар хайх (жнь: 12345)";
    }
    return "ID, цахим шуудан эсвэл нэрээр хайх...";
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="w-full">
          <div className="flex flex-col items-center justify-center py-20">
            <span className="loader"></span>
            <p className="mt-4 text-zinc-400">Хэрэглэгчдийг уншиж байна...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="w-full">
        {/* Stats Card */}
        <Card className="bg-zinc-800/50 border-zinc-700/50 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Users className="w-8 h-8 text-cyan-400" />
              <div>
                <p className="text-2xl font-bold text-white">{totalCount}</p>
                <p className="text-sm text-zinc-400">Нийт хэрэглэгч</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter Card */}
        <Card className="bg-zinc-800/50 border-zinc-700/50 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
                <Input
                  placeholder={getSearchPlaceholder()}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-zinc-700/50 border-zinc-600/50 text-white placeholder-zinc-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    ×
                  </button>
                )}
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
              <Button
                onClick={handleSearch}
                className="bg-cyan-600 hover:bg-cyan-700 cursor-pointer"
              >
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
                  <TableHead className="text-zinc-300"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center">
                        <span className="loader"></span>
                        <p className="mt-4 text-zinc-400">Уншиж байна...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                      Хэрэглэгч олдсонгүй...
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-zinc-700/50 hover:bg-zinc-800/30"
                    >
                      <TableCell className="text-zinc-300 font-mono text-sm">
                        {user.userId ? (
                          <span className="text-cyan-400">#{user.userId}</span>
                        ) : (
                          <span className="text-orange-400 text-xs" title={user.id}>
                            Firebase UID
                          </span>
                        )}
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
                          onClick={() => router.push(`/users/${user.id}`)}
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