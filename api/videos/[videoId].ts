import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req
  const videoId = query.videoId as string

  if (method === 'DELETE') {
    try {
      const userId = req.headers.authorization?.replace('Bearer ', '') // In real app, decode JWT token

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!videoId) {
        return res.status(400).json({ error: 'Video ID is required' })
      }

      // TODO: Replace with actual database deletion
      // await databaseService.deleteVideo(userId, videoId)
      
      console.log(`Deleted video ${videoId} for user ${userId}`)

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting video:', error)
      res.status(500).json({ error: 'Failed to delete video' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}