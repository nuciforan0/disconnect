import { authService } from '../services/auth'

export class TokenManager {
  private static instance: TokenManager
  private refreshPromise: Promise<string | null> | null = null

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager()
    }
    return TokenManager.instance
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getValidToken()
    
    if (!token) {
      throw new Error('No valid authentication token available')
    }

    return {
      'Authorization': `Bearer ${token}`,
    }
  }

  private async getValidToken(): Promise<string | null> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      return await this.refreshPromise
    }

    const token = await authService.getValidAccessToken()
    
    if (!token) {
      // Start refresh process
      this.refreshPromise = authService.refreshAccessToken()
      const refreshedToken = await this.refreshPromise
      this.refreshPromise = null
      
      if (!refreshedToken) {
        // Redirect to login if refresh fails
        window.location.href = '/login'
        return null
      }
      
      return refreshedToken
    }

    return token
  }

  // Wrapper for fetch with automatic token handling
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...headers,
        },
      })

      // If we get a 401, try to refresh the token once
      if (response.status === 401) {
        const newToken = await authService.refreshAccessToken()
        
        if (newToken) {
          const newHeaders = { 'Authorization': `Bearer ${newToken}` }
          
          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              ...newHeaders,
            },
          })
        } else {
          // Refresh failed, redirect to login
          window.location.href = '/login'
          throw new Error('Authentication failed')
        }
      }

      return response
    } catch (error) {
      console.error('Authenticated fetch error:', error)
      throw error
    }
  }
}

export const tokenManager = TokenManager.getInstance()