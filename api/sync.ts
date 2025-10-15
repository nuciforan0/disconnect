import { VercelRequest, VercelResponse } from '@vercel/node'

interface SyncResult {
  channelsSynced: number
  videosSynced: number
  errors: string[]
}

interface CronSyncResult {
  totalUsers: number
  successfulSyncs: number
  failedSyncs: number
  totalVideosSynced: number
  errors: string[]
  executionTime: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()
  const { userId } = req.body
  const isCronJob = !userId

  try {
    if (userId) {
      // Manual sync for specific user
      console.log(`Manual sync requested for user: ${userId}`)
      
      const result = await syncUserVideos(userId)
      
      console.log(`Sync completed for user ${userId}:`, result)
      res.status(200).json(result)
    } else {
      // Cron job - sync all users
      console.log('Cron job: Starting automated sync for all users')
      
      const result = await syncAllUsers()
      result.executionTime = Date.now() - startTime
      
      console.log('Cron job completed:', result)
      res.status(200).json(result)
    }
  } catch (error) {
    console.error('Sync error:', error)
    
    const errorResponse = {
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime
    }
    
    res.status(500).json(errorResponse)
  }
}

async function syncUserVideos(userId: string): Promise<SyncResult> {
  // Mock implementation - in real app this would use the sync service
  const result: SyncResult = {
    channelsSynced: 0,
    videosSynced: 0,
    errors: []
  }

  try {
    // Simulate sync process
    await delay(1000) // Simulate API calls
    
    // Mock successful sync
    result.channelsSynced = Math.floor(Math.random() * 10) + 1
    result.videosSynced = Math.floor(Math.random() * 50) + 5
    
    console.log(`Synced ${result.videosSynced} videos from ${result.channelsSynced} channels for user ${userId}`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
    result.errors.push(`Failed to sync user ${userId}: ${errorMessage}`)
  }

  return result
}

async function syncAllUsers(): Promise<CronSyncResult> {
  const result: CronSyncResult = {
    totalUsers: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalVideosSynced: 0,
    errors: [],
    executionTime: 0
  }

  try {
    // In real implementation, get all users from database
    // const users = await databaseService.getAllUsers()
    
    // Mock users for demonstration
    const mockUsers = ['user1', 'user2', 'user3']
    result.totalUsers = mockUsers.length

    // Sync each user
    for (const userId of mockUsers) {
      try {
        const userResult = await syncUserVideos(userId)
        
        if (userResult.errors.length === 0) {
          result.successfulSyncs++
          result.totalVideosSynced += userResult.videosSynced
        } else {
          result.failedSyncs++
          result.errors.push(...userResult.errors)
        }
        
        // Add delay between users to avoid rate limiting
        await delay(500)
        
      } catch (error) {
        result.failedSyncs++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Failed to sync user ${userId}: ${errorMessage}`)
      }
    }

    console.log(`Cron sync completed: ${result.successfulSyncs}/${result.totalUsers} users synced successfully`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Cron job failed: ${errorMessage}`)
  }

  return result
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}