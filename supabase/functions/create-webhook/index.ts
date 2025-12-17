import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // Get webhook data from request
    const { name, description } = await req.json()
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Missing name' }),
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
