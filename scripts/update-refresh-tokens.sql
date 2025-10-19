-- Script to check current refresh token status
-- Run this in Supabase SQL editor to see current state

SELECT 
  google_id,
  email,
  CASE 
    WHEN refresh_token = 'placeholder' THEN 'NEEDS_UPDATE'
    WHEN refresh_token = 'created_via_sync_no_refresh_token' THEN 'NEEDS_REAUTH'
    WHEN refresh_token = 'no_refresh_token_received' THEN 'NEEDS_REAUTH'
    ELSE 'HAS_REFRESH_TOKEN'
  END as token_status,
  last_sync,
  created_at
FROM users
ORDER BY created_at DESC;

-- To fix users with placeholder tokens, they need to log out and log back in
-- The new OAuth flow will now save real refresh tokens