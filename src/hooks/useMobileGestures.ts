import { useEffect, useRef } from 'react'

interface SwipeGestureOptions {
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  enabled?: boolean
}

export function useMobileGestures({
  onSwipeUp,
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true
}: SwipeGestureOptions) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y

      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // Determine if it's a swipe gesture
      if (Math.max(absDeltaX, absDeltaY) < threshold) {
        touchStartRef.current = null
        return
      }

      // Determine swipe direction
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0) {
          onSwipeRight?.()
        } else {
          onSwipeLeft?.()
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipeDown?.()
        } else {
          onSwipeUp?.()
        }
      }

      touchStartRef.current = null
    }

    const handleTouchCancel = () => {
      touchStartRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight, threshold, enabled])
}

interface PinchGestureOptions {
  onPinchStart?: () => void
  onPinchEnd?: () => void
  onPinch?: (scale: number) => void
  enabled?: boolean
}

export function usePinchGesture({
  onPinchStart,
  onPinchEnd,
  onPinch,
  enabled = true
}: PinchGestureOptions) {
  const initialDistanceRef = useRef<number | null>(null)
  const isPinchingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const getDistance = (touch1: Touch, touch2: Touch) => {
      const dx = touch1.clientX - touch2.clientX
      const dy = touch1.clientY - touch2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistanceRef.current = getDistance(e.touches[0], e.touches[1])
        isPinchingRef.current = true
        onPinchStart?.()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current && initialDistanceRef.current) {
        e.preventDefault()
        
        const currentDistance = getDistance(e.touches[0], e.touches[1])
        const scale = currentDistance / initialDistanceRef.current
        
        onPinch?.(scale)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && isPinchingRef.current) {
        isPinchingRef.current = false
        initialDistanceRef.current = null
        onPinchEnd?.()
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onPinchStart, onPinchEnd, onPinch, enabled])
}

interface DoubleTapOptions {
  onDoubleTap?: () => void
  delay?: number
  enabled?: boolean
}

export function useDoubleTap({
  onDoubleTap,
  delay = 300,
  enabled = true
}: DoubleTapOptions) {
  const lastTapRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      const timeSinceLastTap = now - lastTapRef.current

      if (timeSinceLastTap < delay && timeSinceLastTap > 0) {
        e.preventDefault()
        onDoubleTap?.()
        lastTapRef.current = 0
      } else {
        lastTapRef.current = now
      }
    }

    document.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onDoubleTap, delay, enabled])
}