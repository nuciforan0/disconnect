import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🧪 Manual test: Triggering daily sync...')
    
    // Call the same sync endpoint that the cron job uses
    const syncResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://localhost:3000' : `https://${req.headers.host}`}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (syncResponse.ok) {
      const syncData = await syncResponse.json()
      
      console.log('🧪 Manual test completed:', syncData)
      
      res.status(200).json({
        success: true,
        message: 'Daily sync test completed successfully!',
        results: syncData,
        note: 'This is the same process that runs automatically at 8 AM AEST'
      })
    } else {
      const errorText = await syncResponse.text()
      throw new Error(`Sync API returned ${syncResponse.status}: ${errorText}`)
    }
    
  } catch (error) {
    console.error('🧪 Manual test failed:', error)
    
    res.status(500).json({
      success: false,
      error: 'Daily sync test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}