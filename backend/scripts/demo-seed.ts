// Demo seed (Phase 8 / UX pass): one isolated organisation «بنك سليم التجريبي» with one user per persona, set up
// through the app's own RPCs (create_organization, invites, partner link, product approval, settings).
//
//   npm run demo:seed            (local stack only; refuses any other host unless DEMO_ALLOW_REMOTE=yes)
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (from `supabase status -o env`), optional
// DEMO_PASSWORD. Without DEMO_PASSWORD a random one is generated. The password is written ONLY to
// demo/.demo-credentials.json (git-ignored) and never printed. DEMO_ANALYZE=1 runs the real `analyze` function on the
// sample ads (needs `supabase functions serve` and a model key) — otherwise they stay unanalysed. Nothing is faked:
// findings only ever come from the real pipeline.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const URL_ = process.env.SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL_ || !ANON || !SERVICE) throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required");
const host = new URL(URL_).hostname;
if (!["127.0.0.1", "localhost"].includes(host) && process.env.DEMO_ALLOW_REMOTE !== "yes")
  throw new Error(`refusing to seed ${host}: local only (set DEMO_ALLOW_REMOTE=yes for an approved demo project)`);

export const ORG_NAME = "بنك سليم التجريبي";
/** Personas. `role` is the real org role; the login page shows the ones with `login: true`. */
/** One persona per real org role (lib/permissions.ts ORG_ROLES). Emails must match the demo-login broker allow-list. */
export const PERSONAS = [
  { key: "owner", email: "owner@demo.saleem.app", name: "مالك المساحة", role: "owner" },
  { key: "admin", email: "orgadmin@demo.saleem.app", name: "مدير المنظمة", role: "admin" },
  { key: "lead", email: "lead@demo.saleem.app", name: "قائد الالتزام", role: "compliance_lead" },
  { key: "reviewer", email: "reviewer@demo.saleem.app", name: "مراجع الالتزام", role: "reviewer" },
  { key: "legal", email: "legal@demo.saleem.app", name: "القانوني", role: "legal" },
  { key: "marketer", email: "marketer@demo.saleem.app", name: "المسوّق", role: "creator" },
  { key: "partner", email: "partner@demo.saleem.app", name: "وكالة شريكة", role: "external_uploader" },
  { key: "extreviewer", email: "extreviewer@demo.saleem.app", name: "مراجع خارجي", role: "external_reviewer" },
  { key: "viewer", email: "viewer@demo.saleem.app", name: "المدقق", role: "viewer" },
] as const;
const P = (k: string) => PERSONAS.find((p) => p.key === k)!;

// DEMO_STATE_DIR (set by scripts/isolated-stack.mjs run) keeps another stack's credentials out of demo/.
const stateDir = path.resolve(root, process.env.DEMO_STATE_DIR ?? "demo");
if ((process.env.SALEEM_ISO === "1" || /[\\/]\.iso[\\/]/.test(stateDir)) && !/:544\d\d$/.test(new URL(URL_).host))
  throw new Error(`refusing: isolated-stack state but ${URL_} is not the isolated stack`);
fs.mkdirSync(stateDir, { recursive: true });
const credFile = path.join(stateDir, ".demo-credentials.json");
const password =
  process.env.DEMO_PASSWORD ||
  (fs.existsSync(credFile) ? (JSON.parse(fs.readFileSync(credFile, "utf8")).password as string) : randomBytes(12).toString("base64url"));

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const ok = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

async function ensureUser(p: (typeof PERSONAS)[number]): Promise<string> {
  const list = ok(await admin.auth.admin.listUsers({ perPage: 1000 }), "listUsers");
  const found = list.users.find((u) => u.email?.toLowerCase() === p.email);
  if (found) {
    ok(await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true, user_metadata: { display_name: p.name }, app_metadata: { demo: true } }), "updateUser");
    return found.id;
  }
  const created = ok(
    await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { display_name: p.name }, app_metadata: { demo: true } }),
    "createUser",
  );
  return created.user!.id;
}

// D211: the individual / content-creator demo. NOT in PERSONAS (those become sandbox organisation members): a personal
// workspace only, flagged is_demo so it shares the demo AI cap and is the only thing demo-login lets it reach.
export const INDIVIDUAL = { key: "individual", email: "individual@demo.saleem.app", name: "صانعة محتوى (تجريبي)", role: null } as const;

async function seedIndividual() {
  const id = await ensureUser(INDIVIDUAL as unknown as (typeof PERSONAS)[number]);
  const members = ok(await admin.from("org_members").select("org_id").eq("user_id", id), "individual memberships");
  if (members.length) throw new Error("the individual demo must not belong to any organisation");
  ok(await admin.from("personal_workspaces").upsert({ user_id: id, display_name: INDIVIDUAL.name, is_demo: true, default_authorities: ["GMEDIA", "MC"] }), "personal workspace");
  const me = await as(INDIVIDUAL.email);
  // Two personal sample ads, created like the app does (owner-only promotion + text version; no organisation).
  const ads = [
    { title: "كريم لمى — منشور سناب", sector: "cosmetics", category: "beauty", authorities: null,
      text: "إعلان مدفوع | كريم لمى للترطيب اليومي للبشرة الجافة. اطلبيه الآن من المتجر." },
    { title: "متجر ورد — خصم نهاية الأسبوع", sector: "ecommerce", category: "other", authorities: ["GMEDIA", "MC"],
      text: "خصم 50% على كل المنتجات! أفضل متجر في المملكة ونتائج مضمونة. اطلب الآن." },
  ];
  let created = 0;
  for (const ad of ads) {
    const have = ok(await admin.from("promotions").select("id").eq("owner_id", id).is("org_id", null).eq("title", ad.title).maybeSingle(), "personal lookup");
    if (have) continue;
    const pid = crypto.randomUUID();
    ok(await me.from("promotions").insert({
      id: pid, owner_id: id, org_id: null, title: ad.title, sector: ad.sector, channels: ["snapchat"], communication_type: "creator_sponsored",
      audience: ["general"], is_paid: true, distribution: "influencer", selected_authorities: ad.authorities,
    }), "personal promotion");
    ok(await me.from("submissions").insert({
      id: crypto.randomUUID(), user_id: id, kind: "text", title: ad.title, caption: "", text_content: ad.text, platform: "snapchat",
      product_category: ad.category, is_paid_ad: true, has_written_contract: true, ai_used: false, promotion_id: pid,
      sha256: randomBytes(16).toString("hex"),
    }), "personal submission");
    created++;
  }
  return { user: INDIVIDUAL.email, ads_created: created };
}

async function as(email: string): Promise<SupabaseClient> {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  ok(await c.auth.signInWithPassword({ email, password }), `signIn ${email}`);
  return c;
}

async function main() {
  const ids: Record<string, string> = {};
  for (const p of PERSONAS) ids[p.key] = await ensureUser(p);
  // Enough monthly checks for the demo (agency-capable plan).
  const plan = ok(await admin.from("plans").select("id").order("monthly_checks", { ascending: false }).limit(1).single(), "plan");
  ok(await admin.from("profiles").update({ plan_id: plan.id }).in("id", Object.values(ids)), "profiles.plan");

  const owner = await as(P("owner").email);
  // --reset: rebuild the sandbox from scratch (only the registered sandbox org of the demo owner is deleted).
  const existing = ok(await admin.from("organizations").select("id").eq("name", ORG_NAME).eq("created_by", ids.owner!).maybeSingle(), "org lookup");
  if (existing && process.argv.includes("--reset")) {
    const reg = ok(await admin.from("demo_sandbox_orgs").select("org_id").eq("org_id", existing.id).maybeSingle(), "sandbox lookup");
    if (!reg) throw new Error("refusing to delete an organisation that is not a registered demo sandbox");
    ok(await admin.from("organizations").delete().eq("id", existing.id), "reset sandbox");
  }
  const kept = existing && !process.argv.includes("--reset") ? existing.id : null;
  const orgId = kept ?? (ok(await owner.rpc("create_organization", { _name: ORG_NAME }), "create_organization") as string);
  // Registered as a sandbox: the demo-login broker only signs in users confined to sandbox orgs.
  ok(await admin.from("demo_sandbox_orgs").upsert({ org_id: orgId }), "register sandbox");

  ok(
    await owner
      .from("org_settings")
      .update({
        sector: "banking",
        features: { internal_rules: true, risk_acceptance: true, partners: true, analytics: true, ask_saleem: true },
      })
      .eq("org_id", orgId),
    "org_settings",
  );
  // SAMA advertising rules are drafts: the demo org opts in to see them (labelled «قاعدة مسودة»).
  ok(await owner.rpc("set_org_rule_pack", { _org: orgId, _pack: "sa-sama-advertising", _enabled: true, _include_drafts: true }), "pack");

  // Internal members join through real invites.
  const members = ok(await admin.from("org_members").select("user_id").eq("org_id", orgId), "members");
  const isMember = new Set(members.map((m) => m.user_id));
  for (const p of PERSONAS.filter((x) => x.role !== "owner" && x.role !== "external_uploader")) {
    if (isMember.has(ids[p.key]!)) continue;
    const token = ok(await owner.rpc("create_org_invite", { _org: orgId, _email: p.email, _role: p.role }), `invite ${p.key}`) as string;
    ok(await (await as(p.email)).rpc("accept_org_invite", { _token: token }), `accept ${p.key}`);
  }
  ok(await owner.rpc("set_risk_acceptor", { _org: orgId, _user: ids.lead!, _on: true }), "risk acceptor");

  // Product: created by the admin, approved by the admin (approve_product is the product workflow's RPC).
  let product = ok(await admin.from("products").select("id, status").eq("org_id", orgId).eq("name_ar", "تمويل سليم الشخصي").maybeSingle(), "product");
  if (!product) {
    const id = crypto.randomUUID();
    ok(
      await owner.from("products").insert({
        id, org_id: orgId, name_ar: "تمويل سليم الشخصي", sector: "banking", product_type: "personal_finance", regulator: "SAMA",
        key_facts: { apr: { value: 4.5, type: "fixed" }, term_months: { min: 6, max: 60 } },
      }),
      "product insert",
    );
    product = { id, status: "draft" };
  }
  if (product.status !== "approved") ok(await owner.rpc("approve_product", { _id: product.id }), "approve_product");

  // External agency: partner link → partner joins → admin approves access.
  if (!isMember.has(ids.partner!)) {
    const token = ok(
      await owner.rpc("create_partner_link", {
        _org: orgId, _label: "وكالة شريكة (تجريبي)", _products: [product.id], _channels: ["instagram", "x"],
        _intro: "رابط تجريبي للوكالة الشريكة.", _terms: "بيانات تجريبية.",
      }),
      "partner link",
    ) as string;
    ok(await (await as(P("partner").email)).rpc("partner_join", { _token: token, _accept_terms: true }), "partner_join");
    ok(await owner.rpc("decide_partner_access", { _org: orgId, _user: ids.partner!, _approve: true }), "partner access");
    fs.mkdirSync(path.dirname(credFile), { recursive: true });
    fs.writeFileSync(path.join(stateDir, ".demo-partner-link"), token);
  }

  // Sample ads by the marketer, created exactly like the app does (promotion row + text version).
  const marketer = await as(P("marketer").email);
  const ads = [
    { title: "تمويل سليم — عرض الصيف", text: "تمويل سليم الشخصي بمعدل نسبة سنوي 3.9% فقط! قدّم الآن واحصل على الموافقة خلال دقائق." },
    {
      title: "تمويل سليم — إعلان مكتمل",
      text: "تمويل سليم الشخصي من بنك سليم التجريبي. معدل النسبة السنوي 4.5% ثابت لمدة من 6 إلى 60 شهراً. تطبق الشروط والأحكام. بنك سليم خاضع لإشراف البنك المركزي السعودي.",
    },
    { title: "بطاقة سليم الائتمانية — بلا رسوم", text: "بطاقة سليم الائتمانية بلا رسوم سنوية! استمتع بأفضل المزايا في السوق." },
    { title: "استرداد نقدي 10% — عرض محدود", text: "استرداد نقدي 10% على مشترياتك بالبطاقة. العرض لفترة محدودة. تطبق الشروط والأحكام." },
  ];
  const created: string[] = [];
  for (const ad of ads) {
    const have = ok(await admin.from("promotions").select("id, current_version_id").eq("org_id", orgId).eq("title", ad.title).maybeSingle(), "promo lookup");
    if (have?.current_version_id) {
      created.push(have.current_version_id);
      continue;
    }
    const pid = have?.id ?? crypto.randomUUID();
    if (!have)
      ok(
        await marketer.from("promotions").insert({
          id: pid, owner_id: ids.marketer!, org_id: orgId, title: ad.title, product_id: product.id, sector: "banking",
          channels: ["instagram"], communication_type: "financial_promotion", audience: ["general"], is_paid: true, distribution: "owned",
        }),
        "promotion",
      );
    const sid = crypto.randomUUID();
    ok(
      await marketer.from("submissions").insert({
        id: sid, user_id: ids.marketer!, kind: "text", title: ad.title, caption: "", text_content: ad.text, platform: "instagram",
        product_category: "finance", is_paid_ad: true, has_written_contract: true, ai_used: false, promotion_id: pid,
        sha256: randomBytes(16).toString("hex"),
      }),
      "submission",
    );
    created.push(sid);
  }

  const analysed: Record<string, string> = {};
  if (process.env.DEMO_ANALYZE === "1") {
    for (const sid of created) {
      const { data: s } = await admin.from("submissions").select("status").eq("id", sid).single();
      if (s?.status === "done") {
        analysed[sid] = "done";
        continue;
      }
      const { error } = await marketer.functions.invoke("analyze", { body: { submission_id: sid } });
      if (error) {
        analysed[sid] = `invoke_failed: ${error.message}`;
        continue;
      }
      for (let i = 0; i < 60; i++) {
        const { data } = await admin.from("submissions").select("status, error_message").eq("id", sid).single();
        if (data?.status === "done" || data?.status === "failed") {
          analysed[sid] = data.status + (data.error_message ? `: ${data.error_message}` : "");
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      analysed[sid] ??= "timeout";
    }
  }

  // Real review journey through the app's RPCs, only on analysed versions (needs DEMO_ANALYZE=1 and served
  // functions). Analysis that failed (e.g. no valid model key) is submitted with the app's explicit acknowledgement.
  const journey: Record<string, string> = {};
  const lead = await as(P("lead").email);
  const reviewer = await as(P("reviewer").email);
  const reviewerId = ids.reviewer!;
  const step = async (title: string, target: "pending" | "changes" | "approved") => {
    const p = ok(await admin.from("promotions").select("id, review_status, current_version_id").eq("org_id", orgId).eq("title", title).single(), "promo");
    const v = ok(await admin.from("submissions").select("status").eq("id", p.current_version_id!).single(), "version");
    if (!["done", "failed"].includes(v.status)) return (journey[title] = `skipped: analysis ${v.status}`);
    if (p.review_status !== "draft") return (journey[title] = `kept: ${p.review_status}`);
    // D208: an approval needs a completed analysis of the current version; a failed one stops at «submitted».
    if (target === "approved" && v.status !== "done") target = "pending";
    ok(await marketer.rpc("submit_promotion", { _pid: p.id, _note: "جاهز للمراجعة", _ack_failed: v.status === "failed" }), "submit");
    if (target !== "pending") {
      ok(await lead.rpc("assign_reviewer", { _pid: p.id, _user: reviewerId }), "assign");
      ok(await reviewer.rpc("open_review", { _pid: p.id }), "open");
      ok(
        await reviewer.rpc("decide_promotion", target === "approved"
          ? { _pid: p.id, _decision: "approve", _comment: "مطابق (بيانات تجريبية)" }
          : { _pid: p.id, _decision: "request_changes", _reason_other: "المعدل المعلن لا يطابق بيانات المنتج المعتمدة" }),
        "decide",
      );
    }
    journey[title] = target;
  };
  await step("تمويل سليم — عرض الصيف", "changes");
  await step("تمويل سليم — إعلان مكتمل", "approved");
  await step("بطاقة سليم الائتمانية — بلا رسوم", "pending");

  const personal = await seedIndividual();

  fs.mkdirSync(path.dirname(credFile), { recursive: true });
  fs.writeFileSync(credFile, JSON.stringify({ note: "Local demo only. Never commit.", password, org_id: orgId, users: [...PERSONAS.map((p) => p.email), INDIVIDUAL.email] }, null, 2));
  console.log(JSON.stringify({ individual: personal }));
  console.log(JSON.stringify({ org_id: orgId, personas: PERSONAS.map((p) => `${p.key}:${p.role}`), ads: created.length, analysis: analysed, journey, credentials: path.relative(root, credFile) }, null, 2));
}

await main();
