import { useState, useEffect } from 'react'
import { cronService } from '../services/cronService'

export default function SyncStatus() {
  const [syncInfo, setSyncInfo] = useState<{
    lastSync: Date | null
    nextSync: Date | null
  }>({ lastSync: null, nextSync: null })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const status = await cronService.getSyncStatus()
        setSyncInfo(status)
      } catch (error) {
        console.error('Failed to fetch sync status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSyncStatus()
    
    // Update every minute
    const interval = setInterval(fetchSyncStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Auto-Sync Status</h3>
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-xs text-gray-500">Active</span>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        {syncInfo.lastSync && (
          <div className="flex justify-between">
            <span>Last sync:</span>
            <span>{cronService.formatSyncTime(syncInfo.lastSync)}</span>
          </div>
        )}
        
        {syncInfo.nextSync && (
          <div className="flex justify-between">
            <span>Next sync:</span>
            <span>{cronService.formatNextSyncTime(syncInfo.nextSync)}</span>
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Videos are automatically synced every 3 hours
        </p>
      </div>
    </div>
  )
}