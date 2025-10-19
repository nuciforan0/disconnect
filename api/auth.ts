import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
        console.log('🔍 Checking environment variables...')
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_KEY
        
        console.log('Environment check:', {
          hasSupabaseUrl: !!supabaseUrl,
          hasServiceKey: !!serviceKey,
          supabaseUrlPrefix: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'missing',
          serviceKeyPrefix: serviceKey ? serviceKey.substring(0, 10) + '...' : 'missing'
        })
        
        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey)
          
          console.log(`🔄 Attempting to save user ${userInfo.id} (${userInfo.email}) to database...`)
          
          const userData = {
            google_id: userInfo.id,
            email: userInfo.email,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || 'no_refresh_token_received'
          }
          
          console.log('User data to save:', {
            google_id: userData.google_id,
            email: userData.email,
            hasAccessToken: !!userData.access_token,
            hasRefreshToken: !!userData.refresh_token,
            refreshTokenValue: userData.refresh_token
          })
          
          // Upsert user with real tokens
          const { data: user, error: dbError } = await supabase
            .from('users')
            .upsert(userData, { 
              onConflict: 'google_id',
              ignoreDuplicates: false 
            })
            .select()
            .single()
          
          if (dbError) {
            console.error('❌ Database upsert error:', {
              message: dbError.message,
              details: dbError.details,
              hint: dbError.hint,
              code: dbError.code
            })
          } else if (user) {
            console.log(`✅ Successfully saved user to database:`, {
              id: user.id,
              google_id: user.google_id,
              email: user.email,
              hasRefreshToken: !!user.refresh_token,
              refreshToken: user.refresh_token
            })
          } else {
            console.log('⚠️ No error but no user returned from database')
          }
        } else {
          console.error('❌ Missing Supabase environment variables:', {
            VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY
          })
        }
      } catch (dbError) {
        console.error('❌ Exception during database save:', {
          error: dbError,
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          stack: dbError instanceof Error ? dbError.stack : undefined
        })
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

      // Set secure HTTP-only cookie for persistent user identification
      // This survives localStorage clearing and browser restarts
      res.setHeader('Set-Cookie', [
        `auth_user_id=${userInfo.id}; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}; Path=/`, // 30 days
        `auth_session=${Buffer.from(JSON.stringify({userId: userInfo.id, email: userInfo.email})).toString('base64')}; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}; Path=/`
      ])

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