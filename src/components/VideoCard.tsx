import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface VideoCardProps {
  video: {
    id: string;
    videoId: string;
    title: string;
    channelName: string;
    thumbnailUrl: string;
    publishedAt: string;
    duration: string;
  };
  onWatch: (videoId: string) => void;
  onSkip: (videoId: string) => void;
}

export default function VideoCard({ video, onWatch, onSkip }: VideoCardProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const navigate = useNavigate()

  const handleWatch = () => {
    setIsRemoving(true)
    onWatch(video.videoId)
    // Navigate to video page
    navigate(`/video/${video.videoId}`)
  }

  const handleSkip = () => {
    setIsRemoving(true)
    onSkip(video.videoId)
  }

  const handleThumbnailClick = () => {
    navigate(`/video/${video.videoId}`)
  }

  if (isRemoving) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden opacity-50 transition-opacity duration-300">
        <div className="aspect-video bg-gray-200 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <div className="p-4">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 touch-manipulation">
      <div className="relative aspect-video bg-gray-200 cursor-pointer group" onClick={handleThumbnailClick}>
        <img 
          src={video.thumbnailUrl} 
          alt={video.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {video.duration}
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div className="p-3 sm:p-4">
        <h3 
          className="font-semibold text-gray-900 line-clamp-2 mb-2 cursor-pointer hover:text-blue-600 transition-colors text-sm sm:text-base leading-tight"
          onClick={handleThumbnailClick}
          title={video.title}
        >
          {video.title}
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{video.channelName}</p>
        <p className="text-xs text-gray-500 mb-3">{video.publishedAt}</p>
        
        <div className="flex gap-2">
          <button
            onClick={handleWatch}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors duration-200 font-medium min-h-[36px] touch-manipulation"
          >
            Watch
          </button>
          <button
            onClick={handleSkip}
            className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded text-xs sm:text-sm hover:bg-gray-400 transition-colors duration-200 font-medium min-h-[36px] touch-manipulation"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}