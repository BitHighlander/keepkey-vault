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
 * 1. If token has USD value >= $1, it's NOT a scam (significant value)
 * 2. If token matches stablecoin symbol with value < $0.50, it's a CONFIRMED scam
 * 3. If token has value < $1, it's a POSSIBLE scam (likely worthless airdrop)
 *
 * @param token - Token object with symbol/ticker and valueUsd properties
 * @param assetInfo - Optional asset metadata from assetsMap (contains icon, name, etc.)
 * @returns ScamDetectionResult with isScam flag, scamType, and reason
 */
export const detectScamToken = (token: any, assetInfo?: any): ScamDetectionResult => {
  const symbol = (token.symbol || token.ticker || '').toUpperCase();
  const valueUsd = parseFloat(token.valueUsd || 0);

  // console.log('🔍 Scam detection for:', {
  //   symbol,
  //   valueUsd,
  //   rawValueUsd: token.valueUsd,
  //   valueUsdType: typeof token.valueUsd
  // });

  // FIRST: If token has USD value >= $1, it's NOT a scam (even if symbol matches)
  if (valueUsd >= 1) {
    // console.log('✅ NOT a scam - has value:', valueUsd);
    return {
      isScam: false,
      scamType: null,
      reason: 'Has significant USD value'
    };
  }

  // SECOND: Stablecoin symbol with value < $0.50 = CONFIRMED SCAM
  // Real stablecoins have ~$1 value, fake ones have little to no value
  if (KNOWN_STABLECOINS.includes(symbol) && valueUsd < 0.50) {
    // console.log('🚨 CONFIRMED SCAM - fake stablecoin:', symbol);
    return {
      isScam: true,
      scamType: 'confirmed',
      reason: `Fake ${symbol} token detected. Real ${symbol} has ~$1.00 value, this token has $${valueUsd.toFixed(2)}.`
    };
  }

  // THIRD: Low value (< $1) = POSSIBLE SCAM
  // Most legitimate tokens have at least $1 value when held
  // console.log('⚠️ POSSIBLE SCAM - low value:', symbol, valueUsd);
  return {
    isScam: true,
    scamType: 'possible',
    reason: 'This token has minimal value ($' + valueUsd.toFixed(4) + '). Low-value tokens are commonly used in airdrop scams to trick users into approving malicious transactions.'
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
