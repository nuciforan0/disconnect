import { useState, useEffect, useCallback } from 'react'

interface VideoPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
}

export function useVideoPlayer() {
  const [playerState, setPlayerState] = useState<VideoPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isFullscreen: false,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // YouTube IFrame API integration
  useEffect(() => {
    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
  }, [])

  const handlePlayerReady = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  const handlePlayerError = useCallback((errorCode: number) => {
    setIsLoading(false)
    
    let errorMessage = 'An error occurred while loading the video.'
    
    switch (errorCode) {
      case 2:
        errorMessage = 'Invalid video ID.'
        break
      case 5:
        errorMessage = 'HTML5 player error.'
        break
      case 100:
        errorMessage = 'Video not found or private.'
        break
      case 101:
      case 150:
        errorMessage = 'Video cannot be embedded.'
        break
    }
    
    setError(errorMessage)
  }, [])

  const handlePlayerStateChange = useCallback((state: number) => {
    // YouTube player states:
    // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
    setPlayerState(prev => ({
      ...prev,
      isPlaying: state === 1,
    }))
  }, [])

  const togglePlayPause = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }))
  }, [])

  const toggleMute = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      isMuted: !prev.isMuted,
    }))
  }, [])

  const setVolume = useCallback((volume: number) => {
    setPlayerState(prev => ({
      ...prev,
      volume: Math.max(0, Math.min(1, volume)),
    }))
  }, [])

  const seekTo = useCallback((time: number) => {
    setPlayerState(prev => ({
      ...prev,
      currentTime: Math.max(0, Math.min(prev.duration, time)),
    }))
  }, [])

  const toggleFullscreen = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      isFullscreen: !prev.isFullscreen,
    }))
  }, [])

  return {
    playerState,
    isLoading,
    error,
    handlePlayerReady,
    handlePlayerError,
    handlePlayerStateChange,
    togglePlayPause,
    toggleMute,
    setVolume,
    seekTo,
    toggleFullscreen,
  }
}

// Extend Window interface for YouTube API
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}