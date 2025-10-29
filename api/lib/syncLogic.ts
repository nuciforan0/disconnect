import { createClient } from '@supabase/supabase-js'

// Shared sync logic that can be used by both sync-videos.ts and sync.ts

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

interface SyncResult {
  channelsSynced: number;
  videosSynced: number;
  errors: string[];
  quotaUsed: number;
  executionTime: number;
}

// Inline Supabase setup
const getSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl || !serviceKey) {
    console.log('Missing Supabase environment variables, using memory storage')
    return null
  }
  
  return createClient(supabaseUrl, serviceKey)
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

async function getVideoDurations(videoIds: string[], accessToken: string): Promise<{[key: string]: string}> {
  if (videoIds.length === 0) return {}
  
  try {
    const durations: {[key: string]: string} = {}
    
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50)
      const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        data.items?.forEach((item: any) => {
          const duration = parseDuration(item.contentDetails.duration)
          const isShort = isVideoShort(item.contentDetails.duration)
          if (!isShort) {
            durations[item.id] = duration
          }
        })
      }
      
      if (i + 50 < videoIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return durations
  } catch (error) {
    console.error('Error fetching video durations:', error)
    return {}
  }
}

function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 'Unknown'
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}

function isVideoShort(duration: string): boolean {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return false
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  return totalSeconds <= 150
}

export async function performVideoSync(userId: string, accessToken: string): Promise<SyncResult> {
  const startTime = Date.now()
  
  try {
    console.log(`Starting YouTube subscription sync for user ${userId}`)
    
    // Calculate exactly 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const publishedAfter = oneDayAgo.toISOString()
    
    console.log(`Looking for videos published after: ${publishedAfter}`)
    
    // Get user's subscribed channels first
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
    
    // Use RSS feeds to get recent videos
    const rssVideos = await getAllSubscriptionVideosViaRSS(allChannelIds, publishedAfter)
    
    let allVideos: Video[] = []
    const errors: string[] = []
    const uniqueChannels = new Set<string>()
    
    if (rssVideos.length > 0) {
      // Get video durations from YouTube API
      const videoIds = rssVideos.map(v => v.videoId)
      console.log(`Fetching durations for ${videoIds.length} videos...`)
      const durations = await getVideoDurations(videoIds, accessToken)
      
      // Convert RSS videos to our format, filtering out shorts
      const formattedVideos = rssVideos.map((video: any) => {
        uniqueChannels.add(video.channelId)
        
        const videoDuration = durations[video.videoId] || 'Unknown'
        
        return {
          id: `rss-${video.videoId}`,
          user_id: userId,
          video_id: video.videoId,
          channel_id: video.channelId,
          channel_name: video.channelName,
          title: video.title,
          thumbnail_url: video.thumbnailUrl,
          published_at: video.publishedAt,
          duration: videoDuration,
          created_at: new Date().toISOString()
        }
      })
      
      // Filter out shorts
      const nonShortsVideos = formattedVideos.filter(video => video.duration !== 'Unknown')
      console.log(`Filtered: ${formattedVideos.length} total videos → ${nonShortsVideos.length} non-shorts videos`)
      
      allVideos = nonShortsVideos
      
      // Save videos to database
      const supabase = getSupabaseClient()
      if (supabase) {
        try {
          // Get or create user in database
          let { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('google_id', userId)
            .single()
          
          if (!user) {
            console.log(`User ${userId} not found in database, creating new user`)
            const { data: newUser } = await supabase
              .from('users')
              .insert({
                google_id: userId,
                email: 'user@example.com',
                access_token: accessToken,
                refresh_token: 'created_via_sync_no_refresh_token'
              })
              .select()
              .single()
            user = newUser
          } else {
            // Update existing user's access token and last sync
            const { data: updatedUser } = await supabase
              .from('users')
              .update({ 
                access_token: accessToken,
                last_sync: new Date().toISOString()
              })
              .eq('id', user.id)
              .select()
              .single()
            user = updatedUser
          }
          
          if (user) {
            // Prepare videos for database
            const videosToSave = allVideos.map(video => ({
              user_id: user.id,
              video_id: video.video_id,
              channel_id: video.channel_id,
              channel_name: video.channel_name,
              title: video.title,
              thumbnail_url: video.thumbnail_url,
              published_at: video.published_at,
              duration: video.duration
            }))
            
            // Save videos to database
            const { data: savedVideos } = await supabase
              .from('videos')
              .upsert(videosToSave, { 
                onConflict: 'user_id,video_id',
                ignoreDuplicates: true 
              })
              .select()
            
            console.log(`✅ Saved ${savedVideos?.length || 0} videos to Supabase database!`)
          }
        } catch (error) {
          console.error('Database save error:', error)
          errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
    const result: SyncResult = {
      channelsSynced: uniqueChannels.size,
      videosSynced: allVideos.length,
      errors,
      quotaUsed: Math.ceil(allChannelIds.length / 50),
      executionTime: Date.now() - startTime
    }
    
    console.log(`YouTube sync completed for user ${userId}:`, result)
    return result
    
  } catch (error) {
    console.error('YouTube sync error:', error)
    throw error
  }
}