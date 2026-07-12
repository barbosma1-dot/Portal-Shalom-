import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Clean up Supabase URL: remove trailing slashes and strip any trailing "/rest/v1"
let supabaseUrl = (rawSupabaseUrl || "").trim();
if (supabaseUrl) {
  // Remove trailing slashes
  supabaseUrl = supabaseUrl.replace(/\/+$/, "");
  // Remove /rest/v1 if appended
  if (supabaseUrl.endsWith("/rest/v1")) {
    supabaseUrl = supabaseUrl.slice(0, -8);
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseUrl !== "https://your-supabase-project.supabase.co" && 
  supabaseAnonKey &&
  supabaseAnonKey !== "your-supabase-anon-key"
);

// If configured, initialize client. Otherwise, return null.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
