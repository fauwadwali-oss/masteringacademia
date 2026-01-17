import { createClient } from '@supabase/supabase-js';

// Ensure we always have valid values - check for empty strings too
// If env var is empty string, use fallback
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const supabaseUrl = (envUrl && envUrl.length > 0) 
  ? envUrl 
  : 'https://gbnfaysfuevpuwdovrbg.supabase.co';

const supabaseKey = (envKey && envKey.length > 0)
  ? envKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdibmZheXNmdWV2cHV3ZG92cmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODM0OTIsImV4cCI6MjA3OTY1OTQ5Mn0.vqdGrQ83t0EwiccLjhBDvBjoe2iE3IgjCXSXXpP9Ids';

// Validate that we have required values
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration error: Missing URL or API key');
  throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

// Log configuration in development (without exposing the full key)
if (typeof window !== 'undefined') {
  console.log('Supabase configured:', {
    url: supabaseUrl,
    keyPresent: !!supabaseKey,
    keyLength: supabaseKey.length,
    keyPrefix: supabaseKey.substring(0, 20) + '...'
  });
  
  // Verify the client has the key
  if (!supabaseKey || supabaseKey.length < 50) {
    console.error('⚠️ Supabase API key appears to be invalid or too short!');
  }
}

// Create Supabase client with explicit global headers
// Only set apikey globally - let Supabase use session token for Authorization
// The Supabase JS client automatically uses the session's access token for authenticated requests
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'apikey': supabaseKey
      // Don't set Authorization here - let Supabase use the session token automatically
    }
  }
});
