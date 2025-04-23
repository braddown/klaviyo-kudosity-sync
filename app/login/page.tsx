"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn, getCurrentSession } from "@/lib/supabase";
import { formatErrorMessage } from "@/lib/utils";

export default function Page() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { session, error: sessionError } = await getCurrentSession();
        if (sessionError) {
          console.error("Session check error:", sessionError);
          return;
        }
        
        if (session) {
          // Already logged in, redirect to dashboard
          console.log("Already logged in, redirecting to dashboard");
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Session check exception:", err);
      }
    };
    
    checkSession();
  }, [router]);
  
  const handleLogin = async (email: string, password: string) => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { session, error: authError } = await signIn(email, password);
      
      if (authError) {
        throw authError;
      }
      
      if (!session) {
        throw new Error("Login successful but no session returned");
      }
      
      // Use the router for client-side navigation
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Log In</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm 
            type="login"
            onSubmit={handleLogin}
            error={error}
            loading={loading}
          />
          
          <div className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-primary underline hover:opacity-80">
              Forgot password?
            </Link>
          </div>
          
          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary underline hover:opacity-80">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
