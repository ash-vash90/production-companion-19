import { supabase } from '@/integrations/supabase/client';

export type ProductType = 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER' | 'SDM_ECO';

/**
 * Centralized serialization service
 * Generates unique serial numbers using database sequences
 *
 * Format:
 * - SENSOR: Q-0001, Q-0002, ...
 * - MLA: W-0001, W-0002, ...
 * - HMI: X-0001, X-0002, ...
 * - TRANSMITTER: T-0001, T-0002, ...
 * - SDM_ECO: SDM-0001, SDM-0002, ...
 */
export class SerializationService {
  /**
   * Generate a single serial number
   */
  static async generateSerial(productType: ProductType): Promise<string> {
    const { data, error } = await supabase.rpc('generate_serial_number', {
      p_product_type: productType,
    });

    if (error) {
      console.error('Failed to generate serial number:', error);
      throw new Error(`Failed to generate serial number: ${error.message}`);
    }

    return data as string;
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

    const { data, error } = await supabase.rpc('generate_serial_numbers', {
      p_product_type: productType,
      p_count: count,
    });

    if (error) {
      console.error('Failed to generate serial numbers:', error);
      throw new Error(`Failed to generate serial numbers: ${error.message}`);
    }

    return data as string[];
  }

  /**
   * Get the prefix for a product type
   */
  static getPrefix(productType: ProductType): string {
    const prefixes: Record<ProductType, string> = {
      SENSOR: 'Q',
      MLA: 'W',
      HMI: 'X',
      TRANSMITTER: 'T',
      SDM_ECO: 'SDM',
    };
    return prefixes[productType];
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
      SDM_ECO: /^SDM-\d{4}$/,
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
    const match = serialNumber.match(/^(?:Q|W|X|T|SDM)-(\d{4})$/);
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
      { type: 'SDM_ECO', pattern: /^SDM-(\d{4})$/, prefix: 'SDM' },
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
