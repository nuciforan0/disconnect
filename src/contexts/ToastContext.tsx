import { createContext, useContext, ReactNode } from 'react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

interface ToastContextType {
  success: (title: string, message?: string, options?: { duration?: number }) => string
  error: (title: string, message?: string, options?: { action?: { label: string; onClick: () => void } }) => string
  warning: (title: string, message?: string, options?: { duration?: number }) => string
  info: (title: string, message?: string, options?: { duration?: number }) => string
  removeToast: (id: string) => void
  clearAllToasts: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToastContext() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const {
    toasts,
    success,
    error,
    warning,
    info,
    removeToast,
    clearAllToasts
  } = useToast()

  return (
    <ToastContext.Provider value={{
      success,
      error,
      warning,
      info,
      removeToast,
      clearAllToasts
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}