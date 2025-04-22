"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession, signOut } from "@/lib/supabase";
import { formatErrorMessage } from "@/lib/utils";

interface UserSessionInfo {
  email: string;
  id: string;
  lastSignIn?: string;
  createdAt?: string;
  provider?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user, session, error } = await getCurrentSession();
        
        if (error || !user) {
          // Redirect to login if no session
          window.location.href = "/login";
          return;
        }
        
        // Extract useful session information
        setUser({
          email: user.email || "No email provided",
          id: user.id,
          lastSignIn: user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : undefined,
          createdAt: user.created_at ? new Date(user.created_at).toLocaleString() : undefined,
          provider: user.app_metadata?.provider || "email",
        });
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Welcome, {user?.email}!</CardTitle>
            <CardDescription>
              Your session information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-secondary/50 p-3 rounded">
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="mt-1 font-mono text-sm break-all">{user?.id}</p>
                </div>
                
                <div className="bg-secondary/50 p-3 rounded">
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="mt-1 font-mono text-sm break-all">{user?.email}</p>
                </div>
                
                {user?.createdAt && (
                  <div className="bg-secondary/50 p-3 rounded">
                    <p className="text-sm font-medium text-muted-foreground">Account Created</p>
                    <p className="mt-1 font-mono text-sm">{user?.createdAt}</p>
                  </div>
                )}
                
                {user?.lastSignIn && (
                  <div className="bg-secondary/50 p-3 rounded">
                    <p className="text-sm font-medium text-muted-foreground">Last Sign In</p>
                    <p className="mt-1 font-mono text-sm">{user?.lastSignIn}</p>
                  </div>
                )}
                
                {user?.provider && (
                  <div className="bg-secondary/50 p-3 rounded">
                    <p className="text-sm font-medium text-muted-foreground">Authentication Provider</p>
                    <p className="mt-1 font-mono text-sm">{user?.provider}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              This dashboard will be used to manage integrations between Klaviyo and Kudosity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              This protected dashboard shows your authentication status and session information.
              In the future, it will include functionality to synchronize data between Klaviyo and Kudosity platforms.
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              API integrations with n8n, Klaviyo, and Kudosity will be coming soon.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
