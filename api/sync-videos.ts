import { VercelRequest, VercelResponse } from '@vercel/node'

// Simple in-memory storage for development
interface Video {
  id: string;
  user_id: string;
  video_id: string;
  channel_id: string;
  channel_name: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
  duration: string;
  created_at: string;
}

// Global storage that persists across API calls during the same deployment
let videoStorage: Video[] = []

const storage = {
  addVideos: (videos: Video[]): void => {
    videos.forEach(video => {
      const exists = videoStorage.some(v => 
        v.user_id === video.user_id && v.video_id === video.video_id
      )
      if (!exists) {
        videoStorage.push(video)
      }
    })
  }
}

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

  const { userId } = req.body || {}

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