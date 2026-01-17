# Supabase Setup for Mastering Academia

## 1. Create New Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Name: `masteringacademia`
4. Database Password: (save this securely)
5. Region: Choose closest to your users
6. Click "Create new project"

## 2. Get API Credentials

After project creation:

1. Go to **Settings > API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Configure Environment

Create `.env.local` in project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Apply Database Schema

Go to **SQL Editor** in Supabase Dashboard and run these files in order:

1. `supabase/schema.sql` - Main research tools schema
2. `supabase/auth-schema.sql` - User settings and auth
3. `supabase/dashboard-schema.sql` - Dashboard tables

## 5. Configure Authentication

### Enable Email Auth

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure:
   - Enable email confirmations: Yes
   - Secure email change: Yes

### Configure Site URL

1. Go to **Authentication > URL Configuration**
2. Set **Site URL**: `https://masteringacademia.com`
3. Add **Redirect URLs**:
   - `https://masteringacademia.com/auth/callback`
   - `https://masteringacademia.com/research/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)

### Email Templates (Optional)

Go to **Authentication > Email Templates** and customize:

- Confirmation email
- Password reset email
- Magic link email

## 6. Configure Storage (Optional)

If using avatar uploads:

1. Go to **Storage**
2. Create bucket: `avatars`
3. Set to **Public**

## 7. Deploy Environment Variables

### Cloudflare Pages

Add environment variables in Cloudflare Pages dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Vercel

Add in Vercel project settings > Environment Variables.

## Checklist

- [ ] Created Supabase project
- [ ] Copied API credentials
- [ ] Created `.env.local`
- [ ] Applied `schema.sql`
- [ ] Applied `auth-schema.sql`
- [ ] Applied `dashboard-schema.sql`
- [ ] Configured email authentication
- [ ] Set Site URL and redirects
- [ ] (Optional) Created avatars storage bucket
- [ ] Added env vars to deployment platform
