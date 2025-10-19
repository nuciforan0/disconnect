import { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const REDIRECT_URI = `${process.env.VITE_APP_URL}/api/auth`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req

  if (method === 'POST') {
    // Initiate Google OAuth flow
    const scopes = [
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ')

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`

    res.status(200).json({ authUrl })
  } else if (method === 'GET' && query.code) {
    // Handle OAuth callback
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

      // Store user and tokens in database
      const { createClient } = require('@supabase/supabase-js')
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      
      if (supabaseUrl && serviceKey) {
        try {
          const supabase = createClient(supabaseUrl, serviceKey)
          
          // Upsert user with real tokens
          const { data: user } = await supabase
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
          
          console.log(`✅ Saved user ${userInfo.id} with real refresh token to database`)
        } catch (dbError) {
          console.error('Failed to save user to database:', dbError)
        }
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

      res.redirect(`${process.env.VITE_APP_URL}/login?auth=success&data=${encodeURIComponent(JSON.stringify(authData))}`)
    } catch (error) {
      console.error('OAuth callback error:', error)
      res.redirect(`${process.env.VITE_APP_URL}/login?auth=error&message=${encodeURIComponent((error as Error).message)}`)
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}