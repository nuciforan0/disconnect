import { monitoring } from './monitoring'

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private observers: Map<string, PerformanceObserver> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  init() {
    if (typeof window === 'undefined' || !window.performance) {
      return
    }

    this.observeWebVitals()
    this.observeResourceTiming()
    this.observeUserTiming()
  }

  private observeWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        
        monitoring.logPerformance('largest_contentful_paint', lastEntry.startTime, {
          element: (lastEntry as any).element?.tagName,
        })
      })

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('lcp', lcpObserver)
      } catch (error) {
        console.warn('LCP observer not supported')
      }
    }

    // First Input Delay (FID)
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          monitoring.logPerformance('first_input_delay', (entry as any).processingStart - entry.startTime, {
            eventType: (entry as any).name,
          })
        })
      })

      try {
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.set('fid', fidObserver)
      } catch (error) {
        console.warn('FID observer not supported')
      }
    }

    // Cumulative Layout Shift (CLS)
    if ('PerformanceObserver' in window) {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        })
        
        monitoring.logPerformance('cumulative_layout_shift', clsValue)
      })

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('cls', clsObserver)
      } catch (error) {
        console.warn('CLS observer not supported')
      }
    }
  }

  private observeResourceTiming() {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const resource = entry as PerformanceResourceTiming
          
          // Log slow resources
          if (resource.duration > 1000) {
            monitoring.logPerformance('slow_resource', resource.duration, {
              name: resource.name,
              type: resource.initiatorType,
              size: resource.transferSize,
            })
          }
        })
      })

      try {
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.set('resource', resourceObserver)
      } catch (error) {
        console.warn('Resource timing observer not supported')
      }
    }
  }

  private observeUserTiming() {
    if ('PerformanceObserver' in window) {
      const userTimingObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          monitoring.logPerformance('user_timing', entry.duration || entry.startTime, {
            name: entry.name,
            type: entry.entryType,
          })
        })
      })

      try {
        userTimingObserver.observe({ entryTypes: ['measure', 'mark'] })
        this.observers.set('userTiming', userTimingObserver)
      } catch (error) {
        console.warn('User timing observer not supported')
      }
    }
  }

  // Utility methods for custom performance measurements
  mark(name: string) {
    if (performance.mark) {
      performance.mark(name)
    }
  }

  measure(name: string, startMark: string, endMark?: string) {
    if (performance.measure) {
      performance.measure(name, startMark, endMark)
    }
  }

  measureFunction<T>(name: string, fn: () => T): T {
    const startTime = performance.now()
    const result = fn()
    const duration = performance.now() - startTime
    
    monitoring.logPerformance('function_execution', duration, { name })
    
    return result
  }

  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    const result = await fn()
    const duration = performance.now() - startTime
    
    monitoring.logPerformance('async_function_execution', duration, { name })
    
    return result
  }

  disconnect() {
    this.observers.forEach((observer) => {
      observer.disconnect()
    })
    this.observers.clear()
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  performanceMonitor.init()
}