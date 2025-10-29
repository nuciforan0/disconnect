import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface SyncResult {
  channelsSynced: number
  videosSynced: number
  errors: string[]
}

interface CronSyncResult {
  totalUsers: number
  successfulSyncs: number
  failedSyncs: number
  totalVideosSynced: number
  errors: string[]
  executionTime: number
}

// Inline Supabase setup (same as sync-videos.ts)
const getSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl || !serviceKey) {
    console.log('Missing Supabase environment variables for cron job')
    return null
  }
  
  return createClient(supabaseUrl, serviceKey)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron jobs send GET requests, but we also support POST for manual calls
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  
  console.log(`🚀 CRON JOB TRIGGERED at ${timestamp}`)
  console.log('Environment check:', {
    hasSupabaseUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasYouTubeClientId: !!process.env.VITE_YOUTUBE_CLIENT_ID,
    hasYouTubeSecret: !!process.env.YOUTUBE_CLIENT_SECRET,
    vercelUrl: process.env.VERCEL_URL
  })

  try {
    // Automated daily sync for all users
    console.log('Daily sync: Starting automated sync for all users')
    
    const result = await syncAllUsers()
    result.executionTime = Date.now() - startTime
    
    console.log('Daily sync completed:', result)
    res.status(200).json(result)
  } catch (error) {
    console.error('Sync error:', error)
    
    const errorResponse = {
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime
    }
    
    res.status(500).json(errorResponse)
  }
}

async function refreshUserToken(refreshToken: string): Promise<string | null> {
  try {
    console.log('🔄 Refreshing token directly in cron job...')
    
    // Call Google's token refresh API directly instead of making HTTP request to ourselves
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('❌ Google token refresh failed in cron:', {
        status: tokenResponse.status,
        error: errorData
      })
      return null
    }

    const tokens = await tokenResponse.json()
    
    // Update the access token in database
    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({ access_token: tokens.access_token })
          .eq('refresh_token', refreshToken)
        
        console.log('✅ Updated access token in database')
      } catch (dbError) {
        console.error('Failed to update token in database:', dbError)
      }
    }
    
    return tokens.access_token
  } catch (error) {
    console.error('Failed to refresh token:', error)
    return null
  }
}

// Simple direct sync logic for cron job (avoids HTTP calls)
async function performDirectSync(userId: string, accessToken: string): Promise<SyncResult> {
  const result: SyncResult = {
    channelsSynced: 0,
    videosSynced: 0,
    errors: []
  }

  try {
    console.log(`Starting direct YouTube sync for user ${userId}`)
    
    // Calculate exactly 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const publishedAfter = oneDayAgo.toISOString()
    
    // Get user's subscribed channels
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
      
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } while (nextPageToken)
    
    console.log(`Found ${allChannelIds.length} subscribed channels`)
    
    // Use RSS feeds to get recent videos (simplified version)
    const allVideos: any[] = []
    const publishedAfterDate = new Date(publishedAfter)
    const uniqueChannels = new Set<string>()
    
    // Process channels in small batches
    const batchSize = 5
    for (let i = 0; i < allChannelIds.length; i += batchSize) {
      const batch = allChannelIds.slice(i, i + batchSize)
      
      for (const channelId of batch) {
        try {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
          const response = await fetch(rssUrl)
          
          if (response.ok) {
            const xmlText = await response.text()
            const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || []
            
            entryMatches.forEach(entryXml => {
              const videoIdMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
              const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/)
              const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/)
              const authorMatch = entryXml.match(/<name>([^<]+)<\/name>/)
              
              if (videoIdMatch && titleMatch && publishedMatch) {
                const publishedAt = new Date(publishedMatch[1])
                if (publishedAt > publishedAfterDate) {
                  uniqueChannels.add(channelId)
                  allVideos.push({
                    videoId: videoIdMatch[1],
                    title: titleMatch[1],
                    channelId,
                    channelName: authorMatch ? authorMatch[1] : 'Unknown Channel',
                    publishedAt: publishedMatch[1],
                    thumbnailUrl: `https://img.youtube.com/vi/${videoIdMatch[1]}/mqdefault.jpg`
                  })
                }
              }
            })
          }
        } catch (error) {
          console.warn(`Failed to fetch RSS for channel ${channelId}:`, error)
        }
      }
      
      // Small delay between batches
      if (i + batchSize < allChannelIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    console.log(`Found ${allVideos.length} recent videos from RSS feeds`)
    
    // Save to database
    const supabase = getSupabaseClient()
    if (supabase && allVideos.length > 0) {
      try {
        // Get user from database
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('google_id', userId)
          .single()
        
        if (user) {
          // Prepare videos for database
          const videosToSave = allVideos.map(video => ({
            user_id: user.id,
            video_id: video.videoId,
            channel_id: video.channelId,
            channel_name: video.channelName,
            title: video.title,
            thumbnail_url: video.thumbnailUrl,
            published_at: video.publishedAt,
            duration: 'Unknown' // We'll skip duration check for cron to keep it simple
          }))
          
          // Save videos to database
          const { data: savedVideos } = await supabase
            .from('videos')
            .upsert(videosToSave, { 
              onConflict: 'user_id,video_id',
              ignoreDuplicates: true 
            })
            .select()
          
          console.log(`✅ Saved ${savedVideos?.length || 0} videos to database`)
          
          // Update user's last sync time
          await supabase
            .from('users')
            .update({ 
              access_token: accessToken,
              last_sync: new Date().toISOString() 
            })
            .eq('id', user.id)
        }
      } catch (error) {
        console.error('Database save error:', error)
        result.errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    result.channelsSynced = uniqueChannels.size
    result.videosSynced = allVideos.length
    
    console.log(`Direct sync completed: ${result.videosSynced} videos from ${result.channelsSynced} channels`)
    
  } catch (error) {
    console.error('Direct sync error:', error)
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

async function syncUserVideos(userId: string, accessToken: string, refreshToken?: string): Promise<SyncResult> {
  const result: SyncResult = {
    channelsSynced: 0,
    videosSynced: 0,
    errors: []
  }

  try {
    console.log(`Cron: Starting direct sync for user ${userId}`)
    
    let currentAccessToken = accessToken
    
    // Try direct sync first
    try {
      const syncResult = await performDirectSync(userId, currentAccessToken)
      result.channelsSynced = syncResult.channelsSynced
      result.videosSynced = syncResult.videosSynced
      result.errors = syncResult.errors
      
      console.log(`Cron: Successfully synced ${result.videosSynced} videos from ${result.channelsSynced} channels for user ${userId}`)
      
    } catch (syncError) {
      // If sync failed and we have a refresh token, try to refresh and retry
      if (refreshToken && refreshToken !== 'placeholder' && refreshToken !== 'created_via_sync_no_refresh_token') {
        console.log(`Sync failed for user ${userId}, attempting token refresh...`)
        
        const newAccessToken = await refreshUserToken(refreshToken)
        if (newAccessToken) {
          console.log(`✅ Successfully refreshed token for user ${userId}, retrying sync...`)
          currentAccessToken = newAccessToken
          
          // Retry sync with new token
          const retryResult = await performDirectSync(userId, currentAccessToken)
          result.channelsSynced = retryResult.channelsSynced
          result.videosSynced = retryResult.videosSynced
          result.errors = retryResult.errors
          
          console.log(`Cron: Successfully synced ${result.videosSynced} videos after token refresh for user ${userId}`)
        } else {
          result.errors.push(`Failed to refresh expired token for user ${userId}`)
          throw syncError
        }
      } else {
        throw syncError
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    result.errors.push(`Failed to sync user ${userId}: ${errorMessage}`)
    console.error(`Cron sync error for user ${userId}:`, error)
  }

  return result
}

async function syncAllUsers(): Promise<CronSyncResult> {
  const result: CronSyncResult = {
    totalUsers: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalVideosSynced: 0,
    errors: [],
    executionTime: 0
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    result.errors.push('No Supabase client available for cron job')
    return result
  }

  try {
    // Get all users from database with their tokens
    const { data: users, error } = await supabase
      .from('users')
      .select('google_id, access_token, refresh_token')
    
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }
    
    if (!users || users.length === 0) {
      console.log('Cron: No users found in database')
      return result
    }
    
    result.totalUsers = users.length
    console.log(`Cron: Starting sync for ${result.totalUsers} users`)

    // Sync each user
    for (const user of users) {
      try {
        const userResult = await syncUserVideos(user.google_id, user.access_token, user.refresh_token)
        
        if (userResult.errors.length === 0) {
          result.successfulSyncs++
          result.totalVideosSynced += userResult.videosSynced
        } else {
          result.failedSyncs++
          result.errors.push(...userResult.errors)
        }
        
        // Add delay between users to avoid rate limiting
        await delay(2000) // 2 second delay between users
        
      } catch (error) {
        result.failedSyncs++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Failed to sync user ${user.google_id}: ${errorMessage}`)
      }
    }

    console.log(`Cron sync completed: ${result.successfulSyncs}/${result.totalUsers} users synced successfully`)
    console.log(`Total videos synced: ${result.totalVideosSynced}`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Cron job failed: ${errorMessage}`)
    console.error('Cron job error:', error)
  }

  return result
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}