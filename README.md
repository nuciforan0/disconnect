# YouTube Subscription Manager

A modern web application for managing YouTube video consumption through a personalized feed system.

## Features

- Google OAuth authentication
- Personalized video feed from subscribed channels
- Watch/Skip functionality to manage video consumption
- Embedded YouTube player
- Automatic syncing every 3 hours
- Responsive design for mobile and desktop

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