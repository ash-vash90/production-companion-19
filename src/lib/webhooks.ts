import { supabase } from '@/integrations/supabase/client';
import { isValidWebhookUrl } from '@/lib/validation';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookConfig {
  id: string;
  name: string;
  webhook_url: string;
}

/**
 * Send a single webhook with retry logic
 */
async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  maxAttempts = 3
): Promise<{ success: boolean; error?: string }> {
  // Validate webhook URL to prevent SSRF attacks
  const urlValidation = isValidWebhookUrl(webhook.webhook_url);
  if (!urlValidation.valid) {
    console.error(`Webhook ${webhook.name} blocked: ${urlValidation.error}`);
    return { success: false, error: urlValidation.error };
  }

  const payloadString = JSON.stringify(payload);

  // Retry with exponential backoff: 2s, 4s, 8s
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
      };

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Check if response is successful
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`Webhook ${webhook.name} sent successfully`);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      console.error(
        `Webhook ${webhook.name} attempt ${attempt}/${maxAttempts} failed:`,
        errorMessage
      );

      // If this was the last attempt, return failure
      if (attempt === maxAttempts) {
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
      .select('id, name, webhook_url')
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