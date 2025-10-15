export interface User {
  id: string;
  google_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  last_sync?: Date;
  created_at: Date;
}

export interface Channel {
  id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  thumbnail_url?: string;
  created_at: Date;
}

export interface Video {
  id: string;
  user_id: string;
  video_id: string;
  channel_id: string;
  channel_name: string;
  title: string;
  thumbnail_url?: string;
  published_at: Date;
  duration?: string;
  created_at: Date;
}



// API response types
export interface VideoFeedResponse {
  videos: Video[];
  hasMore: boolean;
}

export interface SyncResponse {
  syncedVideos: number;
  errors: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// YouTube API types
export interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
      maxres?: { url: string };
    };
  };
  contentDetails: {
    duration: string;
  };
}

export interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}