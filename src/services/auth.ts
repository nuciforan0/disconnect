import { apiService } from './api'

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

class AuthService {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: number | null = null

  constructor() {
    this.loadTokensFromStorage()
  }

  private loadTokensFromStorage() {
    try {
      const stored = localStorage.getItem('auth_tokens')
      if (stored) {
        const tokens = JSON.parse(stored)
        this.accessToken = tokens.accessToken
        this.refreshToken = tokens.refreshToken
        this.tokenExpiry = tokens.expiry
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error)
    }
  }

  private saveTokensToStorage(tokens: AuthTokens) {
    try {
      const expiry = Date.now() + (tokens.expiresIn * 1000)
      localStorage.setItem('auth_tokens', JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiry
      }))
      
      this.accessToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken
      this.tokenExpiry = expiry
    } catch (error) {
      console.error('Failed to save tokens to storage:', error)
    }
  }

  private clearTokensFromStorage() {
    localStorage.removeItem('auth_tokens')
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
  }

  async initiateGoogleAuth(): Promise<string> {
    const response = await apiService.initiateGoogleAuth()
    return (response as { authUrl: string }).authUrl
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return null
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const tokens = await response.json()
      
      this.saveTokensToStorage({
        accessToken: tokens.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: tokens.expiresIn,
      })

      return tokens.accessToken
    } catch (error) {
      console.error('Token refresh failed:', error)
      this.clearTokensFromStorage()
      return null
    }
  }

  async getValidAccessToken(): Promise<string | null> {
    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken
    }

    // Try to refresh the token
    return await this.refreshAccessToken()
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.tokenExpiry && Date.now() < this.tokenExpiry
  }

  logout() {
    this.clearTokensFromStorage()
  }

  // Handle OAuth callback (called from URL params)
  handleAuthCallback(urlParams: URLSearchParams): AuthUser | null {
    const authStatus = urlParams.get('auth')
    console.log('handleAuthCallback called with status:', authStatus)
    
    if (authStatus === 'success') {
      const dataParam = urlParams.get('data')
      console.log('Data param present:', !!dataParam)
      
      if (dataParam) {
        try {
          const authData = JSON.parse(decodeURIComponent(dataParam))
          console.log('Parsed auth data:', { hasTokens: !!authData.tokens, hasUser: !!authData.user })
          
          // Save tokens
          if (authData.tokens) {
            this.saveTokensToStorage(authData.tokens)
            console.log('Tokens saved to storage')
          }
          
          // Save user info to localStorage
          if (authData.user) {
            localStorage.setItem('user_info', JSON.stringify(authData.user))
            console.log('User info saved:', authData.user.email)
            return authData.user
          }
        } catch (error) {
          console.error('Failed to parse auth data:', error)
        }
      } else {
        console.error('No data parameter in success callback')
      }
    } else if (authStatus === 'error') {
      const message = urlParams.get('message')
      console.error('OAuth callback error:', message)
    }
    
    return null
  }
}

export const authService = new AuthService()