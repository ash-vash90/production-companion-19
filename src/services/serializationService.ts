import { supabase } from '@/integrations/supabase/client';

export type ProductType = 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER' | 'SDM_ECO';

/**
 * Centralized serialization service
 * Generates unique serial numbers based on existing items in database
 *
 * Format:
 * - SENSOR: Q-0001, Q-0002, ...
 * - MLA: W-0001, W-0002, ...
 * - HMI: X-0001, X-0002, ...
 * - TRANSMITTER: T-0001, T-0002, ...
 * - SDM_ECO: S-0001, S-0002, ...
 */
export class SerializationService {
  private static prefixes: Record<ProductType, string> = {
    SENSOR: 'Q',
    MLA: 'W',
    HMI: 'X',
    TRANSMITTER: 'T',
    SDM_ECO: 'S',
  };

  /**
   * Get the next available serial number by checking existing items
   */
  private static async getNextSequence(productType: ProductType): Promise<number> {
    const prefix = this.prefixes[productType];
    
    // Query for the highest existing serial number with this prefix
    const { data, error } = await supabase
      .from('work_order_items')
      .select('serial_number')
      .like('serial_number', `${prefix}-%`)
      .order('serial_number', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching max serial:', error);
      // Fall back to timestamp-based if query fails
      return Date.now() % 10000;
    }

    if (!data || data.length === 0) {
      return 1;
    }

    // Extract number from serial (e.g., "Q-0042" -> 42)
    const match = data[0].serial_number.match(/^[A-Z]+-(\d+)$/);
    if (match) {
      return parseInt(match[1], 10) + 1;
    }

    return 1;
  }

  /**
   * Generate a single serial number
   */
  static async generateSerial(productType: ProductType): Promise<string> {
    const prefix = this.prefixes[productType];
    const sequence = await this.getNextSequence(productType);
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Generate multiple serial numbers for a batch
   */
  static async generateSerials(
    productType: ProductType,
    count: number
  ): Promise<string[]> {
    if (count < 1) {
      throw new Error('Count must be at least 1');
    }

    if (count > 1000) {
      throw new Error('Cannot generate more than 1000 serials at once');
    }

    const prefix = this.prefixes[productType];
    const startSequence = await this.getNextSequence(productType);
    
    const serials: string[] = [];
    for (let i = 0; i < count; i++) {
      serials.push(`${prefix}-${String(startSequence + i).padStart(4, '0')}`);
    }

    return serials;
  }

  /**
   * Get the prefix for a product type
   */
  static getPrefix(productType: ProductType): string {
    return this.prefixes[productType];
  }

  /**
   * Validate serial number format
   */
  static isValidSerial(serialNumber: string, productType?: ProductType): boolean {
    const patterns: Record<ProductType, RegExp> = {
      SENSOR: /^Q-\d{4}$/,
      MLA: /^W-\d{4}$/,
      HMI: /^X-\d{4}$/,
      TRANSMITTER: /^T-\d{4}$/,
      SDM_ECO: /^S-\d{4}$/,
    };

    if (productType) {
      return patterns[productType].test(serialNumber);
    }

    // Check if it matches any pattern
    return Object.values(patterns).some((pattern) => pattern.test(serialNumber));
  }

  /**
   * Extract number from serial (e.g., "Q-0042" -> 42)
   */
  static extractNumber(serialNumber: string): number | null {
    const match = serialNumber.match(/^[A-Z]+-(\d{4})$/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  /**
   * Parse serial number to get product type and number
   */
  static parseSerial(serialNumber: string): {
    productType: ProductType | null;
    number: number | null;
    prefix: string | null;
  } {
    const patterns: Array<{ type: ProductType; pattern: RegExp; prefix: string }> = [
      { type: 'SENSOR', pattern: /^Q-(\d{4})$/, prefix: 'Q' },
      { type: 'MLA', pattern: /^W-(\d{4})$/, prefix: 'W' },
      { type: 'HMI', pattern: /^X-(\d{4})$/, prefix: 'X' },
      { type: 'TRANSMITTER', pattern: /^T-(\d{4})$/, prefix: 'T' },
      { type: 'SDM_ECO', pattern: /^S-(\d{4})$/, prefix: 'S' },
    ];

    for (const { type, pattern, prefix } of patterns) {
      const match = serialNumber.match(pattern);
      if (match) {
        return {
          productType: type,
          number: parseInt(match[1], 10),
          prefix,
        };
      }
    }

    return { productType: null, number: null, prefix: null };
  }
}