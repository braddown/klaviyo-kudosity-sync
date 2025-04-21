import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CookieOptions } from "@supabase/ssr";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are not properly set");
  }

  return createServerClient(
    supabaseUrl || "",
    supabaseAnonKey || "",
    {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch (error) {
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // Silently fail if not in a Server Action or Route Handler
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // Silently fail if not in a Server Action or Route Handler
          }
        },
      },
    }
  );
}
