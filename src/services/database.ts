import { supabase } from '../lib/supabase'
import { User, Channel, Video } from '../types/database'

export class DatabaseService {
  // User operations
  async createUser(userData: Omit<User, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async getUserByGoogleId(googleId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async updateUserTokens(userId: string, accessToken: string, refreshToken: string) {
    const { error } = await supabase
      .from('users')
      .update({ 
        access_token: accessToken, 
        refresh_token: refreshToken 
      })
      .eq('id', userId)
    
    if (error) throw error
  }

  async updateUserLastSync(userId: string) {
    const { error } = await supabase
      .from('users')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', userId)
    
    if (error) throw error
  }

  // Channel operations
  async createChannels(channels: Omit<Channel, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('channels')
      .insert(channels)
      .select()
    
    if (error) throw error
    return data
  }

  async getUserChannels(userId: string) {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', userId)
    
    if (error) throw error
    return data || []
  }

  // Video operations
  async createVideos(videos: Omit<Video, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('videos')
      .insert(videos)
      .select()
    
    if (error) throw error
    return data
  }

  async getUserVideos(userId: string, limit = 50, offset = 0) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return data || []
  }

  async deleteVideo(userId: string, videoId: string) {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId)
    
    if (error) throw error
  }

  async getVideoCount(userId: string) {
    const { count, error } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    if (error) throw error
    return count || 0
  }



  // Batch operations for sync
  async batchInsertVideos(videos: Omit<Video, 'id' | 'created_at'>[], batchSize = 100) {
    const results = []
    
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('videos')
        .insert(batch)
        .select()
      
      if (error) {
        console.error('Batch insert error:', error)
        continue
      }
      
      if (data) results.push(...data)
    }
    
    return results
  }

  // Enhanced batch insert that avoids duplicates
  async batchInsertVideosFiltered(videos: Omit<Video, 'id' | 'created_at'>[], batchSize = 100) {
    if (videos.length === 0) {
      return []
    }
    
    // Use upsert to handle duplicates gracefully
    const results = []
    
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize)
      const { data, error } = await supabase
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
}

export const databaseService = new DatabaseService()