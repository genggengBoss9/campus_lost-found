export const ITEM_KINDS = ['lost', 'found'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export const FOUND_ITEM_CATEGORIES = ['ID', 'Electronics', 'Clothing', 'Other'] as const;

export type FoundItemCategory = (typeof FOUND_ITEM_CATEGORIES)[number];

export interface FoundItem {
  id: number;
  kind: ItemKind;
  title: string;
  category: string;
  description: string;
  photo_path: string | null;
  photo_url: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export interface FoundItemDraft {
  kind: ItemKind;
  title: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  photo_data?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}

export class ItemApiError extends Error {
  readonly errors: Record<string, string>;
  readonly status: number;

  constructor(message: string, errors: Record<string, string> = {}, status = 0) {
    super(message);
    this.name = 'ItemApiError';
    this.errors = errors;
    this.status = status;
  }
}

export function postedOn(value: string): Date {
  return new Date(value.replace(' ', 'T'));
}

export function kindLabel(kind: string): string {
  return kind === 'lost' ? 'Lost' : 'Found';
}

export function categoryIcon(category: string): string {
  switch (category) {
    case 'Electronics':
      return 'hardware-chip-outline';
    case 'ID':
      return 'id-card-outline';
    case 'Clothing':
      return 'shirt-outline';
    default:
      return 'cube-outline';
  }
}

export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function fullMapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}
