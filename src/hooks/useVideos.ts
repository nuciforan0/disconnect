import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { useToastContext } from '../contexts/ToastContext'
import { useAuthStore } from '../store/authStore'
import { handleAPIError, getErrorMessage } from '../lib/errorHandler'

interface Video {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string;
}

interface VideoFeedResponse {
  videos: Video[];
  hasMore: boolean;
  total: number;
}

export function useVideos(limit = 50, offset = 0) {
  const toast = useToastContext()
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['videos', limit, offset, user?.id],
    queryFn: async (): Promise<VideoFeedResponse> => {
      try {
        const response = await apiService.getVideos(limit, offset, user?.id)
        return response as VideoFeedResponse
      } catch (error) {
        const apiError = handleAPIError(error)

        // Show user-friendly error message
        toast.error(
          'Failed to load videos',
          getErrorMessage(apiError),
          {
            action: {
              label: 'Retry',
              onClick: () => window.location.reload()
            }
          }
        )

        throw apiError
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: Error) => {
      const apiError = handleAPIError(error)

      // Don't retry on client errors
      if (apiError.status >= 400 && apiError.status < 500) {
        return false
      }

      // Retry up to 2 times for server errors
      return failureCount < 2
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useDeleteVideo() {
  const queryClient = useQueryClient()
  const toast = useToastContext()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (videoId: string) => {
      try {
        await apiService.deleteVideo(videoId, user?.id)
      } catch (error) {
        const apiError = handleAPIError(error)

        toast.error(
          'Failed to remove video',
          getErrorMessage(apiError)
        )

        throw apiError
      }
    },
    onMutate: async (videoId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['videos'] })

      // Snapshot the previous value
      const previousVideos = queryClient.getQueriesData({ queryKey: ['videos'] })

      // Optimistically update to remove the video
      queryClient.setQueriesData({ queryKey: ['videos'] }, (old: any) => {
        if (!old) return old

        return {
          ...old,
          videos: old.videos.filter((video: Video) => video.videoId !== videoId),
          total: old.total - 1
        }
      })

      // Return a context object with the snapshotted value
      return { previousVideos }
    },
    onError: (_err, _videoId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSuccess: () => {
      toast.success('Video removed from feed')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useSyncVideos() {
  const queryClient = useQueryClient()
  const toast = useToastContext()

  return useMutation({
    mutationFn: async ({ userId, accessToken }: { userId: string; accessToken?: string }) => {
      try {
        const result = await apiService.syncVideos(userId, accessToken)
        return result
      } catch (error) {
        const apiError = handleAPIError(error)

        toast.error(
          'Failed to sync videos',
          getErrorMessage(apiError)
        )

        throw apiError
      }
    },
    onSuccess: (result: any) => {
      console.log('Sync result:', result)
      console.log('Debug details:', result.debug)
      console.log('Errors:', result.errors)
      
      const debugInfo = result.debug ? 
        `\nDebug: ${result.debug.totalSubscriptions} total subs, processed: ${result.debug.processedChannels?.slice(0, 3).join(', ')}${result.debug.processedChannels?.length > 3 ? '...' : ''}` : ''
      
      const errorInfo = result.errors?.length > 0 ? `\nErrors: ${result.errors.length} failed` : ''
      
      toast.success(
        'Videos synced successfully',
        `Found ${result.videosSynced} new videos from ${result.channelsSynced} channels (2.5+ min only!)${debugInfo}${errorInfo}`
      )
      
      // If sync returned videos, update the cache directly
      if (result.videos && result.videos.length > 0) {
        console.log(`Updating cache with ${result.videos.length} synced videos`)
        
        // Update all video queries with the new videos
        queryClient.setQueriesData({ queryKey: ['videos'] }, (oldData: any) => {
          if (!oldData) {
            return {
              videos: result.videos,
              hasMore: false,
              total: result.videos.length
            }
          }
          
          // Merge new videos with existing ones, avoiding duplicates
          const existingVideoIds = new Set(oldData.videos.map((v: any) => v.videoId))
          const newVideos = result.videos.filter((v: any) => !existingVideoIds.has(v.videoId))
          
          return {
            ...oldData,
            videos: [...newVideos, ...oldData.videos],
            total: oldData.total + newVideos.length
          }
        })
      } else {
        // Fallback: refresh the video list
        queryClient.invalidateQueries({ queryKey: ['videos'] })
      }
    },
    onError: (error) => {
      console.error('Sync failed:', error)
    }
  })
}



export function useInfiniteVideos(limit = 20) {
  const toast = useToastContext()
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['videos', 'infinite', user?.id],
    queryFn: async (): Promise<Video[]> => {
      try {
        const response = await apiService.getVideos(limit, 0, user?.id)
        return (response as VideoFeedResponse).videos
      } catch (error) {
        const apiError = handleAPIError(error)

        toast.error(
          'Failed to load videos',
          getErrorMessage(apiError)
        )

        throw apiError
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}

// Hook for managing video feed state with enhanced error handling
export function useVideoFeed() {
  const { data, isLoading, error, isError } = useVideos()
  const deleteVideoMutation = useDeleteVideo()

  const handleVideoRemoved = (videoId: string) => {
    deleteVideoMutation.mutate(videoId)
  }

  // Enhanced error handling
  const getErrorState = () => {
    if (!isError || !error) return null

    const apiError = handleAPIError(error)
    return {
      message: getErrorMessage(apiError),
      canRetry: apiError.status >= 500 || apiError.name === 'NetworkError',
      isNetworkError: apiError.name === 'NetworkError',
      isServerError: apiError.status >= 500,
      isClientError: apiError.status >= 400 && apiError.status < 500,
    }
  }

  return {
    videos: data?.videos || [],
    hasMore: data?.hasMore || false,
    total: data?.total || 0,
    isLoading,
    error: error?.message || null,
    errorState: getErrorState(),
    handleVideoRemoved,
    isDeleting: deleteVideoMutation.isPending,
  }
}