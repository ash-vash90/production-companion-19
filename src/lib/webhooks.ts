import { supabase } from '@/integrations/supabase/client';

export const triggerWebhook = async (eventType: string, payload: any) => {
  try {
    // Fetch active webhooks for this event type
    const { data: webhooks, error } = await supabase
      .from('zapier_webhooks')
      .select('*')
      .eq('event_type', eventType)
      .eq('enabled', true);

    if (error) throw error;

    // Trigger all matching webhooks
    const promises = (webhooks || []).map(webhook =>
      fetch(webhook.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      }).catch(err => console.error(`Webhook ${webhook.name} failed:`, err))
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
};
