import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import VideoPlayer from '../components/VideoPlayer'
import { useDeleteVideo } from '../hooks/useVideos'

export default function Watch() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const [hasMarkedAsWatched, setHasMarkedAsWatched] = useState(false)
  const deleteVideoMutation = useDeleteVideo()

  const handleBack = () => {
    navigate('/')
  }

  // Mark video as watched when user navigates to watch page
  useEffect(() => {
    if (videoId && !hasMarkedAsWatched) {
      setHasMarkedAsWatched(true)
      deleteVideoMutation.mutate(videoId, {
        onError: (error) => {
          console.error('Failed to mark video as watched:', error)
          // Don't show error to user as they're already watching
        }
      })
    }
  }, [videoId, hasMarkedAsWatched, deleteVideoMutation])

  if (!videoId) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white text-lg mb-4">Invalid video ID</p>
          <button
            onClick={handleBack}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Feed
          </button>
        </div>
      </div>
    )
  }

  return <VideoPlayer videoId={videoId} onBack={handleBack} />
}