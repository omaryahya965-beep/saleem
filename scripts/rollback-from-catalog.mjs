// Rollback generator (D210): writes backend/supabase/rollbacks/<migration>.down.sql from a catalog diff on the
// ISOLATED stack only (container supabase_db_saleem_iso; never the development or hosted database).
// 1. Put .iso/supabase/migrations at the deployed migrations and `npx supabase db reset --workdir .iso`.
// 2. node scripts/rollback-from-catalog.mjs backend/supabase/rollbacks <pending migration files in order>
//    (applies each migration with psql, snapshots functions, triggers, policies, constraints, columns, tables and
//    indexes before and after, and writes the inverse). 3. Verify: apply the rollbacks newest first and compare
//    pg_dump --schema-only with the deployed schema (RELEASE_PLAN.md §4). Restore with isolated-stack.mjs reset.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const C = "supabase_db_saleem_iso";
const psql = (sql, input) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      C,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tAq",
      ...(input ? ["-f", "-"] : ["-c", sql]),
    ],
    {
      input: input ?? undefined,
      encoding: "utf8",
      maxBuffer: 1 << 28,
    },
  );
const q = (sql) =>
  JSON.parse(
    psql(
      `set search_path = ''; select coalesce(json_agg(t), '[]') from (${sql}) t`,
    ).trim(),
  );

function snap() {
  const fn =
    q(`select p.oid::regprocedure::text as k, pg_get_functiondef(p.oid) as def, p.proacl::text as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f','p')`);
  const trg =
    q(`select format('%I on %s', t.tgname, t.tgrelid::regclass) as k, pg_get_triggerdef(t.oid) as def,
    format('%I', t.tgname) as name, t.tgrelid::regclass::text as tbl
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'`);
  const pol =
    q(`select format('%I on %I.%I', policyname, schemaname, tablename) as k, policyname as name,
    format('%I.%I', schemaname, tablename) as tbl, permissive, roles::text[] as roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'storage')`);
  const con =
    q(`select format('%I on %s', c.conname, c.conrelid::regclass) as k, c.conname as name, c.conrelid::regclass::text as tbl,
    c.contype as type, pg_get_constraintdef(c.oid) as def
    from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace where n.nspname = 'public'`);
  const col =
    q(`select format('%I.%I.%I', table_schema, table_name, column_name) as k, format('%I.%I', table_schema, table_name) as tbl,
    column_name as name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public'`);
  const tbl =
    q(`select format('%I.%I', n.nspname, c.relname) as k, c.relkind as kind from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v','m')`);
  const idx =
    q(`select format('%I.%I', schemaname, indexname) as k, format('%I.%I', schemaname, tablename) as tbl, indexdef as def
    from pg_indexes i where schemaname = 'public'
    and not exists (select 1 from pg_constraint c where c.conindid = (format('%I.%I', schemaname, indexname))::regclass)`);
  const by = (a) => new Map(a.map((x) => [x.k, x]));
  return {
    fn: by(fn),
    trg: by(trg),
    pol: by(pol),
    con: by(con),
    col: by(col),
    tbl: by(tbl),
    idx: by(idx),
  };
}

const diff = (a, b, same) => ({
  added: [...b.values()].filter((x) => !a.has(x.k)),
  removed: [...a.values()].filter((x) => !b.has(x.k)),
  changed: [...b.values()]
    .filter((x) => a.has(x.k) && !same(a.get(x.k), x))
    .map((x) => ({ before: a.get(x.k), after: x })),
});
const eqJSON = (x, y) => JSON.stringify(x) === JSON.stringify(y);

function aclSql(sig, acl) {
  const out = [
    `revoke all on function ${sig} from public, anon, authenticated, service_role;`,
  ];
  if (acl == null)
    return [...out, `grant execute on function ${sig} to public;`];
  for (const item of acl
    .replace(/^\{|\}$/g, "")
    .split(",")
    .filter(Boolean)) {
    const m = item.replace(/^"|"$/g, "").match(/^([^=]*)=([^/]*)\//);
    if (!m || !m[2].includes("X")) continue;
    const who = m[1] === "" ? "public" : m[1];
    if (who === "postgres") continue;
    out.push(`grant execute on function ${sig} to ${who};`);
  }
  return out;
}
const policySql = (p) =>
  `create policy ${JSON.stringify(p.name)} on ${p.tbl} as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${p.roles.join(", ")}` +
  (p.qual ? ` using (${p.qual})` : "") +
  (p.with_check ? ` with check (${p.with_check})` : "") +
  ";";

const [outDir, ...files] = process.argv.slice(2);
let before = snap();
for (const f of files) {
  psql(null, readFileSync(f, "utf8"));
  const after = snap();
  const d = {
    fn: diff(before.fn, after.fn, (x, y) => x.def === y.def && x.acl === y.acl),
    trg: diff(before.trg, after.trg, (x, y) => x.def === y.def),
    pol: diff(before.pol, after.pol, eqJSON),
    con: diff(before.con, after.con, (x, y) => x.def === y.def),
    col: diff(before.col, after.col, eqJSON),
    tbl: diff(before.tbl, after.tbl, eqJSON),
    idx: diff(before.idx, after.idx, (x, y) => x.def === y.def),
  };
  const newTbl = new Set(d.tbl.added.map((t) => t.k));
  const L = [];
  const warn = [];
  // 0. constraints this migration added to tables that stay (an FK could point at a new table), then the new
  //    tables themselves (their policies, triggers and indexes go with them; their policies use new functions)
  for (const c of d.con.added)
    if (!newTbl.has(c.tbl))
      L.push(
        `alter table ${c.tbl} drop constraint if exists ${JSON.stringify(c.name)};`,
      );
  for (const t of d.tbl.added) L.push(`drop table if exists ${t.k};`);
  // 1. triggers and policies on tables that stay
  for (const t of d.trg.added)
    if (!newTbl.has(t.tbl))
      L.push(`drop trigger if exists ${t.name} on ${t.tbl};`);
  for (const { before: t } of d.trg.changed)
    L.push(`drop trigger if exists ${t.name} on ${t.tbl};`, `${t.def};`);
  for (const t of d.trg.removed) L.push(`${t.def};`);
  for (const p of d.pol.added)
    if (!newTbl.has(p.tbl))
      L.push(`drop policy if exists ${JSON.stringify(p.name)} on ${p.tbl};`);
  for (const { before: p } of d.pol.changed)
    L.push(
      `drop policy if exists ${JSON.stringify(p.name)} on ${p.tbl};`,
      policySql(p),
    );
  for (const p of d.pol.removed) L.push(policySql(p));
  // 2. functions: drop the new ones, restore replaced bodies and grants, recreate dropped ones
  for (const x of d.fn.added) L.push(`drop function if exists ${x.k};`);
  for (const { before: x, after: y } of d.fn.changed) {
    if (x.def !== y.def) L.push(`${x.def.trimEnd()};`);
    if (x.acl !== y.acl) L.push(...aclSql(x.k, x.acl));
  }
  for (const x of d.fn.removed)
    L.push(`${x.def.trimEnd()};`, ...aclSql(x.k, x.acl));
  // 3. constraints on tables that stay (narrower previous CHECKs come back NOT VALID: rows written after the
  //    upgrade keep their values, new rows are checked again)
  for (const { before: c } of d.con.changed)
    L.push(
      `alter table ${c.tbl} drop constraint if exists ${JSON.stringify(c.name)};`,
      `alter table ${c.tbl} add constraint ${JSON.stringify(c.name)} ${c.def}${c.type === "c" || c.type === "f" ? " not valid" : ""};`,
    );
  for (const c of d.con.removed)
    L.push(
      `alter table ${c.tbl} add constraint ${JSON.stringify(c.name)} ${c.def}${c.type === "c" || c.type === "f" ? " not valid" : ""};`,
    );
  // 4. indexes, columns, tables
  for (const i of d.idx.added)
    if (!newTbl.has(i.tbl)) L.push(`drop index if exists ${i.k};`);
  for (const { before: i } of d.idx.changed)
    L.push(`drop index if exists ${i.k};`, `${i.def};`);
  for (const i of d.idx.removed) L.push(`${i.def};`);
  for (const c of d.col.added)
    if (!newTbl.has(c.tbl))
      L.push(
        `alter table ${c.tbl} drop column if exists ${JSON.stringify(c.name)};`,
      );
  for (const { before: c } of d.col.changed)
    warn.push(`column changed (restore by hand): ${c.k}`);
  for (const c of d.col.removed)
    warn.push(`column removed (cannot restore data): ${c.k}`);
  for (const t of d.tbl.removed) warn.push(`table removed: ${t.k}`);
  const name = basename(f, ".sql");
  const head = [
    `-- Rollback of ${name}.sql (D210). Generated from a catalog diff on the isolated stack (master schema + this`,
    `-- migration) and verified: master + all pending migrations + every rollback in reverse = master's schema.`,
    `-- Run the rollbacks newest first, each in one transaction. Data written into objects this migration added`,
    `-- (new tables, new columns) is dropped with them; take the backup first (RELEASE_PLAN.md §1).`,
    ...warn.map((w) => `-- WARNING: ${w}`),
    "begin;",
  ];
  writeFileSync(
    `${outDir}/${name}.down.sql`,
    [...head, ...L, "commit;", ""].join("\n"),
  );
  const n = (k) =>
    `${k}+${d[k].added.length}/~${d[k].changed.length}/-${d[k].removed.length}`;
  console.log(
    name,
    ["fn", "trg", "pol", "con", "col", "tbl", "idx"].map(n).join(" "),
    warn.length ? `WARN ${warn.join("; ")}` : "",
  );
  before = after;
}
