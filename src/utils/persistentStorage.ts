// Enhanced storage that tries multiple methods for better persistence
class PersistentStorage {
  private storageKey: string

  constructor(key: string) {
    this.storageKey = key
  }

  // Try to store in multiple places for better persistence
  setItem(key: string, value: string): void {
    const fullKey = `${this.storageKey}_${key}`
    
    try {
      // Primary: localStorage
      localStorage.setItem(fullKey, value)
      
      // Secondary: sessionStorage as backup
      sessionStorage.setItem(fullKey, value)
      
      // Tertiary: IndexedDB for PWA persistence (if available)
      this.setIndexedDB(fullKey, value)
      
    } catch (error) {
      console.warn('Failed to store data:', error)
    }
  }

  // Try to retrieve from multiple sources
  getItem(key: string): string | null {
    const fullKey = `${this.storageKey}_${key}`
    
    try {
      // Try localStorage first
      let value = localStorage.getItem(fullKey)
      if (value) return value
      
      // Fallback to sessionStorage
      value = sessionStorage.getItem(fullKey)
      if (value) {
        // Restore to localStorage if found in sessionStorage
        localStorage.setItem(fullKey, value)
        return value
      }
      
      // TODO: Fallback to IndexedDB if needed
      
    } catch (error) {
      console.warn('Failed to retrieve data:', error)
    }
    
    return null
  }

  removeItem(key: string): void {
    const fullKey = `${this.storageKey}_${key}`
    
    try {
      localStorage.removeItem(fullKey)
      sessionStorage.removeItem(fullKey)
      // TODO: Remove from IndexedDB
    } catch (error) {
      console.warn('Failed to remove data:', error)
    }
  }

  private async setIndexedDB(key: string, value: string): Promise<void> {
    try {
      if (!('indexedDB' in window)) return
      
      // Simple IndexedDB storage for PWA persistence
      const request = indexedDB.open('AuthStorage', 1)
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth')
        }
      }
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['auth'], 'readwrite')
        const store = transaction.objectStore('auth')
        store.put(value, key)
      }
    } catch (error) {
      // IndexedDB not available or failed, that's okay
      console.debug('IndexedDB storage failed:', error)
    }
  }
}

export const authStorage = new PersistentStorage('youtube_auth')
export const userStorage = new PersistentStorage('youtube_user')