export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class QuotaExceededError extends APIError {
  constructor(message = 'API quota exceeded') {
    super(message, 403, 'QUOTA_EXCEEDED')
    this.name = 'QuotaExceededError'
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_FAILED')
    this.name = 'AuthenticationError'
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message)
    this.name = 'NetworkError'
  }
}

export function handleAPIError(error: any): APIError {
  if (error instanceof APIError) {
    return error
  }

  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new NetworkError('Network connection failed')
  }

  if (error.status) {
    switch (error.status) {
      case 401:
        return new AuthenticationError('Authentication required')
      case 403:
        return new QuotaExceededError('API quota exceeded')
      case 404:
        return new APIError('Resource not found', 404)
      case 429:
        return new APIError('Rate limit exceeded', 429)
      case 500:
        return new APIError('Server error', 500)
      default:
        return new APIError(`API error: ${error.status}`, error.status)
    }
  }

  return new APIError(error.message || 'Unknown error occurred', 500)
}

export function getErrorMessage(error: any): string {
  if (error instanceof QuotaExceededError) {
    return 'YouTube API quota exceeded. Please try again later.'
  }

  if (error instanceof AuthenticationError) {
    return 'Please log in again to continue.'
  }

  if (error instanceof NetworkError) {
    return 'Network connection failed. Please check your internet connection.'
  }

  if (error instanceof APIError) {
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}