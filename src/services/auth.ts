import { apiService } from './api'
import { authStorage, userStorage } from '../utils/persistentStorage'

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
      const stored = authStorage.getItem('tokens')
      if (stored) {
        const tokens = JSON.parse(stored)
        this.accessToken = tokens.accessToken
        this.refreshToken = tokens.refreshToken
        this.tokenExpiry = tokens.expiry
        console.log('✅ Loaded tokens from persistent storage')
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error)
    }
  }

  private saveTokensToStorage(tokens: AuthTokens) {
    try {
      const expiry = Date.now() + (tokens.expiresIn * 1000)
      const tokenData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiry
      }
      
      authStorage.setItem('tokens', JSON.stringify(tokenData))
      
      this.accessToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken
      this.tokenExpiry = expiry
      
      console.log('✅ Saved tokens to persistent storage')
    } catch (error) {
      console.error('Failed to save tokens to storage:', error)
    }
  }

  private clearTokensFromStorage() {
    authStorage.removeItem('tokens')
    authStorage.removeItem('session_token')
    userStorage.removeItem('info')
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    console.log('🗑️ Cleared tokens and session token from persistent storage')
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

  // Try to restore authentication from server using session token or cookies
  async restoreAuthenticationFromServer(): Promise<boolean> {
    try {
      // First, try session token approach (better for PWAs)
      const sessionToken = authStorage.getItem('session_token')
      
      if (sessionToken) {
        console.log('🎫 Attempting restore with session token')
        
        const response = await fetch('/api/auth/restore-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionToken: sessionToken
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.tokens) {
            // Save the restored tokens
            this.saveTokensToStorage({
              accessToken: data.tokens.accessToken,
              refreshToken: data.tokens.refreshToken,
              expiresIn: data.tokens.expiresIn
            })
            
            // Also restore user info if provided
            if (data.user) {
              userStorage.setItem('info', JSON.stringify(data.user))
            }
            
            console.log('✅ Authentication restored via session token')
            return true
          }
        } else {
          console.log('❌ Session token restore failed:', response.status)
        }
      }

      // Fallback to cookie-based restore
      const storedUser = userStorage.getItem('info')
      let userId = null
      
      if (storedUser) {
        try {
          const userInfo = JSON.parse(storedUser)
          userId = userInfo.id
          console.log(`Found stored user info for: ${userInfo.email}`)
        } catch (e) {
          console.log('Failed to parse stored user info')
        }
      }

      console.log('🍪 Attempting restore with cookies as fallback')
      const response = await fetch('/api/auth/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: userId
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Cookie restore also failed:', {
          status: response.status,
          error: errorData
        })
        return false
      }

      if (response.ok) {
        const data = await response.json()
        
        if (data.tokens) {
          // Save the restored tokens
          this.saveTokensToStorage({
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
            expiresIn: data.tokens.expiresIn
          })
          
          // Also restore user info if provided
          if (data.user) {
            userStorage.setItem('info', JSON.stringify(data.user))
          }
          
          console.log('✅ Authentication restored successfully')
          return true
        }
      } else {
        console.log('❌ Server could not restore authentication:', response.status)
      }
    } catch (error) {
      console.error('Error restoring authentication:', error)
    }

    return false
  }

  async logout() {
    // Clear local storage
    this.clearTokensFromStorage()
    
    // Clear server-side cookies
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      console.log('✅ Server-side logout completed')
    } catch (error) {
      console.error('Failed to logout on server:', error)
    }
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
          
          // Save user info to persistent storage
          if (authData.user) {
            userStorage.setItem('info', JSON.stringify(authData.user))
            console.log('User info saved:', authData.user.email)
            
            // Save session token for PWA persistence
            if (authData.sessionToken) {
              authStorage.setItem('session_token', authData.sessionToken)
              console.log('✅ Session token saved for PWA persistence')
            }
            
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