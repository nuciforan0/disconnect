# YouTube Subscription Manager

A modern web application for managing YouTube video consumption through a personalized feed system.

## Features

### 📺 Smart Video Feed
- Automatically fetches videos from your YouTube subscriptions from the last 24 hours
- Clean, responsive interface optimized for mobile and desktop
- Skip videos to permanently remove them from your feed

### 🔄 Intelligent Sync System
- Manual sync button to fetch latest videos from your subscriptions
- Skipped videos are remembered and won't appear again
- Efficient quota management to stay within YouTube API limits

### 🎯 Video Management
- **Watch**: Opens the video and removes it from your feed
- **Skip**: Permanently removes the video from your feed without watching
- Videos are filtered based on your subscription activity from the past day

### 🔐 Authentication & Security
- Google OAuth authentication
- Secure token management
- Row-level security with Supabase

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State Management**: React Query, Zustand
- **Backend**: Vercel Functions (Serverless)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Google OAuth 2.0
- **Video Player**: YouTube IFrame API

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Fill in your environment variables in `.env`

5. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for required environment variables.

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API service layer
├── store/              # Zustand stores
└── types/              # TypeScript type definitions

api/                    # Vercel serverless functions
├── auth.ts            # Authentication endpoints
├── videos.ts          # Video management endpoints
└── sync.ts            # Background sync functionality
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Deployment

This project is configured for deployment on Vercel with automatic cron jobs for video syncing.