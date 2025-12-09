import { supabase } from '@/integrations/supabase/client';

export interface WorkOrderFormat {
  prefix: string;
  dateFormat: string;
  separator: string;
}

export interface SerialPrefixes {
  SENSOR: string;
  MLA: string;
  HMI: string;
  TRANSMITTER: string;
  SDM_ECO: string;
}

export interface SerialFormat {
  padLength: number;
  separator: string;
}

export class SettingsService {
  private static cache: Map<string, any> = new Map();

  static async getSetting<T>(key: string): Promise<T | null> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error || !data) {
      console.error(`Error fetching setting ${key}:`, error);
      return null;
    }

    this.cache.set(key, data.setting_value);
    return data.setting_value as T;
  }

  static async updateSetting(key: string, value: any): Promise<boolean> {
    const { error } = await supabase
      .from('system_settings')
      .update({ setting_value: value })
      .eq('setting_key', key);

    if (error) {
      console.error(`Error updating setting ${key}:`, error);
      return false;
    }

    this.cache.set(key, value);
    return true;
  }

  static clearCache() {
    this.cache.clear();
  }

  static async getWorkOrderFormat(): Promise<WorkOrderFormat> {
    const format = await this.getSetting<WorkOrderFormat>('work_order_format');
    return format || { prefix: 'WO', dateFormat: 'YYYYMMDD', separator: '-' };
  }

  static async getSerialPrefixes(): Promise<SerialPrefixes> {
    const prefixes = await this.getSetting<SerialPrefixes>('serial_prefixes');
    return prefixes || { SENSOR: 'Q', MLA: 'W', HMI: 'X', TRANSMITTER: 'T', SDM_ECO: 'SDM' };
  }

  static async getSerialFormat(): Promise<SerialFormat> {
    const format = await this.getSetting<SerialFormat>('serial_format');
    return format || { padLength: 4, separator: '-' };
  }

  static async generateWorkOrderNumber(): Promise<string> {
    const format = await this.getWorkOrderFormat();
    const now = new Date();
    
    // Format date based on setting
    let dateStr = '';
    if (format.dateFormat === 'YYYYMMDD') {
      dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    } else if (format.dateFormat === 'YYMMDD') {
      dateStr = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    } else if (format.dateFormat === 'YYYY-MM-DD') {
      dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // Find the highest sequence number for today's prefix pattern
    const todayPrefix = `${format.prefix}${format.separator}${dateStr}${format.separator}`;
    
    const { data } = await supabase
      .from('work_orders')
      .select('wo_number')
      .like('wo_number', `${todayPrefix}%`)
      .order('wo_number', { ascending: false })
      .limit(1);

    let nextSequence = 1;
    if (data && data.length > 0) {
      const lastWoNumber = data[0].wo_number;
      const lastSequence = parseInt(lastWoNumber.split(format.separator).pop() || '0', 10);
      nextSequence = lastSequence + 1;
    }

    const sequence = String(nextSequence).padStart(3, '0');
    
    return `${format.prefix}${format.separator}${dateStr}${format.separator}${sequence}`;
  }

  static async generateSerialNumber(productType: keyof SerialPrefixes, sequence: number): Promise<string> {
    const prefixes = await this.getSerialPrefixes();
    const format = await this.getSerialFormat();
    
    const prefix = prefixes[productType] || productType.charAt(0);
    const paddedSequence = String(sequence).padStart(format.padLength, '0');
    
    return `${prefix}${format.separator}${paddedSequence}`;
  }
}
