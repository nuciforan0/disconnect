import { handleAPIError, APIError, NetworkError } from '../lib/errorHandler'

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

  async getVideos(limit = 50, offset = 0) {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        userId: 'user1' // TODO: Get from auth context
      })
      
      return await this.request(`/videos?${params}`, undefined, {
        maxRetries: 2 // Fewer retries for data fetching
      })
    } catch (error) {
      console.error('Failed to fetch videos:', error)
      throw error
    }
  }

  async deleteVideo(videoId: string) {
    try {
      return await this.request(`/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer user1' // TODO: Get actual auth token
        }
      }, {
        maxRetries: 1 // Fewer retries for mutations
      })
    } catch (error) {
      console.error(`Failed to delete video ${videoId}:`, error)
      throw error
    }
  }

  async initiateGoogleAuth() {
    try {
      return await this.request('/auth/google', {
        method: 'POST',
      }, {
        maxRetries: 1 // Don't retry auth requests
      })
    } catch (error) {
      console.error('Failed to initiate Google auth:', error)
      throw error
    }
  }

  async syncVideos(userId?: string) {
    try {
      return await this.request('/sync', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }, {
        maxRetries: 2,
        baseDelay: 2000, // Longer delay for sync operations
        maxDelay: 15000
      })
    } catch (error) {
      console.error('Failed to sync videos:', error)
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

  // Circuit breaker pattern for critical operations
  private circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    threshold: 5,
    timeout: 60000, // 1 minute
    state: 'closed' as 'closed' | 'open' | 'half-open'
  }

  private async requestWithCircuitBreaker<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const now = Date.now()

    // Check if circuit breaker is open
    if (this.circuitBreaker.state === 'open') {
      if (now - this.circuitBreaker.lastFailureTime < this.circuitBreaker.timeout) {
        throw new Error('Service temporarily unavailable (circuit breaker open)')
      } else {
        this.circuitBreaker.state = 'half-open'
      }
    }

    try {
      const result = await this.request<T>(endpoint, options)
      
      // Reset circuit breaker on success
      if (this.circuitBreaker.state === 'half-open') {
        this.circuitBreaker.state = 'closed'
        this.circuitBreaker.failures = 0
      }
      
      return result
    } catch (error) {
      this.circuitBreaker.failures++
      this.circuitBreaker.lastFailureTime = now

      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.state = 'open'
      }

      throw error
    }
  }

  // Use circuit breaker for critical sync operations
  async syncVideosWithCircuitBreaker(userId?: string) {
    return this.requestWithCircuitBreaker('/sync', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }
}

export const apiService = new ApiService()