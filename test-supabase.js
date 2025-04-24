// Test script for Supabase service role authentication
// Run with: node test-supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log(`URL: ${supabaseUrl}`);
console.log(`Service Role Key (first 10 chars): ${serviceRoleKey?.substring(0, 10)}...`);

async function testStorage() {
  try {
    // Create client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Test by listing buckets (requires service role)
    console.log('Attempting to list storage buckets (requires service role)...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return false;
    }
    
    console.log('Success! Found buckets:', buckets.map(b => b.name).join(', '));
    
    // Check if our target bucket exists
    const targetBucket = 'temp-csv-storage';
    const bucketExists = buckets.some(b => b.name === targetBucket);
    
    if (!bucketExists) {
      console.log(`Target bucket '${targetBucket}' doesn't exist. Creating it...`);
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(targetBucket, {
        public: true
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log('Bucket created successfully!');
      }
    } else {
      console.log(`Target bucket '${targetBucket}' exists.`);
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Run the test
testStorage().then(success => {
  console.log('Test complete. Success:', success);
  if (!success) {
    console.log('\nTROUBLESHOOTING STEPS:');
    console.log('1. Go to Supabase dashboard → Project settings → API');
    console.log('2. Copy the service_role key (JWT) exactly');
    console.log('3. Update your .env file with SUPABASE_SERVICE_ROLE_KEY=your-key');
    console.log('4. Make sure there are no spaces or line breaks in the key');
    console.log('5. Add the same key to your Vercel environment variables');
  }
});
