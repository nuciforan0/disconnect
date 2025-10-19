import { useEffect } from 'react'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import { userStorage } from '../utils/persistentStorage'

export function useAuth() {
  const { user, isAuthenticated, loading, setUser, setLoading, logout: storeLogout } = useAuthStore()

  useEffect(() => {
    // Check if user is already authenticated on mount
    const checkAuth = async () => {
      setLoading(true)
      
      try {
        const isAuth = authService.isAuthenticated()
        
        if (isAuth) {
          // User has valid tokens, get user info from storage
          const storedUser = userStorage.getItem('info')
          if (storedUser) {
            setUser(JSON.parse(storedUser))
          } else {
            // If no user info but tokens exist, clear tokens (inconsistent state)
            authService.logout()
          }
        } else {
          // No valid tokens in localStorage, try to restore from server
          console.log('No valid local tokens, attempting to restore authentication...')
          const restored = await authService.restoreAuthenticationFromServer()
          
          if (restored) {
            console.log('✅ Authentication restored from server')
            const storedUser = userStorage.getItem('info')
            if (storedUser) {
              setUser(JSON.parse(storedUser))
            }
          } else {
            console.log('❌ Could not restore authentication')
            // No valid tokens, make sure user info is also cleared
            userStorage.removeItem('info')
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
        // On error, clear everything
        authService.logout()
        userStorage.removeItem('info')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setLoading])

  const login = async () => {
    try {
      const authUrl = await authService.initiateGoogleAuth()
      window.location.href = authUrl
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    await authService.logout()
    userStorage.removeItem('info')
    storeLogout()
  }

  const refreshToken = async () => {
    try {
      const newToken = await authService.refreshAccessToken()
      return !!newToken
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    refreshToken
  }
}