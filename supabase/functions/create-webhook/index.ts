import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiter (resets on function cold start)
// For production, consider using Redis or database-backed rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10 // Max 10 webhook creations per hour per user

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = `create_webhook:${userId}`
  const entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    // First request or window expired - reset
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime: now + RATE_LIMIT_WINDOW_MS }
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }
  
  entry.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetTime: entry.resetTime }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Create user client to check auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Get the user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('User authenticated:', user.id)
    
    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()
    
    if (!roleData) {
      console.log('User is not admin')
      return new Response(
        JSON.stringify({ error: 'Only administrators can create webhooks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for user:', user.id)
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 10 webhook creations per hour.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
          } 
        }
      )
    }
    
    // Get webhook data from request
    const { name, description } = await req.json()
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Missing name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate name length
    if (name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Name must be 100 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Creating webhook:', name)
    
    // Generate secret (64 hex characters)
    const secretArray = new Uint8Array(32)
    crypto.getRandomValues(secretArray)
    const secretKey = Array.from(secretArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    // Generate endpoint key (32 hex characters)
    const endpointArray = new Uint8Array(16)
    crypto.getRandomValues(endpointArray)
    const endpointKey = Array.from(endpointArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    // Create the webhook
    const { data: webhook, error: insertError } = await supabaseAdmin
      .from('incoming_webhooks')
      .insert({
        name,
        description: description || null,
        created_by: user.id,
        endpoint_key: endpointKey,
        secret_key: secretKey,
      })
      .select('id, name, description, endpoint_key, enabled, trigger_count, last_triggered_at, created_at, updated_at, created_by')
      .single()
    
    if (insertError) {
      console.error('Error creating webhook:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create webhook' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Webhook created:', webhook.id)
    
    // Log the action
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'webhook_created',
      entity_type: 'incoming_webhook',
      entity_id: webhook.id,
      details: { name, created_at: new Date().toISOString() }
    })
    
    // Return webhook data with the secret (only time it will be visible)
    return new Response(
      JSON.stringify({ 
        webhook: {
          ...webhook,
          secret_key: '********' + secretKey.slice(-4), // Masked version for display
        },
        secret: secretKey, // Full secret returned only on creation
        message: 'Webhook created. This is the only time the full secret will be shown.' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
        } 
      }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
