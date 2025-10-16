import { YouTubeVideo } from '../types/database'

// Import DOMParser for Node.js environment
let DOMParser: any
if (typeof window === 'undefined') {
  // Node.js environment
  const { DOMParser: NodeDOMParser } = require('xmldom')
  DOMParser = NodeDOMParser
} else {
  // Browser environment
  DOMParser = window.DOMParser
}

interface RSSVideo {
  videoId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: string
  thumbnailUrl: string
}

export class RSSYouTubeService {
  private readonly RSS_BASE_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id='
  
  async getChannelRecentVideos(channelId: string): Promise<RSSVideo[]> {
    try {
      const response = await fetch(`${this.RSS_BASE_URL}${channelId}`)
      
      if (!response.ok) {
        throw new Error(`RSS feed error for channel ${channelId}: ${response.status}`)
      }
      
      const xmlText = await response.text()
      return this.parseRSSFeed(xmlText, channelId)
    } catch (error) {
      console.error(`Failed to fetch RSS for channel ${channelId}:`, error)
      return []
    }
  }

  async getMultipleChannelsVideos(
    channelIds: string[],
    publishedAfter?: Date,
    concurrency = 10
  ): Promise<RSSVideo[]> {
    console.log(`Fetching RSS feeds for ${channelIds.length} channels with concurrency ${concurrency}`)
    
    const allVideos: RSSVideo[] = []
    const errors: string[] = []
    
    // Process channels in batches to avoid overwhelming the server
    for (let i = 0; i < channelIds.length; i += concurrency) {
      const batch = channelIds.slice(i, i + concurrency)
      
      const batchPromises = batch.map(async (channelId) => {
        try {
          const videos = await this.getChannelRecentVideos(channelId)
          
          // Filter by date if specified
          if (publishedAfter) {
            return videos.filter(video => 
              new Date(video.publishedAt) > publishedAfter
            )
          }
          
          return videos
        } catch (error) {
          errors.push(`Channel ${channelId}: ${error}`)
          return []
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(videos => allVideos.push(...videos))
      
      // Small delay between batches to be respectful
      if (i + concurrency < channelIds.length) {
        await this.delay(100)
      }
      
      console.log(`Processed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(channelIds.length / concurrency)}`)
    }
    
    if (errors.length > 0) {
      console.warn(`RSS fetch errors:`, errors)
    }
    
    // Sort by published date (newest first)
    allVideos.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    
    console.log(`RSS sync complete: ${allVideos.length} videos from ${channelIds.length} channels`)
    return allVideos
  }

  private parseRSSFeed(xmlText: string, channelId: string): RSSVideo[] {
    try {
      // Parse XML using DOMParser (works in both browser and Node.js)
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlText, 'text/xml')
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        throw new Error(`XML parsing error: ${parserError.textContent}`)
      }
      
      const entries = doc.getElementsByTagName('entry')
      const videos: RSSVideo[] = []
      
      for (let i = 0; i < entries.length; i++) {
        try {
          const entry = entries[i]
          const videoIdElement = entry.getElementsByTagName('id')[0]
          const titleElement = entry.getElementsByTagName('title')[0]
          const publishedElement = entry.getElementsByTagName('published')[0]
          const authorElements = entry.getElementsByTagName('name')
          const thumbnailElements = entry.getElementsByTagName('media:thumbnail')
          
          const videoId = this.extractVideoId(videoIdElement?.textContent || '')
          const title = titleElement?.textContent || 'Unknown Title'
          const publishedAt = publishedElement?.textContent || new Date().toISOString()
          const channelName = authorElements[0]?.textContent || 'Unknown Channel'
          
          // Extract thumbnail or construct from video ID
          let thumbnailUrl = thumbnailElements[0]?.getAttribute('url')
          if (!thumbnailUrl && videoId) {
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          }
          
          if (videoId) {
            videos.push({
              videoId,
              title,
              channelId,
              channelName,
              publishedAt,
              thumbnailUrl: thumbnailUrl || ''
            })
          }
        } catch (error) {
          console.warn(`Failed to parse RSS entry:`, error)
        }
      }
      
      return videos
    } catch (error) {
      console.error(`Failed to parse RSS feed for channel ${channelId}:`, error)
      return []
    }
  }

  private extractVideoId(idString: string): string {
    // RSS feed IDs look like: "yt:video:dQw4w9WgXcQ"
    const match = idString.match(/yt:video:(.+)/)
    return match ? match[1] : ''
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Convert RSS videos to your database format
  convertToYouTubeVideos(rssVideos: RSSVideo[]): Omit<YouTubeVideo, 'id'>[] {
    return rssVideos.map(video => ({
      snippet: {
        title: video.title,
        channelId: video.channelId,
        channelTitle: video.channelName,
        publishedAt: video.publishedAt,
        thumbnails: {
          default: { url: video.thumbnailUrl },
          medium: { url: video.thumbnailUrl.replace('mqdefault', 'hqdefault') },
          high: { url: video.thumbnailUrl.replace('mqdefault', 'maxresdefault') },
          maxres: { url: video.thumbnailUrl.replace('mqdefault', 'maxresdefault') },
        },
      },
      contentDetails: {
        duration: 'PT0S', // RSS doesn't provide duration, would need API call for this
      },
    }))
  }
}

export const rssYouTubeService = new RSSYouTubeService()