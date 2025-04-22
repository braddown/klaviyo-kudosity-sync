"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPassword } from "@/lib/supabase";
import { formatErrorMessage } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const handleResetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { error: authError } = await resetPassword(email);
      
      if (authError) {
        throw authError;
      }
      
      setEmailSent(true);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  
  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Reset Email Sent</CardTitle>
            <CardDescription className="text-center">
              If an account exists with that email, you will receive password reset instructions.
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
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email and we&apos;ll send you instructions to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm 
            type="forgot-password"
            onSubmit={(email) => handleResetPassword(email)}
            error={error}
            loading={loading}
          />
          
          <div className="mt-6 text-center text-sm">
            Remember your password?{" "}
            <Link href="/login" className="text-primary underline hover:opacity-80">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 