import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Get value from nested JSON using dot notation path
 */
function getValueByPath(obj: any, path: string): any {
  if (!path || path === '$') return obj;
  
  let cleanPath = path;
  if (cleanPath.startsWith('$.')) {
    cleanPath = cleanPath.slice(2);
  } else if (cleanPath.startsWith('$')) {
    cleanPath = cleanPath.slice(1);
  }
  
  if (!cleanPath) return obj;
  
  const parts = cleanPath.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      value = value[arrayMatch[1]];
      if (Array.isArray(value)) {
        value = value[parseInt(arrayMatch[2])];
      } else {
        return undefined;
      }
    } else {
      value = value[part];
    }
  }
  
  return value;
}

/**
 * Simulate rule execution without making actual changes
 */
function simulateRule(rule: any, payload: any): { 
  ruleName: string; 
  actionType: string; 
  extractedValues: Record<string, any>;
  wouldExecute: boolean;
  conditionResult?: { passed: boolean; reason: string };
} {
  const mappings = rule.field_mappings || {};
  const extractedValues: Record<string, any> = {};
  
  // Extract all mapped values
  for (const [key, path] of Object.entries(mappings)) {
    if (path) {
      extractedValues[key] = getValueByPath(payload, path as string);
    }
  }
  
  // Check conditions if present
  let conditionResult = undefined;
  let wouldExecute = rule.enabled;
  
  if (rule.conditions && rule.conditions.field) {
    const conditionValue = getValueByPath(payload, rule.conditions.field);
    const expectedValue = rule.conditions.value;
    const operator = rule.conditions.operator;
    
    let passed = false;
    let reason = '';
    
    switch (operator) {
      case 'equals':
        passed = conditionValue === expectedValue;
        reason = `${rule.conditions.field} (${JSON.stringify(conditionValue)}) ${passed ? '==' : '!='} ${JSON.stringify(expectedValue)}`;
        break;
      case 'not_equals':
        passed = conditionValue !== expectedValue;
        reason = `${rule.conditions.field} (${JSON.stringify(conditionValue)}) ${passed ? '!=' : '=='} ${JSON.stringify(expectedValue)}`;
        break;
      case 'contains':
        passed = String(conditionValue || '').includes(expectedValue);
        reason = `${rule.conditions.field} (${JSON.stringify(conditionValue)}) ${passed ? 'contains' : 'does not contain'} ${JSON.stringify(expectedValue)}`;
        break;
      case 'exists':
        passed = conditionValue !== undefined && conditionValue !== null;
        reason = `${rule.conditions.field} ${passed ? 'exists' : 'does not exist'}`;
        break;
    }
    
    conditionResult = { passed, reason };
    wouldExecute = wouldExecute && passed;
  }
  
  return {
    ruleName: rule.name,
    actionType: rule.action_type,
    extractedValues,
    wouldExecute,
    conditionResult,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authorization header and verify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user is admin
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { webhook_id, test_payload, dry_run = true } = await req.json();
    
    if (!webhook_id) {
      return new Response(
        JSON.stringify({ error: 'webhook_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const startTime = Date.now();
    
    // Fetch webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('incoming_webhooks')
      .select('*')
      .eq('id', webhook_id)
      .single();
    
    if (webhookError || !webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch rules
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('incoming_webhook_id', webhook_id)
      .order('sort_order', { ascending: true });
    
    if (rulesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch rules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const payload = test_payload || {};
    
    // Simulate each rule
    const ruleResults = (rules || []).map(rule => simulateRule(rule, payload));
    
    const responseTimeMs = Date.now() - startTime;
    
    // Log the test
    await supabase.from('webhook_logs').insert({
      incoming_webhook_id: webhook_id,
      request_body: payload,
      response_status: 200,
      executed_rules: ruleResults.filter(r => r.wouldExecute).map(r => ({
        name: r.ruleName,
        action: r.actionType,
      })),
      is_test: true,
      response_time_ms: responseTimeMs,
    });
    
    // If not dry run, actually call the webhook endpoint
    let liveResult = null;
    if (!dry_run) {
      try {
        const projectId = Deno.env.get('SUPABASE_URL')?.match(/\/\/([^.]+)/)?.[1] || 'project';
        const webhookUrl = `https://${projectId}.supabase.co/functions/v1/webhook-receiver/${webhook.endpoint_key}`;
        
        const liveResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhook.secret_key,
          },
          body: JSON.stringify(payload),
        });
        
        liveResult = {
          status: liveResponse.status,
          body: await liveResponse.json().catch(() => null),
        };
      } catch (liveError: any) {
        liveResult = {
          status: 0,
          error: liveError.message,
        };
      }
    }
    
    console.log(`Test webhook ${webhook_id}: ${ruleResults.length} rules evaluated, ${ruleResults.filter(r => r.wouldExecute).length} would execute`);
    
    return new Response(
      JSON.stringify({
        success: true,
        webhook: {
          id: webhook.id,
          name: webhook.name,
          enabled: webhook.enabled,
        },
        testPayload: payload,
        ruleResults,
        summary: {
          totalRules: ruleResults.length,
          enabledRules: ruleResults.filter(r => r.wouldExecute).length,
          disabledRules: ruleResults.filter(r => !r.wouldExecute).length,
        },
        responseTimeMs,
        dryRun: dry_run,
        liveResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Test webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
