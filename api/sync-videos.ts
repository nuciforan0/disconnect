import { VercelRequest, VercelResponse } from '@vercel/node'
import { storage } from './_storage'

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
    
    // TODO: Implement actual YouTube API sync
    // For now, simulate syncing some recent videos from subscriptions
    const mockSyncedVideos = [
      {
        id: `sync-${Date.now()}-1`,
        user_id: userId,
        video_id: `vid-${Date.now()}-1`,
        channel_id: 'UC_sample_1',
        channel_name: 'Tech Channel',
        title: 'Latest Tech News Update',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        duration: '10:30',
        created_at: new Date().toISOString()
      },
      {
        id: `sync-${Date.now()}-2`,
        user_id: userId,
        video_id: `vid-${Date.now()}-2`,
        channel_id: 'UC_sample_2',
        channel_name: 'Gaming Channel',
        title: 'New Game Review',
        thumbnail_url: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
        published_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        duration: '15:45',
        created_at: new Date().toISOString()
      }
    ]

    // Add to shared storage (avoiding duplicates)
    storage.addVideos(mockSyncedVideos)
    
    const result = {
      channelsSynced: 2,
      videosSynced: mockSyncedVideos.length,
      errors: [],
      quotaUsed: 5,
      executionTime: 1200
    }
    
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