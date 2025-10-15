import { tokenManager } from '../lib/tokenManager'
import { YouTubeVideo, YouTubeChannel } from '../types/database'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export class YouTubeService {
  private quotaUsed = 0
  private readonly DAILY_QUOTA_LIMIT = 10000
  private readonly QUOTA_COSTS = {
    subscriptions: 1,
    activities: 1,
    videos: 1,
    channels: 1,
  }

  async getSubscriptions(pageToken?: string): Promise<{
    channels: YouTubeChannel[];
    nextPageToken?: string;
  }> {
    this.checkQuota(this.QUOTA_COSTS.subscriptions)

    try {
      const url = new URL(`${YOUTUBE_API_BASE}/subscriptions`)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('mine', 'true')
      url.searchParams.set('maxResults', '50')
      
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken)
      }

      const response = await tokenManager.authenticatedFetch(url.toString())
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`)
      }

      const data = await response.json()
      this.quotaUsed += this.QUOTA_COSTS.subscriptions

      const channels = data.items?.map((item: any) => ({
        id: item.snippet.resourceId.channelId,
        snippet: {
          title: item.snippet.title,
          thumbnails: item.snippet.thumbnails,
        },
      })) || []

      return {
        channels,
        nextPageToken: data.nextPageToken,
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      throw error
    }
  }

  async getChannelRecentUploads(
    channelId: string,
    publishedAfter?: Date,
    maxResults = 50
  ): Promise<YouTubeVideo[]> {
    this.checkQuota(this.QUOTA_COSTS.activities)

    try {
      const url = new URL(`${YOUTUBE_API_BASE}/search`)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('channelId', channelId)
      url.searchParams.set('maxResults', maxResults.toString())
      url.searchParams.set('order', 'date')
      url.searchParams.set('type', 'video')
      
      if (publishedAfter) {
        // Ensure we get exactly the last 24 hours
        url.searchParams.set('publishedAfter', publishedAfter.toISOString())
        url.searchParams.set('publishedBefore', new Date().toISOString())
      }

      const response = await tokenManager.authenticatedFetch(url.toString())
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('YouTube API quota exceeded')
        }
        throw new Error(`YouTube API error: ${response.status}`)
      }

      const data = await response.json()
      this.quotaUsed += this.QUOTA_COSTS.activities

      const videos = data.items?.map((item: any) => ({
        id: item.id.videoId,
        snippet: {
          title: item.snippet.title,
          channelId: item.snippet.channelId,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          thumbnails: item.snippet.thumbnails,
        },
        contentDetails: {
          duration: 'PT0S', // Will get actual duration from videos API if needed
        },
      })) || []

      return videos
    } catch (error) {
      console.error('Error fetching channel recent uploads:', error)
      throw error
    }
  }

  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
    if (videoIds.length === 0) return []
    
    this.checkQuota(this.QUOTA_COSTS.videos)

    try {
      const url = new URL(`${YOUTUBE_API_BASE}/videos`)
      url.searchParams.set('part', 'snippet,contentDetails')
      url.searchParams.set('id', videoIds.join(','))

      const response = await tokenManager.authenticatedFetch(url.toString())
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`)
      }

      const data = await response.json()
      this.quotaUsed += this.QUOTA_COSTS.videos

      return data.items || []
    } catch (error) {
      console.error('Error fetching video details:', error)
      throw error
    }
  }

  async getAllSubscriptions(): Promise<YouTubeChannel[]> {
    const allChannels: YouTubeChannel[] = []
    let nextPageToken: string | undefined

    do {
      const result = await this.getSubscriptions(nextPageToken)
      allChannels.push(...result.channels)
      nextPageToken = result.nextPageToken
      
      // Add delay to avoid rate limiting
      if (nextPageToken) {
        await this.delay(100)
      }
    } while (nextPageToken)

    return allChannels
  }

  async syncChannelVideos(
    channelId: string,
    publishedAfter?: Date,
    maxResults = 50
  ): Promise<YouTubeVideo[]> {
    try {
      const videos = await this.getChannelRecentUploads(
        channelId,
        publishedAfter,
        maxResults
      )

      // Get detailed video information if needed
      if (videos.length > 0) {
        const videoIds = videos.map(v => v.id)
        const detailedVideos = await this.getVideoDetails(videoIds)
        
        // Merge the data
        return videos.map(video => {
          const detailed = detailedVideos.find(d => d.id === video.id)
          return detailed || video
        })
      }

      return videos
    } catch (error) {
      console.error(`Error syncing videos for channel ${channelId}:`, error)
      throw error
    }
  }

  private checkQuota(cost: number) {
    if (this.quotaUsed + cost > this.DAILY_QUOTA_LIMIT) {
      throw new Error('YouTube API daily quota limit reached')
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getQuotaUsage() {
    return {
      used: this.quotaUsed,
      limit: this.DAILY_QUOTA_LIMIT,
      remaining: this.DAILY_QUOTA_LIMIT - this.quotaUsed,
    }
  }

  resetQuotaCounter() {
    this.quotaUsed = 0
  }
}

export const youtubeService = new YouTubeService()