import { useState } from 'react'
import VideoCard from './VideoCard'
import { apiService } from '../services/api'

interface Video {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string;
}

interface VideoFeedProps {
  videos: Video[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onVideoRemoved: (videoId: string) => void;
}

export default function VideoFeed({
  videos,
  loading,
  error,
  onRefresh,
  onVideoRemoved
}: VideoFeedProps) {
  const [removingVideos, setRemovingVideos] = useState<Set<string>>(new Set())

  const handleWatch = async (videoId: string) => {
    try {
      setRemovingVideos(prev => new Set(prev).add(videoId))
      await apiService.deleteVideo(videoId)
      onVideoRemoved(videoId)
    } catch (error) {
      console.error('Failed to mark video as watched:', error)
      setRemovingVideos(prev => {
        const newSet = new Set(prev)
        newSet.delete(videoId)
        return newSet
      })
    }
  }

  const handleSkip = async (videoId: string) => {
    try {
      setRemovingVideos(prev => new Set(prev).add(videoId))
      await apiService.deleteVideo(videoId)
      onVideoRemoved(videoId)
    } catch (error) {
      console.error('Failed to skip video:', error)
      setRemovingVideos(prev => {
        const newSet = new Set(prev)
        newSet.delete(videoId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <VideoCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onRefresh}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No videos found</h3>
          <p className="text-gray-600 mb-6">
            Your video feed is empty. Try syncing your subscriptions to get new videos.
          </p>
          <button
            onClick={onRefresh}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            Sync Videos
          </button>
        </div>
      </div>
    )
  }

  // Filter out videos that are being removed
  const visibleVideos = videos.filter(video => !removingVideos.has(video.videoId))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
      {visibleVideos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onWatch={handleWatch}
          onSkip={handleSkip}
        />
      ))}
    </div>
  )
}

function VideoCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className="aspect-video bg-gray-200"></div>
      <div className="p-4">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/5 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/5 mb-3"></div>
        <div className="flex gap-2">
          <div className="flex-1 h-8 bg-gray-200 rounded"></div>
          <div className="flex-1 h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}