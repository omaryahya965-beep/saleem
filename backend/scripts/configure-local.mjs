// Connect only this checkout to the isolated local project and create synthetic test users.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const local = path.resolve(root, "../saleem-local");
const parse = (s) =>
  Object.fromEntries(
    s
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [
        l.slice(0, l.indexOf("=")),
        l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, ""),
      ]),
  );
const env = parse(fs.readFileSync(path.join(local, "status.env"), "utf8"));
const url = env.API_URL;
if (
  !url ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
  new URL(url).port !== "55421"
)
  throw new Error("Refusing a non-isolated Supabase target");
if (!env.ANON_KEY || !env.SERVICE_ROLE_KEY)
  throw new Error("Local Supabase status is incomplete");
fs.writeFileSync(
  path.join(root, "backend/.env.local"),
  `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${env.ANON_KEY}\nVITE_DEMO_MODE=false\nVITE_SHOW_TEST_ACCOUNTS=false\n`,
  { mode: 0o600 },
);
const headers = {
  apikey: env.SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
async function request(endpoint, method = "GET", body) {
  const res = await fetch(`${url}${endpoint}`, {
    method,
    headers,
    redirect: "error",
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error(
      `Local Supabase ${endpoint.split("?")[0]} failed: HTTP ${res.status}`,
    );
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const users =
  (await request("/auth/v1/admin/users?page=1&per_page=100"))?.users ?? [];
const credentials = [];
for (const name of ["creator-live", "isolation-live"]) {
  const email = `${name}@saleem.test`,
    password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const previous = users.find((u) => u.email === email);
  const user = await request(
    previous ? `/auth/v1/admin/users/${previous.id}` : "/auth/v1/admin/users",
    previous ? "PUT" : "POST",
    {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "اختبار محلي حقيقي" },
    },
  );
  const id = user.id ?? user.user?.id;
  if (!id) throw new Error("Local account creation returned no user ID");
  // Local-only test quota and synthetic metadata; no billing or real license verification.
  await request(`/rest/v1/profiles?id=eq.${id}`, "PATCH", {
    plan_id: "creator",
    mawthooq_license_no: "LOCAL-TEST-ONLY",
  });
  credentials.push({ id, email, password });
}
fs.writeFileSync(
  path.join(local, "e2e-credentials.json"),
  JSON.stringify(
    {
      url,
      anon_key: env.ANON_KEY,
      service_role_key: env.SERVICE_ROLE_KEY,
      users: credentials,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
const [a, b] = credentials;
fs.writeFileSync(
  path.join(local, ".env.isolation"),
  `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${env.ANON_KEY}\nTEST_USER_A_EMAIL=${a.email}\nTEST_USER_A_PASSWORD=${a.password}\nTEST_USER_B_EMAIL=${b.email}\nTEST_USER_B_PASSWORD=${b.password}\n`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    target: url,
    frontend_env: "backend/.env.local",
    synthetic_users_created: credentials.length,
    production_untouched: true,
  }),
);

// Enforce permissions even when overwriting a previously created file.
for (const file of [
  path.join(root, "backend/.env.local"),
  path.join(local, "e2e-credentials.json"),
  path.join(local, ".env.isolation"),
])
  fs.chmodSync(file, 0o600);
