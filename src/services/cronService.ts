interface CronSyncResult {
  totalUsers: number
  successfulSyncs: number
  failedSyncs: number
  totalVideosSynced: number
  errors: string[]
  executionTime: number
}

export class CronService {
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

  async getSyncStatus(): Promise<{ lastSync: Date | null; nextSync: Date | null }> {
    // In a real implementation, this would check the database for last sync times
    // and calculate next sync based on cron schedule
    
    const now = new Date()
    const lastSync = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
    const nextSync = new Date(now.getTime() + 1 * 60 * 60 * 1000) // 1 hour from now
    
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