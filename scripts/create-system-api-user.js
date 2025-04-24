/**
 * This script creates a system API user in Supabase that can be used for direct API requests.
 * The user ID will be used as a reference for imports created via the API without authentication.
 * 
 * Usage: 
 * 1. Make sure you have the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set as environment variables
 * 2. Run: node scripts/create-system-api-user.js
 * 3. Copy the generated user ID to your .env file as SYSTEM_API_USER_ID
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Required environment variables not found.');
  console.error('Please make sure you have set the following:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createSystemApiUser() {
  try {
    console.log('Creating system API user...');
    
    // Check if there's already a system API user
    const { data: existingUsers, error: findError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'system-api@klaviyo-kudosity-sync.app')
      .limit(1);
    
    if (findError) {
      console.error('Error checking for existing system user:', findError);
      throw findError;
    }
    
    // If user already exists, return it
    if (existingUsers && existingUsers.length > 0) {
      const systemUser = existingUsers[0];
      console.log('System API user already exists with ID:', systemUser.id);
      console.log('\nAdd this ID to your .env file:');
      console.log('\nSYSTEM_API_USER_ID=' + systemUser.id);
      return systemUser.id;
    }
    
    // Generate a random password
    const password = uuidv4() + uuidv4();
    
    // Create a new user via admin APIs
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'system-api@klaviyo-kudosity-sync.app',
      password: password,
      email_confirm: true,
      user_metadata: {
        name: 'System API User',
        is_system: true
      }
    });
    
    if (error) {
      console.error('Error creating system API user:', error);
      throw error;
    }
    
    if (!data || !data.user) {
      throw new Error('Failed to create system API user');
    }
    
    const userId = data.user.id;
    
    console.log('System API user created successfully.');
    console.log('User ID:', userId);
    console.log('\nAdd this ID to your .env file:');
    console.log('\nSYSTEM_API_USER_ID=' + userId);
    
    return userId;
  } catch (error) {
    console.error('Error creating system API user:', error);
    process.exit(1);
  }
}

// Run the script
createSystemApiUser(); 