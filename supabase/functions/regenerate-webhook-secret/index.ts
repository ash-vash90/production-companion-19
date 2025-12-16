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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()
    
    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Only administrators can regenerate webhook secrets' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    
    // Log the action
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'webhook_secret_regenerated',
      entity_type: 'incoming_webhook',
      entity_id: webhook_id,
      details: { regenerated_at: new Date().toISOString() }
    })
    
    // Return the new secret (only time it will be visible)
    return new Response(
      JSON.stringify({ 
        secret: newSecret,
        message: 'Secret regenerated. This is the only time the full secret will be shown.' 
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