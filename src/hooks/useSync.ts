import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { useToastContext } from '../contexts/ToastContext'
import { handleAPIError, getErrorMessage } from '../lib/errorHandler'

interface SyncResult {
  channelsSynced: number
  videosSynced: number
  errors: string[]
}

export function useSync() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const queryClient = useQueryClient()
  const toast = useToastContext()

  const syncMutation = useMutation({
    mutationFn: async (userId: string | undefined): Promise<SyncResult> => {
      setSyncStatus('syncing')

      try {
        const response = await apiService.syncVideos(userId)
        return response as SyncResult
      } catch (error) {
        const apiError = handleAPIError(error)

        // Show detailed error message
        toast.error(
          'Sync failed',
          getErrorMessage(apiError),
          {
            action: {
              label: 'Try Again',
              onClick: () => syncMutation.mutate(userId)
            }
          }
        )

        throw apiError
      }
    },
    onSuccess: (data: SyncResult) => {
      setSyncStatus('success')

      // Show success message with details
      const message = data.videosSynced > 0
        ? `Found ${data.videosSynced} new videos from ${data.channelsSynced} channels`
        : 'No new videos found'

      toast.success('Sync completed', message)

      // Show any errors that occurred during sync
      if (data.errors && data.errors.length > 0) {
        toast.warning(
          'Sync completed with warnings',
          `${data.errors.length} channel(s) had issues`
        )
      }

      // Invalidate videos query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['videos'] })

      // Reset status after 3 seconds
      setTimeout(() => setSyncStatus('idle'), 3000)
    },
    onError: (error: Error) => {
      setSyncStatus('error')
      console.error('Sync failed:', error)

      // Reset status after 5 seconds
      setTimeout(() => setSyncStatus('idle'), 5000)
    },
    retry: (failureCount: number, error: Error) => {
      const apiError = handleAPIError(error)

      // Don't retry on quota errors or client errors
      if (apiError.code === 'QUOTA_EXCEEDED' || (apiError.status >= 400 && apiError.status < 500)) {
        return false
      }

      // Retry once for server errors
      return failureCount < 1
    },
    retryDelay: 5000, // 5 second delay before retry
  })

  const triggerSync = (userId?: string) => {
    // Prevent multiple simultaneous syncs
    if (syncMutation.isPending) {
      toast.warning('Sync in progress', 'Please wait for the current sync to complete')
      return
    }

    syncMutation.mutate(userId)
  }

  const cancelSync = () => {
    // Note: This doesn't actually cancel the API request, just resets the UI state
    setSyncStatus('idle')
    toast.info('Sync cancelled')
  }

  return {
    syncStatus,
    triggerSync,
    cancelSync,
    isLoading: syncMutation.isPending,
    error: syncMutation.error,
    data: syncMutation.data,
    canRetry: syncStatus === 'error' && !syncMutation.isPending,
  }
}