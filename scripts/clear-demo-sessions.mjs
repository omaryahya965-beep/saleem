import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load backend/.env
const envFile = readFileSync("backend/.env", "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const url = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const key = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);
const { count, error } = await supabase.from("demo_sessions").delete({ count: "exact" }).gt("id", 0);
if (error) {
  console.error("Error clearing demo sessions:", error);
} else {
  console.log(`Successfully cleared ${count} demo_sessions!`);
}
