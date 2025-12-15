import { z } from 'zod';

// Authentication validation schemas
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .max(255, { message: 'Email must be less than 255 characters' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .max(128, { message: 'Password must be less than 128 characters' }),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: 'Full name is required' })
    .max(100, { message: 'Full name must be less than 100 characters' }),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Invalid email address' })
    .max(255, { message: 'Email must be less than 255 characters' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(128, { message: 'Password must be less than 128 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
});

// Work order validation schema
export const workOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, { message: 'Customer name is required' })
    .max(255, { message: 'Customer name must be less than 255 characters' }),
  externalOrderNumber: z
    .string()
    .trim()
    .min(1, { message: 'Order number is required' })
    .max(100, { message: 'Order number must be less than 100 characters' }),
  orderValue: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Order value must be a positive number',
    }),
});

// Blocked TLDs for SSRF protection
const BLOCKED_TLDS = [
  '.internal',
  '.corp',
  '.home',
  '.lan',
  '.localdomain',
  '.intranet',
];

// Cloud metadata endpoints to block
const BLOCKED_HOSTNAMES = [
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254', // AWS/GCP/Azure metadata
  'fd00:ec2::254', // AWS IPv6 metadata
  'instance-data', // AWS instance data
  'kubernetes.default',
  'kubernetes.default.svc',
];

// Webhook URL validation - blocks private IPs, cloud metadata, and requires HTTPS
export function isValidWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Require HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Webhook URL must use HTTPS' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and local hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    ) {
      return { valid: false, error: 'Webhook URL cannot point to localhost' };
    }

    // Block internal TLDs
    for (const tld of BLOCKED_TLDS) {
      if (hostname.endsWith(tld)) {
        return { valid: false, error: `Webhook URL cannot use internal TLD (${tld})` };
      }
    }

    // Block known cloud metadata endpoints
    for (const blockedHost of BLOCKED_HOSTNAMES) {
      if (hostname === blockedHost || hostname.includes(blockedHost)) {
        return { valid: false, error: 'Webhook URL cannot point to cloud metadata endpoint' };
      }
    }

    // Block URLs with credentials
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'Webhook URL cannot contain credentials' };
    }

    // Block non-standard ports that might be internal services
    const port = parsed.port ? parseInt(parsed.port, 10) : 443;
    const blockedPorts = [22, 23, 25, 53, 110, 143, 445, 3306, 5432, 6379, 27017];
    if (blockedPorts.includes(port)) {
      return { valid: false, error: `Webhook URL cannot use port ${port}` };
    }

    // Block private IP ranges
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);

    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);

      // 10.x.x.x
      if (a === 10) {
        return { valid: false, error: 'Webhook URL cannot point to private IP range (10.x.x.x)' };
      }

      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) {
        return { valid: false, error: 'Webhook URL cannot point to private IP range (172.16-31.x.x)' };
      }

      // 192.168.x.x
      if (a === 192 && b === 168) {
        return { valid: false, error: 'Webhook URL cannot point to private IP range (192.168.x.x)' };
      }

      // 169.254.x.x (link-local / cloud metadata)
      if (a === 169 && b === 254) {
        return { valid: false, error: 'Webhook URL cannot point to link-local/metadata IP range' };
      }

      // 127.x.x.x (loopback)
      if (a === 127) {
        return { valid: false, error: 'Webhook URL cannot point to loopback address' };
      }

      // 0.x.x.x (current network)
      if (a === 0) {
        return { valid: false, error: 'Webhook URL cannot point to current network address' };
      }

      // 100.64.x.x - 100.127.x.x (Carrier-grade NAT)
      if (a === 100 && b >= 64 && b <= 127) {
        return { valid: false, error: 'Webhook URL cannot point to CGNAT IP range' };
      }
    }

    // Block IPv6 private ranges
    const ipv6PrivatePrefixes = ['fc', 'fd', 'fe80', '::1', '::ffff:'];
    for (const prefix of ipv6PrivatePrefixes) {
      if (hostname.startsWith(prefix) || hostname.startsWith(`[${prefix}`)) {
        return { valid: false, error: 'Webhook URL cannot point to private IPv6 address' };
      }
    }

    // Ensure hostname has at least one dot (basic domain check)
    if (!hostname.includes('.') && !ipMatch) {
      return { valid: false, error: 'Webhook URL must use a fully qualified domain name' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate webhook payload schema
 */
export const webhookPayloadSchema = z.object({
  event: z.string().min(1).max(100),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  idempotency_key: z.string().max(255).optional(),
});

/**
 * Validate incoming webhook request
 */
export function validateWebhookRequest(
  body: unknown,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): { valid: boolean; error?: string; data?: z.infer<typeof webhookPayloadSchema> } {
  // Check size
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  if (bodyString.length > maxSizeBytes) {
    return { valid: false, error: `Request body exceeds maximum size of ${maxSizeBytes} bytes` };
  }

  // Parse and validate
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const result = webhookPayloadSchema.safeParse(parsed);

    if (!result.success) {
      return { valid: false, error: result.error.errors[0]?.message || 'Invalid payload format' };
    }

    return { valid: true, data: result.data };
  } catch {
    return { valid: false, error: 'Invalid JSON payload' };
  }
}

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type WorkOrderInput = z.infer<typeof workOrderSchema>;
