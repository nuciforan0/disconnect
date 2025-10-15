import { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const REDIRECT_URI = `${process.env.VITE_APP_URL}/api/auth/callback`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req

  if (method === 'POST') {
    // Initiate Google OAuth flow
    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
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

      // Store user and tokens in database (will implement database operations)
      // For now, redirect with success
      res.redirect(`${process.env.VITE_APP_URL}/?auth=success&user=${encodeURIComponent(JSON.stringify({
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name
      }))}`)
    } catch (error) {
      console.error('OAuth callback error:', error)
      res.redirect(`${process.env.VITE_APP_URL}/?auth=error`)
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}