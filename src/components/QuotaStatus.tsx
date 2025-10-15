import { useState, useEffect } from 'react'
import { quotaManager } from '../services/quotaManager'

export default function QuotaStatus() {
  const [quotaUsage, setQuotaUsage] = useState(quotaManager.getQuotaUsage())

  useEffect(() => {
    const updateQuota = () => {
      setQuotaUsage(quotaManager.getQuotaUsage())
    }

    // Update every 30 seconds
    const interval = setInterval(updateQuota, 30000)
    
    // Update on window focus
    window.addEventListener('focus', updateQuota)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', updateQuota)
    }
  }, [])

  const utilizationPercentage = (quotaUsage.used / quotaUsage.limit) * 100
  const timeToReset = quotaManager.estimateTimeToReset()
  const hoursToReset = Math.ceil(timeToReset / (1000 * 60 * 60))

  const getStatusColor = () => {
    if (utilizationPercentage >= 90) return 'text-red-600 bg-red-50 border-red-200'
    if (utilizationPercentage >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  const getProgressBarColor = () => {
    if (utilizationPercentage >= 90) return 'bg-red-500'
    if (utilizationPercentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">API Quota Usage</h3>
        <span className="text-xs">
          {quotaUsage.used.toLocaleString()} / {quotaUsage.limit.toLocaleString()}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
          style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
        />
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span>{utilizationPercentage.toFixed(1)}% used</span>
        <span>Resets in {hoursToReset}h</span>
      </div>
      
      {utilizationPercentage >= 80 && (
        <div className="mt-2 text-xs">
          ⚠️ High usage - sync operations may be throttled
        </div>
      )}
    </div>
  )
}