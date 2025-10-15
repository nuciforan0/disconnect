import { useState, useCallback } from 'react'

interface OptimisticUpdate<T> {
  id: string
  type: 'add' | 'remove' | 'update'
  data?: T
}

export function useOptimisticUpdates<T extends { id: string }>(
  initialData: T[] = []
) {
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate<T>[]>([])

  const addOptimisticUpdate = useCallback((update: OptimisticUpdate<T>) => {
    setOptimisticUpdates(prev => [...prev, update])
  }, [])

  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(update => update.id !== id))
  }, [])

  const clearOptimisticUpdates = useCallback(() => {
    setOptimisticUpdates([])
  }, [])

  const getOptimisticData = useCallback((serverData: T[]) => {
    let result = [...serverData]

    optimisticUpdates.forEach(update => {
      switch (update.type) {
        case 'remove':
          result = result.filter(item => item.id !== update.id)
          break
        case 'add':
          if (update.data) {
            result.unshift(update.data)
          }
          break
        case 'update':
          if (update.data) {
            const index = result.findIndex(item => item.id === update.id)
            if (index !== -1) {
              result[index] = update.data
            }
          }
          break
      }
    })

    return result
  }, [optimisticUpdates])

  return {
    optimisticUpdates,
    addOptimisticUpdate,
    removeOptimisticUpdate,
    clearOptimisticUpdates,
    getOptimisticData,
  }
}