// scripts/seed-demo-user.ts
// Creates or updates the local demo account using the Supabase Admin API.

import { createClient } from "@supabase/supabase-js";

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
// Default Supabase CLI local service_role key
const DEFAULT_LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4Mzg3OTYwMH0.local-service-key-placeholder";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  DEFAULT_LOCAL_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  DEFAULT_LOCAL_SERVICE_KEY;

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@saleem.app";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo123456";

async function seedDemoUser() {
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
      console.warn(`[Seed Demo User] Note: Could not list users (${listError.message}). Attempting direct user creation...`);
    }

    const existingUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase()
    );

    if (existingUser) {
      console.log(`[Seed Demo User] User ${DEMO_EMAIL} exists (ID: ${existingUser.id}). Updating password & confirming...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { display_name: "حساب تجريبي" },
        }
      );
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
      console.log(`[Seed Demo User] Successfully created demo user: ${DEMO_EMAIL} (ID: ${newUser.user?.id})`);
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
