// Calls the admin-only `diagnostics` Edge Function as admin@saleem.app and prints the (secret-free) result.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("backend/.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const URL = env.VITE_SUPABASE_URL, PK = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const tok = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: PK, "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL ?? "admin@saleem.app", password: process.env.ADMIN_PASSWORD ?? "admin123456" }) })).json();
const res = await fetch(`${URL}/functions/v1/diagnostics`, { method: "POST", headers: { apikey: PK, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" }, body: "{}" });
console.log(res.status, JSON.stringify(await res.json(), null, 2));
