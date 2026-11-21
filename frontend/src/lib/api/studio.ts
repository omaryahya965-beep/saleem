// SALEEM AI Studio API (D207): drafts (RLS: creator only), the «studio» Edge Function (script, scene, review,
// estimate) and acceptance. Types mirror backend/supabase/functions/_shared/studio.ts.
import { supabase } from "@/lib/supabase";
/** Studio errors carry the server code (provider_not_configured, quota_exhausted, fabricated_*, …). */
export class StudioApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export type Aspect = "9:16" | "16:9" | "1:1";
export type Style = "product" | "presenter" | "lifestyle" | "animated";
export interface StudioBrief {
  language: "ar" | "en";
  dialect: "msa" | "saudi";
  tone: string;
  style: Style;
  aspect: Aspect;
  duration: number;
  narration: "male" | "female" | "none";
  cta: string;
  instructions: string;
  product: {
    name: string;
    description: string;
    sector: string | null;
    benefits: string[];
    verified_claims: string[];
  };
  brand: { name: string; identity: string; colors: string[] };
  campaign: { name: string; objective: string; platform: string; audience: string };
  context: {
    communication_type: string;
    is_paid: boolean;
    publisher: string;
    channels: string[];
    ai_used: boolean;
  };
}
export interface StudioScene {
  index: number;
  start: number;
  duration: number;
  visual: string;
  narration: string;
  on_screen: string;
  direction: string;
}
export interface StudioScript {
  concept: string;
  hook: string;
  scenes: StudioScene[];
  caption: string;
  cta: string;
  disclosures: string[];
}
export interface ReviewItem {
  code: string;
  severity: "violation" | "warning";
  scene: number | null;
  where: "narration" | "on_screen" | "caption" | "brief";
  text: string;
  message_ar: string;
  message_en: string;
  suggestion_ar: string;
  suggestion_en: string;
}
export type DraftStatus =
  | "brief"
  | "generating"
  | "script_ready"
  | "reviewed"
  | "rendered"
  | "accepted"
  | "discarded"
  | "failed";
export interface StudioDraft {
  id: string;
  org_id: string | null;
  mode: "create" | "replacement";
  source_promotion_id: string | null;
  product_id: string | null;
  campaign_id: string | null;
  brief: StudioBrief;
  script: StudioScript | null;
  review: { items: ReviewItem[]; checked_at: string; engine: string } | null;
  status: DraftStatus;
  script_provider: "gemini" | "template" | "manual" | null;
  voice_provider: string | null;
  render_provider: string | null;
  error_code: string | null;
  result_promotion_id: string | null;
  result_submission_id: string | null;
  updated_at: string;
}

export const DEFAULT_BRIEF: StudioBrief = {
  language: "ar",
  dialect: "msa",
  tone: "warm",
  style: "product",
  aspect: "9:16",
  duration: 15,
  narration: "male",
  cta: "",
  instructions: "",
  product: { name: "", description: "", sector: null, benefits: [], verified_claims: [] },
  brand: { name: "", identity: "", colors: ["#0b6e4f", "#07211a"] },
  campaign: { name: "", objective: "", platform: "instagram", audience: "" },
  context: {
    communication_type: "general_commercial",
    is_paid: true,
    publisher: "owned",
    channels: ["instagram"],
    ai_used: true,
  },
};

/** Platform defaults: vertical 15 s for stories/reels/snap, horizontal 30 s for YouTube, square 15 s for feeds. */
export function platformDefaults(platform: string): Pick<StudioBrief, "aspect" | "duration"> {
  if (platform === "youtube") return { aspect: "16:9", duration: 30 };
  if (platform === "x" || platform === "linkedin") return { aspect: "1:1", duration: 15 };
  return { aspect: "9:16", duration: 15 };
}

// Tables/RPCs added in 20261121170000 are not in the generated types yet.
const table = () =>
  (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(
    "studio_drafts",
  );
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const fail = (e: { message: string } | null) => {
  if (e) throw new StudioApiError(e.message, e.message.match(/code:([a-z_]+)/)?.[1] ?? "unknown");
};

export async function createDraft(input: {
  orgId: string | null;
  brief: StudioBrief;
  mode?: "create" | "replacement";
  sourcePromotionId?: string | null;
  productId?: string | null;
  campaignId?: string | null;
}): Promise<StudioDraft> {
  const { data, error } = await table()
    .insert({
      org_id: input.orgId,
      brief: input.brief,
      mode: input.mode ?? "create",
      source_promotion_id: input.sourcePromotionId ?? null,
      product_id: input.productId ?? null,
      campaign_id: input.campaignId ?? null,
    } as never)
    .select("*")
    .single();
  fail(error);
  return data as unknown as StudioDraft;
}

export async function getDraft(id: string): Promise<StudioDraft> {
  const { data, error } = await table().select("*").eq("id", id).single();
  fail(error);
  return data as unknown as StudioDraft;
}

export async function listDrafts(): Promise<StudioDraft[]> {
  const { data, error } = await table()
    .select("*")
    .not("status", "in", "(accepted,discarded)")
    .order("updated_at", { ascending: false })
    .limit(10);
  fail(error);
  return (data ?? []) as unknown as StudioDraft[];
}

export async function saveDraft(
  id: string,
  patch: Partial<
    Pick<
      StudioDraft,
      | "brief"
      | "script"
      | "status"
      | "voice_provider"
      | "render_provider"
      | "product_id"
      | "campaign_id"
      | "script_provider"
    >
  >,
): Promise<void> {
  const { error } = await table()
    .update(patch as never)
    .eq("id", id);
  fail(error);
}

type StudioAction = "estimate" | "script" | "scene" | "review";
export async function callStudio<T>(
  draftId: string,
  action: StudioAction,
  extra: { provider?: "gemini" | "template"; scene_index?: number; note?: string } = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("studio", {
    body: { draft_id: draftId, action, ...extra },
  });
  if (error) {
    let code = "unknown";
    try {
      const body = await (error as { context?: Response }).context?.json();
      code = String(body?.error ?? "").replace(/^code:/, "") || code;
    } catch {
      /* not JSON */
    }
    throw new StudioApiError(error.message, code);
  }
  return data as T;
}

export interface StudioEstimate {
  providers: { template: { configured: boolean }; gemini: { configured: boolean; model: string } };
  estimate: { inputTokens: number; outputTokens: number; usd: number | null; model: string };
  allowance: { ok: boolean; used: number; limit: number } | null;
}

export async function acceptDraft(id: string, promotionId: string, submissionId: string) {
  const { error } = await rpc("accept_studio_draft", {
    _id: id,
    _promotion: promotionId,
    _submission: submissionId,
  });
  fail(error);
}
export async function discardDraft(id: string) {
  const { error } = await rpc("discard_studio_draft", { _id: id });
  fail(error);
}
