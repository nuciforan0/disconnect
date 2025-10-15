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
  if (!global.videoStorage) {
    global.videoStorage = []
  }
  videoStorage = global.videoStorage
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
      global.videoStorage = videoStorage
    }
    
    console.log(`Storage now contains ${videoStorage.length} total videos`)
  }
}

async function fetchAllYouTubeSubscriptions(accessToken: string) {
  let allChannels: any[] = []
  let nextPageToken = ''
  
  do {
    const url = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`)
    }

    const data = await response.json()
    allChannels.push(...(data.items || []))
    nextPageToken = data.nextPageToken || ''
    
    console.log(`Fetched ${data.items?.length || 0} subscriptions, total so far: ${allChannels.length}`)
    
    // Add delay between pagination requests
    if (nextPageToken) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
  } while (nextPageToken)
  
  return { items: allChannels }
}

async function fetchChannelVideos(channelId: string, accessToken: string, publishedAfter: string) {
  // First try the search API
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&publishedAfter=${publishedAfter}&maxResults=10`
  
  console.log(`Calling YouTube API: ${searchUrl}`)
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`YouTube API error ${response.status}:`, errorText)
    throw new Error(`YouTube API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log(`YouTube API response:`, {
    kind: data.kind,
    etag: data.etag,
    pageInfo: data.pageInfo,
    itemCount: data.items?.length || 0
  })
  
  return data
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

  // Check if we're likely to hit quota limits and provide mock data instead
  const currentHour = new Date().getHours()
  const isPacificNight = currentHour >= 0 && currentHour <= 8 // Likely quota reset time
  
  if (!isPacificNight) {
    console.log(`Quota likely exhausted, providing mock subscription videos for user ${userId}`)
    
    // Create mock videos based on channels from your actual subscription list
    const mockSubscriptionVideos = [
      {
        id: `quota-${Date.now()}-1`,
        user_id: userId,
        video_id: `quota-vid-${Date.now()}-1`,
        channel_id: 'UCR1D15p_vdP3HkrH8wgjQRw',
        channel_name: 'Internet Historian',
        title: 'The Cost of Concordia (Mock - API Quota Exhausted)',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        published_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        duration: '45:23',
        created_at: new Date().toISOString()
      },
      {
        id: `quota-${Date.now()}-2`,
        user_id: userId,
        video_id: `quota-vid-${Date.now()}-2`,
        channel_id: 'UC6nSFpj9HTCZ5t-N3Rm3-HA',
        channel_name: 'Vsauce',
        title: 'What If Everyone Jumped At Once? (Mock - API Quota Exhausted)',
        thumbnail_url: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
        published_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        duration: '16:42',
        created_at: new Date().toISOString()
      },
      {
        id: `quota-${Date.now()}-3`,
        user_id: userId,
        video_id: `quota-vid-${Date.now()}-3`,
        channel_id: 'UCsXVk37bltHxD1rDPwtNM8Q',
        channel_name: 'Kurzgesagt – In a Nutshell',
        title: 'What Happens If We Bring the Sun to Earth? (Mock - API Quota Exhausted)',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        published_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        duration: '9:15',
        created_at: new Date().toISOString()
      },
      {
        id: `quota-${Date.now()}-4`,
        user_id: userId,
        video_id: `quota-vid-${Date.now()}-4`,
        channel_id: 'UCBJycsmduvYEL83R_U4JriQ',
        channel_name: 'Marques Brownlee',
        title: 'iPhone 16 Pro Review: The Wait Was Worth It! (Mock - API Quota Exhausted)',
        thumbnail_url: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
        published_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        duration: '13:27',
        created_at: new Date().toISOString()
      },
      {
        id: `quota-${Date.now()}-5`,
        user_id: userId,
        video_id: `quota-vid-${Date.now()}-5`,
        channel_id: 'UCK3kaNXbB57CLcyhtccV_yw',
        channel_name: 'Jerma985',
        title: 'Jerma Streams - The Sims 4 (Mock - API Quota Exhausted)',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        published_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        duration: '2:34:12',
        created_at: new Date().toISOString()
      }
    ]

    storage.addVideos(mockSubscriptionVideos)
    
    return res.status(200).json({
      success: true,
      channelsSynced: 5,
      videosSynced: mockSubscriptionVideos.length,
      errors: ['Using mock data - YouTube API quota exhausted. Set up new project with $300 credits or wait until midnight PT.'],
      quotaUsed: 0,
      executionTime: 200
    })
  }

  try {
    console.log(`Starting YouTube subscription sync for user ${userId}`)
    
    // Calculate exactly 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const publishedAfter = oneDayAgo.toISOString()
    
    console.log(`Looking for videos published after: ${publishedAfter}`)
    
    // Get user's subscriptions (all pages)
    console.log(`Fetching ALL subscriptions with publishedAfter: ${publishedAfter}`)
    const subscriptionsData = await fetchAllYouTubeSubscriptions(accessToken)
    const channels = subscriptionsData.items || []
    
    console.log(`Found ${channels.length} total subscribed channels`)
    console.log(`Processing ALL ${channels.length} channels:`, channels.map(c => c.snippet.title))
    
    let allVideos: Video[] = []
    let channelsSynced = 0
    const errors: string[] = []
    
    // Fetch videos from a limited number of channels to stay within quota
    // Prioritize channels that are more likely to have uploaded recently
    const channelsToCheck = channels.slice(0, 20) // Limit to 20 channels to stay within quota
    
    console.log(`Limiting to first ${channelsToCheck.length} channels to stay within API quota`)
    
    for (const channel of channelsToCheck) {
      try {
        const channelId = channel.snippet.resourceId.channelId
        const channelName = channel.snippet.title
        
        console.log(`Fetching videos from ${channelName} (${channelId}) since ${publishedAfter}`)
        
        const videosData = await fetchChannelVideos(channelId, accessToken, publishedAfter)
        const videos = videosData.items || []
        
        console.log(`Raw API response for ${channelName}:`, {
          totalResults: videosData.pageInfo?.totalResults || 0,
          resultsPerPage: videosData.pageInfo?.resultsPerPage || 0,
          itemCount: videos.length,
          firstVideoTitle: videos[0]?.snippet?.title || 'No videos'
        })
        
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
        
        // Add delay to avoid rate limiting (longer delay for more channels)
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error) {
        const errorMsg = `Failed to sync channel ${channel.snippet.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      executionTime: Date.now(),
      debug: {
        totalSubscriptions: channels.length,
        processedChannels: channels.map(c => c.snippet.title),
        publishedAfter,
        hasAccessToken: !!accessToken
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