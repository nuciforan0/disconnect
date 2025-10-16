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

// Use global storage to share between API functions
let videoStorage: Video[] = []

// Access global storage
if (typeof global !== 'undefined') {
  if (!(global as any).videoStorage) {
    (global as any).videoStorage = []
  }
  videoStorage = (global as any).videoStorage
}

const storage = {
  addVideos: (videos: Video[]): void => {
    videos.forEach(video => {
      const exists = videoStorage.some(v => 
        v.user_id === video.user_id && v.video_id === video.video_id
      )
      if (!exists) {
        videoStorage.push(video)
        console.log(`Added video: ${video.title} from ${video.channel_name}`)
      }
    })
    
    // Update global storage
    if (typeof global !== 'undefined') {
      (global as any).videoStorage = videoStorage
    }
    
    console.log(`Storage now contains ${videoStorage.length} total videos`)
  }
}

async function fetchChannelRSSFeed(channelId: string): Promise<any[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    console.log(`Fetching RSS feed: ${rssUrl}`)
    
    const response = await fetch(rssUrl)
    
    if (!response.ok) {
      console.error(`RSS feed error for channel ${channelId}: ${response.status}`)
      return []
    }
    
    const xmlText = await response.text()
    return parseRSSFeed(xmlText, channelId)
  } catch (error) {
    console.error(`Failed to fetch RSS for channel ${channelId}:`, error)
    return []
  }
}

function parseRSSFeed(xmlText: string, channelId: string): any[] {
  try {
    // Simple XML parsing for Node.js environment
    const videos: any[] = []
    
    // Extract video entries using regex (simple approach for server-side)
    const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || []
    
    entryMatches.forEach(entryXml => {
      try {
        const videoIdMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
        const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/)
        const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/)
        const authorMatch = entryXml.match(/<name>([^<]+)<\/name>/)
        const thumbnailMatch = entryXml.match(/url="([^"]*mqdefault[^"]*)"/)
        
        if (videoIdMatch && titleMatch && publishedMatch) {
          const videoId = videoIdMatch[1]
          const title = titleMatch[1]
          const publishedAt = publishedMatch[1]
          const channelName = authorMatch ? authorMatch[1] : 'Unknown Channel'
          const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          
          videos.push({
            videoId,
            title,
            channelId,
            channelName,
            publishedAt,
            thumbnailUrl
          })
        }
      } catch (error) {
        console.warn(`Failed to parse RSS entry:`, error)
      }
    })
    
    return videos
  } catch (error) {
    console.error(`Failed to parse RSS feed for channel ${channelId}:`, error)
    return []
  }
}

async function getAllSubscriptionVideosViaRSS(channelIds: string[], publishedAfter: string) {
  console.log(`Fetching RSS feeds for ${channelIds.length} channels...`)
  
  const allVideos: any[] = []
  const publishedAfterDate = new Date(publishedAfter)
  
  // Process channels in batches to avoid overwhelming the server
  const batchSize = 10
  for (let i = 0; i < channelIds.length; i += batchSize) {
    const batch = channelIds.slice(i, i + batchSize)
    
    const batchPromises = batch.map(channelId => fetchChannelRSSFeed(channelId))
    const batchResults = await Promise.all(batchPromises)
    
    // Flatten and filter by date
    batchResults.forEach(channelVideos => {
      const recentVideos = channelVideos.filter(video => 
        new Date(video.publishedAt) > publishedAfterDate
      )
      allVideos.push(...recentVideos)
    })
    
    console.log(`Processed RSS batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(channelIds.length / batchSize)}`)
    
    // Small delay between batches
    if (i + batchSize < channelIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  // Sort by published date (newest first)
  allVideos.sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
  
  console.log(`RSS sync complete: ${allVideos.length} videos from ${channelIds.length} channels`)
  return allVideos
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
        title: 'Latest Tech News Update (Mock - No Auth)',
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
        title: 'New Game Review (Mock - No Auth)',
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

  // RSS feeds use minimal quota, so we can always run the real sync now!

  try {
    console.log(`Starting YouTube subscription sync for user ${userId}`)
    
    // Calculate exactly 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const publishedAfter = oneDayAgo.toISOString()
    
    console.log(`Looking for videos published after: ${publishedAfter}`)
    
    // Get user's subscribed channels first (this requires 1 API call)
    console.log('Fetching user subscriptions to get channel list...')
    const allChannelIds: string[] = []
    let nextPageToken = ''
    
    do {
      const subscriptionsUrl = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
      
      const subsResponse = await fetch(subscriptionsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
      
      if (!subsResponse.ok) {
        throw new Error(`Failed to fetch subscriptions: ${subsResponse.status}`)
      }
      
      const subsData = await subsResponse.json()
      const channels = subsData.items || []
      
      channels.forEach((channel: any) => {
        allChannelIds.push(channel.snippet.resourceId.channelId)
      })
      
      nextPageToken = subsData.nextPageToken || ''
      console.log(`Fetched ${channels.length} subscriptions, total: ${allChannelIds.length}`)
      
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } while (nextPageToken)
    
    console.log(`Found ${allChannelIds.length} subscribed channels, now fetching RSS feeds...`)
    
    // Use RSS feeds to get recent videos (NO additional API quota cost!)
    const rssVideos = await getAllSubscriptionVideosViaRSS(allChannelIds, publishedAfter)
    
    let allVideos: Video[] = []
    const errors: string[] = []
    const uniqueChannels = new Set<string>()
    
    if (rssVideos.length > 0) {
      // Convert RSS videos to our format
      const formattedVideos = rssVideos.map((video: any) => {
        uniqueChannels.add(video.channelId)
        
        return {
          id: `rss-${video.videoId}`,
          user_id: userId,
          video_id: video.videoId,
          channel_id: video.channelId,
          channel_name: video.channelName,
          title: video.title,
          thumbnail_url: video.thumbnailUrl,
          published_at: video.publishedAt,
          duration: 'Unknown', // RSS doesn't provide duration
          created_at: new Date().toISOString()
        }
      })
      
      allVideos = formattedVideos
      console.log(`RSS sync complete: ${allVideos.length} videos from ${uniqueChannels.size} channels`)
    } else {
      console.log('No recent videos found in RSS feeds')
    }
    
    const channelsSynced = uniqueChannels.size
    
    // Add videos to storage (avoiding duplicates)
    storage.addVideos(allVideos)
    
    const result = {
      channelsSynced,
      videosSynced: allVideos.length,
      errors,
      quotaUsed: Math.ceil(allChannelIds.length / 50), // Only subscription API calls (1-2 total for 94 channels)
      executionTime: Date.now(),
      debug: {
        totalRSSVideos: rssVideos.length,
        totalChannelsChecked: allChannelIds.length,
        uniqueChannels: Array.from(uniqueChannels),
        publishedAfter,
        hasAccessToken: !!accessToken,
        method: 'rss_feeds_with_subscription_list'
      }
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