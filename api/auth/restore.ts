import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let userId = req.body?.userId

  // If no userId provided in body, try to get it from secure cookie
  if (!userId) {
    const cookies = req.headers.cookie
    if (cookies) {
      const authUserIdMatch = cookies.match(/auth_user_id=([^;]+)/)
      if (authUserIdMatch) {
        userId = authUserIdMatch[1]
        console.log(`🍪 Found user ID in cookie: ${userId}`)
      }
    }
  }

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required (not found in request or cookies)' })
  }

  try {
    console.log(`🔄 Attempting to restore authentication for user: ${userId}`)

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase environment variables')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Get user from database
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', userId)
      .single()

    if (dbError || !user) {
      console.log(`❌ User ${userId} not found in database`)
      return res.status(404).json({ error: 'User not found' })
    }

    console.log(`✅ Found user in database: ${user.email}`)

    // Check if we have a refresh token
    if (!user.refresh_token || user.refresh_token === 'placeholder' || user.refresh_token === 'no_refresh_token_received') {
      console.log(`❌ No valid refresh token for user ${userId}`)
      return res.status(401).json({ error: 'No valid refresh token available' })
    }

    // Try to refresh the access token using the stored refresh token
    console.log(`🔄 Refreshing access token for user ${userId}`)
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: user.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) {
      console.error(`❌ Failed to refresh token for user ${userId}: ${tokenResponse.status}`)
      return res.status(401).json({ error: 'Failed to refresh token' })
    }

    const tokens = await tokenResponse.json()
    console.log(`✅ Successfully refreshed token for user ${userId}`)

    // Update the access token in the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        access_token: tokens.access_token,
        last_sync: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update access token in database:', updateError)
    }

    // Refresh the cookie expiration on successful restore (rolling expiration)
    res.setHeader('Set-Cookie', [
      `auth_user_id=${user.google_id}; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}; Path=/`, // Reset to 30 days
      `auth_session=${Buffer.from(JSON.stringify({userId: user.google_id, email: user.email})).toString('base64')}; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}; Path=/`
    ])

    console.log(`🍪 Refreshed cookie expiration for user ${user.google_id}`)

    // Return the fresh tokens to the client
    res.status(200).json({
      success: true,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: user.refresh_token, // Keep the same refresh token
        expiresIn: tokens.expires_in || 3600
      },
      user: {
        id: user.google_id,
        email: user.email
      }
    })

  } catch (error) {
    console.error('Auth restore error:', error)
    res.status(500).json({ 
      error: 'Failed to restore authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}