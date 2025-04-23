'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseClient, signOut } from '@/lib/supabase';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting auth session:", error.message);
          router.push('/login');
          return;
        }
        
        if (!data.session) {
          console.log("No active session detected in client, redirecting");
          router.push('/login');
          return;
        }
        
        // Set user name (email) for display
        setUserName(data.session.user.email || null);
      } catch (err) {
        console.error("Exception during auth check:", err);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };
  
  // Function to handle navigation
  const handleNavigation = useCallback((path: string) => {
    console.log(`Navigating to: ${path}`);
    // Use router.push for client-side navigation
    router.push(path);
  }, [router]);

  // Navigation items
  const navItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Sync Data', path: '/dashboard/sync' },
    { name: 'Settings', path: '/dashboard/settings' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="font-bold text-xl">Klaviyo-Kudosity Sync</h1>
          </div>
          
          {userName && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{userName}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row">
          {/* Sidebar Navigation */}
          <div className="w-full md:w-64 mb-6 md:mb-0">
            <div className="bg-white shadow-sm rounded-lg p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <button
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full text-left block px-4 py-2 rounded-md ${
                        pathname === item.path
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 md:ml-6">
            <div className="bg-white shadow-sm rounded-lg">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 