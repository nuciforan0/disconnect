import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { userId } = req.body

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' })
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_KEY

        if (!supabaseUrl || !serviceKey) {
            return res.status(500).json({ error: 'Database not configured' })
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        // Get user's token info
        const { data: user, error } = await supabase
            .from('users')
            .select('google_id, email, access_token, refresh_token, last_sync, created_at')
            .eq('google_id', userId)
            .single()

        if (error || !user) {
            return res.status(404).json({ error: 'User not found' })
        }

        // Test the access token
        let accessTokenValid = false
        let accessTokenError: string | null = null

        try {
            const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + user.access_token)
            accessTokenValid = testResponse.ok
            if (!testResponse.ok) {
                const errorData = await testResponse.json().catch(() => ({}))
                accessTokenError = errorData.error || `HTTP ${testResponse.status}`
            }
        } catch (error) {
            accessTokenError = error instanceof Error ? error.message : 'Unknown error'
        }

        // Test the refresh token
        let refreshTokenValid = false
        let refreshTokenError: string | null = null

        if (user.refresh_token && !['placeholder', 'created_via_sync_no_refresh_token', 'no_refresh_token_received'].includes(user.refresh_token)) {
            try {
                const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: process.env.VITE_YOUTUBE_CLIENT_ID!,
                        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
                        refresh_token: user.refresh_token,
                        grant_type: 'refresh_token',
                    }),
                })

                refreshTokenValid = refreshResponse.ok
                if (!refreshResponse.ok) {
                    const errorData = await refreshResponse.json().catch(() => ({}))
                    refreshTokenError = errorData.error || `HTTP ${refreshResponse.status}`
                }
            } catch (error) {
                refreshTokenError = error instanceof Error ? error.message : 'Unknown error'
            }
        } else {
            refreshTokenError = 'Invalid or placeholder refresh token'
        }

        res.status(200).json({
            user: {
                googleId: user.google_id,
                email: user.email,
                lastSync: user.last_sync,
                createdAt: user.created_at
            },
            tokens: {
                accessToken: {
                    valid: accessTokenValid,
                    error: accessTokenError,
                    length: user.access_token?.length || 0
                },
                refreshToken: {
                    valid: refreshTokenValid,
                    error: refreshTokenError,
                    isPlaceholder: ['placeholder', 'created_via_sync_no_refresh_token', 'no_refresh_token_received'].includes(user.refresh_token),
                    length: user.refresh_token?.length || 0
                }
            }
        })

    } catch (error) {
        console.error('Token status check error:', error)
        res.status(500).json({
            error: 'Failed to check token status',
            message: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}