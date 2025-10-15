-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Will be encrypted
  refresh_token TEXT NOT NULL, -- Will be encrypted
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL, -- YouTube channel ID
  channel_name TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

-- Create videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL, -- YouTube video ID
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Create indexes for optimal query performance
CREATE INDEX idx_videos_user_published ON videos(user_id, published_at DESC);
CREATE INDEX idx_channels_user_id ON channels(user_id);
CREATE INDEX idx_users_google_id ON users(google_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid()::text = google_id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid()::text = google_id);

-- Channels policies
CREATE POLICY "Users can view own channels" ON channels FOR SELECT USING (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));
CREATE POLICY "Users can insert own channels" ON channels FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));
CREATE POLICY "Users can update own channels" ON channels FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));
CREATE POLICY "Users can delete own channels" ON channels FOR DELETE USING (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));

-- Videos policies
CREATE POLICY "Users can view own videos" ON videos FOR SELECT USING (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));
CREATE POLICY "Users can insert own videos" ON videos FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));
CREATE POLICY "Users can delete own videos" ON videos FOR DELETE USING (user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text));