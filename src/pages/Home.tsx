import Header from '../components/Header'
import VideoFeed from '../components/VideoFeed'
import SyncStatus from '../components/SyncStatus'
import QuotaStatus from '../components/QuotaStatus'
import { useAuth } from '../hooks/useAuth'
import { useVideoFeed } from '../hooks/useVideos'

export default function Home() {
  const { user } = useAuth()
  const {
    videos,
    total,
    isLoading,
    error,
    handleVideoRemoved,
  } = useVideoFeed()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Mobile-first header section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 truncate">
                Welcome back, {user?.name || user?.email}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                {total > 0 
                  ? `${total} video${total !== 1 ? 's' : ''} from your subscribed channels`
                  : 'Recent videos from your subscribed channels'
                }
              </p>
            </div>
            

          </div>
        </div>

        {/* Status cards - responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="sm:col-span-1">
            <SyncStatus />
          </div>
          <div className="sm:col-span-1">
            <QuotaStatus />
          </div>
          {/* Third column for future status cards */}
          <div className="hidden lg:block">
            {/* Placeholder for additional status */}
          </div>
        </div>
        
        {/* Video feed */}
        <VideoFeed
          videos={videos}
          loading={isLoading}
          error={error}
          onVideoRemoved={handleVideoRemoved}
        />
        
        {/* Footer info */}
        {videos.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Showing {videos.length} of {total} videos
            </p>
          </div>
        )}
      </main>
    </div>
  )
}