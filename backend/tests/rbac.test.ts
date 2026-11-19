// Role-based access, enforced by the server, for ANY organisation and ANY user — not the demo accounts.
// Local stack only (SUPABASE_LOCAL_URL / _ANON_KEY / _SERVICE_ROLE_KEY). Creates a brand-new organisation with
// brand-new users, one per role, joined through the app's own invite flow; a second organisation for
// multi-org users; then calls the database directly (RLS + RPCs), bypassing the UI on purpose.
// Fixture note: one submission is marked analysed by the service role so the review workflow can run
// without spending AI quota; no finding is inserted.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { ACTIONS, ORG_ROLES, type OrgRole } from "../../frontend/src/lib/permissions.ts";

const URL_ = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "";
const enabled = Boolean(URL_ && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL_));

const svc = () => createClient(URL_, SERVICE, { auth: { persistSession: false } });
const run = `${Date.now().toString(36)}`;
const password = `Rb-${crypto.randomUUID()}`;
const errOf = async (p: PromiseLike<{ error: { message: string } | null }>) => (await p).error?.message ?? null;
// Authorization refusals only (a validation error must never count as «denied»).
const DENIED = /code:forbidden|code:not_found|^forbidden$|permission denied|row-level security|separation_of_duties|last_owner/i;

async function newUser(tag: string): Promise<{ c: SupabaseClient; id: string; email: string }> {
  const email = `rbac-${run}-${tag}@test.local`;
  const { data, error } = await svc().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { c, id: data.user!.id, email };
}

/** Joins through the app's invite flow (create_org_invite → accept_org_invite). */
async function join(inviter: SupabaseClient, org: string, user: { c: SupabaseClient; email: string }, role: OrgRole) {
  const { data: token, error } = await inviter.rpc("create_org_invite", { _org: org, _email: user.email, _role: role });
  if (error) throw new Error(`invite ${role}: ${error.message}`);
  const acc = await user.c.rpc("accept_org_invite", { _token: token });
  if (acc.error) throw new Error(`accept ${role}: ${acc.error.message}`);
}

const orgCan = async (c: SupabaseClient, org: string, action: string) => (await c.rpc("org_can", { _org: org, _action: action })).data as string;

describe.skipIf(!enabled)("RBAC: a new organisation, real users per role, enforced server-side", () => {
  const u = {} as Record<OrgRole, { c: SupabaseClient; id: string; email: string }>;
  let orgA = "", orgB = "", ownerB: Awaited<ReturnType<typeof newUser>>;
  let promo = "", sub = "";

  const newPromotion = async (c: SupabaseClient, ownerId: string, org: string, title: string) => {
    const id = crypto.randomUUID();
    const { error } = await c.from("promotions").insert({
      id, owner_id: ownerId, org_id: org, title, sector: "banking", channels: ["instagram"],
      communication_type: "financial_promotion", audience: ["general"], is_paid: true, distribution: "owned",
    });
    return { id, error: error?.message ?? null };
  };
  const newVersion = async (c: SupabaseClient, ownerId: string, pid: string) => {
    const id = crypto.randomUUID();
    const { error } = await c.from("submissions").insert({
      id, user_id: ownerId, kind: "text", title: "v1", caption: "", text_content: "تمويل بمعدل 3.9% فقط", platform: "instagram",
      product_category: "finance", is_paid_ad: true, has_written_contract: true, ai_used: false, promotion_id: pid,
      sha256: crypto.randomUUID().replace(/-/g, ""),
    });
    if (error) throw error;
    // Fixture: mark the version analysed (no findings) so the review workflow can proceed without AI calls.
    await svc().from("submissions").update({ status: "done", progress: 100, current_step: "done", overall_status: "ready", analyzed_at: new Date().toISOString() }).eq("id", id);
    return id;
  };

  beforeAll(async () => {
    for (const r of ORG_ROLES) u[r] = await newUser(r);
    ownerB = await newUser("ownerB");
    // Organisations need a plan that allows them (business rule «plan_no_orgs»): the two owners are upgraded.
    const plan = (await svc().from("plans").select("id").eq("orgs_allowed", true).limit(1).single()).data!.id;
    await svc().from("profiles").update({ plan_id: plan }).in("id", [u.owner.id, ownerB.id]);
    const a = await u.owner.c.rpc("create_organization", { _name: `RBAC A ${run}` });
    const b = await ownerB.c.rpc("create_organization", { _name: `RBAC B ${run}` });
    if (a.error || b.error) throw new Error(`create_organization: ${a.error?.message ?? b.error?.message}`);
    orgA = a.data as string;
    orgB = b.data as string;
    for (const r of ORG_ROLES.filter((r) => r !== "owner")) await join(u.owner.c, orgA, u[r], r);
    // Multi-org: the marketer of A is only a viewer in B.
    await join(ownerB.c, orgB, u.creator, "viewer");
    // Organisation features used below (as an owner would enable them on «الميزات»).
    await svc().from("org_settings").update({ features: { internal_rules: true, analytics: true, ask_saleem: true } }).eq("org_id", orgA);
  }, 120_000);

  it("every role's effective permissions come from its membership, exactly as the matrix says", async () => {
    for (const r of ORG_ROLES)
      for (const [action, def] of Object.entries(ACTIONS))
        expect(`${r}.${action}=${await orgCan(u[r].c, orgA, action)}`).toBe(`${r}.${action}=${def.cells[r]}`);
  }, 120_000);

  it("a user with different roles in two organisations gets each organisation's permissions", async () => {
    expect(await orgCan(u.creator.c, orgA, "create_promotion")).toBe("yes");
    expect(await orgCan(u.creator.c, orgB, "create_promotion")).toBe("no");
    expect(await orgCan(u.creator.c, orgB, "view_analytics")).toBe("yes"); // viewer in B
    expect((await newPromotion(u.creator.c, u.creator.id, orgB, "ممنوع")).error).toMatch(DENIED);
  });

  it("changing a member's role takes effect at once and keeps nothing from the old role", async () => {
    const target = u.compliance_lead;
    expect(await errOf(target.c.rpc("set_org_rule_pack", { _org: orgA, _pack: "sa-system", _enabled: true, _include_drafts: false }))).toBeNull();
    expect(await errOf(u.owner.c.rpc("set_org_member_role", { _org: orgA, _user: target.id, _role: "viewer" }))).toBeNull();
    try {
      expect(await orgCan(target.c, orgA, "assign_reviewer")).toBe("no");
      expect(await errOf(target.c.rpc("set_org_rule_pack", { _org: orgA, _pack: "sa-system", _enabled: true, _include_drafts: false }))).toMatch(DENIED);
    } finally {
      expect(await errOf(u.owner.c.rpc("set_org_member_role", { _org: orgA, _user: target.id, _role: "compliance_lead" }))).toBeNull();
    }
    expect(await orgCan(target.c, orgA, "assign_reviewer")).toBe("yes");
  });

  it("only the owner grants ownership; an admin cannot grant or take it", async () => {
    expect(await errOf(u.admin.c.rpc("set_org_member_role", { _org: orgA, _user: u.viewer.id, _role: "owner" }))).toMatch(DENIED);
    expect(await errOf(u.admin.c.rpc("set_org_member_role", { _org: orgA, _user: u.owner.id, _role: "viewer" }))).toMatch(DENIED);
    expect(await errOf(u.compliance_lead.c.rpc("create_org_invite", { _org: orgA, _email: `x-${run}@test.local`, _role: "creator" }))).toMatch(DENIED);
  });

  const claimArgs = (name: string) => ({ _id: null, _org: orgA, _name: name, _text_ar: "ادعاء تجريبي", _text_en: null, _product_ids: [], _channels: [], _communication_types: [], _substantiation: [], _next_review: null, _expires: null });

  it("positive controls: the same writes succeed for roles that are allowed", async () => {
    expect(await errOf(u.creator.c.rpc("save_claim", claimArgs("creator")))).toBeNull();
    expect(await errOf(u.compliance_lead.c.rpc("save_internal_rule", { _org: orgA, _id: null, _code: `INT-PC${run.toUpperCase()}`.slice(0, 28), _title: "x", _instruction: "x", _severity: "warning" }))).toBeNull();
    expect((await u.admin.c.from("products").insert({ org_id: orgA, name_ar: "منتج", sector: "banking", product_type: "personal_finance", regulator: "SAMA" })).error).toBeNull();
    expect((await newPromotion(u.creator.c, u.creator.id, orgA, "تحكم")).error).toBeNull();
  });

  it("the viewer is read-only through the API too", async () => {
    const v = u.viewer;
    expect((await newPromotion(v.c, v.id, orgA, "viewer")).error).toMatch(DENIED);
    expect(await errOf(v.c.rpc("save_claim", claimArgs("viewer")))).toMatch(DENIED);
    expect(await errOf(v.c.rpc("save_internal_rule", { _org: orgA, _id: null, _code: "INT-V", _title: "x", _instruction: "x", _severity: "warning" }))).toMatch(DENIED);
    expect(await errOf(v.c.from("org_settings").update({ sector: "retail" }).eq("org_id", orgA).select())).toBeNull(); // RLS: 0 rows
    expect((await svc().from("org_settings").select("sector").eq("org_id", orgA).single()).data?.sector).not.toBe("retail");
    expect((await v.c.from("products").insert({ org_id: orgA, name_ar: "منتج", sector: "banking", product_type: "personal_finance", regulator: "SAMA" })).error?.message).toMatch(DENIED);
  });

  it("external members cannot write the organisation's libraries", async () => {
    for (const r of ["external_uploader", "external_reviewer"] as const)
      expect(`${r}:${await errOf(u[r].c.rpc("save_claim", claimArgs(r)))}`).toMatch(DENIED);
  });

  it("advertisement workflow: create, submit, assign, review; separation of duties holds", async () => {
    const created = await newPromotion(u.creator.c, u.creator.id, orgA, `إعلان ${run}`);
    expect(created.error).toBeNull();
    promo = created.id;
    sub = await newVersion(u.creator.c, u.creator.id, promo);
    // Roles without create_promotion cannot create one, even through the API.
    for (const r of ["reviewer", "legal", "viewer", "external_reviewer", "compliance_lead"] as const)
      expect(`${r}:${(await newPromotion(u[r].c, u[r].id, orgA, r)).error}`).toMatch(DENIED);
    expect(await errOf(u.creator.c.rpc("submit_promotion", { _pid: promo, _note: "جاهز" }))).toBeNull();
    // Owner/admin/lead assign anyone; a reviewer may only take a case for themselves; others never.
    expect(await errOf(u.reviewer.c.rpc("assign_reviewer", { _pid: promo, _user: u.admin.id }))).toMatch(DENIED);
    for (const r of ["creator", "legal", "viewer", "external_reviewer"] as const)
      expect(`${r}:${await errOf(u[r].c.rpc("assign_reviewer", { _pid: promo, _user: u.reviewer.id }))}`).toMatch(DENIED);
    expect(await errOf(u.compliance_lead.c.rpc("assign_reviewer", { _pid: promo, _user: u.reviewer.id }))).toBeNull();
    expect(await errOf(u.reviewer.c.rpc("open_review", { _pid: promo }))).toBeNull();
    // Nobody outside the decision roles can decide; the uploader cannot approve their own advertisement.
    for (const r of ["creator", "legal", "viewer", "external_uploader", "external_reviewer"] as const)
      expect(`${r}:${await errOf(u[r].c.rpc("decide_promotion", { _pid: promo, _decision: "approve" }))}`).toMatch(DENIED);
    // Legal gives an opinion on an escalation, but it never becomes an approval.
    expect(await errOf(u.reviewer.c.rpc("escalate_promotion", { _pid: promo, _legal_user: u.legal.id, _question: "هل الصياغة مقبولة؟" }))).toBeNull();
    expect(await errOf(u.legal.c.rpc("respond_escalation", { _pid: promo, _response: "مقبولة بشرط إضافة الشروط والأحكام." }))).toBeNull();
    expect(await errOf(u.legal.c.rpc("decide_promotion", { _pid: promo, _decision: "approve" }))).toMatch(DENIED);
    expect(await errOf(u.reviewer.c.rpc("decide_promotion", { _pid: promo, _decision: "approve", _comment: "مطابق" }))).toBeNull();
    expect((await svc().from("promotions").select("review_status").eq("id", promo).single()).data?.review_status).toBe("approved");
  }, 60_000);

  it("a member cannot approve an advertisement they uploaded (admin uploads, admin tries to approve)", async () => {
    const p = await newPromotion(u.admin.c, u.admin.id, orgA, `ذاتي ${run}`);
    expect(p.error).toBeNull();
    await newVersion(u.admin.c, u.admin.id, p.id);
    expect(await errOf(u.admin.c.rpc("submit_promotion", { _pid: p.id }))).toBeNull();
    // Nobody can make the uploader the reviewer of their own advertisement.
    expect(await errOf(u.owner.c.rpc("assign_reviewer", { _pid: p.id, _user: u.admin.id }))).toMatch(/separation_of_duties/);
    expect(await errOf(u.compliance_lead.c.rpc("assign_reviewer", { _pid: p.id, _user: u.reviewer.id }))).toBeNull();
    expect(await errOf(u.reviewer.c.rpc("open_review", { _pid: p.id }))).toBeNull();
    // In review: the uploader (an admin, who may otherwise decide) cannot approve their own advertisement.
    expect(await errOf(u.admin.c.rpc("decide_promotion", { _pid: p.id, _decision: "approve" }))).toMatch(DENIED);
  });

  it("partners and external reviewers never see internal advertisements; other organisations stay invisible", async () => {
    for (const r of ["external_uploader", "external_reviewer"] as const) {
      const { data } = await u[r].c.from("promotions").select("id").eq("id", promo);
      expect(`${r}:${data?.length ?? 0}`).toBe(`${r}:0`);
      expect(`${r}:${((await u[r].c.from("submissions").select("id").eq("id", sub)).data ?? []).length}`).toBe(`${r}:0`);
      expect(`${r}:${((await u[r].c.from("org_members").select("user_id").eq("org_id", orgA)).data ?? []).length}`).toBe(`${r}:1`); // own row only
      expect(`${r}:${((await u[r].c.from("products").select("id").eq("org_id", orgA)).data ?? []).length}`).toBe(`${r}:0`);
    }
    // The partner cannot create promotions directly (only through a partner link).
    expect((await newPromotion(u.external_uploader.c, u.external_uploader.id, orgA, "شريك")).error).toMatch(DENIED);
    // Organisation B's owner sees nothing of A; A's lead sees nothing of B.
    expect(((await ownerB.c.from("promotions").select("id").eq("id", promo)).data ?? []).length).toBe(0);
    const pB = await newPromotion(ownerB.c, ownerB.id, orgB, "B");
    expect(pB.error).toBeNull();
    expect(((await u.compliance_lead.c.from("promotions").select("id").eq("id", pB.id)).data ?? []).length).toBe(0);
    // A non-member is refused by the role check itself (was NULL-unsafe before D168).
    expect(await errOf(u.compliance_lead.c.rpc("assign_reviewer", { _pid: pB.id, _user: u.reviewer.id }))).toMatch(/code:forbidden/);
  });

  it("organisation analytics follow view_analytics (no reviewer, legal, creator or external access)", async () => {
    const args = { _org: orgA, _from: new Date(Date.now() - 864e5).toISOString(), _to: new Date().toISOString() };
    for (const r of ORG_ROLES) {
      const allowed = ACTIONS.view_analytics.cells[r] === "yes";
      const err = await errOf(u[r].c.rpc("org_metrics", args));
      expect(`${r}:${allowed ? err : DENIED.test(err ?? "")}`).toBe(`${r}:${allowed ? null : true}`);
    }
  });

  it("company rules: managers create, a second manager approves, others are refused", async () => {
    const { data: rid, error } = await u.compliance_lead.c.rpc("save_internal_rule", { _org: orgA, _id: null, _code: `INT-${run.toUpperCase()}`, _title: "لا ضمان للموافقة", _instruction: "لا وعد بموافقة مضمونة.", _severity: "violation" });
    expect(error).toBeNull();
    for (const r of ["creator", "reviewer", "legal", "viewer", "external_uploader", "external_reviewer"] as const)
      expect(`${r}:${await errOf(u[r].c.rpc("approve_internal_rule", { _id: rid }))}`).toMatch(DENIED);
    expect(await errOf(u.compliance_lead.c.rpc("approve_internal_rule", { _id: rid }))).toMatch(DENIED); // its author
    expect(await errOf(u.admin.c.rpc("approve_internal_rule", { _id: rid }))).toBeNull();
  });
});
