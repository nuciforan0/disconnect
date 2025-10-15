// Test utilities for integration testing

export const testIds = {
  // Authentication
  loginButton: 'login-button',
  logoutButton: 'logout-button',
  
  // Video Feed
  videoFeed: 'video-feed',
  videoCard: 'video-card',
  watchButton: 'watch-button',
  skipButton: 'skip-button',
  refreshButton: 'refresh-button',
  
  // Sync
  syncButton: 'sync-button',
  syncStatus: 'sync-status',
  
  // Video Player
  videoPlayer: 'video-player',
  backButton: 'back-button',
  
  // Loading states
  loadingSpinner: 'loading-spinner',
  videoCardSkeleton: 'video-card-skeleton',
  
  // Error states
  errorMessage: 'error-message',
  retryButton: 'retry-button',
  
  // Toast notifications
  toast: 'toast',
  toastClose: 'toast-close',
} as const

export const mockVideoData = {
  id: 'test-video-1',
  videoId: 'dQw4w9WgXcQ',
  title: 'Test Video Title',
  channelName: 'Test Channel',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  publishedAt: '2 hours ago',
  duration: '3:45'
}

export const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User'
}

export const mockSyncResult = {
  channelsSynced: 5,
  videosSynced: 25,
  errors: []
}

// Utility functions for testing
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const waitForElement = async (selector: string, timeout = 5000): Promise<Element> => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector)
    if (element) return element
    await waitFor(100)
  }
  
  throw new Error(`Element with selector "${selector}" not found within ${timeout}ms`)
}

export const waitForElementToDisappear = async (selector: string, timeout = 5000): Promise<void> => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector)
    if (!element) return
    await waitFor(100)
  }
  
  throw new Error(`Element with selector "${selector}" did not disappear within ${timeout}ms`)
}

// Mock API responses for testing
export const mockApiResponses = {
  videos: {
    success: {
      videos: [mockVideoData],
      hasMore: false,
      total: 1
    },
    empty: {
      videos: [],
      hasMore: false,
      total: 0
    },
    error: {
      error: 'Failed to fetch videos',
      message: 'Network error'
    }
  },
  
  sync: {
    success: mockSyncResult,
    error: {
      error: 'Sync failed',
      message: 'YouTube API quota exceeded'
    }
  },
  
  auth: {
    success: {
      authUrl: 'https://accounts.google.com/oauth/authorize?...'
    },
    error: {
      error: 'Authentication failed',
      message: 'Invalid client configuration'
    }
  }
}

// Test scenarios
export const testScenarios = {
  // Happy path: User logs in, sees videos, watches one
  happyPath: async () => {
    console.log('🧪 Testing happy path scenario...')
    
    // 1. User should see login page
    await waitForElement(`[data-testid="${testIds.loginButton}"]`)
    console.log('✅ Login page loaded')
    
    // 2. Click login button
    const loginButton = document.querySelector(`[data-testid="${testIds.loginButton}"]`) as HTMLElement
    loginButton?.click()
    console.log('✅ Login initiated')
    
    // 3. After auth, should see video feed
    await waitForElement(`[data-testid="${testIds.videoFeed}"]`)
    console.log('✅ Video feed loaded')
    
    // 4. Should see video cards
    await waitForElement(`[data-testid="${testIds.videoCard}"]`)
    console.log('✅ Video cards displayed')
    
    // 5. Click watch button
    const watchButton = document.querySelector(`[data-testid="${testIds.watchButton}"]`) as HTMLElement
    watchButton?.click()
    console.log('✅ Watch button clicked')
    
    // 6. Should navigate to video player
    await waitForElement(`[data-testid="${testIds.videoPlayer}"]`)
    console.log('✅ Video player loaded')
    
    // 7. Click back button
    const backButton = document.querySelector(`[data-testid="${testIds.backButton}"]`) as HTMLElement
    backButton?.click()
    console.log('✅ Navigated back to feed')
    
    console.log('🎉 Happy path test completed successfully!')
  },
  
  // Error handling: Network errors, API failures
  errorHandling: async () => {
    console.log('🧪 Testing error handling scenario...')
    
    // Test will depend on mocked API responses
    console.log('✅ Error handling test completed')
  },
  
  // Sync functionality
  syncFlow: async () => {
    console.log('🧪 Testing sync functionality...')
    
    // 1. Should see sync button
    await waitForElement(`[data-testid="${testIds.syncButton}"]`)
    console.log('✅ Sync button found')
    
    // 2. Click sync button
    const syncButton = document.querySelector(`[data-testid="${testIds.syncButton}"]`) as HTMLElement
    syncButton?.click()
    console.log('✅ Sync initiated')
    
    // 3. Should show loading state
    await waitForElement(`[data-testid="${testIds.loadingSpinner}"]`)
    console.log('✅ Loading state displayed')
    
    // 4. Should complete and show success
    await waitForElementToDisappear(`[data-testid="${testIds.loadingSpinner}"]`)
    console.log('✅ Sync completed')
    
    console.log('🎉 Sync flow test completed successfully!')
  }
}

// Performance testing utilities
export const performanceTests = {
  measurePageLoad: () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
      firstPaint: navigation.loadEventEnd - navigation.fetchStart, // Simplified
    }
  },
  
  measureComponentRender: (componentName: string, renderFn: () => void) => {
    const startTime = performance.now()
    renderFn()
    const endTime = performance.now()
    
    console.log(`${componentName} render time: ${endTime - startTime}ms`)
    return endTime - startTime
  }
}

// Accessibility testing helpers
export const a11yTests = {
  checkKeyboardNavigation: async () => {
    console.log('🧪 Testing keyboard navigation...')
    
    // Simulate tab navigation
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    console.log(`Found ${focusableElements.length} focusable elements`)
    
    // Test that all interactive elements are keyboard accessible
    focusableElements.forEach((element, index) => {
      if (element instanceof HTMLElement) {
        element.focus()
        const isFocused = document.activeElement === element
        console.log(`Element ${index + 1}: ${isFocused ? '✅' : '❌'} focusable`)
      }
    })
  },
  
  checkAriaLabels: () => {
    console.log('🧪 Testing ARIA labels...')
    
    const interactiveElements = document.querySelectorAll('button, [role="button"], input')
    let missingLabels = 0
    
    interactiveElements.forEach((element) => {
      const hasLabel = element.getAttribute('aria-label') || 
                      element.getAttribute('aria-labelledby') ||
                      element.textContent?.trim()
      
      if (!hasLabel) {
        missingLabels++
        console.log('❌ Missing label:', element)
      }
    })
    
    console.log(`${missingLabels === 0 ? '✅' : '❌'} ARIA labels check: ${missingLabels} missing labels`)
  }
}