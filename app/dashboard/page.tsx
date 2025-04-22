"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession, signOut } from "@/lib/supabase";
import { formatErrorMessage } from "@/lib/utils";

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user, error } = await getCurrentSession();
        
        if (error || !user) {
          // Redirect to login if no session
          window.location.href = "/login";
          return;
        }
        
        setUser({ email: user.email || "User" });
      } catch (err) {
        console.error('Authentication error:', formatErrorMessage(err));
        // Redirect to login on error
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, []);
  
  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      
      if (error) {
        throw error;
      }
      
      // Redirect to login
      window.location.href = "/login";
    } catch (err) {
      console.error('Sign out error:', formatErrorMessage(err));
      // Still try to redirect to login page even if there's an error
      window.location.href = "/login";
    }
  };
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen flex-col p-4">
      <header className="container mx-auto mb-8 flex items-center justify-between py-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {user && (
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        )}
      </header>
      
      <main className="container mx-auto flex-1">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.email}!</CardTitle>
            <CardDescription>
              You have successfully logged in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              This is a protected dashboard page. Only authenticated users can see this content.
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              This page will be used to display your synchronized Klaviyo and Kudosity data.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
