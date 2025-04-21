import { createServerClient, CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )
  
  await supabase.auth.signOut()
  
  // Get the referer or default to home page
  const referer = request.headers.get('referer')
  const redirectPath = referer ? new URL(referer).pathname : '/'
  
  // Only redirect to safe paths (not containing /dashboard or /admin)
  const safePath = 
    redirectPath.includes('/dashboard') || 
    redirectPath.includes('/admin') ? 
    '/' : redirectPath
  
  return NextResponse.redirect(new URL(safePath, request.url))
} 