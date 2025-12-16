import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Global registry to track active channels and their reference counts
const channelRegistry = new Map<string, { channel: RealtimeChannel; refCount: number }>();

interface ChannelConfig {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

/**
 * Centralized hook for Supabase realtime channel management.
 * Prevents duplicate subscriptions and ensures proper cleanup.
 */
export function useSupabaseChannel(
  channelName: string,
  config: ChannelConfig,
  onPayload: (payload: any) => void,
  enabled: boolean = true
) {
  const callbackRef = useRef(onPayload);
  
  // Keep callback ref updated without causing re-subscriptions
  useEffect(() => {
    callbackRef.current = onPayload;
  }, [onPayload]);

  useEffect(() => {
    if (!enabled) return;

    const uniqueKey = `${channelName}-${config.table}-${config.event || '*'}`;
    let entry = channelRegistry.get(uniqueKey);

    if (entry) {
      // Channel already exists, increment ref count
      entry.refCount++;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useSupabaseChannel] Reusing channel ${uniqueKey}, refCount: ${entry.refCount}`);
      }
    } else {
      // Create new channel
      const channel = supabase
        .channel(uniqueKey)
        .on(
          'postgres_changes' as any,
          {
            event: config.event || '*',
            schema: config.schema || 'public',
            table: config.table,
            filter: config.filter,
          } as any,
          (payload: any) => {
            callbackRef.current(payload);
          }
        )
        .subscribe((status) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[useSupabaseChannel] ${uniqueKey} status: ${status}`);
          }
        });

      entry = { channel, refCount: 1 };
      channelRegistry.set(uniqueKey, entry);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useSupabaseChannel] Created channel ${uniqueKey}`);
      }
    }

    return () => {
      const currentEntry = channelRegistry.get(uniqueKey);
      if (currentEntry) {
        currentEntry.refCount--;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[useSupabaseChannel] Decrementing ${uniqueKey}, refCount: ${currentEntry.refCount}`);
        }
        
        if (currentEntry.refCount <= 0) {
          // No more subscribers, clean up the channel
          supabase.removeChannel(currentEntry.channel);
          channelRegistry.delete(uniqueKey);
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[useSupabaseChannel] Removed channel ${uniqueKey}`);
          }
        }
      }
    };
  }, [channelName, config.table, config.schema, config.event, config.filter, enabled]);
}

/**
 * Get the current count of active channels (for debugging)
 */
export function getActiveChannelCount(): number {
  return channelRegistry.size;
}

/**
 * Force cleanup all channels (use sparingly, mainly for testing)
 */
export function cleanupAllChannels(): void {
  channelRegistry.forEach((entry, key) => {
    supabase.removeChannel(entry.channel);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useSupabaseChannel] Force cleaned up ${key}`);
    }
  });
  channelRegistry.clear();
}
