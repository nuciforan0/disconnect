import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useToastContext } from '../contexts/ToastContext'
import { useEffect, useRef } from 'react'

export default function NetworkStatus() {
  const { isOnline, isSlowConnection } = useNetworkStatus()
  const toast = useToastContext()
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (!isOnline && !wasOfflineRef.current) {
      // Just went offline
      wasOfflineRef.current = true
      toast.error(
        'No internet connection',
        'Some features may not work properly',
        {
          action: {
            label: 'Retry',
            onClick: () => window.location.reload()
          }
        }
      )
    } else if (isOnline && wasOfflineRef.current) {
      // Just came back online
      wasOfflineRef.current = false
      toast.success(
        'Connection restored',
        'You\'re back online'
      )
    }
  }, [isOnline, toast])

  useEffect(() => {
    if (isOnline && isSlowConnection) {
      toast.warning(
        'Slow connection detected',
        'Some features may load slowly'
      )
    }
  }, [isSlowConnection, toast])

  // Don't render anything - this component only manages notifications
  return null
}