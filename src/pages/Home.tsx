import Header from '../components/Header'
import VideoFeed from '../components/VideoFeed'
import SyncStatus from '../components/SyncStatus'
import QuotaStatus from '../components/QuotaStatus'
import { useAuth } from '../hooks/useAuth'
import { useVideoFeed, useSyncVideos } from '../hooks/useVideos'
import { authService } from '../services/auth'

export default function Home() {
  const { user } = useAuth()
  const {
    videos,
    total,
    isLoading,
    error,
    handleVideoRemoved,
  } = useVideoFeed()
  const syncVideosMutation = useSyncVideos()

  const handleSyncVideos = async () => {
    if (user?.id) {
      // Try to get a valid access token
      const accessToken = await authService.getValidAccessToken()
      
      syncVideosMutation.mutate({ 
        userId: user.id, 
        accessToken: accessToken || undefined 
      })
    }
  }

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
            
            <div className="flex-shrink-0">
              <button
                onClick={handleSyncVideos}
                disabled={syncVideosMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncVideosMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Videos
                  </>
                )}
              </button>
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