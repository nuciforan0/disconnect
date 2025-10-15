interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'blue' | 'white' | 'gray'
  className?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  color = 'blue',
  className = '' 
}: LoadingSpinnerProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4'
      case 'md': return 'w-6 h-6'
      case 'lg': return 'w-8 h-8'
      case 'xl': return 'w-12 h-12'
      default: return 'w-6 h-6'
    }
  }

  const getColorClass = () => {
    switch (color) {
      case 'blue': return 'border-blue-600'
      case 'white': return 'border-white'
      case 'gray': return 'border-gray-600'
      default: return 'border-blue-600'
    }
  }

  return (
    <div 
      className={`animate-spin rounded-full border-2 border-t-transparent ${getSizeClass()} ${getColorClass()} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}