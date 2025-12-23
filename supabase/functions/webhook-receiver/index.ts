import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

/**
 * Get value from nested JSON using dot notation path
 * Supports both natural field names (order.productType) and legacy JSON path ($.data.productType)
 */
function getValueByPath(obj: any, path: string): any {
  if (!path || path === '$') return obj;
  
  // Remove leading $. if present (legacy JSON path syntax)
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

/**
 * Map natural field names to database column names
 */
const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  create_work_order: {
    workOrderNumber: 'wo_number',
    productType: 'product_type',
    quantity: 'batch_size',
    customer: 'customer_name',
    externalReference: 'external_order_number',
    startDate: 'start_date',
    shippingDate: 'shipping_date',
    notes: 'notes',
  },
  update_work_order_status: {
    workOrderNumber: 'wo_number',
    status: 'status',
  },
  update_item_status: {
    serialNumber: 'serial_number',
    status: 'status',
    currentStep: 'current_step',
  },
  log_activity: {
    action: 'action',
    entityType: 'entity_type',
    entityId: 'entity_id',
    details: 'details_path',
  },
  trigger_outgoing_webhook: {
    webhookUrl: 'webhook_url',
  },
  // Exact sync mappings
  sync_exact_work_order: {
    workOrderId: 'work_order_id',
    workOrderNumber: 'wo_number',
    exactShopOrderNumber: 'exact_shop_order_number',
    exactShopOrderLink: 'exact_shop_order_link',
    status: 'status',
    productionReadyDate: 'production_ready_date',
    materialsSummary: 'materials_summary',
    materialsIssuedStatus: 'materials_issued_status',
  },
  assign_batch_numbers: {
    workOrderId: 'work_order_id',
    batchAssignments: 'batch_assignments',
  },
  // Products sync from Exact
  sync_products: {
    products: 'products',
  },
};

/**
 * Get the database key for a field, supporting both natural and legacy field names
 */
function getDbKey(actionType: string, fieldKey: string): string {
  const mapping = FIELD_MAPPINGS[actionType];
  if (mapping && mapping[fieldKey]) {
    return mapping[fieldKey];
  }
  // If not found in mapping, assume it's already a DB key (legacy)
  return fieldKey;
}

/**
 * Execute automation rules
 */
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
      const actionType = rule.action_type;
      
      // Helper to get value with natural field name support
      const getValue = (naturalKey: string, legacyKey?: string): any => {
        // First try natural key
        if (mappings[naturalKey]) {
          return getValueByPath(payload, mappings[naturalKey]);
        }
        // Then try legacy key if provided
        if (legacyKey && mappings[legacyKey]) {
          return getValueByPath(payload, mappings[legacyKey]);
        }
        return undefined;
      };
      
      switch (actionType) {
        case 'create_work_order': {
          const woNumber = getValue('workOrderNumber', 'wo_number') || `WO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-3)}`;
          const productType = getValue('productType', 'product_type') || 'SDM_ECO';
          const batchSize = parseInt(getValue('quantity', 'batch_size')) || 1;
          const customerName = getValue('customer', 'customer_name') || null;
          const externalOrderNumber = getValue('externalReference', 'external_order_number') || null;
          const startDate = getValue('startDate', 'start_date') || null;
          const shippingDate = getValue('shippingDate', 'shipping_date') || null;
          const notes = getValue('notes') || '';
          
          // Get a system user for created_by (first admin)
          const { data: adminUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1)
            .single();
          
          if (!adminUser) {
            errors.push(`Rule "${rule.name}": No admin user found for work order creation`);
            continue;
          }
          
          console.log(`Creating work order: ${woNumber}, type: ${productType}, size: ${batchSize}`);
          
          // Create work order
          const { data: wo, error: woError } = await supabase
            .from('work_orders')
            .insert({
              wo_number: woNumber,
              product_type: productType,
              batch_size: batchSize,
              customer_name: customerName,
              external_order_number: externalOrderNumber,
              start_date: startDate,
              shipping_date: shippingDate,
              notes: notes,
              created_by: adminUser.user_id,
              status: 'planned',
            })
            .select()
            .single();
          
          if (woError) {
            errors.push(`Rule "${rule.name}": ${woError.message}`);
            continue;
          }
          
          // Create work order items with serial numbers
          const items = [];
          const serialPrefix = productType === 'SENSOR' ? 'Q' : 
                              productType === 'MLA' ? 'W' :
                              productType === 'HMI' ? 'X' :
                              productType === 'TRANSMITTER' ? 'T' : 'S';
          
          const timestamp = Date.now().toString().slice(-8);
          for (let i = 0; i < batchSize; i++) {
            const serialNumber = `${serialPrefix}-${timestamp}-${String(i + 1).padStart(3, '0')}`;
            items.push({
              work_order_id: wo.id,
              serial_number: serialNumber,
              position_in_batch: i + 1,
              product_type: productType,
              status: 'planned',
              current_step: 1,
            });
          }
          
          const { error: itemsError } = await supabase
            .from('work_order_items')
            .insert(items);
          
          if (itemsError) {
            errors.push(`Rule "${rule.name}": Failed to create items - ${itemsError.message}`);
          }
          
          executed.push({ 
            rule: rule.name, 
            action: 'create_work_order', 
            result: { 
              workOrderId: wo.id, 
              workOrderNumber: woNumber,
              itemCount: batchSize,
              productType: productType,
            } 
          });
          
          console.log(`Created work order ${woNumber} with ${batchSize} items`);
          break;
        }
        
        case 'update_work_order_status': {
          const woNumber = getValue('workOrderNumber', 'wo_number');
          const newStatus = getValue('status');
          
          if (!woNumber || !newStatus) {
            errors.push(`Rule "${rule.name}": Missing workOrderNumber or status in payload`);
            continue;
          }
          
          const { data: updated, error } = await supabase
            .from('work_orders')
            .update({ status: newStatus })
            .eq('wo_number', woNumber)
            .select('id')
            .single();
          
          if (error) {
            errors.push(`Rule "${rule.name}": ${error.message}`);
          } else {
            executed.push({ 
              rule: rule.name, 
              action: 'update_work_order_status', 
              result: { workOrderNumber: woNumber, status: newStatus } 
            });
            console.log(`Updated work order ${woNumber} status to ${newStatus}`);
          }
          break;
        }
        
        case 'update_item_status': {
          const serialNumber = getValue('serialNumber', 'serial_number');
          const newStatus = getValue('status');
          const newStep = getValue('currentStep', 'current_step');
          
          if (!serialNumber) {
            errors.push(`Rule "${rule.name}": Missing serialNumber in payload`);
            continue;
          }
          
          const updates: any = {};
          if (newStatus) updates.status = newStatus;
          if (newStep) updates.current_step = parseInt(newStep);
          
          if (Object.keys(updates).length === 0) {
            errors.push(`Rule "${rule.name}": No updates specified`);
            continue;
          }
          
          const { error } = await supabase
            .from('work_order_items')
            .update(updates)
            .eq('serial_number', serialNumber);
          
          if (error) {
            errors.push(`Rule "${rule.name}": ${error.message}`);
          } else {
            executed.push({ 
              rule: rule.name, 
              action: 'update_item_status', 
              result: { serialNumber, updates } 
            });
            console.log(`Updated item ${serialNumber}:`, updates);
          }
          break;
        }
        
        case 'log_activity': {
          const action = getValue('action') || 'webhook_triggered';
          const entityType = getValue('entityType', 'entity_type') || 'webhook';
          const entityId = getValue('entityId', 'entity_id') || webhookId;
          const detailsPath = getValue('details', 'details_path');
          const details = detailsPath ? getValueByPath(payload, detailsPath) : payload;
          
          const { error } = await supabase
            .from('activity_logs')
            .insert({
              action,
              entity_type: entityType,
              entity_id: entityId,
              details: details,
            });
          
          if (error) {
            errors.push(`Rule "${rule.name}": ${error.message}`);
          } else {
            executed.push({ 
              rule: rule.name, 
              action: 'log_activity', 
              result: { action, entityType } 
            });
            console.log(`Logged activity: ${action} on ${entityType}`);
          }
          break;
        }
        
        case 'trigger_outgoing_webhook': {
          const webhookUrl = getValue('webhookUrl', 'webhook_url');
          if (!webhookUrl) {
            errors.push(`Rule "${rule.name}": No webhookUrl configured`);
            continue;
          }
          
          // Retry logic with exponential backoff
          const maxRetries = 3;
          let lastError: string | null = null;
          let success = false;
          
          for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
              
              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Webhook-Attempt': attempt.toString(),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });
              
              clearTimeout(timeout);
              
              if (response.ok) {
                executed.push({ 
                  rule: rule.name, 
                  action: 'trigger_outgoing_webhook', 
                  result: { url: webhookUrl, status: response.status, attempts: attempt } 
                });
                console.log(`Forwarded to webhook: ${webhookUrl}, status: ${response.status}, attempts: ${attempt}`);
                success = true;
              } else {
                lastError = `HTTP ${response.status}: ${response.statusText}`;
                if (attempt < maxRetries) {
                  // Wait before retry: 1s, 2s, 4s
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                }
              }
            } catch (fetchError: any) {
              lastError = fetchError.message;
              console.error(`Webhook attempt ${attempt} failed:`, lastError);
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
              }
            }
          }
          
          if (!success) {
            errors.push(`Rule "${rule.name}": Failed after ${maxRetries} attempts - ${lastError}`);
          }
          break;
        }
        
        // Exact sync: Update work order with Exact shop order info
        case 'sync_exact_work_order': {
          // Can use either work_order_id or wo_number to find the work order
          const workOrderId = getValue('workOrderId', 'work_order_id');
          const woNumber = getValue('workOrderNumber', 'wo_number');
          const exactShopOrderNumber = getValue('exactShopOrderNumber', 'exact_shop_order_number');
          const exactShopOrderLink = getValue('exactShopOrderLink', 'exact_shop_order_link');
          const newStatus = getValue('status');
          const productionReadyDate = getValue('productionReadyDate', 'production_ready_date');
          const materialsSummary = getValue('materialsSummary', 'materials_summary');
          const materialsIssuedStatus = getValue('materialsIssuedStatus', 'materials_issued_status');
          
          if (!workOrderId && !woNumber) {
            errors.push(`Rule "${rule.name}": Missing workOrderId or workOrderNumber`);
            continue;
          }
          
          const updates: any = {
            sync_status: 'synced',
            last_sync_at: new Date().toISOString(),
            last_sync_error: null,
          };
          
          if (exactShopOrderNumber) updates.exact_shop_order_number = exactShopOrderNumber;
          if (exactShopOrderLink) updates.exact_shop_order_link = exactShopOrderLink;
          if (newStatus) updates.status = newStatus;
          if (productionReadyDate) updates.production_ready_date = productionReadyDate;
          if (materialsSummary) updates.materials_summary = materialsSummary;
          if (materialsIssuedStatus) updates.materials_issued_status = materialsIssuedStatus;
          
          let query = supabase.from('work_orders').update(updates);
          if (workOrderId) {
            query = query.eq('id', workOrderId);
          } else {
            query = query.eq('wo_number', woNumber);
          }
          
          const { data: updated, error } = await query.select('id, wo_number').single();
          
          if (error) {
            // Mark as sync failed
            const failQuery = supabase.from('work_orders').update({
              sync_status: 'sync_failed',
              last_sync_error: error.message,
              last_sync_at: new Date().toISOString(),
            });
            if (workOrderId) {
              await failQuery.eq('id', workOrderId);
            } else if (woNumber) {
              await failQuery.eq('wo_number', woNumber);
            }
            errors.push(`Rule "${rule.name}": ${error.message}`);
          } else {
            executed.push({ 
              rule: rule.name, 
              action: 'sync_exact_work_order', 
              result: { 
                workOrderId: updated.id,
                workOrderNumber: updated.wo_number,
                exactShopOrderNumber,
                syncStatus: 'synced',
              } 
            });
            console.log(`Synced work order ${updated.wo_number} with Exact: ${exactShopOrderNumber}`);
          }
          break;
        }
        
        // Exact sync: Assign batch numbers to work order items
        case 'assign_batch_numbers': {
          const workOrderId = getValue('workOrderId', 'work_order_id');
          const batchAssignments = getValue('batchAssignments', 'batch_assignments');
          
          if (!workOrderId) {
            errors.push(`Rule "${rule.name}": Missing workOrderId`);
            continue;
          }
          
          if (!batchAssignments || !Array.isArray(batchAssignments)) {
            errors.push(`Rule "${rule.name}": Invalid or missing batchAssignments array`);
            continue;
          }
          
          let successCount = 0;
          let failCount = 0;
          
          for (const assignment of batchAssignments) {
            // Assignment can identify item by serial_number or position_in_batch
            const { serial_number, position_in_batch, batch_number } = assignment;
            
            if (!batch_number) continue;
            
            let itemQuery = supabase
              .from('work_order_items')
              .update({ 
                batch_number, 
                batch_assigned_at: new Date().toISOString() 
              })
              .eq('work_order_id', workOrderId);
            
            if (serial_number) {
              itemQuery = itemQuery.eq('serial_number', serial_number);
            } else if (position_in_batch) {
              itemQuery = itemQuery.eq('position_in_batch', position_in_batch);
            } else {
              continue;
            }
            
            const { error: itemError } = await itemQuery;
            if (itemError) {
              failCount++;
              console.error(`Failed to assign batch to item:`, itemError);
            } else {
              successCount++;
            }
          }
          
          // Update materials issued status on work order
          if (successCount > 0) {
            const { data: items } = await supabase
              .from('work_order_items')
              .select('batch_number')
              .eq('work_order_id', workOrderId);
            
            const totalItems = items?.length || 0;
            const assignedItems = items?.filter((i: { batch_number: string | null }) => i.batch_number).length || 0;
            
            let issuedStatus = 'not_issued';
            if (assignedItems === totalItems && totalItems > 0) {
              issuedStatus = 'complete';
            } else if (assignedItems > 0) {
              issuedStatus = 'partial';
            }
            
            await supabase
              .from('work_orders')
              .update({ 
                materials_issued_status: issuedStatus,
                last_sync_at: new Date().toISOString(),
              })
              .eq('id', workOrderId);
          }
          
          executed.push({ 
            rule: rule.name, 
            action: 'assign_batch_numbers', 
            result: { 
              workOrderId,
              assigned: successCount,
              failed: failCount,
            } 
          });
          console.log(`Assigned ${successCount} batch numbers to work order ${workOrderId}`);
          break;
        }
        
        // Sync products from Exact
        case 'sync_products': {
          const products = getValue('products');
          
          if (!products || !Array.isArray(products)) {
            errors.push(`Rule "${rule.name}": Missing or invalid products array`);
            continue;
          }
          
          let upsertCount = 0;
          let failCount = 0;
          
          for (const product of products) {
            const { exact_item_id, item_code, name, name_nl, description, product_type, is_active } = product;
            
            if (!exact_item_id || !item_code || !name) {
              failCount++;
              continue;
            }
            
            const { error: upsertError } = await supabase
              .from('products')
              .upsert({
                exact_item_id,
                item_code,
                name,
                name_nl: name_nl || null,
                description: description || null,
                product_type: product_type || 'SDM_ECO',
                is_active: is_active !== false,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'exact_item_id' });
            
            if (upsertError) {
              failCount++;
              console.error(`Failed to upsert product ${item_code}:`, upsertError);
            } else {
              upsertCount++;
            }
          }
          
          executed.push({ 
            rule: rule.name, 
            action: 'sync_products', 
            result: { 
              synced: upsertCount,
              failed: failCount,
            } 
          });
          console.log(`Synced ${upsertCount} products from Exact`);
          break;
        }
      }
    } catch (ruleError: any) {
      errors.push(`Rule "${rule.name}": ${ruleError.message}`);
      console.error(`Error executing rule ${rule.name}:`, ruleError);
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
        JSON.stringify({ 
          error: 'Endpoint key required',
          usage: 'POST /webhook-receiver/{your-endpoint-key}',
          headers: { 'X-Webhook-Secret': 'your-secret-key' }
        }),
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
