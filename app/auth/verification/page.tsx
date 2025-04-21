"use client";

import Link from "next/link";

export default function VerificationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Check your email
          </h2>
        </div>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-left">
          <p className="text-blue-700">
            We've sent you an email with a confirmation link. Please check your inbox and click the link to verify your account.
          </p>
        </div>
        
        <div className="mt-6">
          <p className="text-sm">
            Already confirmed?{" "}
            <Link 
              href="/auth/login" 
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 