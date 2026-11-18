// Generates backend/supabase/tests/p8_roles_matrix.test.sql from frontend/src/lib/permissions.ts (Phase 8, step 5).
// Usage: node --experimental-strip-types backend/scripts/gen-permission-tests.mjs
//  1. Every cell: public.org_role_can(role, action) must equal the TypeScript matrix.
//  2. Every "no" cell: a probe calls the real RPC / table as that role and must be denied.
//  3. Conditional cells: a probe where the condition is false must be denied (see COND below).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { ACTIONS, ORG_ROLES } = await import(pathToFileURL(path.join(root, "frontend/src/lib/permissions.ts")).href);

const ORG = "28000000-0000-0000-0000-000000000001";
const U = Object.fromEntries(ORG_ROLES.map((r, i) => [r, `18000000-0000-0000-0000-00000000000${i + 1}`]));
const P = "48000000-0000-0000-0000-000000000001"; // creator's promotion, in review
const S = "38000000-0000-0000-0000-000000000001";
const PD = "48000000-0000-0000-0000-000000000002"; // creator's draft with a finished version
const PO = "48000000-0000-0000-0000-000000000003"; // owner's promotion, in review (owner uploaded it)
const SO = "38000000-0000-0000-0000-000000000003";
const PE = "48000000-0000-0000-0000-000000000004"; // escalated to the legal member
const IR = "58000000-0000-0000-0000-000000000001"; // internal rule draft edited by the admin

/** Probe run as the denied role. `rows` probes are DML that RLS silently filters: zero rows = denied. */
const PROBE = {
  view_promotions: { rows: `select 1 from public.promotions where id = '${PO}'` },
  create_promotion: { sql: `insert into public.promotions (owner_id, org_id, title, communication_type) values (auth.uid(), '${ORG}', 'x', 'financial_promotion')` },
  submit_for_review: { sql: `select public.submit_promotion('${PD}')` },
  request_changes_comment: { sql: `select public.add_comment('${P}', '${S}', 'x', null, null, 'change_request')` },
  comment: { sql: `select public.add_comment('${PO}', '${SO}', 'x')` },
  decide_review: { sql: `select public.decide_promotion('${P}', 'approve')` },
  assign_reviewer: { sql: `select public.assign_reviewer('${P}', '${U.compliance_lead}')` },
  escalate_legal: { sql: `select public.escalate_promotion('${P}', '${U.legal}', 'q')` },
  legal_opinion: { sql: `select public.respond_escalation('${PE}', 'x')` },
  accept_risk: { asOwner: true, sql: (role) => `select public.set_risk_acceptor('${ORG}', '${U[role]}', true)` },
  manage_members: { sql: `select public.set_org_member_role('${ORG}', '${U.viewer}', 'reviewer')` },
  manage_rule_packs: { sql: `select public.set_org_rule_pack('${ORG}', 'sa-bank', true, true)` },
  manage_company_rules: { sql: `select public.save_internal_rule('${ORG}', null, 'INT-PROBE', 't', 'i', 'warning')` },
  approve_company_rules: { sql: `select public.approve_internal_rule('${IR}')` },
  manage_products: { sql: `insert into public.products (org_id, name_ar, sector, product_type, regulator) values ('${ORG}', 'x', 'banking', 'other', 'SAMA')` },
  manage_settings: { rows: `update public.org_settings set review_sla_business_days = 9 where org_id = '${ORG}' returning 1` },
  view_analytics: { sql: `select public.org_metrics('${ORG}', now() - interval '1 day', now())` },
};
/** Conditional cells: the probe above with the condition false (or a specific one). Cells not listed are noted. */
const COND = {
  view_promotions: ["creator", "external_uploader", "external_reviewer"], // PO is not theirs
  create_promotion: ["external_uploader"], // only through partner_create_promotion
  submit_for_review: ["compliance_lead", "reviewer", "legal", "external_uploader"], // PD is not theirs
  comment: ["creator", "external_uploader", "external_reviewer"], // PO is not visible to them
  decide_review: { owner: `select public.decide_promotion('${PO}', 'approve')` }, // uploader cannot decide
  escalate_legal: { owner: `select public.escalate_promotion('${PO}', '${U.legal}', 'q')` }, // uploader cannot escalate
  manage_members: { admin: `select public.set_org_member_role('${ORG}', '${U.viewer}', 'owner')` }, // admin cannot grant owner
  approve_company_rules: { admin: `select public.approve_internal_rule('${IR}')` }, // author cannot approve
};
const DENIED = "forbidden|permission denied|row-level security|read_only_role|not_found|not_a_reviewer|separation_of_duties|not_authorised";

const lit = (s) => `'${s.replace(/'/g, "''")}'`;
const probeSql = (action, role, override) => {
  const p = PROBE[action];
  const sql = override ?? (typeof p.sql === "function" ? p.sql(role) : p.sql);
  const as = p.asOwner && !override ? U.owner : U[role];
  if (p.rows && !override) return `select pg_temp.expect_no_rows(${lit(as)}, ${lit(p.rows)}, ${lit(`${action}/${role}`)});`;
  return `select pg_temp.expect_denied(${lit(as)}, ${lit(sql)}, ${lit(`${action}/${role}`)});`;
};

const cells = [], probes = [], untested = [];
for (const [action, def] of Object.entries(ACTIONS)) {
  for (const role of ORG_ROLES) {
    const c = def.cells[role];
    cells.push(`select is(public.org_role_can('${role}', '${action}'), '${c}', '${action}/${role} = ${c}');`);
    if (c === "no") probes.push(probeSql(action, role));
    if (c === "cond") {
      const k = COND[action];
      if (Array.isArray(k) && k.includes(role)) probes.push(probeSql(action, role));
      else if (k && !Array.isArray(k) && k[role]) probes.push(probeSql(action, role, k[role]));
      else untested.push(`${action}/${role}`);
    }
  }
}

const sql = `-- GENERATED by backend/scripts/gen-permission-tests.mjs from frontend/src/lib/permissions.ts — do not edit.
-- Phase 8 roles: every matrix cell, every forbidden cell against the real RPCs/tables, and conditional cells with
-- the condition false. Conditional cells covered by other suites (not probed here): ${untested.join(", ") || "none"}.
begin;
create extension if not exists pgtap with schema extensions;
select plan(${cells.length + probes.length});

insert into auth.users (id, email) values
${ORG_ROLES.map((r) => `  ('${U[r]}', '${r}@roles.test')`).join(",\n")};
update public.profiles set plan_id = (select id from public.plans order by monthly_checks desc limit 1) where id::text like '18000000-%';
insert into public.organizations (id, name, created_by) values ('${ORG}', 'Roles Bank', '${U.owner}');
insert into public.org_members (org_id, user_id, role) values
${ORG_ROLES.map((r) => `  ('${ORG}', '${U[r]}', '${r}')`).join(",\n")};
update public.org_settings set features = '{"internal_rules": true, "risk_acceptance": true}'::jsonb where org_id = '${ORG}';
insert into public.promotions (id, owner_id, org_id, title, communication_type) values
  ('${P}', '${U.creator}', '${ORG}', 'P', 'financial_promotion'),
  ('${PD}', '${U.creator}', '${ORG}', 'PD', 'financial_promotion'),
  ('${PO}', '${U.owner}', '${ORG}', 'PO', 'financial_promotion'),
  ('${PE}', '${U.creator}', '${ORG}', 'PE', 'financial_promotion');
insert into public.submissions (id, user_id, kind, caption, platform, product_category, promotion_id, sha256, status, analyzed_at) values
  ('${S}', '${U.creator}', 'text', 'x', 'x', 'finance', '${P}', 'r1', 'done', now()),
  ('38000000-0000-0000-0000-000000000002', '${U.creator}', 'text', 'x', 'x', 'finance', '${PD}', 'r2', 'done', now()),
  ('${SO}', '${U.owner}', 'text', 'x', 'x', 'finance', '${PO}', 'r3', 'done', now());
update public.promotions set review_status = 'in_review' where id in ('${P}', '${PO}');
update public.promotions set review_status = 'escalated', escalated_to = '${U.legal}' where id = '${PE}';
insert into public.internal_rules (id, org_id, code, title_ar, instruction_ar, source, edited_by, edited_at)
values ('${IR}', '${ORG}', 'INT-ROLES', 'قاعدة', 'تعليمات', 'manual', '${U.admin}', now());

create or replace function pg_temp.expect_denied(_u text, _sql text, _label text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    execute _sql;
  exception when others then
    reset role;
    if sqlerrm ~ '${DENIED}' then return ok(true, _label || ' denied'); end if;
    return ok(false, _label || ' unexpected error: ' || sqlerrm);
  end;
  reset role;
  return ok(false, _label || ' was allowed');
end $$;
create or replace function pg_temp.expect_no_rows(_u text, _sql text, _label text) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', _u, true), set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    execute 'select count(*) from (' || regexp_replace(_sql, 'returning 1$', '') || ') q' into n;
  exception when others then
    -- DML cannot be wrapped in a subquery: run it and read the row count.
    execute _sql; get diagnostics n = row_count;
  end;
  reset role;
  return ok(n = 0, _label || ' denied (no rows)');
end $$;

${cells.join("\n")}

${probes.join("\n")}

select * from finish();
rollback;
`;
fs.writeFileSync(path.join(root, "backend/supabase/tests/p8_roles_matrix.test.sql"), sql);
console.log(`cells ${cells.length}, probes ${probes.length}, cond covered elsewhere: ${untested.length}`);
