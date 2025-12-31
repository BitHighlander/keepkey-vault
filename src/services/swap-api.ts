/**
 * Swap API Service
 *
 * Fetches swap asset configuration from Pioneer server with caching and fallback strategies
 */

import { ThorchainPool } from '@/config/thorchain-pools';

const CACHE_KEY = 'keepkey_swap_assets_cache';
const CACHE_TTL = 3600000; // 1 hour in milliseconds

interface CacheEntry {
  assets: ThorchainPool[];
  timestamp: number;
  version: string;
}

interface SwapAssetsResponse {
  success: boolean;
  data: {
    assets: ThorchainPool[];
    total: number;
    version: string;
    enabled: string[];
  };
}

/**
 * Emergency fallback assets (BTC, ETH, USDT)
 * Used only when all other strategies fail
 */
const EMERGENCY_FALLBACK_ASSETS: ThorchainPool[] = [
  {
    asset: 'BTC.BTC',
    chain: 'BTC',
    symbol: 'BTC',
    name: 'Bitcoin',
    caip: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
    networkId: 'bip122:000000000019d6689c085ae165831e93',
    isNative: true,
  },
  {
    asset: 'ETH.ETH',
    chain: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    caip: 'eip155:1/slip44:60',
    networkId: 'eip155:1',
    isNative: true,
  },
  {
    asset: 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
    chain: 'ETH',
    symbol: 'USDT',
    name: 'Tether on Ethereum',
    caip: 'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
    networkId: 'eip155:1',
    isNative: false,
    contract: '0XDAC17F958D2EE523A2206206994597C13D831EC7',
  },
];

/**
 * Get Pioneer server URL from environment
 * Defaults to production API
 * Handles URLs that include /spec/swagger.json by extracting base URL
 */
function getPioneerServerUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://api.keepkey.info';
  }

  let url = (
    process.env.NEXT_PUBLIC_PIONEER_SERVER_URL ||
    process.env.NEXT_PUBLIC_PIONEER_URL ||
    'https://api.keepkey.info'
  );

  // Remove /spec/swagger.json suffix if present (common in .env files)
  if (url.endsWith('/spec/swagger.json')) {
    url = url.replace('/spec/swagger.json', '');
  }

  return url;
}

/**
 * Get cached swap assets from localStorage
 * Returns null if cache is missing or invalid
 */
export function getCachedSwapAssets(): ThorchainPool[] | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }

    const entry: CacheEntry = JSON.parse(cached);

    // Validate structure
    if (!entry.assets || !Array.isArray(entry.assets) || !entry.timestamp) {
      console.warn('[swap-api] Invalid cache structure, clearing cache');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Check if expired (soft expiration - we still return it for fallback)
    const age = Date.now() - entry.timestamp;
    const isExpired = age > CACHE_TTL;

    if (isExpired) {
      console.log(`[swap-api] Cache expired (age: ${Math.round(age / 1000 / 60)}min), but returning for fallback use`);
    } else {
      console.log(`[swap-api] Cache hit (age: ${Math.round(age / 1000 / 60)}min)`);
    }

    return entry.assets;
  } catch (error) {
    console.error('[swap-api] Error reading cache:', error);
    return null;
  }
}

/**
 * Save swap assets to localStorage cache
 */
export function setCachedSwapAssets(assets: ThorchainPool[], version: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const entry: CacheEntry = {
      assets,
      timestamp: Date.now(),
      version,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    console.log(`[swap-api] Cached ${assets.length} swap assets (version: ${version})`);
  } catch (error) {
    console.error('[swap-api] Error saving cache:', error);
  }
}

/**
 * Clear swap assets cache
 * Useful for manual cache invalidation
 */
export function clearSwapAssetsCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[swap-api] Cache cleared');
  } catch (error) {
    console.error('[swap-api] Error clearing cache:', error);
  }
}

/**
 * Check if cache is fresh (not expired)
 */
export function isCacheFresh(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return false;
    }

    const entry: CacheEntry = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;
    return age <= CACHE_TTL;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch swap assets from Pioneer server
 * Returns array of ThorchainPool objects
 *
 * @throws Error if fetch fails
 */
export async function fetchSwapAssets(): Promise<ThorchainPool[]> {
  const baseUrl = getPioneerServerUrl();
  const endpoint = `${baseUrl}/api/v1/swap/available-assets`;

  console.log(`[swap-api] Fetching swap assets from ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: SwapAssetsResponse = await response.json();

    if (!data.success || !data.data || !data.data.assets) {
      throw new Error('Invalid response format from Pioneer server');
    }

    if (data.data.assets.length === 0) {
      throw new Error('No swap assets returned from Pioneer server');
    }

    console.log(`[swap-api] Fetched ${data.data.assets.length} swap assets successfully`);

    // Cache the result
    setCachedSwapAssets(data.data.assets, data.data.version);

    return data.data.assets;
  } catch (error) {
    console.error('[swap-api] Error fetching swap assets:', error);
    throw error;
  }
}

/**
 * Get swap assets with full fallback strategy
 *
 * Strategy:
 * 1. Try fresh cache (if < 1 hour old)
 * 2. Try fetch from API
 * 3. Try stale cache (if API fails)
 * 4. Use emergency hardcoded fallback
 *
 * @returns Array of ThorchainPool objects (always returns something)
 */
export async function getSwapAssets(): Promise<{
  assets: ThorchainPool[];
  source: 'cache' | 'api' | 'stale-cache' | 'emergency-fallback';
}> {
  // 1. Try fresh cache first
  if (isCacheFresh()) {
    const cached = getCachedSwapAssets();
    if (cached && cached.length > 0) {
      console.log('[swap-api] Using fresh cache');
      return { assets: cached, source: 'cache' };
    }
  }

  // 2. Try fetching from API
  try {
    const assets = await fetchSwapAssets();
    return { assets, source: 'api' };
  } catch (error) {
    console.warn('[swap-api] API fetch failed, trying fallback strategies');
  }

  // 3. Try stale cache as fallback
  const staleCache = getCachedSwapAssets();
  if (staleCache && staleCache.length > 0) {
    console.warn('[swap-api] Using stale cache as fallback');
    return { assets: staleCache, source: 'stale-cache' };
  }

  // 4. Emergency fallback (hardcoded assets)
  console.error('[swap-api] All strategies failed, using emergency hardcoded fallback');
  return { assets: EMERGENCY_FALLBACK_ASSETS, source: 'emergency-fallback' };
}
