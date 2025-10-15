import { useEffect } from 'react'

interface KeyboardNavigationOptions {
  onEscape?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onSpace?: () => void
  enabled?: boolean
}

export function useKeyboardNavigation({
  onEscape,
  onArrowLeft,
  onArrowRight,
  onSpace,
  enabled = true
}: KeyboardNavigationOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard events if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          onEscape?.()
          break
        case 'ArrowLeft':
          event.preventDefault()
          onArrowLeft?.()
          break
        case 'ArrowRight':
          event.preventDefault()
          onArrowRight?.()
          break
        case ' ':
          event.preventDefault()
          onSpace?.()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onEscape, onArrowLeft, onArrowRight, onSpace, enabled])
}