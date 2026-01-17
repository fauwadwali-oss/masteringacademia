-- ============================================
-- User Settings & Auth Schema
-- Supabase storage and settings for users
-- ============================================

-- 1. USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Notification preferences
  notifications JSONB DEFAULT '{
    "email_updates": true,
    "email_alerts": true,
    "email_digest": "weekly"
  }'::jsonb,
  
  -- UI preferences
  preferences JSONB DEFAULT '{
    "theme": "light",
    "sidebar_collapsed": false,
    "default_view": "grid"
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
DROP POLICY IF EXISTS "users_own_settings" ON user_settings;
CREATE POLICY "users_own_settings" ON user_settings
  FOR ALL USING (user_id = auth.uid());

-- 3. STORAGE BUCKET FOR AVATARS
-- ============================================
-- Run this in the Supabase Dashboard under Storage

-- Create the avatars bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload their own avatars
DROP POLICY IF EXISTS "users_upload_avatar" ON storage.objects;
CREATE POLICY "users_upload_avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own avatars
DROP POLICY IF EXISTS "users_update_avatar" ON storage.objects;
CREATE POLICY "users_update_avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Anyone can view avatars (public bucket)
DROP POLICY IF EXISTS "public_view_avatars" ON storage.objects;
CREATE POLICY "public_view_avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 4. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. USER PROFILE VIEW
-- ============================================
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_user_meta_data->>'avatar_url' as avatar_url,
  u.created_at,
  u.updated_at,
  u.email_confirmed_at,
  s.notifications,
  s.preferences
FROM auth.users u
LEFT JOIN user_settings s ON s.user_id = u.id;

-- 6. GRANT PERMISSIONS
-- ============================================
GRANT ALL ON user_settings TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;

-- 7. OPTIONAL: EMAIL TEMPLATES (Configure in Supabase Dashboard)
-- ============================================
-- 
-- Confirmation Email Subject:
-- Confirm your MasteringSeries account
--
-- Confirmation Email Body:
-- <h2>Welcome to MasteringSeries!</h2>
-- <p>Click the link below to confirm your email address:</p>
-- <p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
-- <p>This link will expire in 24 hours.</p>
--
-- Password Reset Subject:
-- Reset your MasteringSeries password
--
-- Password Reset Body:
-- <h2>Password Reset Request</h2>
-- <p>Click the link below to reset your password:</p>
-- <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
-- <p>If you didn't request this, you can safely ignore this email.</p>
-- <p>This link will expire in 1 hour.</p>

-- 8. EDGE FUNCTION FOR ACCOUNT DELETION
-- ============================================
-- Create this as a Supabase Edge Function: delete-account
--
-- // supabase/functions/delete-account/index.ts
-- import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
-- import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
--
-- serve(async (req) => {
--   const supabaseClient = createClient(
--     Deno.env.get('SUPABASE_URL') ?? '',
--     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
--   )
--
--   const authHeader = req.headers.get('Authorization')!
--   const token = authHeader.replace('Bearer ', '')
--   
--   const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
--   
--   if (userError || !user) {
--     return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
--   }
--
--   // Delete user data from all tables
--   await supabaseClient.from('research_projects').delete().eq('user_id', user.id)
--   await supabaseClient.from('user_settings').delete().eq('user_id', user.id)
--   
--   // Delete user from auth
--   const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user.id)
--   
--   if (deleteError) {
--     return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
--   }
--
--   return new Response(JSON.stringify({ success: true }), { status: 200 })
-- })
