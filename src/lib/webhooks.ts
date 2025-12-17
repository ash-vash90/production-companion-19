import { supabase } from '@/integrations/supabase/client';
import { isValidWebhookUrl } from '@/lib/validation';
import {
  generateWebhookSignature,
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
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_COUNT = 3;

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
 * Log outgoing webhook to database
 */
async function logOutgoingWebhook(
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
    // Use any type since the table might not be in generated types yet
    await supabase
      .from('outgoing_webhook_logs' as any)
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
  } catch (error) {
    // Log silently - don't fail webhook because of logging failure
    console.error('Failed to log outgoing webhook:', error);
  }
}

/**
 * Send a single webhook with retry logic, signature, and health tracking
 */
async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  maxAttempts: number = DEFAULT_RETRY_COUNT
): Promise<WebhookResult> {
  // Validate webhook URL to prevent SSRF attacks
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

  // Add delivery ID for tracking
  const deliveryId = generateDeliveryId();
  const deliveryPayload: WebhookPayload = {
    ...payload,
    delivery_id: deliveryId,
  };

  const payloadString = JSON.stringify(deliveryPayload);
  const timeoutMs = webhook.timeout_ms || DEFAULT_TIMEOUT_MS;

  // Retry with exponential backoff: 2s, 4s, 8s
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-Delivery': deliveryId,
        'User-Agent': 'Rhosonics-PMS-Webhook/1.0',
        ...(webhook.headers || {}),
      };

      // Add HMAC signature if secret key is available
      if (webhook.secret_key) {
        const signature = await generateWebhookSignature(payloadString, webhook.secret_key);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseTimeMs = Date.now() - startTime;
      let responseBody = null;
      
      try {
        responseBody = await response.json();
      } catch {
        // Response might not be JSON
      }

      // Check if response is successful
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Record successful call
      await recordWebhookCall(webhook.id, true, responseTimeMs);

      // Log to database
      await logOutgoingWebhook(
        webhook.id,
        payload.event,
        deliveryPayload,
        response.status,
        responseBody,
        responseTimeMs,
        null,
        deliveryId,
        attempt
      );

      console.log(`Webhook ${webhook.name} sent successfully in ${responseTimeMs}ms`);
      return {
        success: true,
        statusCode: response.status,
        responseTimeMs,
        webhookId: webhook.id,
      };
    } catch (err) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      console.error(
        `Webhook ${webhook.name} attempt ${attempt}/${maxAttempts} failed:`,
        errorMessage
      );

      // Record failed call
      await recordWebhookCall(webhook.id, false, responseTimeMs);

      // If this was the last attempt, add to dead letter queue and log
      if (attempt === maxAttempts) {
        addToDeadLetterQueue(webhook, payload, errorMessage, attempt);
        
        // Log failed webhook to database
        await logOutgoingWebhook(
          webhook.id,
          payload.event,
          deliveryPayload,
          null,
          null,
          responseTimeMs,
          errorMessage,
          deliveryId,
          attempt
        );

        return {
          success: false,
          error: errorMessage,
          responseTimeMs,
          webhookId: webhook.id,
        };
      }

      // Wait before retrying (exponential backoff: 2s, 4s, 8s)
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { success: false, error: 'Max retries exceeded', webhookId: webhook.id };
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

    // Fetch active webhooks for this event type
    const { data: webhooks, error } = await supabase
      .from('zapier_webhooks')
      .select('id, name, webhook_url')
      .eq('event_type', eventType)
      .eq('enabled', true);

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
        sendWebhookWithRetry(webhook, webhookPayload)
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
 * Send a test webhook to verify endpoint
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
