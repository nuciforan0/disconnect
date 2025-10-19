-- Add session token field for PWA authentication persistence
ALTER TABLE users ADD COLUMN session_token TEXT UNIQUE;

-- Create index for session token lookups
CREATE INDEX idx_users_session_token ON users(session_token);