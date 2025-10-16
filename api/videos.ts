import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Inline Supabase setup to avoid import issues
const getSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl || !serviceKey) {
    console.log('Missing Supabase environment variables, using memory storage')
    return null
  }
  
  return createClient(supabaseUrl, serviceKey)
}

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

// Shared global storage that persists across function calls within the same instance
const getVideoStorage = () => {
  if (!(global as any).sharedVideoStorage) {
    (global as any).sharedVideoStorage = []
  }
  return (global as any).sharedVideoStorage as Video[]
}

const storage = {
  getVideos: (userId: string): Video[] => {
    const videos = getVideoStorage()
    return videos.filter(video => video.user_id === userId)
  },

  addVideos: (videos: Video[]): void => {
    const storage = getVideoStorage()
    videos.forEach(video => {
      const exists = storage.some(v => 
        v.user_id === video.user_id && v.video_id === video.video_id
      )
      if (!exists) {
        storage.push(video)
        console.log(`Storage: Added video ${video.title} for user ${video.user_id}`)
      }
    })
    console.log(`Storage: Total videos: ${storage.length}`)
  },

  deleteVideo: (userId: string, videoId: string): boolean => {
    const storage = getVideoStorage()
    const initialLength = storage.length
    const newStorage = storage.filter(video => 
      !(video.user_id === userId && video.video_id === videoId)
    )
    
    // Update global storage
    ;(global as any).sharedVideoStorage = newStorage
    
    const deleted = newStorage.length < initialLength
    if (deleted) {
      console.log(`Storage: Deleted video ${videoId} for user ${userId}`)
    }
    return deleted
  },

  getAllVideos: (): Video[] => {
    return getVideoStorage()
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { method, query } = req

  if (method === 'GET') {
    try {
      // Get query parameters with better error handling
      const limitStr = query.limit as string
      const offsetStr = query.offset as string
      const userId = query.userId as string

      const limit = limitStr ? parseInt(limitStr) : 50
      const offset = offsetStr ? parseInt(offsetStr) : 0

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
        return res.status(400).json({ error: 'Invalid limit or offset parameters' })
      }

      // TODO: Replace with actual database query
      // const videos = await databaseService.getUserVideos(userId, limit, offset)
      
      // Try database first, fallback to memory
      let userVideos: any[] = []
      let totalCount = 0
      
      const supabase = getSupabaseClient()
      if (supabase) {
        try {
          // Get user from database
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('google_id', userId)
            .single()
          
          if (user) {
            // Get videos from database
            const { data: dbVideos } = await supabase
              .from('videos')
              .select('*')
              .eq('user_id', user.id)
              .order('published_at', { ascending: false })
              .range(offset, offset + limit - 1)
            
            const { count } = await supabase
              .from('videos')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
            
            userVideos = dbVideos || []
            totalCount = count || 0
            
            console.log(`✅ Found ${userVideos.length} videos from Supabase database for user ${userId}`)
          } else {
            throw new Error('User not found in database')
          }
        } catch (error) {
          console.error('Database error, falling back to memory:', error)
          
          // Fallback to memory
          const memoryVideos = storage.getVideos(userId)
            .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
          
          userVideos = memoryVideos.slice(offset, offset + limit)
          totalCount = memoryVideos.length
          
          console.log(`📦 Found ${userVideos.length} videos from memory for user ${userId}`)
        }
      } else {
        // No Supabase config, use memory
        const memoryVideos = storage.getVideos(userId)
          .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        
        userVideos = memoryVideos.slice(offset, offset + limit)
        totalCount = memoryVideos.length
        
        console.log(`📦 Using memory storage: ${userVideos.length} videos for user ${userId}`)
      }
      
      const hasMore = offset + limit < totalCount

      // Format response
      const formattedVideos = userVideos.map(video => ({
        id: video.id,
        videoId: video.video_id,
        channelId: video.channel_id,
        channelName: video.channel_name,
        title: video.title,
        thumbnailUrl: video.thumbnail_url,
        publishedAt: formatTimeAgo(new Date(video.published_at)),
        duration: video.duration,
      }))

      res.status(200).json({
        videos: formattedVideos,
        hasMore,
        total: totalCount
      })
    } catch (error) {
      console.error('Error fetching videos:', error)
      res.status(500).json({ error: 'Failed to fetch videos' })
    }
  } else if (method === 'DELETE') {
    try {
      const videoId = query.videoId as string
      const userId = query.userId as string // In real app, get from auth token

      if (!videoId || !userId) {
        return res.status(400).json({ error: 'Video ID and user authentication required' })
      }

      // TODO: Replace with actual database deletion
      // await databaseService.deleteVideo(userId, videoId)
      
      // Try database first, fallback to memory
      const supabase = getSupabaseClient()
      if (supabase) {
        try {
          // Get user from database
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('google_id', userId)
            .single()
          
          if (user) {
            await supabase
              .from('videos')
              .delete()
              .eq('user_id', user.id)
              .eq('video_id', videoId)
            
            console.log(`✅ Deleted video ${videoId} from Supabase database`)
          } else {
            throw new Error('User not found')
          }
        } catch (error) {
          console.error('Database delete error, using memory:', error)
          storage.deleteVideo(userId, videoId)
          console.log(`📦 Deleted video ${videoId} from memory`)
        }
      } else {
        // No database, use memory
        storage.deleteVideo(userId, videoId)
        console.log(`📦 Deleted video ${videoId} from memory`)
      }
      
      console.log(`Deleted video ${videoId} for user ${userId}`)

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting video:', error)
      res.status(500).json({ error: 'Failed to delete video' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else {
    const weeks = Math.floor(diffInSeconds / 604800)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
}