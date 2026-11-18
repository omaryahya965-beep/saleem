// v2 comments (Phase 4): threads pinned on the asset, mentions, change requests. Writes go through RPCs.
import { useQuery } from "@tanstack/react-query";
import type { Database, Json } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import type { Anchor } from "@/features/collab/model";
import { ApiError } from "./data";

export type Comment = Database["public"]["Tables"]["comments"]["Row"];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new ApiError(res.error.message);
  return res.data as NonNullable<T>;
}

export const fetchComments = async (promotionId: string) =>
  check(
    await supabase.from("comments").select("*").eq("promotion_id", promotionId).order("created_at"),
  ) as Comment[];

export const addComment = async (c: {
  promotionId: string;
  submissionId: string;
  body: string;
  anchor: Anchor | null;
  parentId?: string | null;
  kind?: "general" | "change_request";
  mentions?: string[];
}) =>
  check(
    await supabase.rpc("add_comment", {
      _pid: c.promotionId,
      _sid: c.submissionId,
      _body: c.body,
      _anchor: (c.anchor as unknown as Json) ?? null,
      _parent: c.parentId ?? null,
      _kind: c.kind ?? "general",
      _mentions: c.mentions ?? [],
    }),
  ) as string;
export const editComment = async (id: string, body: string) =>
  void check(await supabase.rpc("edit_comment", { _id: id, _body: body }));
export const resolveComment = async (id: string, resolved: boolean) =>
  void check(await supabase.rpc("resolve_comment", { _id: id, _resolved: resolved }));
export const deleteComment = async (id: string) =>
  void check(await supabase.rpc("delete_comment", { _id: id }));

/** Signed URL of a version's preview (image, first PDF page or video poster) for pinning comments. */
export async function versionPreview(submissionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("submissions")
    .select("thumbnail_path, media_deleted_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!data?.thumbnail_path || data.media_deleted_at) return null;
  const { data: signed } = await supabase.storage
    .from("media")
    .createSignedUrl(data.thumbnail_path, 3600);
  return signed?.signedUrl ?? null;
}

export const ck = { comments: (pid: string) => ["comments", pid] as const };
export const useComments = (pid: string) =>
  useQuery({ queryKey: ck.comments(pid), queryFn: () => fetchComments(pid) });

/** Draft persistence; storage may be unavailable (private mode), so every access is guarded. */
export const drafts = {
  get(key: string): string {
    try {
      return localStorage.getItem(`saleem-draft:${key}`) ?? "";
    } catch {
      return "";
    }
  },
  set(key: string, value: string) {
    try {
      if (value) localStorage.setItem(`saleem-draft:${key}`, value);
      else localStorage.removeItem(`saleem-draft:${key}`);
    } catch {
      /* storage unavailable: drafts are a convenience only */
    }
  },
};
