import { useState, useEffect } from 'react'
import { cronService } from '../services/cronService'

export default function SyncStatus() {
  const [timeUntilSync, setTimeUntilSync] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const updateCountdown = () => {
      try {
        const countdown = cronService.getTimeUntilNextSync()
        setTimeUntilSync(countdown)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to calculate countdown:', error)
        setIsLoading(false)
      }
    }

    updateCountdown()
    
    // Update every second for real-time countdown
    const interval = setInterval(updateCountdown, 1000)
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
        <h3 className="text-sm font-medium text-gray-900">Next Sync</h3>
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-xs text-gray-500">Daily at 8 AM AEST</span>
        </div>
      </div>
      
      <div className="text-center py-2">
        <div className="text-2xl font-mono font-bold text-gray-900">
          {timeUntilSync}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          until next sync
        </p>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Videos sync automatically once per day
        </p>
      </div>
    </div>
  )
}