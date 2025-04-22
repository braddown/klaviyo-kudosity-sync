"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp } from "@/lib/supabase";
import { formatErrorMessage } from "@/lib/utils";

export default function Page() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  
  const handleRegister = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { error: authError } = await signUp(email, password);
      
      if (authError) {
        throw authError;
      }
      
      // Show success message rather than redirecting
      setRegistered(true);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  
  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Registration Successful</CardTitle>
            <CardDescription className="text-center">
              Please check your email for a confirmation link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Link href="/login" className="text-primary underline hover:opacity-80">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Sign up for a new account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm 
            type="register"
            onSubmit={handleRegister}
            error={error}
            loading={loading}
          />
          
          <div className="mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline hover:opacity-80">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
