import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Product type display names - human readable
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  SDM_ECO: 'SDM-ECO',
  SENSOR: 'Sensor',
  MLA: 'MLA',
  HMI: 'HMI',
  TRANSMITTER: 'Transmitter',
};

export function formatProductType(type: string): string {
  return PRODUCT_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

// Status display names - human readable
const STATUS_LABELS: Record<string, { en: string; nl: string }> = {
  planned: { en: 'Planned', nl: 'Gepland' },
  in_progress: { en: 'In Progress', nl: 'In Uitvoering' },
  completed: { en: 'Completed', nl: 'Voltooid' },
  on_hold: { en: 'On Hold', nl: 'In Wacht' },
  cancelled: { en: 'Cancelled', nl: 'Geannuleerd' },
  pending: { en: 'Pending', nl: 'In Afwachting' },
  skipped: { en: 'Skipped', nl: 'Overgeslagen' },
};

export function formatStatus(status: string, language: 'en' | 'nl' = 'en'): string {
  return STATUS_LABELS[status]?.[language] || status.replace(/_/g, ' ');
}

// Serial number prefix to product type mapping
const PREFIX_TO_TYPE: Record<string, string> = {
  Q: 'SENSOR',
  W: 'MLA',
  X: 'HMI',
  T: 'TRANSMITTER',
  SDM: 'SDM_ECO',
  S: 'SDM_ECO',
};

export function getProductTypeFromSerial(serialNumber: string): string | null {
  const prefix = serialNumber.split('-')[0];
  return PREFIX_TO_TYPE[prefix] || null;
}

// Group work order items by product type
export interface ProductBreakdown {
  type: string;
  label: string;
  count: number;
}

export function getProductBreakdown(items: Array<{ serial_number: string }>): ProductBreakdown[] {
  const counts: Record<string, number> = {};
  
  for (const item of items) {
    const type = getProductTypeFromSerial(item.serial_number);
    if (type) {
      counts[type] = (counts[type] || 0) + 1;
    }
  }
  
  return Object.entries(counts).map(([type, count]) => ({
    type,
    label: formatProductType(type),
    count,
  }));
}

// Format breakdown for display
export function formatProductBreakdownText(breakdown: ProductBreakdown[]): string {
  if (breakdown.length === 0) return '';
  if (breakdown.length === 1) return `${breakdown[0].count}× ${breakdown[0].label}`;
  return breakdown.map(b => `${b.count}× ${b.label}`).join(', ');
}
