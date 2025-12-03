import { supabase } from '@/integrations/supabase/client';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookConfig {
  id: string;
  name: string;
  webhook_url: string;
  secret_key?: string;
}

/**
 * Generate HMAC signature for webhook authentication
 * Uses Web Crypto API (available in modern browsers)
 */
async function generateHMACSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `sha256=${hashHex}`;
}

/**
 * Send a single webhook with retry logic
 */
async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  maxAttempts = 3
): Promise<{ success: boolean; error?: string }> {
  const payloadString = JSON.stringify(payload);

  // Generate HMAC signature if secret key exists
  let signature: string | undefined;
  if (webhook.secret_key) {
    try {
      signature = await generateHMACSignature(payloadString, webhook.secret_key);
    } catch (err) {
      console.error(`Failed to generate HMAC signature for ${webhook.name}:`, err);
    }
  }

  // Retry with exponential backoff: 2s, 4s, 8s
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
      };

      // Add signature if available
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers,
        body: payloadString,
        // Remove 'no-cors' to properly catch errors
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Check if response is successful
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success! Update webhook stats
      await supabase
        .from('zapier_webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          last_error: null,
          success_count: supabase.sql`success_count + 1`,
        })
        .eq('id', webhook.id);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      console.error(
        `Webhook ${webhook.name} attempt ${attempt}/${maxAttempts} failed:`,
        errorMessage
      );

      // If this was the last attempt, log the failure
      if (attempt === maxAttempts) {
        await supabase
          .from('zapier_webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            last_error: errorMessage,
            failure_count: supabase.sql`failure_count + 1`,
          })
          .eq('id', webhook.id);

        return { success: false, error: errorMessage };
      }

      // Wait before retrying (exponential backoff: 2s, 4s, 8s)
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Trigger webhooks for a specific event type
 *
 * @param eventType - The event type (e.g., 'work_order_created', 'quality_check_passed')
 * @param payload - The data to send with the webhook
 */
export async function triggerWebhook(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Fetch active webhooks for this event type
    const { data: webhooks, error } = await supabase
      .from('zapier_webhooks')
      .select('id, name, webhook_url, secret_key')
      .eq('event_type', eventType)
      .eq('enabled', true);

    if (error) {
      console.error('Failed to fetch webhooks:', error);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log(`No active webhooks found for event type: ${eventType}`);
      return;
    }

    const webhookPayload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    // Send all webhooks in parallel
    const results = await Promise.allSettled(
      webhooks.map((webhook) =>
        sendWebhookWithRetry(webhook, webhookPayload)
      )
    );

    // Log results
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failureCount = results.length - successCount;

    console.log(
      `Webhook trigger complete for ${eventType}: ${successCount} succeeded, ${failureCount} failed`
    );
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}
