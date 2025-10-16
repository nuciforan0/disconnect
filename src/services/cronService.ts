interface CronSyncResult {
  totalUsers: number
  successfulSyncs: number
  failedSyncs: number
  totalVideosSynced: number
  errors: string[]
  executionTime: number
}

export class CronService {
  // Cron job runs at 22:00 UTC (10 PM UTC = 8 AM AEST next day)

  async triggerManualSync(): Promise<CronSyncResult> {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // No userId in body triggers cron job logic
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Manual sync trigger failed:', error)
      throw error
    }
  }

  getNextSyncTime(): Date {
    const now = new Date()
    
    // Create next sync time at 8 AM AEDT (which is 10 PM UTC the previous day, or 9 PM during DST)
    // For simplicity, we'll use 10 PM UTC (22:00) which corresponds to 8 AM AEST
    const nextSync = new Date()
    nextSync.setUTCHours(22, 0, 0, 0) // 10 PM UTC = 8 AM AEST next day
    
    // If we've already passed 10 PM UTC today, set it for tomorrow
    if (now.getUTCHours() >= 22) {
      nextSync.setUTCDate(nextSync.getUTCDate() + 1)
    }
    
    return nextSync
  }

  getTimeUntilNextSync(): string {
    const now = new Date()
    const nextSync = this.getNextSyncTime()
    const diffInMs = nextSync.getTime() - now.getTime()
    
    if (diffInMs <= 0) {
      return '00:00:00'
    }
    
    const hours = Math.floor(diffInMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffInMs % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  async getSyncStatus(): Promise<{ lastSync: Date | null; nextSync: Date | null }> {
    // In a real implementation, this would check the database for last sync times
    const nextSync = this.getNextSyncTime()
    const lastSync = new Date(nextSync.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    return {
      lastSync,
      nextSync
    }
  }

  formatSyncTime(date: Date): string {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60)
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    }
  }

  formatNextSyncTime(date: Date): string {
    const now = new Date()
    const diffInMinutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) {
      return 'Soon'
    } else if (diffInMinutes < 60) {
      return `In ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60)
      return `In ${diffInHours} hour${diffInHours > 1 ? 's' : ''}`
    }
  }
}

export const cronService = new CronService()