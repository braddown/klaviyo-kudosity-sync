import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  
  // Sign the user out
  await supabase.auth.signOut();
  
  // Redirect back to home page
  return NextResponse.redirect(new URL("/", request.url));
} 