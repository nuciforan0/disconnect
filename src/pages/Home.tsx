import Header from '../components/Header'
import VideoFeed from '../components/VideoFeed'
import SyncButton from '../components/SyncButton'
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
    handleRefresh,
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
            
            {/* Mobile controls */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleRefresh}
                  className="flex-1 sm:flex-none px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 rounded-lg hover:bg-gray-100"
                  disabled={isLoading}
                  aria-label="Refresh videos"
                >
                  <svg className="w-5 h-5 mx-auto sm:mx-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="sr-only sm:not-sr-only sm:ml-2">Refresh</span>
                </button>
                <SyncButton userId={user?.id} className="flex-1 sm:flex-none" />
              </div>
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
          onRefresh={handleRefresh}
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