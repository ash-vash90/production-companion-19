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

// Webhook URL validation - blocks private IPs and requires HTTPS
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
    
    // Block private IP ranges
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    
    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);
      
      // 10.x.x.x
      if (a === 10) {
        return { valid: false, error: 'Webhook URL cannot point to private IP range' };
      }
      
      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) {
        return { valid: false, error: 'Webhook URL cannot point to private IP range' };
      }
      
      // 192.168.x.x
      if (a === 192 && b === 168) {
        return { valid: false, error: 'Webhook URL cannot point to private IP range' };
      }
      
      // 169.254.x.x (link-local)
      if (a === 169 && b === 254) {
        return { valid: false, error: 'Webhook URL cannot point to link-local IP range' };
      }
      
      // 127.x.x.x (loopback)
      if (a === 127) {
        return { valid: false, error: 'Webhook URL cannot point to loopback address' };
      }
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type WorkOrderInput = z.infer<typeof workOrderSchema>;
