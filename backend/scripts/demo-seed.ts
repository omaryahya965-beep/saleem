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
export const PERSONAS = [
  { key: "admin", email: "admin@demo.saleem.app", name: "مدير المنظمة", role: "owner", login: true },
  { key: "lead", email: "lead@demo.saleem.app", name: "قائد الالتزام", role: "compliance_lead", login: true },
  { key: "reviewer", email: "reviewer@demo.saleem.app", name: "مراجع الالتزام", role: "reviewer", login: false },
  { key: "legal", email: "legal@demo.saleem.app", name: "القانوني", role: "legal", login: false },
  { key: "marketer", email: "marketer@demo.saleem.app", name: "المسوّق", role: "creator", login: true },
  { key: "partner", email: "partner@demo.saleem.app", name: "وكالة شريكة", role: "external_uploader", login: true },
  { key: "viewer", email: "viewer@demo.saleem.app", name: "المدقق", role: "viewer", login: true },
] as const;

const credFile = path.join(root, "demo/.demo-credentials.json");
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
    ok(await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true, user_metadata: { display_name: p.name } }), "updateUser");
    return found.id;
  }
  const created = ok(
    await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { display_name: p.name } }),
    "createUser",
  );
  return created.user!.id;
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

  const owner = await as(PERSONAS[0].email);
  // Organisation: reuse the demo org if it already exists for this owner.
  const existing = ok(await admin.from("organizations").select("id").eq("name", ORG_NAME).eq("created_by", ids.admin!).maybeSingle(), "org lookup");
  const orgId = existing?.id ?? (ok(await owner.rpc("create_organization", { _name: ORG_NAME }), "create_organization") as string);

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
    ok(await (await as(PERSONAS[5].email)).rpc("partner_join", { _token: token, _accept_terms: true }), "partner_join");
    ok(await owner.rpc("decide_partner_access", { _org: orgId, _user: ids.partner!, _approve: true }), "partner access");
    fs.mkdirSync(path.dirname(credFile), { recursive: true });
    fs.writeFileSync(path.join(root, "demo/.demo-partner-link"), token);
  }

  // Sample ads by the marketer, created exactly like the app does (promotion row + text version).
  const marketer = await as(PERSONAS[4].email);
  const ads = [
    { title: "تمويل سليم — عرض الصيف", text: "تمويل سليم الشخصي بمعدل نسبة سنوي 3.9% فقط! قدّم الآن واحصل على الموافقة خلال دقائق." },
    {
      title: "تمويل سليم — إعلان مكتمل",
      text: "تمويل سليم الشخصي من بنك سليم التجريبي. معدل النسبة السنوي 4.5% ثابت لمدة من 6 إلى 60 شهراً. تطبق الشروط والأحكام. بنك سليم خاضع لإشراف البنك المركزي السعودي.",
    },
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

  fs.mkdirSync(path.dirname(credFile), { recursive: true });
  fs.writeFileSync(credFile, JSON.stringify({ note: "Local demo only. Never commit.", password, org_id: orgId, users: PERSONAS.map((p) => p.email) }, null, 2));
  console.log(JSON.stringify({ org_id: orgId, personas: PERSONAS.map((p) => `${p.key}:${p.role}`), ads: created.length, analysis: analysed, credentials: "demo/.demo-credentials.json" }, null, 2));
}

await main();
