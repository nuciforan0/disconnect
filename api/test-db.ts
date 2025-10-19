import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🔍 Testing database connection...')
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    
    const envCheck = {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      supabaseUrlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing',
      serviceKeyPrefix: serviceKey ? serviceKey.substring(0, 15) + '...' : 'missing'
    }
    
    console.log('Environment variables:', envCheck)
    
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: 'Missing environment variables',
        envCheck
      })
    }
    
    const supabase = createClient(supabaseUrl, serviceKey)
    
    // Test database connection by querying users table
    const { data: users, error } = await supabase
      .from('users')
      .select('id, google_id, email, created_at')
      .limit(5)
    
    if (error) {
      console.error('Database query error:', error)
      return res.status(500).json({
        error: 'Database query failed',
        details: error,
        envCheck
      })
    }
    
    console.log('✅ Database connection successful')
    
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      userCount: users?.length || 0,
      users: users?.map(u => ({
        id: u.id,
        google_id: u.google_id,
        email: u.email,
        created_at: u.created_at
      })) || [],
      envCheck
    })
    
  } catch (error) {
    console.error('Test endpoint error:', error)
    res.status(500).json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}