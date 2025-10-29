import { handleAPIError, APIError } from '../lib/errorHandler'

const API_BASE_URL = '/api'

interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
}

class ApiService {
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  }

  private async request<T>(
    endpoint: string, 
    options?: RequestInit,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const retry = { ...this.defaultRetryOptions, ...retryOptions }
    
    let lastError: Error

    for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          ...options,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const error = new APIError(
            errorData.message || `HTTP ${response.status}`,
            response.status,
            errorData.code
          )
          
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error
          }
          
          throw error
        }

        return response.json()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // Don't retry on client errors or network errors on last attempt
        if (
          attempt === retry.maxRetries ||
          (error instanceof APIError && error.status >= 400 && error.status < 500)
        ) {
          throw handleAPIError(lastError)
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          retry.baseDelay * Math.pow(2, attempt),
          retry.maxDelay
        )
        
        console.warn(`API request failed (attempt ${attempt + 1}/${retry.maxRetries + 1}), retrying in ${delay}ms:`, error)
        await this.delay(delay)
      }
    }

    throw handleAPIError(lastError!)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async getVideos(limit = 50, offset = 0, userId?: string) {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        userId: userId || 'user1' // Fallback for development
      })
      
      return await this.request(`/videos?${params}`, undefined, {
        maxRetries: 2 // Fewer retries for data fetching
      })
    } catch (error) {
      console.error('Failed to fetch videos:', error)
      throw error
    }
  }

  async deleteVideo(videoId: string, userId?: string) {
    try {
      const params = new URLSearchParams({
        videoId: videoId,
        userId: userId || 'user1' // Fallback for development
      })
      
      return await this.request(`/videos?${params}`, {
        method: 'DELETE'
      }, {
        maxRetries: 1 // Fewer retries for mutations
      })
    } catch (error) {
      console.error(`Failed to delete video ${videoId}:`, error)
      throw error
    }
  }

  async syncVideos(userId: string, accessToken?: string) {
    try {
      return await this.request('/sync-videos', {
        method: 'POST',
        body: JSON.stringify({ userId, accessToken })
      }, {
        maxRetries: 1 // Don't retry sync requests
      })
    } catch (error) {
      console.error('Failed to sync videos:', error)
      throw error
    }
  }

  async initiateGoogleAuth() {
    try {
      return await this.request('/auth', {
        method: 'POST',
      }, {
        maxRetries: 1 // Don't retry auth requests
      })
    } catch (error) {
      console.error('Failed to initiate Google auth:', error)
      throw error
    }
  }



  // Health check endpoint
  async healthCheck() {
    try {
      return await this.request('/health', undefined, {
        maxRetries: 1,
        baseDelay: 500
      })
    } catch (error) {
      console.error('Health check failed:', error)
      throw error
    }
  }

  // Debug token status
  async checkTokenStatus(userId: string): Promise<{
    user: {
      googleId: string;
      email: string;
      lastSync: string | null;
      createdAt: string;
    };
    tokens: {
      accessToken: {
        valid: boolean;
        error: string | null;
        length: number;
      };
      refreshToken: {
        valid: boolean;
        error: string | null;
        isPlaceholder: boolean;
        length: number;
      };
    };
  }> {
    try {
      return await this.request('/debug/token-status', {
        method: 'POST',
        body: JSON.stringify({ userId })
      }, {
        maxRetries: 1
      })
    } catch (error) {
      console.error('Token status check failed:', error)
      throw error
    }
  }




}

export const apiService = new ApiService()