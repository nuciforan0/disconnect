// Temporary storage solution using a simple external service
// This is a workaround for Vercel's isolated serverless functions

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

class VideoStorage {
  private baseUrl = 'https://jsonbin.io/v3/b'
  private binId = process.env.JSONBIN_ID || 'temp-storage'
  private apiKey = process.env.JSONBIN_API_KEY

  async getVideos(userId: string): Promise<Video[]> {
    try {
      // For now, use a simple in-memory approach with a global object
      // This is a temporary solution until we set up proper database
      
      // Try to get from a simple cache first
      const cached = (global as any).videoCache
      if (cached && cached[userId]) {
        console.log(`Storage: Found ${cached[userId].length} cached videos for user ${userId}`)
        return cached[userId]
      }
      
      console.log(`Storage: No cached videos found for user ${userId}`)
      return []
    } catch (error) {
      console.error('Storage: Error getting videos:', error)
      return []
    }
  }

  async addVideos(videos: Video[]): Promise<void> {
    try {
      if (videos.length === 0) return
      
      // Initialize global cache if it doesn't exist
      if (!(global as any).videoCache) {
        (global as any).videoCache = {}
      }
      
      const cache = (global as any).videoCache
      
      videos.forEach(video => {
        if (!cache[video.user_id]) {
          cache[video.user_id] = []
        }
        
        // Check if video already exists
        const exists = cache[video.user_id].some((v: Video) => v.video_id === video.video_id)
        if (!exists) {
          cache[video.user_id].push(video)
          console.log(`Storage: Added video ${video.title} for user ${video.user_id}`)
        }
      })
      
      const totalVideos = Object.values(cache).flat().length
      console.log(`Storage: Total videos in cache: ${totalVideos}`)
      
    } catch (error) {
      console.error('Storage: Error adding videos:', error)
    }
  }

  async deleteVideo(userId: string, videoId: string): Promise<boolean> {
    try {
      const cache = (global as any).videoCache
      if (!cache || !cache[userId]) {
        return false
      }
      
      const initialLength = cache[userId].length
      cache[userId] = cache[userId].filter((video: Video) => video.video_id !== videoId)
      
      const deleted = cache[userId].length < initialLength
      if (deleted) {
        console.log(`Storage: Deleted video ${videoId} for user ${userId}`)
      }
      
      return deleted
    } catch (error) {
      console.error('Storage: Error deleting video:', error)
      return false
    }
  }

  async getAllVideos(): Promise<Video[]> {
    try {
      const cache = (global as any).videoCache
      if (!cache) return []
      
      return Object.values(cache).flat() as Video[]
    } catch (error) {
      console.error('Storage: Error getting all videos:', error)
      return []
    }
  }
}

// Create a singleton instance
export const videoStorage = new VideoStorage()