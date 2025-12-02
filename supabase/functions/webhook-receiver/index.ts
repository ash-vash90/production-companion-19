import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Helper to get value from nested JSON using dot notation path
function getValueByPath(obj: any, path: string): any {
  if (!path || path === '$') return obj;
  
  // Remove leading $. if present
  const cleanPath = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  
  if (!cleanPath) return obj;
  
  const parts = cleanPath.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    
    // Handle array notation like items[0]
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

// Execute automation rules
async function executeRules(
  supabase: any,
  rules: any[],
  payload: any,
  webhookId: string
): Promise<{ executed: any[]; errors: string[] }> {
  const executed: any[] = [];
  const errors: string[] = [];
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    try {
      const mappings = rule.field_mappings || {};
      
      switch (rule.action_type) {
        case 'create_work_order': {
          // Map fields from payload
          const woNumber = getValueByPath(payload, mappings.wo_number) || `WO-${Date.now()}`;
          const productType = getValueByPath(payload, mappings.product_type) || 'SDM_ECO';
          const batchSize = parseInt(getValueByPath(payload, mappings.batch_size)) || 1;
          const notes = getValueByPath(payload, mappings.notes) || '';
          const scheduledDate = getValueByPath(payload, mappings.scheduled_date);
          
          // Get a system user for created_by (first admin)
          const { data: adminUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1)
            .single();
          
          if (!adminUser) {
            errors.push(`Rule ${rule.name}: No admin user found for work order creation`);
            continue;
          }
          
          // Create work order
          const { data: wo, error: woError } = await supabase
            .from('work_orders')
            .insert({
              wo_number: woNumber,
              product_type: productType,
              batch_size: batchSize,
              notes: notes,
              scheduled_date: scheduledDate || null,
              created_by: adminUser.user_id,
              status: 'planned',
            })
            .select()
            .single();
          
          if (woError) {
            errors.push(`Rule ${rule.name}: ${woError.message}`);
            continue;
          }
          
          // Create work order items with serial numbers
          const items = [];
          const serialPrefix = productType === 'SENSOR' ? 'Q' : 
                              productType === 'MLA' ? 'W' :
                              productType === 'HMI' ? 'X' :
                              productType === 'TRANSMITTER' ? 'T' : 'S';
          
          for (let i = 0; i < batchSize; i++) {
            const serialNumber = `${serialPrefix}-${Date.now()}-${String(i + 1).padStart(3, '0')}`;
            items.push({
              work_order_id: wo.id,
              serial_number: serialNumber,
              position_in_batch: i + 1,
              status: 'planned',
              current_step: 1,
            });
          }
          
          const { error: itemsError } = await supabase
            .from('work_order_items')
            .insert(items);
          
          if (itemsError) {
            errors.push(`Rule ${rule.name}: Failed to create items - ${itemsError.message}`);
          }
          
          executed.push({ rule: rule.name, action: 'create_work_order', result: { work_order_id: wo.id, wo_number: woNumber } });
          break;
        }
        
        case 'update_work_order_status': {
          const woNumber = getValueByPath(payload, mappings.wo_number);
          const newStatus = getValueByPath(payload, mappings.status);
          
          if (!woNumber || !newStatus) {
            errors.push(`Rule ${rule.name}: Missing wo_number or status in payload`);
            continue;
          }
          
          const { error } = await supabase
            .from('work_orders')
            .update({ status: newStatus })
            .eq('wo_number', woNumber);
          
          if (error) {
            errors.push(`Rule ${rule.name}: ${error.message}`);
          } else {
            executed.push({ rule: rule.name, action: 'update_work_order_status', result: { wo_number: woNumber, status: newStatus } });
          }
          break;
        }
        
        case 'update_item_status': {
          const serialNumber = getValueByPath(payload, mappings.serial_number);
          const newStatus = getValueByPath(payload, mappings.status);
          const newStep = getValueByPath(payload, mappings.current_step);
          
          if (!serialNumber) {
            errors.push(`Rule ${rule.name}: Missing serial_number in payload`);
            continue;
          }
          
          const updates: any = {};
          if (newStatus) updates.status = newStatus;
          if (newStep) updates.current_step = parseInt(newStep);
          
          if (Object.keys(updates).length === 0) {
            errors.push(`Rule ${rule.name}: No updates specified`);
            continue;
          }
          
          const { error } = await supabase
            .from('work_order_items')
            .update(updates)
            .eq('serial_number', serialNumber);
          
          if (error) {
            errors.push(`Rule ${rule.name}: ${error.message}`);
          } else {
            executed.push({ rule: rule.name, action: 'update_item_status', result: { serial_number: serialNumber, updates } });
          }
          break;
        }
        
        case 'log_activity': {
          const action = getValueByPath(payload, mappings.action) || 'webhook_triggered';
          const entityType = getValueByPath(payload, mappings.entity_type) || 'webhook';
          const entityId = getValueByPath(payload, mappings.entity_id) || webhookId;
          const details = mappings.details_path ? getValueByPath(payload, mappings.details_path) : payload;
          
          const { error } = await supabase
            .from('activity_logs')
            .insert({
              action,
              entity_type: entityType,
              entity_id: entityId,
              details: details,
            });
          
          if (error) {
            errors.push(`Rule ${rule.name}: ${error.message}`);
          } else {
            executed.push({ rule: rule.name, action: 'log_activity', result: { action, entity_type: entityType } });
          }
          break;
        }
        
        case 'trigger_outgoing_webhook': {
          const webhookUrl = mappings.webhook_url;
          if (!webhookUrl) {
            errors.push(`Rule ${rule.name}: No webhook_url configured`);
            continue;
          }
          
          try {
            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            
            executed.push({ rule: rule.name, action: 'trigger_outgoing_webhook', result: { url: webhookUrl, status: response.status } });
          } catch (fetchError: any) {
            errors.push(`Rule ${rule.name}: Failed to call webhook - ${fetchError.message}`);
          }
          break;
        }
      }
    } catch (ruleError: any) {
      errors.push(`Rule ${rule.name}: ${ruleError.message}`);
    }
  }
  
  return { executed, errors };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected path: /webhook-receiver/{endpoint_key}
    const endpointKey = pathParts[pathParts.length - 1];
    
    if (!endpointKey || endpointKey === 'webhook-receiver') {
      console.log('No endpoint key provided');
      return new Response(
        JSON.stringify({ error: 'Endpoint key required. Use: /webhook-receiver/{your-endpoint-key}' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing webhook for endpoint: ${endpointKey}`);
    
    // Initialize Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Find the webhook endpoint
    const { data: webhook, error: webhookError } = await supabase
      .from('incoming_webhooks')
      .select('*')
      .eq('endpoint_key', endpointKey)
      .single();
    
    if (webhookError || !webhook) {
      console.log(`Webhook not found: ${endpointKey}`);
      return new Response(
        JSON.stringify({ error: 'Webhook endpoint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!webhook.enabled) {
      console.log(`Webhook disabled: ${endpointKey}`);
      return new Response(
        JSON.stringify({ error: 'Webhook endpoint is disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate secret key
    const providedSecret = req.headers.get('x-webhook-secret');
    if (providedSecret !== webhook.secret_key) {
      console.log(`Invalid secret for webhook: ${endpointKey}`);
      
      // Log failed attempt
      await supabase.from('webhook_logs').insert({
        incoming_webhook_id: webhook.id,
        request_headers: Object.fromEntries(req.headers.entries()),
        response_status: 401,
        error_message: 'Invalid secret key',
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid secret key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    let payload: any = {};
    try {
      const text = await req.text();
      if (text) {
        payload = JSON.parse(text);
      }
    } catch (parseError) {
      console.log('Failed to parse request body');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Webhook payload received:`, JSON.stringify(payload).slice(0, 500));
    
    // Fetch automation rules for this webhook
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('incoming_webhook_id', webhook.id)
      .eq('enabled', true)
      .order('sort_order', { ascending: true });
    
    if (rulesError) {
      console.error('Failed to fetch rules:', rulesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch automation rules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Execute rules
    const { executed, errors } = await executeRules(supabase, rules || [], payload, webhook.id);
    
    console.log(`Executed ${executed.length} rules, ${errors.length} errors`);
    
    // Update webhook stats
    await supabase
      .from('incoming_webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: webhook.trigger_count + 1,
      })
      .eq('id', webhook.id);
    
    // Log the execution
    await supabase.from('webhook_logs').insert({
      incoming_webhook_id: webhook.id,
      request_body: payload,
      request_headers: Object.fromEntries(req.headers.entries()),
      response_status: errors.length > 0 ? 207 : 200,
      response_body: { executed, errors },
      executed_rules: executed,
      error_message: errors.length > 0 ? errors.join('; ') : null,
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        executed: executed.length,
        errors: errors.length,
        details: { executed, errors },
      }),
      { 
        status: errors.length > 0 ? 207 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('Webhook receiver error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
