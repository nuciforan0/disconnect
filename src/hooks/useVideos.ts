import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { useToastContext } from '../contexts/ToastContext'
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

  return useQuery<VideoFeedResponse, Error>(
    ['videos', limit, offset],
    async () => {
      try {
        const response = await apiService.getVideos(limit, offset)
        return response
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
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const apiError = handleAPIError(error)
        
        // Don't retry on client errors
        if (apiError.status >= 400 && apiError.status < 500) {
          return false
        }
        
        // Retry up to 2 times for server errors
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    }
  )
}

export function useDeleteVideo() {
  const queryClient = useQueryClient()
  const toast = useToastContext()

  return useMutation<void, Error, string>(
    async (videoId: string) => {
      try {
        await apiService.deleteVideo(videoId)
      } catch (error) {
        const apiError = handleAPIError(error)
        
        toast.error(
          'Failed to remove video',
          getErrorMessage(apiError)
        )
        
        throw apiError
      }
    },
    {
      onMutate: async (videoId) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries(['videos'])

        // Snapshot the previous value
        const previousVideos = queryClient.getQueriesData(['videos'])

        // Optimistically update to remove the video
        queryClient.setQueriesData(['videos'], (old: any) => {
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
      onError: (err, videoId, context) => {
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
        queryClient.invalidateQueries(['videos'])
      },
    }
  )
}

export function useInfiniteVideos(limit = 20) {
  const toast = useToastContext()

  return useQuery<Video[], Error>(
    ['videos', 'infinite'],
    async () => {
      try {
        const response = await apiService.getVideos(limit, 0)
        return response.videos
      } catch (error) {
        const apiError = handleAPIError(error)
        
        toast.error(
          'Failed to load videos',
          getErrorMessage(apiError)
        )
        
        throw apiError
      }
    },
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    }
  )
}

// Hook for managing video feed state with enhanced error handling
export function useVideoFeed() {
  const queryClient = useQueryClient()
  const toast = useToastContext()
  const { data, isLoading, error, refetch, isError } = useVideos()
  const deleteVideoMutation = useDeleteVideo()

  const handleVideoRemoved = (videoId: string) => {
    deleteVideoMutation.mutate(videoId)
  }

  const handleRefresh = async () => {
    try {
      await refetch()
      toast.success('Videos refreshed')
    } catch (error) {
      // Error is already handled by the query
    }
  }

  const handleSync = () => {
    // Trigger sync and then refetch videos
    queryClient.invalidateQueries(['videos'])
    toast.info('Syncing videos...', 'This may take a few moments')
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
    handleRefresh,
    handleSync,
    isDeleting: deleteVideoMutation.isLoading,
    isRefreshing: isLoading,
  }
}