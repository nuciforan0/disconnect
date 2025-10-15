import { useState, useEffect } from 'react'

interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType: string
  effectiveType: string
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    connectionType: 'unknown',
    effectiveType: 'unknown'
  })

  useEffect(() => {
    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection

      setNetworkStatus({
        isOnline: navigator.onLine,
        isSlowConnection: connection ? 
          ['slow-2g', '2g'].includes(connection.effectiveType) : false,
        connectionType: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || 'unknown'
      })
    }

    const handleOnline = () => updateNetworkStatus()
    const handleOffline = () => updateNetworkStatus()
    const handleConnectionChange = () => updateNetworkStatus()

    // Initial check
    updateNetworkStatus()

    // Event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Connection API listeners (if supported)
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection

    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [])

  return networkStatus
}