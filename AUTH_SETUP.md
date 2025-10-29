# Authentication Setup Guide

This guide will help you set up Supabase authentication for Browzer.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and pnpm installed

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in your project details:
   - Project name: `browzer` (or your preferred name)
   - Database password: Choose a strong password
   - Region: Select the closest region to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (this may take a few minutes)

## Step 2: Configure Authentication Providers

### Email Authentication (Already Enabled by Default)

Email authentication is enabled by default in Supabase.

### Google OAuth Setup

1. In your Supabase dashboard, go to **Authentication** > **Providers**
2. Find **Google** in the list and click to expand
3. Enable the Google provider
4. You'll need to create OAuth credentials in Google Cloud Console:

#### Google Cloud Console Setup:

1. Go to https://console.cloud.google.com
2. Create a new project or select an existing one
3. Go to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Configure the OAuth consent screen if prompted:
   - User Type: External
   - App name: Browzer
   - User support email: Your email
   - Developer contact: Your email
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Browzer
   - Authorized redirect URIs: Add the callback URL from Supabase (shown in the Google provider settings)
     - Format: `https://<your-project-ref>.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**
8. Paste them into the Supabase Google provider settings
9. Click **Save**

## Step 3: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (under Project URL)
   - **anon public** key (under Project API keys)

## Step 4: Configure Environment Variables

1. Create a `.env` file in the root of your Browzer project:

```bash
cp .env.example .env
```

2. Edit the `.env` file and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace `your-project-ref` and `your-anon-key-here` with your actual values.

## Step 5: Configure Email Templates (Optional)

You can customize the email templates for authentication emails:

1. Go to **Authentication** > **Email Templates** in Supabase
2. Customize templates for:
   - Confirm signup
   - Magic Link
   - Change Email Address
   - Reset Password

## Step 6: Set Up Row Level Security (RLS) Policies

For future features like user profiles, subscriptions, etc., you'll want to set up RLS policies:

### Example: User Profiles Table

```sql
-- Create a profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Step 7: Test the Authentication

1. Start your Browzer app:

```bash
pnpm start
```

2. The app should redirect you to the authentication page
3. Try signing up with email and password
4. Check your email for the confirmation link (if email confirmation is enabled)
5. Try signing in with Google OAuth

## Features Implemented

### ✅ Email/Password Authentication
- Sign up with email and password
- Sign in with email and password
- Email verification (configurable in Supabase)
- Password reset via email

### ✅ Google OAuth
- One-click sign in with Google
- Automatic profile creation

### ✅ Session Management
- Automatic token refresh
- Persistent sessions across app restarts
- Secure session storage using electron-store with encryption

### ✅ Protected Routes
- AuthGuard component protects all app routes
- Automatic redirect to auth page if not authenticated
- Loading states during authentication checks

### ✅ User Profile
- Access to user metadata
- Update user profile information
- Avatar support (via user_metadata)

## Future Enhancements (Planned)

### 🔄 Subscription & Billing (Stripe Integration)
- Multiple pricing tiers (Free, Pro, Enterprise)
- Credit-based usage tracking
- Stripe Checkout integration
- Webhook handling for subscription events

### 🔄 Team Management
- Create and manage teams
- Invite team members
- Role-based access control (Owner, Admin, Member)
- Team-based resource sharing

### 🔄 Rate Limiting
- API rate limits based on subscription tier
- Usage analytics and monitoring
- Quota management

### 🔄 Advanced Features
- Two-factor authentication (2FA)
- Social login providers (GitHub, Microsoft, etc.)
- SSO for enterprise customers
- Audit logs

## Troubleshooting

### Issue: "Missing Supabase configuration" error

**Solution**: Make sure you've created the `.env` file with the correct Supabase credentials.

### Issue: Google OAuth not working

**Solution**: 
1. Verify the redirect URI in Google Cloud Console matches the one in Supabase
2. Make sure the Google provider is enabled in Supabase
3. Check that Client ID and Secret are correctly entered

### Issue: Email confirmation not working

**Solution**:
1. Check your Supabase email settings in **Authentication** > **Email Templates**
2. Verify SMTP settings if using custom email provider
3. For development, you can disable email confirmation in **Authentication** > **Settings**

### Issue: Session not persisting

**Solution**:
1. Check that electron-store is properly initialized
2. Verify the encryption key in AuthService
3. Clear app data and try again

## Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use strong encryption keys** - Replace the default encryption key in `AuthService.ts`
3. **Enable RLS** - Always use Row Level Security for database tables
4. **Validate on server** - Never trust client-side validation alone
5. **Use HTTPS** - Ensure all production deployments use HTTPS
6. **Regular security audits** - Keep dependencies updated

## Support

For issues or questions:
- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Browzer Issues: [Your GitHub repo issues page]

## License

This authentication implementation follows the same license as the Browzer project.
