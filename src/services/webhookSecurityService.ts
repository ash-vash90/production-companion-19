/**
 * Webhook Security Service
 *
 * Provides security hardening for webhooks:
 * - HMAC-SHA256 signature verification
 * - Rate limiting
 * - Idempotency key support
 * - IP allowlisting
 * - Request validation
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// HMAC SIGNATURE VERIFICATION
// ============================================

/**
 * Generate HMAC-SHA256 signature for a payload
 */
export async function generateWebhookSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `sha256=${hashHex}`;
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await generateWebhookSignature(payload, secret);

  // Timing-safe comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
};

// In-memory rate limit store (for client-side, use server-side for production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every minute
if (typeof window !== 'undefined') {
  setInterval(cleanupRateLimitStore, 60000);
}

// ============================================
// IDEMPOTENCY
// ============================================

const idempotencyCache = new Map<string, { response: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if request with idempotency key was already processed
 */
export function checkIdempotency(
  idempotencyKey: string
): { isDuplicate: boolean; cachedResponse?: unknown } {
  const cached = idempotencyCache.get(idempotencyKey);

  if (cached && Date.now() < cached.expiresAt) {
    return { isDuplicate: true, cachedResponse: cached.response };
  }

  return { isDuplicate: false };
}

/**
 * Store idempotency result
 */
export function storeIdempotencyResult(
  idempotencyKey: string,
  response: unknown
): void {
  idempotencyCache.set(idempotencyKey, {
    response,
    expiresAt: Date.now() + IDEMPOTENCY_TTL,
  });
}

/**
 * Clean up expired idempotency entries
 */
export function cleanupIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now > entry.expiresAt) {
      idempotencyCache.delete(key);
    }
  }
}

// Clean up every hour
if (typeof window !== 'undefined') {
  setInterval(cleanupIdempotencyCache, 60 * 60 * 1000);
}

// ============================================
// IP ALLOWLISTING
// ============================================

/**
 * Check if IP is in allowlist
 */
export function isIpAllowed(
  ip: string,
  allowlist: string[] | null
): boolean {
  // If no allowlist, allow all
  if (!allowlist || allowlist.length === 0) {
    return true;
  }

  // Check exact match or CIDR range
  for (const allowed of allowlist) {
    if (allowed === ip) {
      return true;
    }

    // Simple CIDR check for /24 ranges
    if (allowed.endsWith('/24')) {
      const prefix = allowed.slice(0, -3);
      const ipPrefix = ip.split('.').slice(0, 3).join('.');
      const allowedPrefix = prefix.split('.').slice(0, 3).join('.');
      if (ipPrefix === allowedPrefix) {
        return true;
      }
    }
  }

  return false;
}

// ============================================
// PAYLOAD VALIDATION
// ============================================

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

/**
 * Validate webhook payload
 */
export function validatePayload(
  payload: unknown,
  maxSize: number = MAX_PAYLOAD_SIZE
): { valid: boolean; error?: string } {
  if (payload === null || payload === undefined) {
    return { valid: false, error: 'Payload is required' };
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  if (payloadString.length > maxSize) {
    return { valid: false, error: `Payload exceeds maximum size of ${maxSize} bytes` };
  }

  try {
    if (typeof payload === 'string') {
      JSON.parse(payload);
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid JSON payload' };
  }
}

// ============================================
// WEBHOOK HEALTH MONITORING
// ============================================

interface WebhookHealthStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  averageResponseTime: number;
  consecutiveFailures: number;
}

const webhookHealthStore = new Map<string, WebhookHealthStats>();

const FAILURE_THRESHOLD = 5; // Auto-disable after 5 consecutive failures
const HEALTH_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Record webhook call result
 */
export async function recordWebhookCall(
  webhookId: string,
  success: boolean,
  responseTimeMs: number
): Promise<{ shouldDisable: boolean }> {
  let stats = webhookHealthStore.get(webhookId);

  if (!stats) {
    stats = {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      lastSuccess: null,
      lastFailure: null,
      averageResponseTime: 0,
      consecutiveFailures: 0,
    };
  }

  stats.totalCalls++;

  if (success) {
    stats.successCount++;
    stats.lastSuccess = new Date();
    stats.consecutiveFailures = 0;
    // Update average response time
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.successCount - 1) + responseTimeMs) / stats.successCount;
  } else {
    stats.failureCount++;
    stats.lastFailure = new Date();
    stats.consecutiveFailures++;
  }

  webhookHealthStore.set(webhookId, stats);

  // Check if webhook should be auto-disabled
  const shouldDisable = stats.consecutiveFailures >= FAILURE_THRESHOLD;

  if (shouldDisable) {
    // Log warning
    console.warn(
      `Webhook ${webhookId} has ${stats.consecutiveFailures} consecutive failures. Consider disabling.`
    );
  }

  return { shouldDisable };
}

/**
 * Get webhook health statistics
 */
export function getWebhookHealth(webhookId: string): WebhookHealthStats | null {
  return webhookHealthStore.get(webhookId) || null;
}

/**
 * Calculate webhook health score (0-100)
 */
export function calculateHealthScore(webhookId: string): number {
  const stats = webhookHealthStore.get(webhookId);

  if (!stats || stats.totalCalls === 0) {
    return 100; // No data, assume healthy
  }

  const successRate = stats.successCount / stats.totalCalls;
  const consecutiveFailurePenalty = Math.min(stats.consecutiveFailures * 10, 50);

  return Math.max(0, Math.round(successRate * 100 - consecutiveFailurePenalty));
}

/**
 * Reset webhook health stats (after manual fix)
 */
export function resetWebhookHealth(webhookId: string): void {
  webhookHealthStore.delete(webhookId);
}

// ============================================
// WEBHOOK EVENT TYPES
// ============================================

export const WEBHOOK_EVENT_TYPES = {
  // Work Order Events
  WORK_ORDER_CREATED: 'work_order_created',
  WORK_ORDER_STARTED: 'work_order_started',
  WORK_ORDER_COMPLETED: 'work_order_completed',
  WORK_ORDER_CANCELLED: 'work_order_cancelled',
  WORK_ORDER_ON_HOLD: 'work_order_on_hold',

  // Production Events
  PRODUCTION_STEP_STARTED: 'production_step_started',
  PRODUCTION_STEP_COMPLETED: 'production_step_completed',
  QUALITY_CHECK_PASSED: 'quality_check_passed',
  QUALITY_CHECK_FAILED: 'quality_check_failed',

  // Material Events
  MATERIAL_BATCH_SCANNED: 'material_batch_scanned',
  LOW_STOCK_ALERT: 'low_stock_alert',
  STOCK_RECEIVED: 'stock_received',
  STOCK_CONSUMED: 'stock_consumed',

  // Item Events
  ITEM_COMPLETED: 'item_completed',
  ITEM_FAILED: 'item_failed',
  SERIAL_NUMBER_ASSIGNED: 'serial_number_assigned',

  // Certificate Events
  CERTIFICATE_GENERATED: 'certificate_generated',
  CERTIFICATE_SIGNED: 'certificate_signed',

  // System Events
  OPERATOR_ASSIGNED: 'operator_assigned',
  SHIFT_STARTED: 'shift_started',
  SHIFT_ENDED: 'shift_ended',
} as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[keyof typeof WEBHOOK_EVENT_TYPES];

/**
 * Get event type metadata
 */
export function getEventTypeMetadata(eventType: WebhookEventType): {
  label: string;
  description: string;
  category: string;
} {
  const metadata: Record<WebhookEventType, { label: string; description: string; category: string }> = {
    work_order_created: {
      label: 'Work Order Created',
      description: 'Fired when a new work order is created',
      category: 'Work Orders',
    },
    work_order_started: {
      label: 'Work Order Started',
      description: 'Fired when production begins on a work order',
      category: 'Work Orders',
    },
    work_order_completed: {
      label: 'Work Order Completed',
      description: 'Fired when all items in a work order are completed',
      category: 'Work Orders',
    },
    work_order_cancelled: {
      label: 'Work Order Cancelled',
      description: 'Fired when a work order is cancelled',
      category: 'Work Orders',
    },
    work_order_on_hold: {
      label: 'Work Order On Hold',
      description: 'Fired when a work order is put on hold',
      category: 'Work Orders',
    },
    production_step_started: {
      label: 'Production Step Started',
      description: 'Fired when an operator starts a production step',
      category: 'Production',
    },
    production_step_completed: {
      label: 'Production Step Completed',
      description: 'Fired when a production step is marked complete',
      category: 'Production',
    },
    quality_check_passed: {
      label: 'Quality Check Passed',
      description: 'Fired when a quality check passes',
      category: 'Production',
    },
    quality_check_failed: {
      label: 'Quality Check Failed',
      description: 'Fired when a quality check fails',
      category: 'Production',
    },
    material_batch_scanned: {
      label: 'Material Batch Scanned',
      description: 'Fired when a material batch is scanned during production',
      category: 'Materials',
    },
    low_stock_alert: {
      label: 'Low Stock Alert',
      description: 'Fired when inventory drops below reorder point',
      category: 'Materials',
    },
    stock_received: {
      label: 'Stock Received',
      description: 'Fired when inventory is received',
      category: 'Materials',
    },
    stock_consumed: {
      label: 'Stock Consumed',
      description: 'Fired when inventory is consumed',
      category: 'Materials',
    },
    item_completed: {
      label: 'Item Completed',
      description: 'Fired when a work order item is completed',
      category: 'Items',
    },
    item_failed: {
      label: 'Item Failed',
      description: 'Fired when an item fails production',
      category: 'Items',
    },
    serial_number_assigned: {
      label: 'Serial Number Assigned',
      description: 'Fired when a serial number is assigned to an item',
      category: 'Items',
    },
    certificate_generated: {
      label: 'Certificate Generated',
      description: 'Fired when a quality certificate is generated',
      category: 'Certificates',
    },
    certificate_signed: {
      label: 'Certificate Signed',
      description: 'Fired when a certificate is digitally signed',
      category: 'Certificates',
    },
    operator_assigned: {
      label: 'Operator Assigned',
      description: 'Fired when an operator is assigned to a work order',
      category: 'System',
    },
    shift_started: {
      label: 'Shift Started',
      description: 'Fired when an operator starts their shift',
      category: 'System',
    },
    shift_ended: {
      label: 'Shift Ended',
      description: 'Fired when an operator ends their shift',
      category: 'System',
    },
  };

  return metadata[eventType] || { label: eventType, description: '', category: 'Other' };
}

/**
 * Get all event types grouped by category
 */
export function getEventTypesByCategory(): Record<string, WebhookEventType[]> {
  const categories: Record<string, WebhookEventType[]> = {};

  for (const eventType of Object.values(WEBHOOK_EVENT_TYPES)) {
    const { category } = getEventTypeMetadata(eventType);
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(eventType);
  }

  return categories;
}
