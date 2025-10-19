import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' })
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh token')
    }

    const tokens = await tokenResponse.json()

    // Update tokens in database
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey)
        
        // Update access token for user with this refresh token
        const { data: updatedUser } = await supabase
          .from('users')
          .update({ 
            access_token: tokens.access_token
          })
          .eq('refresh_token', refreshToken)
          .select()
          .single()
        
        if (updatedUser) {
          console.log(`✅ Updated access token for user ${updatedUser.google_id}`)
        }
      } catch (dbError) {
        console.error('Failed to update tokens in database:', dbError)
      }
    }
    
    res.status(200).json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(401).json({ error: 'Failed to refresh token' })
  }
}