import { useEffect } from 'react'
import { authService } from '../services/auth'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, isAuthenticated, loading, setUser, setLoading, logout: storeLogout } = useAuthStore()

  useEffect(() => {
    // Check if user is already authenticated on mount
    const checkAuth = async () => {
      setLoading(true)
      
      try {
        const isAuth = authService.isAuthenticated()
        
        if (isAuth) {
          // User has valid tokens, but we might need to get user info from storage or API
          const storedUser = localStorage.getItem('user_info')
          if (storedUser) {
            setUser(JSON.parse(storedUser))
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
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
    authService.logout()
    localStorage.removeItem('user_info')
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