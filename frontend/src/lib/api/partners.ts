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
            "id, org_id, label, allowed_product_ids, allowed_channels, intro_ar, terms_ar, active, created_by, created_at",
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
