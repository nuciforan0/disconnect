import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔄 Simple auth restore request received')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionToken } = req.body
  console.log('Session token provided:', !!sessionToken)

  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token is required' })
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Find user by session token
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('session_token', sessionToken)
      .single()

    if (dbError || !user) {
      console.log('❌ User not found for session token')
      return res.status(404).json({ error: 'Invalid session token' })
    }

    console.log(`✅ Found user: ${user.email}`)

    // Check if we have a refresh token
    if (!user.refresh_token || user.refresh_token === 'placeholder' || user.refresh_token === 'no_refresh_token_received') {
      console.log(`❌ No valid refresh token for user`)
      return res.status(401).json({ error: 'No valid refresh token available' })
    }

    // Refresh the access token
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
      console.error(`❌ Failed to refresh token: ${tokenResponse.status}`)
      return res.status(401).json({ error: 'Failed to refresh token' })
    }

    const tokens = await tokenResponse.json()
    console.log(`✅ Successfully refreshed token`)

    // Update the access token in the database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        access_token: tokens.access_token,
        last_sync: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update access token:', updateError)
    }

    // Return fresh tokens
    res.status(200).json({
      success: true,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: user.refresh_token,
        expiresIn: tokens.expires_in || 3600
      },
      user: {
        id: user.google_id,
        email: user.email
      }
    })

  } catch (error) {
    console.error('Simple restore error:', error)
    res.status(500).json({ 
      error: 'Failed to restore authentication',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}