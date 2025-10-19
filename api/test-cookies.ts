import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🍪 Cookie test endpoint called')
  console.log('Method:', req.method)
  console.log('Headers:', {
    cookie: req.headers.cookie,
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
  })

  if (req.method === 'POST') {
    // Set test cookies
    const testCookies = [
      `test_cookie=test_value_${Date.now()}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600; Path=/`,
      `simple_cookie=simple_value; Max-Age=3600; Path=/`
    ]
    
    res.setHeader('Set-Cookie', testCookies)
    console.log('🍪 Setting test cookies:', testCookies)
    
    res.status(200).json({
      success: true,
      message: 'Test cookies set',
      cookies: testCookies
    })
  } else {
    // Read cookies
    const cookies = req.headers.cookie
    console.log('🍪 Reading cookies:', cookies)
    
    const parsedCookies: Record<string, string> = {}
    if (cookies) {
      cookies.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          parsedCookies[name] = value
        }
      })
    }
    
    res.status(200).json({
      success: true,
      rawCookies: cookies,
      parsedCookies,
      hasCookies: !!cookies,
      cookieCount: Object.keys(parsedCookies).length
    })
  }
}