import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiter (resets on function cold start)
// For production, consider using Redis or database-backed rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5 // Max 5 secret regenerations per hour per user (stricter than create)

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = `regenerate_secret:${userId}`
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
        JSON.stringify({ error: 'Only administrators can regenerate webhook secrets' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check rate limit (stricter for regeneration - potential security concern)
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for user:', user.id)
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 5 secret regenerations per hour.',
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
    
    // Get webhook ID from request
    const { webhook_id } = await req.json()
    if (!webhook_id) {
      return new Response(
        JSON.stringify({ error: 'Missing webhook_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Verify webhook exists
    const { data: existingWebhook, error: fetchError } = await supabaseAdmin
      .from('incoming_webhooks')
      .select('id, name')
      .eq('id', webhook_id)
      .single()
    
    if (fetchError || !existingWebhook) {
      console.log('Webhook not found:', webhook_id)
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Regenerating secret for webhook:', existingWebhook.name)
    
    // Generate new secret (64 hex characters)
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const newSecret = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    // Update the webhook with new secret
    const { error: updateError } = await supabaseAdmin
      .from('incoming_webhooks')
      .update({ 
        secret_key: newSecret,
        updated_at: new Date().toISOString()
      })
      .eq('id', webhook_id)
    
    if (updateError) {
      console.error('Error updating webhook:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to regenerate secret' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Secret regenerated for webhook:', webhook_id)
    
    // Log the action with detailed audit information
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'webhook_secret_regenerated',
      entity_type: 'incoming_webhook',
      entity_id: webhook_id,
      details: { 
        webhook_name: existingWebhook.name,
        regenerated_at: new Date().toISOString(),
        reason: 'manual_regeneration'
      }
    })
    
    // Return the new secret (only time it will be visible)
    return new Response(
      JSON.stringify({ 
        secret: newSecret,
        message: 'Secret regenerated. This is the only time the full secret will be shown.' 
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
