import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Test endpoint called')
  console.log('Method:', req.method)
  console.log('Query:', req.query)
  console.log('Headers:', req.headers)
  
  res.status(200).json({ 
    message: 'Test endpoint working',
    method: req.method,
    query: req.query,
    timestamp: new Date().toISOString()
  })
}