// v2 Phase 6.3: partner links (token shown once, stored hashed), partner page, pending partner access.
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";
import type { CommunicationType } from "./promotions";

type Tables = Database["public"]["Tables"];
export type PartnerLink = Omit<Tables["partner_links"]["Row"], "token_hash">;

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
  return res.data as NonNullable<T>;
}

export interface PartnerInfo {
  ok: boolean;
  org_id?: string;
  org_name?: string;
  label?: string;
  intro_ar?: string | null;
  terms_ar?: string;
  channels?: string[];
  products?: { id: string; name_ar: string; name_en: string | null }[];
  membership?: {
    role: string;
    access_status: "active" | "pending";
    terms_accepted: boolean;
  } | null;
}

export const partnerUrl = (token: string) => `${window.location.origin}/partner/${token}`;

export const prk = {
  info: (token: string) => ["partner-info", token] as const,
  mine: (org: string) => ["partner-mine", org] as const,
  links: (org: string) => ["partner-links", org] as const,
  pending: (org: string) => ["partner-members", org] as const,
};

export const usePartnerInfo = (token: string) =>
  useQuery({
    queryKey: prk.info(token),
    queryFn: async () =>
      check(await supabase.rpc("partner_link_info", { _token: token })) as unknown as PartnerInfo,
  });

export const joinPartner = async (token: string) =>
  check(await supabase.rpc("partner_join", { _token: token, _accept_terms: true }));

export const createPartnerPromotion = async (
  token: string,
  i: {
    title: string;
    productId: string | null;
    channels: string[];
    communicationType: CommunicationType;
  },
) =>
  check(
    await supabase.rpc("partner_create_promotion", {
      _token: token,
      _title: i.title,
      _product: i.productId,
      _channels: i.channels,
      _communication_type: i.communicationType,
    }),
  );

/** «إرسالاتي»: the partner's own promotions in that organisation (RLS: owner only). */
export const useMyPartnerPromotions = (org: string | undefined, userId: string | undefined) =>
  useQuery({
    queryKey: prk.mine(org ?? ""),
    enabled: Boolean(org && userId),
    queryFn: async () =>
      check(
        await supabase
          .from("promotions")
          .select("id, title, review_status, deadline_at, updated_at")
          .eq("org_id", org!)
          .eq("owner_id", userId!)
          .order("updated_at", { ascending: false }),
      ),
  });

/** Email one-time code sign-in (Supabase Auth). */
export const sendOtp = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.href },
  });
  if (error) throw new ApiError(error.message);
};
export const verifyOtp = async (email: string, token: string) => {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new ApiError(error.message);
};

// ---------------------------------------------------------------- admin side
export const usePartnerLinks = (org: string) =>
  useQuery({
    queryKey: prk.links(org),
    queryFn: async () =>
      check(
        await supabase
          .from("partner_links")
          .select(
            "id, org_id, label, allowed_product_ids, allowed_channels, intro_ar, terms_ar, active, created_by, created_at, campaign_id, instructions_ar, expires_at, max_active_submissions, allowed_partner_ids, allowed_communication_types, rotated_at",
          )
          .eq("org_id", org)
          .order("created_at", { ascending: false }),
      ) as PartnerLink[],
  });

export const createPartnerLink = async (
  org: string,
  i: { label: string; products: string[]; channels: string[]; intro: string; terms: string },
) =>
  check(
    await supabase.rpc("create_partner_link", {
      _org: org,
      _label: i.label,
      _products: i.products,
      _channels: i.channels,
      _intro: i.intro.trim() || null,
      _terms: i.terms,
    }),
  );
export const setLinkActive = async (id: string, active: boolean) => {
  check(await supabase.rpc("set_partner_link_active", { _id: id, _active: active }));
};

export const usePartnerMembers = (org: string) =>
  useQuery({
    queryKey: prk.pending(org),
    queryFn: async () =>
      check(
        await supabase
          .from("org_members")
          .select("user_id, email, role, access_status, created_at")
          .eq("org_id", org)
          .in("role", ["external_uploader", "external_reviewer"]),
      ),
  });
export const decidePartnerAccess = async (org: string, user: string, approve: boolean) => {
  check(await supabase.rpc("decide_partner_access", { _org: org, _user: user, _approve: approve }));
};

// ---------------------------------------------------------------- V2 upgrade (D174)
// RPCs added in 20261120100000_v2_upgrade_workflow.sql, typed locally.
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

/** Payload of partner_link_info / partner_link_info_by_id / my_partner_links (never a token). */
export interface PartnerLinkView extends PartnerInfo {
  id?: string;
  instructions_ar?: string | null;
  communication_types?: string[];
  campaign?: { id: string; name: string; brand: string | null } | null;
  expires_at?: string | null;
  max_active?: number;
  my_active?: number;
  my_submissions?: { id: string; title: string; review_status: string; updated_at: string }[];
}
/** `link:<uuid>` opens an assigned link from inside the account (no token needed). */
export const isLinkRef = (ref: string) => ref.startsWith("link:");
export const usePartnerLink = (ref: string) =>
  useQuery({
    queryKey: prk.info(ref),
    queryFn: async () =>
      check(
        isLinkRef(ref)
          ? await rpc("partner_link_info_by_id", { _id: ref.slice(5) })
          : await rpc("partner_link_info", { _token: ref }),
      ) as PartnerLinkView,
  });
export const useMyPartnerLinks = (enabled = true) =>
  useQuery({
    queryKey: ["my-partner-links"],
    enabled,
    queryFn: async () => check(await rpc("my_partner_links")) as PartnerLinkView[],
  });
export const createPartnerPromotionRef = async (
  ref: string,
  i: {
    title: string;
    productId: string | null;
    channels: string[];
    communicationType: CommunicationType;
  },
) =>
  check(
    await rpc("partner_create_promotion_v2", {
      _link: isLinkRef(ref) ? ref.slice(5) : null,
      _token: isLinkRef(ref) ? null : ref,
      _title: i.title,
      _product: i.productId,
      _channels: i.channels,
      _communication_type: i.communicationType,
    }),
  ) as string;
export const cancelDraft = async (pid: string, reason: string) =>
  check(await rpc("cancel_draft_promotion", { _pid: pid, _reason: reason || null }));

export interface LinkInput {
  label: string;
  products: string[];
  channels: string[];
  communicationTypes: string[];
  intro: string;
  instructions: string;
  terms: string;
  campaignId: string;
  expiresAt: string;
  maxActive: number;
}
export const createPartnerLinkV2 = async (org: string, i: LinkInput) =>
  check(
    await rpc("create_partner_link_v2", {
      _org: org,
      _payload: {
        label: i.label,
        product_ids: i.products,
        channels: i.channels,
        communication_types: i.communicationTypes,
        intro_ar: i.intro,
        instructions_ar: i.instructions,
        terms_ar: i.terms,
        campaign_id: i.campaignId || null,
        expires_at: i.expiresAt ? new Date(`${i.expiresAt}T23:59:00`).toISOString() : null,
        max_active: i.maxActive,
      },
    }),
  ) as { id: string; token: string };
export const rotatePartnerLink = async (id: string) =>
  check(await rpc("rotate_partner_link", { _id: id })) as string;
export interface LinkStats {
  submissions: number;
  active: number;
  partners: number;
  last_submission_at: string | null;
}
export const useLinkStats = (org: string) =>
  useQuery({
    queryKey: ["partner-link-stats", org],
    queryFn: async () =>
      check(await rpc("partner_link_stats", { _org: org })) as Record<string, LinkStats>,
  });
