import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_COUNT = 3;

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  idempotency_key?: string;
  delivery_id?: string;
}

interface WebhookRequest {
  webhook_id: string;
  webhook_name: string;
  webhook_url: string;
  secret_key?: string;
  payload: WebhookPayload;
  timeout_ms?: number;
  max_attempts?: number;
  headers?: Record<string, string>;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate unique delivery ID
 */
function generateDeliveryId(): string {
  return `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate webhook URL for security (prevent SSRF)
 */
function isValidWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS protocols are allowed' };
    }
    
    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '10.',
      '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
      '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
      '192.168.',
      '169.254.',
    ];
    
    for (const pattern of blockedPatterns) {
      if (hostname === pattern || hostname.startsWith(pattern)) {
        return { valid: false, error: 'Private/localhost URLs are not allowed' };
      }
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Log webhook attempt to database
 */
async function logWebhookAttempt(
  supabase: any,
  webhookId: string,
  eventType: string,
  payload: WebhookPayload,
  responseStatus: number | null,
  responseBody: unknown | null,
  responseTimeMs: number,
  errorMessage: string | null,
  deliveryId: string,
  attempts: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('outgoing_webhook_logs')
      .insert({
        webhook_id: webhookId,
        event_type: eventType,
        payload,
        response_status: responseStatus,
        response_body: responseBody,
        response_time_ms: responseTimeMs,
        error_message: errorMessage,
        delivery_id: deliveryId,
        attempts,
      });
    
    if (error) {
      console.error('Failed to log webhook attempt:', error);
    }
  } catch (error) {
    console.error('Failed to log webhook attempt:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Manual auth (so CORS preflight can succeed even if platform JWT checks are disabled)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const request: WebhookRequest = await req.json();
    const { 
      webhook_id, 
      webhook_name, 
      webhook_url, 
      secret_key, 
      payload,
      timeout_ms = DEFAULT_TIMEOUT_MS,
      max_attempts = DEFAULT_RETRY_COUNT,
      headers: customHeaders = {}
    } = request;

    console.log(`Processing webhook: ${webhook_name} to ${webhook_url}`);

    // Validate URL
    const urlValidation = isValidWebhookUrl(webhook_url);
    if (!urlValidation.valid) {
      console.error(`Webhook URL validation failed: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: urlValidation.error,
          webhook_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Generate delivery ID
    const deliveryId = generateDeliveryId();
    const deliveryPayload: WebhookPayload = {
      ...payload,
      delivery_id: deliveryId,
    };
    const payloadString = JSON.stringify(deliveryPayload);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      'X-Webhook-Delivery': deliveryId,
      'User-Agent': 'Rhosonics-PMS-Webhook/1.0',
      ...customHeaders,
    };

    // Add HMAC signature if secret key provided
    if (secret_key) {
      const signature = await generateSignature(payloadString, secret_key);
      headers['X-Webhook-Signature'] = signature;
    }

    // Retry with exponential backoff
    let lastError: string = '';
    for (let attempt = 1; attempt <= max_attempts; attempt++) {
      const startTime = Date.now();

      try {
        console.log(`Attempt ${attempt}/${max_attempts} for webhook ${webhook_name}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

        const response = await fetch(webhook_url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTimeMs = Date.now() - startTime;

        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch {
          // Response might not be JSON
          try {
            responseBody = await response.text();
          } catch {
            // Ignore
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Log successful attempt
        await logWebhookAttempt(
          supabase,
          webhook_id,
          payload.event,
          deliveryPayload,
          response.status,
          responseBody,
          responseTimeMs,
          null,
          deliveryId,
          attempt
        );

        console.log(`Webhook ${webhook_name} sent successfully in ${responseTimeMs}ms`);

        return new Response(
          JSON.stringify({
            success: true,
            status_code: response.status,
            response_time_ms: responseTimeMs,
            webhook_id,
            delivery_id: deliveryId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (err) {
        const responseTimeMs = Date.now() - startTime;
        lastError = err instanceof Error ? err.message : 'Unknown error';
        
        console.error(`Webhook attempt ${attempt}/${max_attempts} failed: ${lastError}`);

        // If last attempt, log the failure
        if (attempt === max_attempts) {
          await logWebhookAttempt(
            supabase,
            webhook_id,
            payload.event,
            deliveryPayload,
            null,
            null,
            responseTimeMs,
            lastError,
            deliveryId,
            attempt
          );
        } else {
          // Wait before retry (exponential backoff: 2s, 4s, 8s)
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All attempts failed
    return new Response(
      JSON.stringify({
        success: false,
        error: lastError,
        webhook_id,
        delivery_id: deliveryId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
