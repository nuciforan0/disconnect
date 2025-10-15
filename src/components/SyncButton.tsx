import { useSync } from '../hooks/useSync'

interface SyncButtonProps {
  userId?: string
  className?: string
}

export default function SyncButton({ userId, className = '' }: SyncButtonProps) {
  const { syncStatus, triggerSync, isLoading } = useSync()

  const handleSync = () => {
    triggerSync(userId)
  }

  const getButtonText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...'
      case 'success':
        return 'Synced!'
      case 'error':
        return 'Sync Failed'
      default:
        return 'Sync Videos'
    }
  }

  const getButtonClass = () => {
    const baseClass = `px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm touch-manipulation min-h-[36px] ${className}`
    
    switch (syncStatus) {
      case 'syncing':
        return `${baseClass} bg-blue-500 text-white cursor-not-allowed`
      case 'success':
        return `${baseClass} bg-green-600 text-white`
      case 'error':
        return `${baseClass} bg-red-600 text-white hover:bg-red-700`
      default:
        return `${baseClass} bg-blue-600 text-white hover:bg-blue-700`
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isLoading || syncStatus === 'syncing'}
      className={getButtonClass()}
    >
      <div className="flex items-center justify-center">
        {isLoading && (
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        )}
        <span className="hidden sm:inline">{getButtonText()}</span>
        <span className="sm:hidden">
          {syncStatus === 'syncing' ? 'Sync...' : 'Sync'}
        </span>
      </div>
    </button>
  )
}