import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  // Only enable this in development environments
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  try {
    // Get cookie information
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    const cookieInfo = allCookies.map(cookie => ({
      name: cookie.name,
      // Don't show values for security reasons
      exists: true,
    }));

    // Check Supabase session
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        { 
          error: error.message, 
          cookies: cookieInfo 
        },
        { status: 500 }
      );
    }

    // Return debug info
    return NextResponse.json({
      authenticated: !!data.session,
      sessionExists: !!data.session,
      userId: data.session?.user?.id || null,
      userEmail: data.session?.user?.email || null,
      tokenExpires: data.session?.expires_at 
        ? new Date(data.session.expires_at * 1000).toISOString()
        : null,
      cookies: cookieInfo,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
} 