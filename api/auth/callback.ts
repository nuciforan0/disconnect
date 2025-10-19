import { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const REDIRECT_URI = `${process.env.VITE_APP_URL}/api/auth/callback`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req

  if (method === 'GET' && query.code) {
    // Handle OAuth callback
    console.log('OAuth callback received with code:', query.code ? 'present' : 'missing')
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          code: query.code as string,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      })

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens')
      }

      const tokens = await tokenResponse.json()

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to get user info')
      }

      const userInfo = await userResponse.json()
      console.log(`Got user info for: ${userInfo.email} (ID: ${userInfo.id})`)

      // Store user and tokens in database (don't let this break auth flow)
      try {
        const { createClient } = require('@supabase/supabase-js')
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_KEY
        
        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey)
          
          console.log(`Attempting to save user ${userInfo.id} to database...`)
          
          // Upsert user with real tokens
          const { data: user, error: dbError } = await supabase
            .from('users')
            .upsert({
              google_id: userInfo.id,
              email: userInfo.email,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || 'no_refresh_token_received'
            }, { 
              onConflict: 'google_id',
              ignoreDuplicates: false 
            })
            .select()
            .single()
          
          if (dbError) {
            console.error('Database upsert error:', dbError)
          } else {
            console.log(`✅ Saved user ${userInfo.id} with real refresh token to database`)
          }
        } else {
          console.log('Missing Supabase environment variables, skipping database save')
        }
      } catch (dbError) {
        console.error('Failed to save user to database (non-blocking):', dbError)
      }

      const authData = {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name
        },
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in
        }
      }

      console.log(`Redirecting to success with user data for: ${userInfo.email}`)
      res.redirect(`${process.env.VITE_APP_URL}/login?auth=success&data=${encodeURIComponent(JSON.stringify(authData))}`)
    } catch (error) {
      console.error('OAuth callback error:', error)
      res.redirect(`${process.env.VITE_APP_URL}/login?auth=error&message=${encodeURIComponent((error as Error).message)}`)
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}