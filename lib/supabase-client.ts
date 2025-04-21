import { createBrowserClient } from "@supabase/ssr";

export function createClientSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are not properly set");
    throw new Error(
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set"
    );
  }
  
  try {
    return createBrowserClient(
      supabaseUrl,
      supabaseAnonKey
    );
  } catch (error) {
    console.error("Error creating Supabase browser client:", error);
    throw error;
  }
}
