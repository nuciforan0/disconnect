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

async function fetchYouTubeSubscriptions(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`)
  }

  return response.json()
}

async function fetchChannelVideos(channelId: string, accessToken: string, publishedAfter: string) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&publishedAfter=${publishedAfter}&maxResults=10`, 
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`)
  }

  return response.json()
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

  const { userId, accessToken } = req.body || {}

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' })
  }

  // If no access token provided, fall back to mock data for testing
  if (!accessToken) {
    console.log(`No access token provided, using mock data for user ${userId}`)
    
    const mockSyncedVideos = [
      {
        id: `sync-${Date.now()}-1`,
        user_id: userId,
        video_id: `vid-${Date.now()}-1`,
        channel_id: 'UC_sample_1',
        channel_name: 'Tech Channel',
        title: 'Latest Tech News Update (Mock)',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        duration: '10:30',
        created_at: new Date().toISOString()
      },
      {
        id: `sync-${Date.now()}-2`,
        user_id: userId,
        video_id: `vid-${Date.now()}-2`,
        channel_id: 'UC_sample_2',
        channel_name: 'Gaming Channel',
        title: 'New Game Review (Mock)',
        thumbnail_url: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
        published_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        duration: '15:45',
        created_at: new Date().toISOString()
      }
    ]

    storage.addVideos(mockSyncedVideos)
    
    return res.status(200).json({
      success: true,
      channelsSynced: 2,
      videosSynced: mockSyncedVideos.length,
      errors: ['Using mock data - no access token provided'],
      quotaUsed: 0,
      executionTime: 500
    })
  }

  try {
    console.log(`Starting YouTube subscription sync for user ${userId}`)
    
    // Calculate exactly 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const publishedAfter = oneDayAgo.toISOString()
    
    // Get user's subscriptions
    const subscriptionsData = await fetchYouTubeSubscriptions(accessToken)
    const channels = subscriptionsData.items || []
    
    console.log(`Found ${channels.length} subscribed channels`)
    
    let allVideos: Video[] = []
    let channelsSynced = 0
    const errors: string[] = []
    
    // Fetch videos from each subscribed channel (limit to first 10 to avoid quota issues)
    for (const channel of channels.slice(0, 10)) {
      try {
        const channelId = channel.snippet.resourceId.channelId
        const channelName = channel.snippet.title
        
        const videosData = await fetchChannelVideos(channelId, accessToken, publishedAfter)
        const videos = videosData.items || []
        
        // Convert to our format
        const formattedVideos = videos.map((video: any) => ({
          id: `yt-${video.id.videoId}`,
          user_id: userId,
          video_id: video.id.videoId,
          channel_id: channelId,
          channel_name: channelName,
          title: video.snippet.title,
          thumbnail_url: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
          published_at: video.snippet.publishedAt,
          duration: 'Unknown', // Would need additional API call to get duration
          created_at: new Date().toISOString()
        }))
        
        allVideos.push(...formattedVideos)
        channelsSynced++
        
        console.log(`Synced ${formattedVideos.length} videos from ${channelName}`)
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        const errorMsg = `Failed to sync channel: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }
    
    // Add videos to storage (avoiding duplicates)
    storage.addVideos(allVideos)
    
    const result = {
      channelsSynced,
      videosSynced: allVideos.length,
      errors,
      quotaUsed: channelsSynced * 2, // Rough estimate
      executionTime: Date.now()
    }
    
    console.log(`YouTube sync completed for user ${userId}:`, result)
    
    res.status(200).json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('YouTube sync error:', error)
    
    const errorResponse = {
      success: false,
      error: 'YouTube sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
    
    res.status(500).json(errorResponse)
  }
}