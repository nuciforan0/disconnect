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

// Use the same global storage as sync-videos API
let videoStorage: Video[] = []

// Access the shared global storage
if (typeof global !== 'undefined') {
  if (!(global as any).videoStorage) {
    (global as any).videoStorage = []
  }
  videoStorage = (global as any).videoStorage
}

const storage = {
  getVideos: (userId: string): Video[] => {
    return videoStorage.filter(video => video.user_id === userId)
  },

  addVideos: (videos: Video[]): void => {
    videos.forEach(video => {
      const exists = videoStorage.some(v => 
        v.user_id === video.user_id && v.video_id === video.video_id
      )
      if (!exists) {
        videoStorage.push(video)
      }
    })
    if (typeof global !== 'undefined') {
      (global as any).videoStorage = videoStorage
    }
  },

  deleteVideo: (userId: string, videoId: string): boolean => {
    const initialLength = videoStorage.length
    videoStorage = videoStorage.filter(video => 
      !(video.user_id === userId && video.video_id === videoId)
    )
    if (typeof global !== 'undefined') {
      (global as any).videoStorage = videoStorage
    }
    return videoStorage.length < initialLength
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { method, query } = req

  if (method === 'GET') {
    try {
      // Get query parameters with better error handling
      const limitStr = query.limit as string
      const offsetStr = query.offset as string
      const userId = query.userId as string

      const limit = limitStr ? parseInt(limitStr) : 50
      const offset = offsetStr ? parseInt(offsetStr) : 0

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
        return res.status(400).json({ error: 'Invalid limit or offset parameters' })
      }

      // TODO: Replace with actual database query
      // const videos = await databaseService.getUserVideos(userId, limit, offset)
      
      // Use shared storage and sort by published date (newest first)
      const userVideos = storage.getVideos(userId)
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      
      console.log(`Videos API: Found ${userVideos.length} videos for user ${userId}`)
      console.log(`Videos API: Total videos in storage: ${videoStorage.length}`)
      console.log(`Videos API: All user IDs in storage:`, [...new Set(videoStorage.map(v => v.user_id))])
      
      const paginatedVideos = userVideos.slice(offset, offset + limit)
      const hasMore = offset + limit < userVideos.length

      // Format response
      const formattedVideos = paginatedVideos.map(video => ({
        id: video.id,
        videoId: video.video_id,
        channelId: video.channel_id,
        channelName: video.channel_name,
        title: video.title,
        thumbnailUrl: video.thumbnail_url,
        publishedAt: formatTimeAgo(new Date(video.published_at)),
        duration: video.duration,
      }))

      res.status(200).json({
        videos: formattedVideos,
        hasMore,
        total: userVideos.length
      })
    } catch (error) {
      console.error('Error fetching videos:', error)
      res.status(500).json({ error: 'Failed to fetch videos' })
    }
  } else if (method === 'DELETE') {
    try {
      const videoId = query.videoId as string
      const userId = query.userId as string // In real app, get from auth token

      if (!videoId || !userId) {
        return res.status(400).json({ error: 'Video ID and user authentication required' })
      }

      // TODO: Replace with actual database deletion
      // await databaseService.deleteVideo(userId, videoId)
      
      // Remove from shared storage
      storage.deleteVideo(userId, videoId)
      
      console.log(`Deleted video ${videoId} for user ${userId}`)

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting video:', error)
      res.status(500).json({ error: 'Failed to delete video' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else {
    const weeks = Math.floor(diffInSeconds / 604800)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
}