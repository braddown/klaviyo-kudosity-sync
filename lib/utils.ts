import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the site URL based on environment
 * - In development: http://localhost:3000
 * - In production: uses NEXT_PUBLIC_SITE_URL or falls back to vercel deployment URL
 */
export function getSiteURL() {
  let url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  // Make sure we don't have a trailing slash
  url = url.trim().replace(/\/$/, '');
  
  // When deploying to Vercel, fall back to the Vercel deployment URL
  if (
    process.env.VERCEL_URL && 
    !process.env.NEXT_PUBLIC_SITE_URL
  ) {
    url = `https://${process.env.VERCEL_URL}`;
  }
  
  return url;
}

/**
 * Create a URL by joining the site URL with a path
 */
export function createURL(path: string) {
  return `${getSiteURL()}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date | string | null | undefined) {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
