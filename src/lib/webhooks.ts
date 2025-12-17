import { supabase } from '@/integrations/supabase/client';
import { isValidWebhookUrl } from '@/lib/validation';
import {
  recordWebhookCall,
  checkIdempotency,
  storeIdempotencyResult,
  calculateHealthScore,
} from '@/services/webhookSecurityService';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  idempotency_key?: string;
  delivery_id?: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  webhook_url: string;
  secret_key?: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
  retry_count?: number;
}

interface WebhookResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  responseTimeMs?: number;
  webhookId?: string;
}

// Dead letter queue for failed webhooks
interface DeadLetterEntry {
  id: string;
  webhookId: string;
  webhookName: string;
  webhookUrl: string;
  payload: WebhookPayload;
  error: string;
  attempts: number;
  created_at: string;
  last_attempt_at: string;
}

const deadLetterQueue: DeadLetterEntry[] = [];
const MAX_DEAD_LETTER_SIZE = 1000;

/**
 * Generate a unique delivery ID for tracking
 */
function generateDeliveryId(): string {
  return `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add failed webhook to dead letter queue
 */
function addToDeadLetterQueue(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  error: string,
  attempts: number
): void {
  // Remove oldest entries if queue is full
  while (deadLetterQueue.length >= MAX_DEAD_LETTER_SIZE) {
    deadLetterQueue.shift();
  }

  deadLetterQueue.push({
    id: generateDeliveryId(),
    webhookId: webhook.id,
    webhookName: webhook.name,
    webhookUrl: webhook.webhook_url,
    payload,
    error,
    attempts,
    created_at: new Date().toISOString(),
    last_attempt_at: new Date().toISOString(),
  });
}

/**
 * Get dead letter queue entries
 */
export function getDeadLetterQueue(): DeadLetterEntry[] {
  return [...deadLetterQueue];
}

/**
 * Clear dead letter queue
 */
export function clearDeadLetterQueue(): void {
  deadLetterQueue.length = 0;
}

/**
 * Retry a dead letter entry
 */
export async function retryDeadLetterEntry(entryId: string): Promise<WebhookResult> {
  const entryIndex = deadLetterQueue.findIndex(e => e.id === entryId);
  if (entryIndex === -1) {
    return { success: false, error: 'Entry not found' };
  }

  const entry = deadLetterQueue[entryIndex];
  const webhook: WebhookConfig = {
    id: entry.webhookId,
    name: entry.webhookName,
    webhook_url: entry.webhookUrl,
  };

  const result = await sendWebhookWithRetry(webhook, entry.payload, 1);

  if (result.success) {
    // Remove from dead letter queue on success
    deadLetterQueue.splice(entryIndex, 1);
  } else {
    // Update attempt count
    entry.attempts++;
    entry.last_attempt_at = new Date().toISOString();
    entry.error = result.error || 'Unknown error';
  }

  return result;
}

/**
 * Send a single webhook via the edge function (server-side to avoid CORS)
 */
async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  maxAttempts: number = 3
): Promise<WebhookResult> {
  // Validate webhook URL client-side first
  const urlValidation = isValidWebhookUrl(webhook.webhook_url);
  if (!urlValidation.valid) {
    console.error(`Webhook ${webhook.name} blocked: ${urlValidation.error}`);
    return { success: false, error: urlValidation.error, webhookId: webhook.id };
  }

  // Check webhook health score - skip if too unhealthy
  const healthScore = calculateHealthScore(webhook.id);
  if (healthScore < 20) {
    console.warn(`Webhook ${webhook.name} skipped due to low health score (${healthScore})`);
    return {
      success: false,
      error: `Webhook disabled due to low health score (${healthScore}/100)`,
      webhookId: webhook.id,
    };
  }

  const startTime = Date.now();

  try {
    // Call the edge function to send the webhook server-side
    const { data, error } = await supabase.functions.invoke('send-outgoing-webhook', {
      body: {
        webhook_id: webhook.id,
        webhook_name: webhook.name,
        webhook_url: webhook.webhook_url,
        secret_key: webhook.secret_key,
        payload,
        timeout_ms: webhook.timeout_ms || 10000,
        max_attempts: maxAttempts,
        headers: webhook.headers,
      },
    });

    const responseTimeMs = Date.now() - startTime;

    if (error) {
      console.error(`Webhook ${webhook.name} edge function error:`, error);
      await recordWebhookCall(webhook.id, false, responseTimeMs);
      addToDeadLetterQueue(webhook, payload, error.message || 'Edge function error', maxAttempts);
      return {
        success: false,
        error: error.message || 'Edge function error',
        responseTimeMs,
        webhookId: webhook.id,
      };
    }

    if (data?.success) {
      await recordWebhookCall(webhook.id, true, data.response_time_ms || responseTimeMs);
      console.log(`Webhook ${webhook.name} sent successfully in ${data.response_time_ms || responseTimeMs}ms`);
      return {
        success: true,
        statusCode: data.status_code,
        responseTimeMs: data.response_time_ms || responseTimeMs,
        webhookId: webhook.id,
      };
    } else {
      const errorMsg = data?.error || 'Unknown error';
      await recordWebhookCall(webhook.id, false, responseTimeMs);
      addToDeadLetterQueue(webhook, payload, errorMsg, maxAttempts);
      return {
        success: false,
        error: errorMsg,
        responseTimeMs,
        webhookId: webhook.id,
      };
    }
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    console.error(`Webhook ${webhook.name} failed:`, errorMessage);
    await recordWebhookCall(webhook.id, false, responseTimeMs);
    addToDeadLetterQueue(webhook, payload, errorMessage, maxAttempts);
    
    return {
      success: false,
      error: errorMessage,
      responseTimeMs,
      webhookId: webhook.id,
    };
  }
}

/**
 * Trigger webhooks for a specific event type
 *
 * @param eventType - The event type (e.g., 'work_order_created', 'quality_check_passed')
 * @param payload - The data to send with the webhook
 * @param options - Additional options
 */
export async function triggerWebhook(
  eventType: string,
  payload: Record<string, unknown>,
  options?: {
    idempotencyKey?: string;
    priority?: 'high' | 'normal' | 'low';
  }
): Promise<{ sent: number; failed: number; results: WebhookResult[] }> {
  const results: WebhookResult[] = [];

  try {
    // Check idempotency if key provided
    if (options?.idempotencyKey) {
      const { isDuplicate, cachedResponse } = checkIdempotency(options.idempotencyKey);
      if (isDuplicate) {
        console.log(`Webhook trigger skipped - duplicate idempotency key: ${options.idempotencyKey}`);
        return cachedResponse as { sent: number; failed: number; results: WebhookResult[] };
      }
    }

    // Fetch active webhooks for this event type (including secret for signing)
    const { data: webhooks, error } = await supabase
      .from('zapier_webhooks')
      .select('id, name, webhook_url, secret_key')
      .eq('event_type', eventType)
      .eq('enabled', true) as { data: Array<{ id: string; name: string; webhook_url: string; secret_key: string | null }> | null; error: any };

    if (error) {
      console.error('Failed to fetch webhooks:', error);
      return { sent: 0, failed: 0, results: [] };
    }

    if (!webhooks || webhooks.length === 0) {
      console.log(`No active webhooks found for event type: ${eventType}`);
      return { sent: 0, failed: 0, results: [] };
    }

    const webhookPayload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
      idempotency_key: options?.idempotencyKey,
    };

    // Send all webhooks in parallel
    const sendResults = await Promise.allSettled(
      webhooks.map((webhook) =>
        sendWebhookWithRetry({ ...webhook, secret_key: webhook.secret_key || undefined }, webhookPayload)
      )
    );

    // Process results
    for (const result of sendResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ success: false, error: result.reason?.message || 'Unknown error' });
      }
    }

    // Log results
    const sent = results.filter(r => r.success).length;
    const failed = results.length - sent;

    console.log(
      `Webhook trigger complete for ${eventType}: ${sent} succeeded, ${failed} failed`
    );

    const response = { sent, failed, results };

    // Store idempotency result
    if (options?.idempotencyKey) {
      storeIdempotencyResult(options.idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    return { sent: 0, failed: 0, results: [] };
  }
}

/**
 * Send a test webhook to verify endpoint (generic URL-only test)
 */
export async function sendTestWebhook(
  webhookUrl: string,
  secretKey?: string
): Promise<WebhookResult> {
  const testPayload: WebhookPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from Rhosonics PMS',
      test_id: generateDeliveryId(),
    },
  };

  const webhook: WebhookConfig = {
    id: 'test',
    name: 'Test Webhook',
    webhook_url: webhookUrl,
    secret_key: secretKey,
  };

  return sendWebhookWithRetry(webhook, testPayload, 1);
}

export interface OutgoingWebhookTestConfig {
  id: string;
  name: string;
  webhook_url: string;
  secret_key?: string;
}

/**
 * Send a test webhook and attribute it to a specific saved webhook (so logs + UI match).
 */
export async function sendTestWebhookForConfig(
  webhook: OutgoingWebhookTestConfig
): Promise<WebhookResult> {
  const testPayload: WebhookPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from Rhosonics PMS',
      test_id: generateDeliveryId(),
    },
  };

  return sendWebhookWithRetry(
    {
      id: webhook.id,
      name: webhook.name,
      webhook_url: webhook.webhook_url,
      secret_key: webhook.secret_key,
    },
    testPayload,
    1
  );
}

/**
 * Get webhook delivery statistics
 */
export function getWebhookStats(): {
  deadLetterCount: number;
  recentDeadLetters: DeadLetterEntry[];
} {
  return {
    deadLetterCount: deadLetterQueue.length,
    recentDeadLetters: deadLetterQueue.slice(-10),
  };
}
