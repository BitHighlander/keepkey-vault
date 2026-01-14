/**
 * Scam Token Detection Utility
 *
 * Provides functions to detect potential scam tokens based on:
 * 1. USD value (tokens with value are not scams)
 * 2. Known stablecoin names with zero value (confirmed scams)
 * 3. Zero-value tokens (possible scams)
 */

// List of known stablecoin symbols that should always have ~$1 value
export const KNOWN_STABLECOINS = [
  'USDT', 'USDC', 'DAI', 'BUSD', 'UST', 'TUSD', 'USDD', 'USDP', 'GUSD', 'PYUSD',
  'FRAX', 'LUSD', 'sUSD', 'alUSD', 'FEI', 'MIM', 'DOLA', 'agEUR', 'EURT', 'EURS'
];

export interface ScamDetectionResult {
  isScam: boolean;
  scamType: 'possible' | 'confirmed' | null;
  reason: string;
}

/**
 * Detects if a token is potentially a scam based on its properties
 *
 * Logic:
 * 1. If token matches stablecoin symbol with minimal/no value, it's a CONFIRMED scam
 * 2. If token has minimal value (< $0.01) AND no asset data, it's a POSSIBLE scam
 * 3. If token has no value, it's a POSSIBLE scam
 * 4. Otherwise, it's NOT a scam
 *
 * @param token - Token object with symbol/ticker and valueUsd properties
 * @param assetInfo - Optional asset metadata from assetsMap (contains icon, name, etc.)
 * @returns ScamDetectionResult with isScam flag, scamType, and reason
 */
export const detectScamToken = (token: any, assetInfo?: any): ScamDetectionResult => {
  const symbol = (token.symbol || token.ticker || '').toUpperCase();
  const valueUsd = parseFloat(token.valueUsd || 0);

  // FIRST: Stablecoin symbol with minimal/no value = CONFIRMED SCAM
  // Real stablecoins have ~$1 value, fake ones have little to no value
  if (KNOWN_STABLECOINS.includes(symbol) && valueUsd < 0.50) {
    return {
      isScam: true,
      scamType: 'confirmed',
      reason: `Fake ${symbol} token detected. Real ${symbol} has ~$1.00 value, this token has $${valueUsd.toFixed(2)}.`
    };
  }

  // SECOND: Minimal value + missing asset data = POSSIBLE SCAM
  // Legitimate tokens typically have proper asset metadata including icons
  // Scammers often create tokens without proper metadata
  if (valueUsd < 0.01 && (!assetInfo || !assetInfo.icon)) {
    return {
      isScam: true,
      scamType: 'possible',
      reason: 'This token has minimal value ($' + valueUsd.toFixed(4) + ') and is not recognized in our asset database. Unknown tokens without proper metadata are commonly used in airdrop scams.'
    };
  }

  // THIRD: Zero value = POSSIBLE SCAM
  if (valueUsd === 0) {
    return {
      isScam: true,
      scamType: 'possible',
      reason: 'Zero-value tokens are commonly used in phishing attacks to gain wallet access or trick users into approving malicious transactions.'
    };
  }

  // NOT a scam
  return {
    isScam: false,
    scamType: null,
    reason: ''
  };
};

/**
 * Filters an array of tokens into categories:
 * - tokens with value (valueUsd > 0)
 * - tokens with zero/minimal value but not scams
 * - scam tokens
 *
 * @param tokens - Array of token objects
 * @param assetsMap - Optional map of CAIP to asset metadata for scam detection
 * @returns Object with categorized token arrays
 */
export const categorizeTokens = (tokens: any[], assetsMap?: Map<string, any>) => {
  const getAssetInfo = (token: any) => {
    if (!assetsMap) return undefined;
    return assetsMap.get(token.caip) || assetsMap.get(token.caip?.toLowerCase());
  };

  const cleanTokens = tokens.filter(t => !detectScamToken(t, getAssetInfo(t)).isScam);
  const scamTokens = tokens.filter(t => detectScamToken(t, getAssetInfo(t)).isScam);

  const tokensWithValue = cleanTokens.filter(t => parseFloat(t.valueUsd || 0) > 0);
  const tokensWithZeroValue = cleanTokens.filter(t => parseFloat(t.valueUsd || 0) === 0);

  return {
    tokensWithValue,
    tokensWithZeroValue,
    scamTokens,
    cleanTokens
  };
};
