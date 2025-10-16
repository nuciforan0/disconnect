# Environment Variables Setup for Vercel

You need to add these environment variables in your Vercel dashboard:

## Required Environment Variables:

1. **VITE_SUPABASE_URL** - Your Supabase project URL
   - Found in: Supabase Dashboard → Settings → API
   - Example: `https://your-project.supabase.co`

2. **SUPABASE_SERVICE_KEY** - Your Supabase service role key (secret)
   - Found in: Supabase Dashboard → Settings → API → service_role key
   - ⚠️ This is SECRET - never expose in frontend code

3. **VITE_SUPABASE_ANON_KEY** - Your Supabase anon public key
   - Found in: Supabase Dashboard → Settings → API → anon public key
   - This is safe for frontend use

## How to add them in Vercel:

1. Go to your Vercel dashboard
2. Select your project (disconnect-zeta)
3. Go to Settings → Environment Variables
4. Add each variable with the values from your Supabase dashboard

## Test the setup:

After adding the environment variables:
1. Redeploy your project in Vercel
2. Try syncing videos - they should now save to Supabase
3. Refresh the page - videos should persist!

## Check your Supabase database:

After syncing, you should see data in:
- `users` table - Your user record
- `videos` table - Your synced videos