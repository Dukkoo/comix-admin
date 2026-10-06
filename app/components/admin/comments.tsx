// app/components/admin/comments.tsx
"use client";

import { useState } from "react";
import { MessageSquare, RefreshCw, Trash2, ThumbsUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";

interface CommentItem {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  mangaId: string;
  mangaTitle: string;
  chapterNumber: number | null;
  text: string;
  gifUrl: string | null;
  likeCount: number;
  replyCount: number;
  createdAt: string | null;
}

interface ReplyItem {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  text: string;
  gifUrl: string | null;
  likeCount: number;
  createdAt: string | null;
}

interface RepliesState {
  open: boolean;
  loading: boolean;
  items: ReplyItem[];
}

const PAGE_SIZE = 30;

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (isNaN(ms)) return "";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "саяхан";
  if (diff < 3600) return `${Math.floor(diff / 60)} минутын өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} цагийн өмнө`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} хоногийн өмнө`;
  return iso.slice(0, 10);
};

function Avatar({ url, name, size }: { url: string; name: string; size: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#00f0ff]/40 bg-[#00f0ff]/10 text-sm font-bold text-[#00f0ff] ${size}`}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        (name?.[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}

export default function Comments() {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, RepliesState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const apiRequest = async (path: string, init?: RequestInit) => {
    const token = await currentUser?.getIdToken();
    if (!token) throw new Error("Нэвтрээгүй байна");

    const response = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || (response.status === 404 ? "API route олдсонгүй (404)" : `HTTP ${response.status}`)
      );
    }
    return data;
  };

  const loadFirst = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/admin/comments?limit=${PAGE_SIZE}`);
      setComments(data.comments || []);
      setNextCursor(data.nextCursor ?? null);
      setReplies({});
      setHasFetched(true);
    } catch (err) {
      console.warn("Error fetching comments:", err);
      setError(err instanceof Error ? err.message : "Сэтгэгдэл ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest(`/api/admin/comments?limit=${PAGE_SIZE}&cursor=${nextCursor}`);
      setComments((prev) => [...prev, ...(data.comments || [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ачаалж чадсангүй");
    } finally {
      setLoadingMore(false);
    }
  };

  // Нээх үед л (эхний удаа) татна. Дахин хаагаад нээхэд дахин татахгүй, шинэчлэхийг ↻ товчоор.
  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);

    if (next && !hasFetched && !loading) {
      loadFirst();
    }
  };

  const toggleReplies = async (comment: CommentItem) => {
    const current = replies[comment.id];

    if (current?.open) {
      setReplies((prev) => ({ ...prev, [comment.id]: { ...current, open: false } }));
      return;
    }

    if (current && current.items.length > 0) {
      setReplies((prev) => ({ ...prev, [comment.id]: { ...current, open: true } }));
      return;
    }

    setReplies((prev) => ({ ...prev, [comment.id]: { open: true, loading: true, items: [] } }));

    try {
      const data = await apiRequest(`/api/admin/comments?parentId=${comment.id}`);
      setReplies((prev) => ({
        ...prev,
        [comment.id]: { open: true, loading: false, items: data.replies || [] },
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хариулт ачаалж чадсангүй");
      setReplies((prev) => ({ ...prev, [comment.id]: { open: false, loading: false, items: [] } }));
    }
  };

  const deleteComment = async (comment: CommentItem) => {
    const extra = comment.replyCount > 0 ? ` (${comment.replyCount} хариулттай)` : "";
    if (!confirm(`${comment.userName}-ийн сэтгэгдлийг устгах уу?${extra}`)) return;

    setBusyId(comment.id);
    try {
      await apiRequest("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: comment.id }),
      });
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      toast.success("Сэтгэгдэл устгагдлаа");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Устгаж чадсангүй");
    } finally {
      setBusyId(null);
    }
  };

  const deleteReply = async (comment: CommentItem, reply: ReplyItem) => {
    if (!confirm(`${reply.userName}-ийн хариултыг устгах уу?`)) return;

    setBusyId(reply.id);
    try {
      await apiRequest("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: comment.id, replyId: reply.id }),
      });
      setReplies((prev) => ({
        ...prev,
        [comment.id]: { ...prev[comment.id], items: prev[comment.id].items.filter((r) => r.id !== reply.id) },
      }));
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c))
      );
      toast.success("Хариулт устгагдлаа");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Устгаж чадсангүй");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="cyber-panel">
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <MessageSquare className="h-5 w-5 shrink-0 text-[#00f0ff]" />
          <h3 className="font-display text-lg font-semibold text-white">Сэтгэгдлүүд</h3>
          {hasFetched && comments.length > 0 && (
            <span className="text-sm tabular-nums text-zinc-500">{comments.length}</span>
          )}
          <span className="ml-auto">
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-400" />
            )}
          </span>
        </button>

        {isOpen && (
          <button
            type="button"
            onClick={loadFirst}
            disabled={loading}
            aria-label="Шинэчлэх"
            className="cyber-btn p-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {!isOpen && (
        <div className="flex flex-col items-center gap-4 border-t border-white/5 p-8 text-center">
          <MessageSquare className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-400">Сэтгэгдлийг одоогоор ачаалаагүй байна</p>
          <button type="button" onClick={handleToggle} className="cyber-btn px-5 py-2 text-sm">
            Сэтгэгдэл харах
          </button>
        </div>
      )}

      {isOpen && (
      <div className="border-t border-white/5 p-4">
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
            <button type="button" onClick={loadFirst} className="cyber-btn mt-5 px-5 py-2 text-sm">
              Дахин оролдох
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
            <p className="text-zinc-300">Сэтгэгдэл алга</p>
          </div>
        ) : (
          <div className="cyber-scroll max-h-[560px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {comments.map((comment) => {
                const state = replies[comment.id];

                return (
                  <article
                    key={comment.id}
                    className="border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-[#00f0ff]/40"
                  >
                    <div className="flex gap-3">
                      <Avatar url={comment.userAvatarUrl} name={comment.userName} size="h-9 w-9" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-white">{comment.userName}</p>
                          <span className="shrink-0 text-xs text-zinc-500">{timeAgo(comment.createdAt)}</span>
                        </div>

                        {comment.mangaTitle && (
                          <p className="truncate text-xs text-[#ff2e88]">
                            {comment.mangaTitle}
                            {comment.chapterNumber !== null && `, бүлэг ${comment.chapterNumber}`}
                          </p>
                        )}

                        {comment.text && (
                          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-sm text-zinc-300">
                            {comment.text}
                          </p>
                        )}

                        {comment.gifUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={comment.gifUrl}
                            alt="GIF"
                            loading="lazy"
                            className="mt-2 max-h-28 w-auto max-w-full border border-white/10"
                          />
                        )}

                        <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                          <span className="flex items-center gap-1 tabular-nums">
                            <ThumbsUp className="h-3 w-3" />
                            {comment.likeCount}
                          </span>
                          {comment.replyCount > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleReplies(comment)}
                              className="font-medium text-[#00f0ff] transition-colors hover:text-white"
                            >
                              {state?.open ? "Хариултыг нуух" : `${comment.replyCount} хариулт`}
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteComment(comment)}
                        disabled={busyId === comment.id}
                        aria-label="Сэтгэгдэл устгах"
                        title="Устгах"
                        className="h-8 w-8 shrink-0 cursor-pointer self-start border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>

                    {state?.open && (
                      <div className="mt-3 space-y-3 border-l border-white/15 pl-3">
                        {state.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        ) : (
                          state.items.map((reply) => (
                            <div key={reply.id} className="flex gap-2.5">
                              <Avatar url={reply.userAvatarUrl} name={reply.userName} size="h-7 w-7 text-xs" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="truncate text-xs font-semibold text-white">{reply.userName}</p>
                                  <span className="shrink-0 text-[11px] text-zinc-500">{timeAgo(reply.createdAt)}</span>
                                </div>
                                {reply.text && (
                                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-zinc-300">
                                    {reply.text}
                                  </p>
                                )}
                                {reply.gifUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={reply.gifUrl}
                                    alt="GIF"
                                    loading="lazy"
                                    className="mt-1.5 max-h-20 w-auto max-w-full border border-white/10"
                                  />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteReply(comment, reply)}
                                disabled={busyId === reply.id}
                                aria-label="Хариулт устгах"
                                title="Устгах"
                                className="h-7 w-7 shrink-0 cursor-pointer self-start border border-[#ff2e88]/40 bg-[#ff2e88]/10 text-[#ff2e88] transition-colors hover:bg-[#ff2e88]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="mx-auto h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {nextCursor !== null && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="cyber-btn flex items-center gap-2 px-6 py-2 text-sm"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Илүү харах
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </section>
  );
}