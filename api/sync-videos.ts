import { VercelRequest, VercelResponse } from '@vercel/node'
import { syncService } from '../src/services/syncService'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' })
  }

  try {
    console.log(`Starting video sync for user ${userId}`)
    
    // Sync videos from the last 24 hours
    const result = await syncService.syncUserVideos(userId)
    
    console.log(`Video sync completed for user ${userId}:`, result)
    
    res.status(200).json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Video sync error:', error)
    
    const errorResponse = {
      success: false,
      error: 'Video sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
    
    res.status(500).json(errorResponse)
  }
}