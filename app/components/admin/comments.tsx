// app/admin/components/admin/comments.tsx
"use client";

import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * АНХААРУУЛГА: API-ийн хэлбэрийг таамагласан. Өөрийнхөөрөө тааруулна уу:
 *   GET    /api/admin/comments?limit=30  ->  { comments: CommentItem[] }
 *   DELETE /api/admin/comments/:id
 */
interface CommentItem {
  id: string;
  username: string;
  text: string;
  mangaTitle?: string;
  chapterTitle?: string;
  createdAt: string | number; // ISO string эсвэл ms
}

function timeAgo(value: string | number) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "саяхан";
  if (diff < 3600) return `${Math.floor(diff / 60)} минутын өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} цагийн өмнө`;
  return `${Math.floor(diff / 86400)} хоногийн өмнө`;
}

export default function Comments() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = async () => {
    try {
      const user = getAuth().currentUser;
      return user ? await user.getIdToken() : null;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      if (!token) {
        setError("Нэвтрээгүй байна");
        return;
      }

      const response = await fetch("/api/admin/comments?limit=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "API route олдсонгүй (404): /api/admin/comments"
            : `Сервер алдаа буцаалаа (HTTP ${response.status})`
        );
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      console.warn("Error fetching comments:", err);
      setError(err instanceof Error ? err.message : "Сэтгэгдэл ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (comment: CommentItem) => {
    if (!confirm(`${comment.username}-ийн сэтгэгдлийг устгах уу?`)) return;

    setDeleting(comment.id);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/admin/comments/${comment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to delete");

      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      toast.success("Сэтгэгдэл устгагдлаа");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Сэтгэгдэл устгаж чадсангүй");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="cyber-panel">
      <div className="flex items-center gap-2 border-b border-white/5 p-4">
        <MessageSquare className="h-5 w-5 text-[#00f0ff]" />
        <h3 className="font-display text-lg font-semibold text-white">Сэтгэгдлүүд</h3>
        {!loading && comments.length > 0 && (
          <span className="text-sm text-zinc-500">{comments.length}</span>
        )}
        <button
          type="button"
          onClick={fetchComments}
          disabled={loading}
          aria-label="Шинэчлэх"
          className="cyber-btn ml-auto p-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        {loading && comments.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/5" />
            ))}
          </div>
        ) : error && comments.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-display font-semibold text-[#ff2e88]">Сэтгэгдэл ачаалж чадсангүй</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">{error}</p>
            <button
              type="button"
              onClick={fetchComments}
              className="cyber-btn mt-5 px-5 py-2 text-sm"
            >
              Дахин оролдох
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
            <p className="text-zinc-300">Сэтгэгдэл алга</p>
            <p className="mt-1 text-sm text-zinc-500">Хэрэглэгчид сэтгэгдэл үлдээхэд энд харагдана</p>
          </div>
        ) : (
          <div className="cyber-scroll grid max-h-[520px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {comments.map((comment) => (
              <article
                key={comment.id}
                className="flex gap-3 border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-[#00f0ff]/40"
              >
                <div className="font-display flex h-9 w-9 shrink-0 items-center justify-center border border-[#00f0ff]/40 bg-[#00f0ff]/10 text-sm font-bold text-[#00f0ff]">
                  {(comment.username?.[0] ?? "?").toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{comment.username}</p>
                    <span className="shrink-0 text-xs text-zinc-500">{timeAgo(comment.createdAt)}</span>
                  </div>

                  {(comment.mangaTitle || comment.chapterTitle) && (
                    <p className="truncate text-xs text-[#ff2e88]">
                      {comment.mangaTitle}
                      {comment.mangaTitle && comment.chapterTitle ? ", " : ""}
                      {comment.chapterTitle}
                    </p>
                  )}

                  <p className="mt-1.5 line-clamp-3 break-words text-sm text-zinc-300">{comment.text}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(comment)}
                  disabled={deleting === comment.id}
                  aria-label="Сэтгэгдэл устгах"
                  className="h-8 w-8 shrink-0 self-start border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}