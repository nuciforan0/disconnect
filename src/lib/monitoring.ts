interface ErrorReport {
  message: string
  stack?: string
  url: string
  userAgent: string
  timestamp: Date
  userId?: string
  context?: Record<string, any>
}

class MonitoringService {
  private isProduction = process.env.NODE_ENV === 'production'
  private sentryDsn = process.env.SENTRY_DSN

  logError(error: Error, context?: Record<string, any>) {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date(),
      context
    }

    // Log to console in development
    if (!this.isProduction) {
      console.error('Error logged:', errorReport)
      return
    }

    // Send to monitoring service in production
    this.sendToMonitoring(errorReport)
  }

  logPerformance(metric: string, value: number, context?: Record<string, any>) {
    if (!this.isProduction) {
      console.log(`Performance metric - ${metric}:`, value, context)
      return
    }

    // Send performance metrics to monitoring service
    this.sendPerformanceMetric(metric, value, context)
  }

  logUserAction(action: string, context?: Record<string, any>) {
    if (!this.isProduction) {
      console.log(`User action - ${action}:`, context)
      return
    }

    // Send user action to analytics
    this.sendUserAction(action, context)
  }

  private async sendToMonitoring(errorReport: ErrorReport) {
    try {
      // Example: Send to Sentry or other monitoring service
      if (this.sentryDsn) {
        // Sentry integration would go here
        console.log('Would send to Sentry:', errorReport)
      }

      // Fallback: Send to custom endpoint
      await fetch('/api/monitoring/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
      })
    } catch (error) {
      console.error('Failed to send error report:', error)
    }
  }

  private async sendPerformanceMetric(metric: string, value: number, context?: Record<string, any>) {
    try {
      await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metric,
          value,
          context,
          timestamp: new Date(),
          url: window.location.href,
        }),
      })
    } catch (error) {
      console.error('Failed to send performance metric:', error)
    }
  }

  private async sendUserAction(action: string, context?: Record<string, any>) {
    try {
      // Send to analytics service (Google Analytics, Mixpanel, etc.)
      if (window.gtag) {
        window.gtag('event', action, context)
      }

      // Custom analytics endpoint
      await fetch('/api/analytics/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          context,
          timestamp: new Date(),
          url: window.location.href,
        }),
      })
    } catch (error) {
      console.error('Failed to send user action:', error)
    }
  }

  // Performance monitoring
  measurePageLoad() {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      if (navigation) {
        this.logPerformance('page_load_time', navigation.loadEventEnd - navigation.fetchStart)
        this.logPerformance('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart)
        this.logPerformance('first_contentful_paint', navigation.loadEventEnd - navigation.fetchStart)
      }
    }
  }

  measureApiCall(endpoint: string, duration: number, success: boolean) {
    this.logPerformance('api_call_duration', duration, {
      endpoint,
      success,
    })
  }
}

export const monitoring = new MonitoringService()

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    monitoring.logError(new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    monitoring.logError(new Error(event.reason), {
      type: 'unhandled_promise_rejection',
    })
  })
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}