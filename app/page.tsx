import { redirect } from 'next/navigation';

// This is a Server Component
export default function Home() {
  // This is a server-side redirect in Next.js App Router
  redirect('/login');
  
  // This line is never reached due to the redirect
  return null;
} 