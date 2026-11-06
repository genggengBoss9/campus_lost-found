import { registerPlugin, WebPlugin } from '@capacitor/core';

import { ItemApiError } from './found-item';

const STORAGE_KEY = 'campus-lost-found-api-url';

interface LocalAddressPlugin {
  getAddresses(): Promise<{ addresses: string[] }>;
}

class LocalAddressWeb extends WebPlugin implements LocalAddressPlugin {
  async getAddresses(): Promise<{ addresses: string[] }> {
    return { addresses: [] };
  }
}

const LocalAddress = registerPlugin<LocalAddressPlugin>('LocalAddress', {
  web: () => new LocalAddressWeb(),
});

const HOTSPOT_PREFIXES = ['192.168.43', '192.168.8', '192.168.44'];

export async function resolveApiUrl(preferred: string): Promise<string> {
  const candidates = unique(
    [readSaved(), preferred, withHost(preferred, 'localhost'), withHost(preferred, '127.0.0.1')].filter(
      (value): value is string => value !== null && value !== '',
    ),
  );

  for (const url of candidates) {
    if (await probe(url, 1500)) {
      save(url);
      return url;
    }
  }

  const found = await scan(preferred);
  if (found !== null) {
    save(found);
    return found;
  }

  forget();
  throw new ItemApiError(
    'Could not reach the computer. Connect the computer to this phone hotspot, or plug in the USB cable, then try again.',
  );
}

async function scan(preferred: string): Promise<string | null> {
  const onThisPhone = await localPrefixes();
  const prefixes = onThisPhone.length > 0 ? onThisPhone : unique([...prefixOf(preferred), ...HOTSPOT_PREFIXES]);
  const urls: string[] = [];
  for (const prefix of prefixes) {
    for (let host = 1; host <= 254; host += 1) {
      urls.push(withHost(preferred, `${prefix}.${host}`));
    }
  }

  let found: string | null = null;
  let cursor = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (found === null && cursor < urls.length) {
      const url = urls[cursor];
      cursor += 1;
      if (await probe(url, 700)) {
        found = url;
      }
    }
  });
  await Promise.all(workers);
  return found;
}

async function localPrefixes(): Promise<string[]> {
  try {
    const result = await LocalAddress.getAddresses();
    return unique(
      (result.addresses ?? [])
        .map((address) => address.match(/^(\d+\.\d+\.\d+)\.\d+$/)?.[1])
        .filter((prefix): prefix is string => prefix !== undefined),
    );
  } catch {
    return [];
  }
}

async function probe(url: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      return false;
    }
    const body: unknown = await response.json();
    return isItemList(body);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function isItemList(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('success' in value) || !('data' in value)) {
    return false;
  }
  const body = value as { success: unknown; data: unknown };
  return body.success === true && Array.isArray(body.data);
}

function withHost(apiUrl: string, host: string): string {
  const url = new URL(apiUrl);
  url.hostname = host;
  return url.toString();
}

function prefixOf(apiUrl: string): string[] {
  const match = new URL(apiUrl).hostname.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  return match === null ? [] : [match[1]];
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function save(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch {
    return;
  }
}

function forget(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
