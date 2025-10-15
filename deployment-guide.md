# YouTube Subscription Manager - Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
3. **Google Cloud Console**: Access at [console.cloud.google.com](https://console.cloud.google.com)

## Step 1: Set Up Google OAuth

1. Go to Google Cloud Console
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:5173/api/auth/callback` (development)
   - `https://your-domain.vercel.app/api/auth/callback` (production)
7. Save the Client ID and Client Secret

## Step 2: Set Up Supabase

1. Create a new Supabase project
2. Go to Settings → API to get your URL and keys
3. Run the database migration:
   ```sql
   -- Copy and paste the contents of supabase/migrations/001_initial_schema.sql
   -- into the Supabase SQL editor and execute
   ```
4. Configure Row Level Security (RLS) policies as defined in the migration

## Step 3: Configure Environment Variables

### Development (.env.local)
```bash
# YouTube API
VITE_YOUTUBE_CLIENT_ID=your_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_oauth_client_secret

# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# App
VITE_APP_URL=http://localhost:5173

# Security
ENCRYPTION_KEY=your_32_character_encryption_key
```

### Production (Vercel Environment Variables)
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add all the variables from above with production values
4. Make sure `VITE_APP_URL` points to your production domain

## Step 4: Deploy to Vercel

### Option 1: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically deploy on every push to main branch

### Option 2: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

## Step 5: Configure Domain (Optional)

1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Update Google OAuth redirect URIs with new domain
4. Update `VITE_APP_URL` environment variable

## Step 6: Set Up Monitoring (Optional)

### Error Tracking with Sentry
1. Create Sentry account and project
2. Add `SENTRY_DSN` environment variable
3. Errors will be automatically tracked in production

### Analytics
1. Set up Google Analytics
2. Add `ANALYTICS_ID` environment variable
3. User actions will be tracked automatically

## Step 7: Test Deployment

1. Visit your deployed application
2. Test Google OAuth login
3. Verify video sync functionality
4. Check cron job execution in Vercel Functions tab

## Security Checklist

- [ ] All environment variables are set correctly
- [ ] OAuth redirect URIs are configured for production domain
- [ ] Supabase RLS policies are enabled
- [ ] HTTPS is enforced (automatic with Vercel)
- [ ] Security headers are configured (in vercel.json)
- [ ] API keys are not exposed in client-side code

## Performance Optimization

### Vercel Configuration
- Functions are configured with 30s timeout
- Static assets are automatically cached
- Edge caching is enabled for API responses

### Database Optimization
- Indexes are created for frequently queried columns
- Connection pooling is handled by Supabase
- Batch operations are used for bulk inserts

### Frontend Optimization
- Code splitting with React Router
- Image lazy loading
- React Query caching
- Service worker for offline functionality (optional)

## Monitoring and Maintenance

### Cron Job Monitoring
- Check Vercel Functions tab for cron execution logs
- Monitor sync success/failure rates
- Set up alerts for quota exceeded errors

### Database Maintenance
- Monitor Supabase usage and performance
- Set up automated backups
- Clean up old video records periodically

### API Quota Management
- Monitor YouTube API quota usage
- Implement alerts for high usage
- Optimize sync frequency if needed

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**
   - Ensure redirect URIs in Google Console match your domain
   - Check for trailing slashes and protocol (http vs https)

2. **Database Connection Issues**
   - Verify Supabase service key is correct
   - Check RLS policies are properly configured
   - Ensure database migration was executed

3. **Cron Job Not Running**
   - Verify vercel.json cron configuration
   - Check function logs in Vercel dashboard
   - Ensure function doesn't exceed timeout limits

4. **YouTube API Quota Exceeded**
   - Monitor quota usage in Google Cloud Console
   - Reduce sync frequency if necessary
   - Implement exponential backoff for retries

### Debug Mode
Set `NODE_ENV=development` to enable:
- Detailed error messages
- React Query DevTools
- Console logging
- Performance monitoring

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Vercel and Supabase documentation
3. Check browser console for client-side errors
4. Review Vercel function logs for server-side errors

## Updates and Maintenance

### Updating Dependencies
```bash
npm update
npm audit fix
```

### Database Schema Updates
1. Create new migration file in `supabase/migrations/`
2. Test migration in development
3. Apply to production Supabase instance
4. Deploy application updates

### Feature Rollouts
1. Test new features in development
2. Deploy to staging environment (optional)
3. Deploy to production
4. Monitor for errors and performance impact