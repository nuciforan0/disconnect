interface QuotaUsage {
  used: number
  limit: number
  remaining: number
  resetTime: Date
}

interface QuotaOperation {
  type: 'subscriptions' | 'activities' | 'videos' | 'channels'
  cost: number
  timestamp: Date
}

export class QuotaManager {
  private static instance: QuotaManager
  private quotaUsage: QuotaUsage
  private operations: QuotaOperation[] = []
  private readonly DAILY_LIMIT = 10000
  private readonly OPERATION_COSTS = {
    subscriptions: 1,
    activities: 1,
    videos: 1,
    channels: 1,
  }

  constructor() {
    this.quotaUsage = {
      used: 0,
      limit: this.DAILY_LIMIT,
      remaining: this.DAILY_LIMIT,
      resetTime: this.getNextResetTime()
    }
    
    this.loadQuotaFromStorage()
  }

  static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager()
    }
    return QuotaManager.instance
  }

  private getNextResetTime(): Date {
    const now = new Date()
    const resetTime = new Date(now)
    resetTime.setUTCHours(0, 0, 0, 0)
    resetTime.setUTCDate(resetTime.getUTCDate() + 1)
    return resetTime
  }

  private loadQuotaFromStorage() {
    try {
      const stored = localStorage.getItem('youtube_quota_usage')
      if (stored) {
        const data = JSON.parse(stored)
        const resetTime = new Date(data.resetTime)
        
        // Check if quota should be reset
        if (new Date() >= resetTime) {
          this.resetQuota()
        } else {
          this.quotaUsage = {
            ...data,
            resetTime
          }
          this.operations = data.operations || []
        }
      }
    } catch (error) {
      console.error('Failed to load quota from storage:', error)
    }
  }

  private saveQuotaToStorage() {
    try {
      const data = {
        ...this.quotaUsage,
        operations: this.operations
      }
      localStorage.setItem('youtube_quota_usage', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save quota to storage:', error)
    }
  }

  canPerformOperation(operationType: keyof typeof this.OPERATION_COSTS, count = 1): boolean {
    const cost = this.OPERATION_COSTS[operationType] * count
    return this.quotaUsage.remaining >= cost
  }

  recordOperation(operationType: keyof typeof this.OPERATION_COSTS, count = 1): void {
    const cost = this.OPERATION_COSTS[operationType] * count
    
    if (!this.canPerformOperation(operationType, count)) {
      throw new Error(`Insufficient quota. Need ${cost}, have ${this.quotaUsage.remaining}`)
    }

    this.quotaUsage.used += cost
    this.quotaUsage.remaining -= cost

    this.operations.push({
      type: operationType,
      cost,
      timestamp: new Date()
    })

    // Keep only last 100 operations
    if (this.operations.length > 100) {
      this.operations = this.operations.slice(-100)
    }

    this.saveQuotaToStorage()
  }

  getQuotaUsage(): QuotaUsage {
    // Check if quota should be reset
    if (new Date() >= this.quotaUsage.resetTime) {
      this.resetQuota()
    }
    
    return { ...this.quotaUsage }
  }

  getOperationHistory(): QuotaOperation[] {
    return [...this.operations]
  }

  resetQuota(): void {
    this.quotaUsage = {
      used: 0,
      limit: this.DAILY_LIMIT,
      remaining: this.DAILY_LIMIT,
      resetTime: this.getNextResetTime()
    }
    this.operations = []
    this.saveQuotaToStorage()
  }

  getOptimalBatchSize(operationType: keyof typeof this.OPERATION_COSTS): number {
    const operationCost = this.OPERATION_COSTS[operationType]
    const maxOperations = Math.floor(this.quotaUsage.remaining / operationCost)
    
    // Conservative batch sizes to avoid hitting limits
    const conservativeLimits = {
      subscriptions: Math.min(maxOperations, 50),
      activities: Math.min(maxOperations, 10),
      videos: Math.min(maxOperations, 50),
      channels: Math.min(maxOperations, 50),
    }
    
    return conservativeLimits[operationType]
  }

  estimateTimeToReset(): number {
    const now = new Date()
    return Math.max(0, this.quotaUsage.resetTime.getTime() - now.getTime())
  }

  getQuotaUtilizationPercentage(): number {
    return (this.quotaUsage.used / this.quotaUsage.limit) * 100
  }

  shouldThrottleRequests(): boolean {
    // Throttle if we've used more than 80% of quota
    return this.getQuotaUtilizationPercentage() > 80
  }

  getRecommendedDelay(): number {
    const utilization = this.getQuotaUtilizationPercentage()
    
    if (utilization > 90) {
      return 5000 // 5 seconds
    } else if (utilization > 80) {
      return 2000 // 2 seconds
    } else if (utilization > 60) {
      return 1000 // 1 second
    }
    
    return 500 // 500ms default
  }
}

export const quotaManager = QuotaManager.getInstance()