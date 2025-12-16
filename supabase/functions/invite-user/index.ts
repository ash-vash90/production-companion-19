import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for service-level operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create client with user's token to verify they're an admin
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    if (roleError || !roleData) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only admins can invite users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    const { email, role } = await req.json();
    
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'Email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate role
    const validRoles = ['admin', 'supervisor', 'operator', 'logistics'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if there's already a pending invite for this email
    const { data: existingInvite } = await supabaseAdmin
      .from('user_invites')
      .select('id, expires_at')
      .eq('email', email)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'Pending invite already exists for this email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invites')
      .insert({
        email,
        role,
        invited_by: user.id,
      })
      .select()
      .single();
    
    if (inviteError) {
      console.error('Invite creation error:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Invite created for ${email} with role ${role} by user ${user.id}`);
    
    // Generate invite link
    const baseUrl = req.headers.get('origin') || supabaseUrl.replace('.supabase.co', '');
    const inviteLink = `${baseUrl}/auth?invite=${invite.invite_token}`;
    
    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'invite_user',
      entity_type: 'user_invite',
      entity_id: invite.id,
      details: { email, role },
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expires_at: invite.expires_at,
          invite_link: inviteLink,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
