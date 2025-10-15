import { useState, useCallback } from 'react'
import { Toast, ToastType } from '../components/Toast'

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    options?: {
      duration?: number
      action?: {
        label: string
        onClick: () => void
      }
    }
  ) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = {
      id,
      type,
      title,
      message,
      duration: options?.duration ?? (type === 'error' ? 0 : 5000), // Errors persist until dismissed
      action: options?.action
    }

    setToasts(prev => [...prev, toast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  // Convenience methods
  const success = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    return addToast('success', title, message, options)
  }, [addToast])

  const error = useCallback((title: string, message?: string, options?: { action?: { label: string; onClick: () => void } }) => {
    return addToast('error', title, message, { duration: 0, ...options })
  }, [addToast])

  const warning = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    return addToast('warning', title, message, options)
  }, [addToast])

  const info = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    return addToast('info', title, message, options)
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info
  }
}