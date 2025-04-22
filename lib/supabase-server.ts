import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CookieOptions } from "@supabase/ssr";
import { cache } from "react";

// Create a cached Supabase client to avoid creating a new client on every server request
export const createServerSupabaseClient = cache(async () => {
  const cookieStore = cookies();
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not properly set");
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch (error) {
            console.error("Error getting cookie:", error);
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.error("Error setting cookie:", error);
            // Silently fail if not in a Server Action or Route Handler
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            console.error("Error removing cookie:", error);
            // Silently fail if not in a Server Action or Route Handler
          }
        },
      },
    }
  );
  
  return client;
});

// Export for convenience
export default createServerSupabaseClient;
