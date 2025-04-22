import Image from "next/image";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  
  // Get session data
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  
  // If user is authenticated, redirect to dashboard
  if (session) {
    redirect("/dashboard");
  }
  
  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full flex justify-end items-center p-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/auth/login" 
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
          >
            Sign in
          </Link>
          <Link 
            href="/auth/signup" 
            className="rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
          >
            Sign up
          </Link>
        </div>
      </header>
      
      <main className="flex flex-col gap-[32px] items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <h1 className="text-3xl font-bold text-center sm:text-left">
          Next.js + Supabase Auth Demo
        </h1>
        <p className="text-center sm:text-left max-w-xl">
          This is a demo application showing how to implement authentication with Next.js and Supabase.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://supabase.com/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Supabase Docs
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next.js Docs
          </a>
        </div>
      </main>
      
      <footer className="flex gap-[24px] flex-wrap items-center justify-center">
        <span>© {new Date().getFullYear()} Supabase Auth Demo</span>
      </footer>
    </div>
  );
}
