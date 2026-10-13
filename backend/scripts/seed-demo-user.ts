// backend/scripts/seed-demo-user.ts
// Creates or updates the demo account using the Supabase Admin API.
// Reads environment variables from backend/.env.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

// Load backend/.env if present
if (fs.existsSync(envPath)) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envPath);
    } else {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim().replace(/^["'](.*)["']$/, "$1");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Seed Demo User] Note: Could not parse ${envPath}:`, err);
  }
}

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "http://127.0.0.1:54321";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@saleem.app";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo123456";

async function seedDemoUser() {
  if (!serviceRoleKey || serviceRoleKey.includes("placeholder") || serviceRoleKey.length < 20) {
    console.log(`\n======================================================================`);
    console.log(`[Seed Demo User] SUPABASE_SERVICE_ROLE_KEY is not configured in backend/.env.`);
    console.log(`[Seed Demo User] Skipping automated demo-user creation via Admin API.`);
    console.log(`[Seed Demo User] You can create the demo user directly in your Supabase dashboard:`);
    console.log(`                 1. Go to: Authentication -> Users -> Add User`);
    console.log(`                 2. Email:    ${DEMO_EMAIL}`);
    console.log(`                 3. Password: ${DEMO_PASSWORD}`);
    console.log(`                 4. Check "Auto Confirm User"`);
    console.log(`======================================================================\n`);
    process.exit(0);
  }

  console.log(`[Seed Demo User] Connecting to Supabase at: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.warn(
        `[Seed Demo User] Note: Could not list users (${listError.message}). Attempting direct user creation...`,
      );
    }

    const existingUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase(),
    );

    if (existingUser) {
      console.log(
        `[Seed Demo User] User ${DEMO_EMAIL} exists (ID: ${existingUser.id}). Updating password & confirming...`,
      );
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: "حساب تجريبي" },
      });
      if (updateError) throw updateError;
      console.log(`[Seed Demo User] Successfully updated demo user: ${DEMO_EMAIL}`);
    } else {
      console.log(`[Seed Demo User] Creating new demo user: ${DEMO_EMAIL}...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: "حساب تجريبي" },
      });
      if (createError) throw createError;
      console.log(
        `[Seed Demo User] Successfully created demo user: ${DEMO_EMAIL} (ID: ${newUser.user?.id})`,
      );
    }

    console.log(`\n=========================================`);
    console.log(`Demo Account Ready:`);
    console.log(`Email:    ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log(`=========================================\n`);
  } catch (error) {
    console.error(`[Seed Demo User] Error:`, error);
    process.exit(1);
  }
}

seedDemoUser();
