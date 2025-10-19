import { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.VITE_YOUTUBE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const REDIRECT_URI = `${process.env.VITE_APP_URL}/api/auth/callback`

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
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}