// setup-supabase.js - Generate SQL to configure Supabase storage for your project
// Run with: node setup-supabase.js > setup-commands.sql

console.log(`-- SQL commands to set up Supabase storage for Klaviyo-Kudosity Sync
-- 1. Run these in the Supabase SQL Editor
-- 2. Or copy/paste into each section of the Supabase dashboard

-- First, create the storage bucket if it doesn't exist
SELECT storage.create_bucket('temp-csv-storage', 'public');

-- Enable bucket public access
UPDATE storage.buckets SET public = TRUE WHERE name = 'temp-csv-storage';

-- Add RLS policies for the temp-csv-storage bucket:

-- 1. Allow authenticated users to upload files (INSERT)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT 
TO authenticated 
USING (bucket_id = 'temp-csv-storage');

-- 2. Allow public to view files (SELECT)
CREATE POLICY "Allow public viewing" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'temp-csv-storage');

-- 3. Allow service role to manage files (without RLS restrictions)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- 4. Allow bucket owners to update/delete their files
CREATE POLICY "Allow owners to update/delete files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'temp-csv-storage')
WITH CHECK (auth.uid() = owner);

-- Note: Make sure you have the service role key correctly set in your environment variables:
-- SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
`);

console.log(`
-- IMPORTANT: If you're using the service role in a Next.js app, make sure your .env file has:
-- NEXT_PUBLIC_SUPABASE_URL=your-project-url
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
-- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (exact key from Supabase dashboard)
`);

console.log(`
-- To test if your service role key is working correctly, run:
-- node test-supabase.js
`); 