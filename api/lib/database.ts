import { createClient } from '@supabase/supabase-js'

// Server-side database service for API routes
export class ServerDatabaseService {
  private supabase

  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase environment variables for server')
    }
    
    this.supabase = createClient(supabaseUrl, serviceKey)
  }

  // User operations
  async createUser(userData: {
    google_id: string
    email: string
    access_token: string
    refresh_token: string
  }) {
    const { data, error } = await this.supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async getUserByGoogleId(googleId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async updateUserLastSync(userId: string) {
    const { error } = await this.supabase
      .from('users')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', userId)
    
    if (error) throw error
  }

  // Video operations
  async createVideos(videos: Array<{
    user_id: string
    video_id: string
    channel_id: string
    channel_name: string
    title: string
    thumbnail_url: string
    published_at: string
    duration?: string
  }>) {
    const { data, error } = await this.supabase
      .from('videos')
      .insert(videos)
      .select()
    
    if (error) throw error
    return data
  }

  async getUserVideos(userId: string, limit = 50, offset = 0) {
    const { data, error } = await this.supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return data || []
  }

  async deleteVideo(userId: string, videoId: string) {
    const { error } = await this.supabase
      .from('videos')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId)
    
    if (error) throw error
  }

  async getVideoCount(userId: string) {
    const { count, error } = await this.supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    if (error) throw error
    return count || 0
  }

  // Batch operations with upsert to handle duplicates
  async batchInsertVideosFiltered(videos: Array<{
    user_id: string
    video_id: string
    channel_id: string
    channel_name: string
    title: string
    thumbnail_url: string
    published_at: string
    duration?: string
  }>, batchSize = 100) {
    if (videos.length === 0) {
      return []
    }
    
    const results = []
    
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize)
      const { data, error } = await this.supabase
        .from('videos')
        .upsert(batch, { 
          onConflict: 'user_id,video_id',
          ignoreDuplicates: true 
        })
        .select()
      
      if (error) {
        console.error('Batch upsert error:', error)
        continue
      }
      
      if (data) results.push(...data)
    }
    
    return results
  }

  // Get or create user by Google ID
  async getOrCreateUser(googleId: string, email: string, accessToken: string, refreshToken: string) {
    // First try to get existing user
    let user = await this.getUserByGoogleId(googleId)
    
    if (!user) {
      // Create new user
      user = await this.createUser({
        google_id: googleId,
        email,
        access_token: accessToken,
        refresh_token: refreshToken
      })
      console.log(`Created new user: ${user.id}`)
    } else {
      // Update tokens for existing user
      const { error } = await this.supabase
        .from('users')
        .update({ 
          access_token: accessToken, 
          refresh_token: refreshToken 
        })
        .eq('id', user.id)
      
      if (error) throw error
      console.log(`Updated tokens for existing user: ${user.id}`)
    }
    
    return user
  }
}

export const serverDatabaseService = new ServerDatabaseService()