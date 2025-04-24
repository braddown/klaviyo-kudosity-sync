import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

// Define types for errors
export type SupabaseError = Error | unknown;

// Type for authentication response
export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: SupabaseError | null;
}

// Singleton pattern to reuse the Supabase client
let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// Server-side admin client with service role (only use server-side)
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    console.warn('Warning: Attempted to use admin client in browser context');
    return getSupabaseClient(); // Fall back to regular client in browser
  }

  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Missing Supabase service role key, falling back to anon key');
    return getSupabaseClient();
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey);
  return supabaseAdminInstance;
}

// Authentication helpers
export async function signUp(email: string, password: string): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    return {
      user: data?.user || null,
      session: data?.session || null,
      error: null,
    };
  } catch (error) {
    console.error('Error signing up:', error);
    return {
      user: null,
      session: null,
      error,
    };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return {
      user: data?.user || null,
      session: data?.session || null,
      error: null,
    };
  } catch (error) {
    console.error('Error signing in:', error);
    return {
      user: null,
      session: null,
      error,
    };
  }
}

export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    return {
      user: null,
      session: null,
      error: null,
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      user: null,
      session: null,
      error,
    };
  }
}

export async function signOut(): Promise<{ error: SupabaseError | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    
    if (error) throw error;
    
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return { error };
  }
}

export async function getCurrentSession(): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    if (!session) {
      return { user: null, session: null, error: null };
    }
    
    return {
      user: session.user,
      session: session,
      error: null,
    };
  } catch (error) {
    console.error('Error getting current session:', error);
    return {
      user: null,
      session: null,
      error,
    };
  }
}

export async function updatePassword(password: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({
      password,
    });
    
    return { data, error };
  } catch (error) {
    console.error('Error updating password:', error);
    return { data: null, error };
  }
} 