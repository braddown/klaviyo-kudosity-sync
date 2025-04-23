import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/',
  // Add other public routes here
];

export async function middleware(request: NextRequest) {
  console.log("Middleware running for path:", request.nextUrl.pathname);
  
  // Create a response object that we'll modify and return
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with our custom cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
        set(name, value, options) {
          // This is essential for CSRF protection and session management
          response.cookies.set({
            name,
            value,
            ...options,
            // Make sure the cookie is accessible across the domain
            path: '/',
            sameSite: 'lax'
          });
        },
        remove(name, options) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            path: '/',
            maxAge: 0,
          });
        },
      },
    }
  );
  
  // Check if the user is authenticated
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("Session error:", error.message);
  }
  
  console.log("Middleware session exists:", !!data.session);
  
  // Get the current path from the request
  const path = request.nextUrl.pathname;
  console.log(`Path: ${path}, Auth required: ${!isPublicRoute(path)}`);
  
  // Handle protected routes
  if (!data.session && !isPublicRoute(path)) {
    console.log("No session, redirecting to login");
    // Redirect to login for protected routes
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Handle login/register route when already authenticated
  if (data.session && (path === '/login' || path === '/register')) {
    console.log("Already authenticated, redirecting to dashboard");
    // Redirect to dashboard if logged in and trying to access auth pages
    const redirectUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Return the response with any modified cookies
  return response;
}

// Helper to check if a route is public
function isPublicRoute(path: string): boolean {
  return publicRoutes.some(route => path === route || path.startsWith(route));
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 