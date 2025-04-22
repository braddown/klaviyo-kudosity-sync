"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "@/lib/supabase";
import { formatErrorMessage } from "@/lib/utils";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { error: authError } = await signIn(email, password);
      
      if (authError) {
        throw authError;
      }
      
      // Direct redirect after successful login
      window.location.href = "/dashboard";
    } catch (err) {
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
