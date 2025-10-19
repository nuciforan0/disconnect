import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Clear the secure cookies
  res.setHeader('Set-Cookie', [
    'auth_user_id=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/',
    'auth_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
  ])

  console.log('🍪 Cleared authentication cookies')

  res.status(200).json({ success: true, message: 'Logged out successfully' })
}