/**
 * Scam Whitelist Storage Service
 *
 * Manages user-whitelisted tokens that should not be flagged as scam.
 * Uses localStorage with an in-memory Set cache for O(1) lookups.
 */

const STORAGE_KEY = 'keepkey_vault_scam_whitelist';
const STORAGE_VERSION = '1.0.0';

export interface WhitelistedToken {
  caip: string;
  symbol: string;
  name?: string;
  whitelistedAt: number;
  reportedToServer: boolean;
}

interface WhitelistData {
  tokens: WhitelistedToken[];
  version: string;
}

// In-memory cache for O(1) lookups
let cache: Set<string> | null = null;

function normalizeCaip(caip: string): string {
  return caip.toLowerCase();
}

function invalidateCache(): void {
  cache = null;
}

function loadCache(): Set<string> {
  if (cache) return cache;
  const data = loadWhitelistData();
  cache = new Set(data.tokens.map(t => normalizeCaip(t.caip)));
  return cache;
}

function loadWhitelistData(): WhitelistData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tokens: [], version: STORAGE_VERSION };

    const data: WhitelistData = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) {
      console.warn('[ScamWhitelist] Storage version mismatch:', data.version, '→', STORAGE_VERSION);
    }
    return data;
  } catch (error) {
    console.error('[ScamWhitelist] Failed to load whitelist:', error);
    return { tokens: [], version: STORAGE_VERSION };
  }
}

function saveWhitelistData(data: WhitelistData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    invalidateCache();
    return true;
  } catch (error) {
    console.error('[ScamWhitelist] Failed to save whitelist:', error);
    return false;
  }
}

/**
 * Check if a token CAIP is whitelisted (O(1) via in-memory Set)
 */
export function isTokenWhitelisted(caip: string): boolean {
  if (!caip) return false;
  try {
    const set = loadCache();
    return set.has(normalizeCaip(caip));
  } catch (error) {
    return false;
  }
}

/**
 * Add a token to the whitelist
 */
export function addToWhitelist(token: { caip: string; symbol: string; name?: string }): boolean {
  try {
    const data = loadWhitelistData();
    const normalizedCaip = normalizeCaip(token.caip);

    // Check for duplicates
    if (data.tokens.some(t => normalizeCaip(t.caip) === normalizedCaip)) {
      return true; // Already whitelisted
    }

    data.tokens.push({
      caip: token.caip, // Store original case for display
      symbol: token.symbol,
      name: token.name,
      whitelistedAt: Date.now(),
      reportedToServer: false,
    });

    return saveWhitelistData(data);
  } catch (error) {
    console.error('[ScamWhitelist] Failed to add to whitelist:', error);
    return false;
  }
}

/**
 * Remove a token from the whitelist
 */
export function removeFromWhitelist(caip: string): boolean {
  try {
    const data = loadWhitelistData();
    const normalizedCaip = normalizeCaip(caip);
    data.tokens = data.tokens.filter(t => normalizeCaip(t.caip) !== normalizedCaip);
    return saveWhitelistData(data);
  } catch (error) {
    console.error('[ScamWhitelist] Failed to remove from whitelist:', error);
    return false;
  }
}

/**
 * Mark a whitelisted token as reported to server
 */
export function markAsReported(caip: string): boolean {
  try {
    const data = loadWhitelistData();
    const normalizedCaip = normalizeCaip(caip);
    const token = data.tokens.find(t => normalizeCaip(t.caip) === normalizedCaip);
    if (token) {
      token.reportedToServer = true;
      return saveWhitelistData(data);
    }
    return false;
  } catch (error) {
    console.error('[ScamWhitelist] Failed to mark as reported:', error);
    return false;
  }
}

/**
 * Get all whitelisted tokens
 */
export function getWhitelistedTokens(): WhitelistedToken[] {
  try {
    return loadWhitelistData().tokens;
  } catch (error) {
    console.error('[ScamWhitelist] Failed to get whitelisted tokens:', error);
    return [];
  }
}
