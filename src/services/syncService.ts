import { youtubeService } from './youtube'
import { databaseService } from './database'
import { batchProcessor } from './batchProcessor'
import { quotaManager } from './quotaManager'
import { handleAPIError } from '../lib/errorHandler'

export interface SyncResult {
  channelsSynced: number
  videosSynced: number
  errors: string[]
  quotaUsed: number
  executionTime: number
}

export class SyncService {
  async syncUserSubscriptions(userId: string): Promise<SyncResult> {
    const startTime = Date.now()
    const initialQuota = quotaManager.getQuotaUsage().used
    
    const result: SyncResult = {
      channelsSynced: 0,
      videosSynced: 0,
      errors: [],
      quotaUsed: 0,
      executionTime: 0
    }

    try {
      // Check quota before starting
      if (!quotaManager.canPerformOperation('subscriptions', 1)) {
        throw new Error('Insufficient quota to sync subscriptions')
      }

      // Get user's YouTube subscriptions with quota management
      const youtubeChannels = await youtubeService.getAllSubscriptions()
      
      if (youtubeChannels.length === 0) {
        return result
      }

      // Convert to database format
      const channelsToStore = youtubeChannels.map(channel => ({
        user_id: userId,
        channel_id: channel.id,
        channel_name: channel.snippet.title,
        thumbnail_url: channel.snippet.thumbnails?.default?.url,
      }))

      // Store channels in database using batch processing
      const batchResult = await batchProcessor.processBatch({
        id: `subscriptions-${userId}`,
        items: channelsToStore,
        processor: async (batch) => {
          return await databaseService.createChannels(batch)
        },
        batchSize: 50,
        delay: 100,
      })

      result.channelsSynced = batchResult.totalProcessed
      result.errors.push(...batchResult.errors.map(e => e.message))

      console.log(`Synced ${result.channelsSynced} channels for user ${userId}`)
      
    } catch (error) {
      const apiError = handleAPIError(error)
      result.errors.push(`Failed to sync subscriptions: ${apiError.message}`)
      console.error('Subscription sync error:', error)
    } finally {
      result.quotaUsed = quotaManager.getQuotaUsage().used - initialQuota
      result.executionTime = Date.now() - startTime
    }

    return result
  }

  async syncUserVideos(userId: string): Promise<SyncResult> {
    const startTime = Date.now()
    const initialQuota = quotaManager.getQuotaUsage().used
    
    const result: SyncResult = {
      channelsSynced: 0,
      videosSynced: 0,
      errors: [],
      quotaUsed: 0,
      executionTime: 0
    }

    try {
      // Check quota before starting
      if (!quotaManager.canPerformOperation('activities', 3)) {
        throw new Error('Insufficient quota to sync videos')
      }

      // Always fetch videos from exactly the last 24 hours
      const exactlyOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      // Use the efficient activities API to get all subscription videos at once
      console.log('Fetching subscription feed using efficient activities API...')
      const videos = await youtubeService.getAllSubscriptionVideos(
        exactlyOneDayAgo,
        200 // Get up to 200 videos from the last 24h
      )

      console.log(`Found ${videos.length} videos from subscription feed`)

      if (videos.length === 0) {
        console.log('No new videos found in subscription feed')
        return result
      }

      // Get user's channels to map channel names
      const userChannels = await databaseService.getUserChannels(userId)
      const channelMap = new Map(
        userChannels.map(ch => [ch.channel_id, ch.channel_name])
      )

      // Convert to database format
      const videosToStore = videos.map(video => ({
        user_id: userId,
        video_id: video.id,
        channel_id: video.snippet.channelId,
        channel_name: channelMap.get(video.snippet.channelId) || video.snippet.channelTitle,
        title: video.snippet.title,
        thumbnail_url: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        published_at: new Date(video.snippet.publishedAt),
        duration: this.parseDuration(video.contentDetails?.duration),
      }))

      // Batch insert videos
      if (videosToStore.length > 0) {
        const insertedVideos = await databaseService.batchInsertVideosFiltered(videosToStore, 100)
        result.videosSynced = insertedVideos.length
      }

      // Count unique channels
      const uniqueChannels = new Set(videos.map(v => v.snippet.channelId))
      result.channelsSynced = uniqueChannels.size

      // Update user's last sync time
      await databaseService.updateUserLastSync(userId)

      console.log(`Efficiently synced ${result.videosSynced} videos from ${result.channelsSynced} channels using activities API`)
      
    } catch (error) {
      const apiError = handleAPIError(error)
      result.errors.push(`Failed to sync videos: ${apiError.message}`)
      console.error('Video sync error:', error)
    } finally {
      result.quotaUsed = quotaManager.getQuotaUsage().used - initialQuota
      result.executionTime = Date.now() - startTime
    }

    return result
  }

  async performFullSync(userId: string): Promise<SyncResult> {
    console.log(`Starting optimized full sync for user ${userId}`)
    
    const startTime = Date.now()
    const initialQuota = quotaManager.getQuotaUsage().used
    
    // Check if we have enough quota for a full sync
    const quotaUsage = quotaManager.getQuotaUsage()
    if (quotaUsage.remaining < 100) { // Conservative estimate
      throw new Error(`Insufficient quota for full sync. Remaining: ${quotaUsage.remaining}`)
    }
    
    // First sync subscriptions
    const subscriptionResult = await this.syncUserSubscriptions(userId)
    
    // Then sync videos (only if subscription sync was successful)
    let videoResult: SyncResult = {
      channelsSynced: 0,
      videosSynced: 0,
      errors: [],
      quotaUsed: 0,
      executionTime: 0
    }
    
    if (subscriptionResult.errors.length === 0) {
      videoResult = await this.syncUserVideos(userId)
    } else {
      videoResult.errors.push('Skipped video sync due to subscription sync errors')
    }
    
    // Combine results
    return {
      channelsSynced: subscriptionResult.channelsSynced,
      videosSynced: videoResult.videosSynced,
      errors: [...subscriptionResult.errors, ...videoResult.errors],
      quotaUsed: quotaManager.getQuotaUsage().used - initialQuota,
      executionTime: Date.now() - startTime
    }
  }

  async syncAllUsers(): Promise<{ [userId: string]: SyncResult }> {
    console.log('Starting optimized sync for all users')
    
    const results: { [userId: string]: SyncResult } = {}
    
    try {
      // In real implementation, get all users from database
      // const users = await databaseService.getAllUsers()
      
      // Mock users for demonstration
      const mockUsers = ['user1', 'user2', 'user3']
      
      // Process users with quota awareness
      const userProcessor = async (userId: string) => {
        try {
          return await this.performFullSync(userId)
        } catch (error) {
          console.error(`Failed to sync user ${userId}:`, error)
          return {
            channelsSynced: 0,
            videosSynced: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            quotaUsed: 0,
            executionTime: 0
          }
        }
      }

      const batchResult = await batchProcessor.processChannelsWithQuota(
        mockUsers,
        userProcessor,
        'activities'
      )

      // Map results back to user IDs
      mockUsers.forEach((userId, index) => {
        results[userId] = batchResult.results[index] || {
          channelsSynced: 0,
          videosSynced: 0,
          errors: ['Sync failed'],
          quotaUsed: 0,
          executionTime: 0
        }
      })

      console.log(`Completed sync for ${Object.keys(results).length} users`)
      
    } catch (error) {
      console.error('Batch user sync failed:', error)
    }
    
    return results
  }

  private parseDuration(duration?: string): string | undefined {
    if (!duration) return undefined
    
    // Parse ISO 8601 duration format (PT4M13S -> 4:13)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return duration
    
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  getQuotaStatus() {
    return quotaManager.getQuotaUsage()
  }
}

export const syncService = new SyncService()