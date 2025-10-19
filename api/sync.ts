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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()

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
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken })
    })

    if (response.ok) {
      const data = await response.json()
      return data.accessToken
    }
  } catch (error) {
    console.error('Failed to refresh token:', error)
  }
  return null
}

async function syncUserVideos(userId: string, accessToken: string, refreshToken?: string): Promise<SyncResult> {
  const result: SyncResult = {
    channelsSynced: 0,
    videosSynced: 0,
    errors: []
  }

  try {
    console.log(`Cron: Starting RSS sync for user ${userId}`)
    
    let currentAccessToken = accessToken
    
    // Call the same sync logic as the manual sync button
    // This makes an internal API call to sync-videos endpoint
    let syncResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/sync-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        accessToken: currentAccessToken
      })
    })
    
    // If access token is expired and we have a refresh token, try to refresh
    if (!syncResponse.ok && syncResponse.status === 401 && refreshToken && refreshToken !== 'placeholder' && refreshToken !== 'created_via_sync_no_refresh_token') {
      console.log(`Access token expired for user ${userId}, attempting refresh...`)
      
      const newAccessToken = await refreshUserToken(refreshToken)
      if (newAccessToken) {
        console.log(`✅ Successfully refreshed token for user ${userId}`)
        currentAccessToken = newAccessToken
        
        // Retry sync with new token
        syncResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/sync-videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            accessToken: currentAccessToken
          })
        })
      } else {
        result.errors.push(`Failed to refresh expired token for user ${userId}`)
      }
    }
    
    if (syncResponse.ok) {
      const syncData = await syncResponse.json()
      result.channelsSynced = syncData.channelsSynced || 0
      result.videosSynced = syncData.videosSynced || 0
      result.errors = syncData.errors || []
      
      console.log(`Cron: Successfully synced ${result.videosSynced} videos from ${result.channelsSynced} channels for user ${userId}`)
    } else {
      throw new Error(`Sync API returned ${syncResponse.status}`)
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