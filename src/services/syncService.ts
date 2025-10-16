import { youtubeService } from './youtube'
import { rssYouTubeService } from './rssYouTubeService'
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
    
    const result: SyncResult = {
      channelsSynced: 0,
      videosSynced: 0,
      errors: [],
      quotaUsed: 0, // RSS feeds use NO quota!
      executionTime: 0
    }

    try {
      // Get user's subscribed channels from database
      const userChannels = await databaseService.getUserChannels(userId)
      
      if (userChannels.length === 0) {
        console.log('No subscribed channels found for user')
        return result
      }

      console.log(`Fetching RSS feeds for ${userChannels.length} subscribed channels...`)

      // Always fetch videos from exactly the last 24 hours
      const exactlyOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      // Use RSS feeds to get recent videos (NO API quota cost!)
      const channelIds = userChannels.map(ch => ch.channel_id)
      const rssVideos = await rssYouTubeService.getMultipleChannelsVideos(
        channelIds,
        exactlyOneDayAgo,
        15 // Process 15 channels concurrently
      )

      console.log(`Found ${rssVideos.length} videos from RSS feeds`)

      if (rssVideos.length === 0) {
        console.log('No new videos found in RSS feeds')
        return result
      }

      // Convert to database format
      const videosToStore = rssVideos.map(video => ({
        user_id: userId,
        video_id: video.videoId,
        channel_id: video.channelId,
        channel_name: video.channelName,
        title: video.title,
        thumbnail_url: video.thumbnailUrl,
        published_at: new Date(video.publishedAt),
        duration: undefined, // RSS doesn't provide duration
      }))

      // Batch insert videos
      if (videosToStore.length > 0) {
        const insertedVideos = await databaseService.batchInsertVideosFiltered(videosToStore, 100)
        result.videosSynced = insertedVideos.length
      }

      // Count unique channels that had videos
      const uniqueChannels = new Set(rssVideos.map(v => v.channelId))
      result.channelsSynced = uniqueChannels.size

      // Update user's last sync time
      await databaseService.updateUserLastSync(userId)

      console.log(`RSS sync complete: ${result.videosSynced} videos from ${result.channelsSynced} channels (0 quota used!)`)
      
    } catch (error) {
      const apiError = handleAPIError(error)
      result.errors.push(`Failed to sync videos via RSS: ${apiError.message}`)
      console.error('RSS video sync error:', error)
    } finally {
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



  getQuotaStatus() {
    return quotaManager.getQuotaUsage()
  }
}

export const syncService = new SyncService()