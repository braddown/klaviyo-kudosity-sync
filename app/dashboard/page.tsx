import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  
  // Get authenticated user
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // If there's an error or no user, redirect to login page
  if (error || !user) {
    console.error("Authentication error:", error?.message);
    redirect("/auth/login");
  }
  
  // Fetch user profile data (if you have a profiles table)
  // This is an example of how you'd fetch user-specific data
  // const { data: profile, error: profileError } = await supabase
  //   .from('profiles')
  //   .select('*')
  //   .eq('id', user.id)
  //   .single();
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Welcome, {user.email}!</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          This is a protected page that only authenticated users can see.
        </p>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>User ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Last Sign In: {new Date(user.last_sign_in_at || '').toLocaleString()}</p>
        </div>
      </div>
      
      <div className="flex gap-4">
        <Link 
          href="/"
          className="rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
        >
          Back to Home
        </Link>
        
        <form action="/api/auth/signout" method="post">
          <button 
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-500"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
} 