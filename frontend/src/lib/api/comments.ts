// v2 comments (Phase 4): threads pinned on the asset, mentions, change requests. Writes go through RPCs.
import { useQuery } from "@tanstack/react-query";
import type { Database, Json } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import type { Anchor } from "@/features/collab/model";
import { ApiError } from "./data";

export type Comment = Database["public"]["Tables"]["comments"]["Row"];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
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
  kind?: CommentKind;
  mentions?: string[];
  links?: string[];
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
      _links: c.links ?? [],
    } as never),
  ) as string;

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

// ---- V2 completion (D189): categories, eligible mention targets, author names/roles ----
export type CommentKind =
  "general" | "question" | "change_request" | "reviewer_feedback" | "legal_opinion" | "evidence";
export const COMMENT_KINDS: CommentKind[] = [
  "general",
  "question",
  "evidence",
  "change_request",
  "reviewer_feedback",
  "legal_opinion",
];
export interface Participant {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
}
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
/** People who can already read this advertisement (empty for external callers). */
export const useParticipants = (pid: string) =>
  useQuery({
    queryKey: ["comment-participants", pid],
    queryFn: async () => check(await rpc("comment_participants", { _pid: pid })) as Participant[],
  });
/** Authors' names and roles (externals receive roles only). */
export const useCommentAuthors = (pid: string) =>
  useQuery({
    queryKey: ["comment-authors", pid],
    queryFn: async () =>
      check(await rpc("comment_authors", { _pid: pid })) as Record<
        string,
        { name: string | null; role: string | null }
      >,
  });
