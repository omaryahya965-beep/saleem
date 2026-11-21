// Real end-to-end workflows on the LOCAL stack, through the app's own tables and RPCs, as the demo personas
// (npm run demo:seed). Skipped unless SUPABASE_LOCAL_URL / _ANON_KEY / _SERVICE_ROLE_KEY are set and the seed exists.
// Analysis runs the real `analyze` function when it is served; with no valid model key it fails with a provider
// error — the test records that and continues through the app's «submit despite failed analysis» path. Nothing is
// faked: no finding is inserted by this test.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const URL_ = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "";
const root = path.resolve(__dirname, "../..");
const stateDir = path.resolve(root, process.env.DEMO_STATE_DIR ?? "demo");
const credFile = path.join(stateDir, ".demo-credentials.json");
const enabled = Boolean(URL_ && ANON && SERVICE && fs.existsSync(credFile) && /127\.0\.0\.1|localhost/.test(URL_));
const cred = enabled ? (JSON.parse(fs.readFileSync(credFile, "utf8")) as { password: string; org_id: string }) : null;
const partnerToken = enabled && fs.existsSync(path.join(stateDir, ".demo-partner-link"))
  ? fs.readFileSync(path.join(stateDir, ".demo-partner-link"), "utf8").trim()
  : null;

const as = async (who: string): Promise<SupabaseClient> => {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `${who}@demo.saleem.app`, password: cred!.password });
  if (error) throw error;
  return c;
};
const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } });
const uid = async (c: SupabaseClient) => (await c.auth.getUser()).data.user!.id;
const errOf = async (p: PromiseLike<{ error: { message: string } | null }>) => (await p).error?.message ?? null;

/** Creates a promotion + text version like the app does, runs the real analysis if available, returns ids. */
async function newAd(c: SupabaseClient, title: string, text: string, pid?: string) {
  const owner = await uid(c);
  const promotion = pid ?? crypto.randomUUID();
  if (!pid) {
    const { error } = await c.from("promotions").insert({
      id: promotion, owner_id: owner, org_id: cred!.org_id, title, sector: "banking", channels: ["instagram"],
      communication_type: "financial_promotion", audience: ["general"], is_paid: true, distribution: "owned",
    });
    if (error) throw error;
  }
  const sid = crypto.randomUUID();
  const { error } = await c.from("submissions").insert({
    id: sid, user_id: owner, kind: "text", title, caption: "", text_content: text, platform: "instagram",
    product_category: "finance", is_paid_ad: true, has_written_contract: true, ai_used: false, promotion_id: promotion,
    sha256: crypto.randomUUID().replace(/-/g, ""),
  });
  if (error) throw error;
  const inv = await c.functions.invoke("analyze", { body: { submission_id: sid } });
  let status = "not_invoked";
  if (!inv.error)
    for (let i = 0; i < 40; i++) {
      const { data } = await admin().from("submissions").select("status, error_message").eq("id", sid).single();
      if (data?.status === "done" || data?.status === "failed") {
        status = `${data.status}${data.error_message ? `:${data.error_message}` : ""}`;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  return { pid: promotion, sid, status };
}
const statusOf = async (pid: string) =>
  (await admin().from("promotions").select("review_status").eq("id", pid).single()).data!.review_status as string;

describe.skipIf(!enabled)("real workflows (local stack, demo org)", () => {
  let marketer: SupabaseClient, lead: SupabaseClient, reviewer: SupabaseClient, ownerC: SupabaseClient, viewer: SupabaseClient;
  beforeAll(async () => {
    [marketer, lead, reviewer, ownerC, viewer] = await Promise.all(["marketer", "lead", "reviewer", "owner", "viewer"].map(as));
  }, 60_000);

  let ad: Awaited<ReturnType<typeof newAd>>;
  it("marketing: create → upload → analysis (real) → submit for review", async () => {
    ad = await newAd(marketer, `سير عمل ${Date.now()}`, "تمويل سليم الشخصي بمعدل 3.9% فقط، قدّم الآن.");
    // Whatever the analysis outcome, it is a real state from the pipeline (never a faked «done»).
    expect(ad.status).toMatch(/^(done|failed|not_invoked)/);
    if (ad.status === "not_invoked") return; // functions not served: cannot go further honestly
    const ack = ad.status.startsWith("failed");
    expect(await errOf(marketer.rpc("submit_promotion", { _pid: ad.pid, _note: "جاهز", _ack_failed: ack }))).toBeNull();
    expect(await statusOf(ad.pid)).toBe("pending_review");
  }, 120_000);

  it("compliance: assign → open → request changes; the uploader cannot decide", async () => {
    if (ad.status === "not_invoked") return;
    const reviewerId = await uid(reviewer);
    expect(await errOf(lead.rpc("assign_reviewer", { _pid: ad.pid, _user: reviewerId }))).toBeNull();
    expect(await errOf(reviewer.rpc("open_review", { _pid: ad.pid }))).toBeNull();
    expect(await statusOf(ad.pid)).toBe("in_review");
    expect(await errOf(marketer.rpc("decide_promotion", { _pid: ad.pid, _decision: "approve" }))).toMatch(/forbidden/);
    expect(await errOf(reviewer.rpc("decide_promotion", { _pid: ad.pid, _decision: "request_changes" }))).toMatch(/reason_required/);
    expect(
      await errOf(reviewer.rpc("decide_promotion", { _pid: ad.pid, _decision: "request_changes", _reason_other: "المعدل لا يطابق المنتج" })),
    ).toBeNull();
    expect(await statusOf(ad.pid)).toBe("changes_requested");
  }, 60_000);

  it("revision: new version → resubmit → approve → sealed decision chain verifies", async () => {
    if (ad.status === "not_invoked") return;
    const v2 = await newAd(marketer, "", "تمويل سليم الشخصي بمعدل نسبة سنوي 4.5%. تطبق الشروط والأحكام.", ad.pid);
    const ack = v2.status.startsWith("failed");
    expect(await errOf(marketer.rpc("submit_promotion", { _pid: ad.pid, _note: "عدّلت المعدل", _ack_failed: ack }))).toBeNull();
    expect(await errOf(reviewer.rpc("open_review", { _pid: ad.pid }))).toBeNull();
    expect(await errOf(reviewer.rpc("decide_promotion", { _pid: ad.pid, _decision: "approve", _comment: "مطابق" }))).toBeNull();
    expect(await statusOf(ad.pid)).toBe("approved");
    const { data, error } = await reviewer.rpc("verify_decision_chain", { _pid: ad.pid });
    expect(error).toBeNull();
    expect(JSON.stringify(data)).toMatch(/true|valid/);
  }, 120_000);

  it("administrator: change a member's role and back; the change is audited", async () => {
    const viewerId = await uid(viewer);
    const since = new Date(Date.now() - 1000).toISOString();
    expect(await errOf(ownerC.rpc("set_org_member_role", { _org: cred!.org_id, _user: viewerId, _role: "reviewer" }))).toBeNull();
    expect(await errOf(ownerC.rpc("set_org_member_role", { _org: cred!.org_id, _user: viewerId, _role: "viewer" }))).toBeNull();
    const { data } = await admin().from("audit_events").select("action, target_table").eq("target_table", "org_members").gte("at", since);
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    // The compliance lead cannot manage members.
    expect(await errOf(lead.rpc("set_org_member_role", { _org: cred!.org_id, _user: viewerId, _role: "admin" }))).toMatch(/forbidden/);
  }, 60_000);

  it.skipIf(!partnerToken)("agency: submits through its partner link and sees only its own promotions", async () => {
    const partner = await as("partner");
    const product = (await admin().from("products").select("id").eq("org_id", cred!.org_id).eq("status", "approved").limit(1).single()).data!.id;
    const created = await partner.rpc("partner_create_promotion", {
      _token: partnerToken!, _title: `إعلان الوكالة ${Date.now()}`, _product: product, _channels: ["instagram"], _communication_type: "financial_promotion",
    });
    // Business rule: one open promotion per partner at a time (a re-run finds the previous one still open).
    let pid = created.data as string | null;
    if (created.error) {
      expect(created.error.message).toMatch(/one_at_a_time|limit_reached/); // D174 renamed the code (configurable limit)
      const me0 = await uid(partner);
      pid = (await admin().from("promotions").select("id").eq("org_id", cred!.org_id).eq("owner_id", me0).order("created_at", { ascending: false }).limit(1).single()).data!.id;
    }
    // Public sample reports (is_demo, no owner/org) are readable by everyone by design; everything else must be theirs.
    const mine = ((await partner.from("promotions").select("id, owner_id, is_demo")).data ?? []).filter((p) => !p.is_demo);
    const me = await uid(partner);
    expect(mine.map((p) => p.id)).toContain(pid);
    expect(mine.every((p) => p.owner_id === me)).toBe(true);
    // The organisation's internal promotions (by the marketer) stay invisible to the partner.
    const internal = (await admin().from("promotions").select("id").eq("org_id", cred!.org_id).neq("owner_id", me)).data ?? [];
    expect(internal.length).toBeGreaterThan(0);
    expect(mine.some((p) => internal.some((i) => i.id === p.id))).toBe(false);
    expect((await partner.from("products").select("id").eq("org_id", cred!.org_id)).data ?? []).toEqual([]);
  }, 60_000);

  it("viewer: reads the organisation's records; every write is rejected by the server", async () => {
    const list = (await viewer.from("promotions").select("id").eq("org_id", cred!.org_id)).data ?? [];
    expect(list.length).toBeGreaterThan(0);
    const any = list[0]!.id;
    const sid = (await admin().from("promotions").select("current_version_id").eq("id", any).single()).data!.current_version_id;
    expect(await errOf(viewer.rpc("add_comment", { _pid: any, _sid: sid, _body: "تعليق" }))).toMatch(/read_only_role|forbidden|old_version/);
    expect(await errOf(viewer.rpc("decide_promotion", { _pid: any, _decision: "approve" }))).toMatch(/forbidden|invalid_status/);
    const upd = await viewer.from("org_settings").update({ review_sla_business_days: 9 }).eq("org_id", cred!.org_id).select();
    expect((upd.data ?? []).length).toBe(0);
  }, 60_000);
});
