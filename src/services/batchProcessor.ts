import { quotaManager } from './quotaManager'

interface BatchJob<T, R> {
  id: string
  items: T[]
  processor: (batch: T[]) => Promise<R[]>
  batchSize: number
  delay: number
  onProgress?: (completed: number, total: number) => void
  onBatchComplete?: (results: R[], batchIndex: number) => void
}

interface BatchResult<R> {
  results: R[]
  errors: Error[]
  totalProcessed: number
  totalFailed: number
  executionTime: number
}

export class BatchProcessor {
  private activeJobs = new Map<string, boolean>()

  async processBatch<T, R>(job: BatchJob<T, R>): Promise<BatchResult<R>> {
    const startTime = Date.now()
    const results: R[] = []
    const errors: Error[] = []
    let totalProcessed = 0
    let totalFailed = 0

    // Mark job as active
    this.activeJobs.set(job.id, true)

    try {
      const batches = this.createBatches(job.items, job.batchSize)
      
      for (let i = 0; i < batches.length; i++) {
        // Check if job was cancelled
        if (!this.activeJobs.get(job.id)) {
          break
        }

        const batch = batches[i]
        
        try {
          // Check quota before processing
          if (quotaManager.shouldThrottleRequests()) {
            const delay = quotaManager.getRecommendedDelay()
            await this.delay(delay)
          }

          const batchResults = await job.processor(batch)
          results.push(...batchResults)
          totalProcessed += batchResults.length

          // Call progress callback
          job.onProgress?.(totalProcessed, job.items.length)
          job.onBatchComplete?.(batchResults, i)

          // Add delay between batches to avoid rate limiting
          if (i < batches.length - 1) {
            await this.delay(job.delay)
          }

        } catch (error) {
          const err = error instanceof Error ? error : new Error('Unknown batch error')
          errors.push(err)
          totalFailed += batch.length
          
          console.error(`Batch ${i + 1} failed:`, err)
          
          // Continue with next batch unless it's a quota error
          if (err.message.includes('quota')) {
            console.log('Quota exceeded, stopping batch processing')
            break
          }
        }
      }

    } finally {
      // Clean up
      this.activeJobs.delete(job.id)
    }

    return {
      results,
      errors,
      totalProcessed,
      totalFailed,
      executionTime: Date.now() - startTime
    }
  }

  cancelJob(jobId: string): void {
    this.activeJobs.set(jobId, false)
  }

  isJobActive(jobId: string): boolean {
    return this.activeJobs.get(jobId) || false
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    return batches
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Utility method for processing channels with quota awareness
  async processChannelsWithQuota<T, R>(
    channels: T[],
    processor: (channel: T) => Promise<R>,
    operationType: 'subscriptions' | 'activities' | 'videos' | 'channels'
  ): Promise<BatchResult<R>> {
    const optimalBatchSize = quotaManager.getOptimalBatchSize(operationType)
    const recommendedDelay = quotaManager.getRecommendedDelay()

    const batchProcessor = async (batch: T[]): Promise<R[]> => {
      const results: R[] = []
      
      for (const item of batch) {
        // Record quota usage
        quotaManager.recordOperation(operationType)
        
        try {
          const result = await processor(item)
          results.push(result)
        } catch (error) {
          console.error('Item processing failed:', error)
          throw error
        }
      }
      
      return results
    }

    return this.processBatch({
      id: `${operationType}-${Date.now()}`,
      items: channels,
      processor: batchProcessor,
      batchSize: Math.max(1, optimalBatchSize),
      delay: recommendedDelay,
    })
  }
}

export const batchProcessor = new BatchProcessor()