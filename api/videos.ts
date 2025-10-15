import { VercelRequest, VercelResponse } from '@vercel/node'

// Mock data for now - will be replaced with actual database calls
const mockVideos = [
  {
    id: '1',
    user_id: 'user1',
    video_id: 'dQw4w9WgXcQ',
    channel_id: 'UC123',
    channel_name: 'Sample Channel',
    title: 'Never Gonna Give You Up',
    thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    duration: '3:33',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    user_id: 'user1',
    video_id: 'jNQXAC9IVRw',
    channel_id: 'UC456',
    channel_name: 'Another Channel',
    title: 'Me at the zoo',
    thumbnail_url: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
    published_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    duration: '0:19',
    created_at: new Date().toISOString()
  }
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req

  if (method === 'GET') {
    try {
      // Get query parameters
      const limit = parseInt(query.limit as string) || 50
      const offset = parseInt(query.offset as string) || 0
      const userId = query.userId as string // In real app, get from auth token

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // TODO: Replace with actual database query
      // const videos = await databaseService.getUserVideos(userId, limit, offset)
      
      // Mock implementation
      const userVideos = mockVideos.filter(video => video.user_id === userId)
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