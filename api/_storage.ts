// Simple in-memory storage for development
// In production, this would be replaced with a proper database

interface Video {
  id: string;
  user_id: string;
  video_id: string;
  channel_id: string;
  channel_name: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
  duration: string;
  created_at: string;
}

// Global storage that persists across API calls during the same deployment
let videoStorage: Video[] = []

export const storage = {
  getVideos: (userId: string): Video[] => {
    return videoStorage.filter(video => video.user_id === userId)
  },

  addVideos: (videos: Video[]): void => {
    videos.forEach(video => {
      const exists = videoStorage.some(v => 
        v.user_id === video.user_id && v.video_id === video.video_id
      )
      if (!exists) {
        videoStorage.push(video)
      }
    })
  },

  deleteVideo: (userId: string, videoId: string): boolean => {
    const initialLength = videoStorage.length
    videoStorage = videoStorage.filter(video => 
      !(video.user_id === userId && video.video_id === videoId)
    )
    return videoStorage.length < initialLength
  },

  getAllVideos: (): Video[] => {
    return [...videoStorage]
  },

  clearAll: (): void => {
    videoStorage = []
  }
}