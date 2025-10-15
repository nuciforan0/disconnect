import { useState, useEffect, useRef } from 'react'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'

interface VideoPlayerProps {
  videoId: string;
  onBack: () => void;
}

export default function VideoPlayer({ videoId, onBack }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [isLandscape, setIsLandscape] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // Detect mobile and orientation
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    const checkOrientation = () => {
      setIsLandscape(window.innerHeight < window.innerWidth)
    }

    checkMobile()
    checkOrientation()

    window.addEventListener('resize', checkMobile)
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // Hide controls after inactivity (longer on mobile)
  useEffect(() => {
    const timeoutDuration = isMobile ? 5000 : 3000 // 5s on mobile, 3s on desktop

    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      
      setShowControls(true)
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, timeoutDuration)
    }

    const handleInteraction = () => resetControlsTimeout()
    const handleMouseLeave = () => {
      if (!isMobile && controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
        setShowControls(false)
      }
    }

    // Use different events for mobile vs desktop
    if (isMobile) {
      document.addEventListener('touchstart', handleInteraction)
      document.addEventListener('touchmove', handleInteraction)
    } else {
      document.addEventListener('mousemove', handleInteraction)
      document.addEventListener('mouseleave', handleMouseLeave)
    }
    
    // Initial timeout
    resetControlsTimeout()

    return () => {
      if (isMobile) {
        document.removeEventListener('touchstart', handleInteraction)
        document.removeEventListener('touchmove', handleInteraction)
      } else {
        document.removeEventListener('mousemove', handleInteraction)
        document.removeEventListener('mouseleave', handleMouseLeave)
      }
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isMobile])

  // Keyboard navigation (desktop only)
  useKeyboardNavigation({
    onEscape: onBack,
    enabled: !isMobile
  })

  // Prevent scroll on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.height = '100%'
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.height = ''
    }
  }, [isMobile])

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError('Failed to load video. The video might be unavailable or restricted.')
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?` + new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    fs: '1',
    cc_load_policy: '1',
    iv_load_policy: '3',
    playsinline: '1',
    // Mobile-specific optimizations
    ...(isMobile && {
      controls: '1',
      disablekb: '0', // Enable keyboard controls
      enablejsapi: '1', // Enable JS API for better control
    })
  }).toString()

  return (
    <div className="fixed inset-0 bg-black flex flex-col touch-manipulation">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-center px-4">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-white mb-4 mx-auto"></div>
            <p className="text-white text-sm sm:text-lg">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20 p-4">
          <div className="text-center max-w-sm mx-auto">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white text-lg sm:text-xl font-semibold mb-2">Video Unavailable</h3>
            <p className="text-gray-300 text-sm sm:text-base mb-6">{error}</p>
            <button
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors touch-manipulation min-h-[44px]"
            >
              Back to Feed
            </button>
          </div>
        </div>
      )}

      {/* Desktop controls overlay */}
      {!isMobile && (
        <div 
          className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 bg-black/50 text-white px-4 py-2 rounded-lg hover:bg-black/70 transition-colors backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Feed</span>
            </button>

            <div className="text-white text-sm bg-black/50 px-3 py-1 rounded backdrop-blur-sm">
              Press ESC to go back
            </div>
          </div>
        </div>
      )}

      {/* Video player */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="w-full h-full"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={`YouTube video ${videoId}`}
        />
      </div>

      {/* Mobile controls */}
      {isMobile && (
        <>
          {/* Top controls for mobile */}
          <div 
            className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            } ${isLandscape ? 'p-2' : 'p-4'}`}
          >
            <div className="flex items-center justify-between">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 bg-black/50 text-white px-3 py-2 rounded-lg hover:bg-black/70 transition-colors backdrop-blur-sm touch-manipulation min-h-[44px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Back</span>
              </button>

              {/* Orientation hint */}
              {!isLandscape && (
                <div className="text-white text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                  Rotate for better view
                </div>
              )}
            </div>
          </div>

          {/* Bottom controls for mobile (portrait only) */}
          {!isLandscape && (
            <div 
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-white text-xs mb-2">Tap screen to show/hide controls</p>
                </div>
                <button
                  onClick={onBack}
                  className="w-full bg-black/50 text-white py-3 rounded-lg hover:bg-black/70 transition-colors backdrop-blur-sm touch-manipulation min-h-[44px] font-medium"
                >
                  Back to Feed
                </button>
              </div>
            </div>
          )}

          {/* Swipe gesture hint */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
            <div className={`text-white text-xs bg-black/30 px-2 py-1 rounded transition-opacity duration-1000 ${
              showControls ? 'opacity-0' : 'opacity-60'
            }`}>
              Swipe up for controls
            </div>
          </div>
        </>
      )}
    </div>
  )
}