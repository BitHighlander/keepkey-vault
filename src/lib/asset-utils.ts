/**
 * Asset Utility Functions
 *
 * Provides conversion utilities for working with blockchain assets and CAIP identifiers.
 * Handles decimal conversions between display amounts and base units.
 */

import type { AssetContextState } from '@/components/providers/pioneer';

/**
 * Convert human-readable amount to base units
 *
 * @param amount - Human-readable amount as string (e.g., "1.5")
 * @param assetContext - Asset context containing precision/decimals
 * @returns Amount in base units as string (e.g., "150000000" for 1.5 with 8 decimals)
 *
 * @example
 * toBaseUnit("1.5", { precision: 8 }) // Returns "150000000"
 * toBaseUnit("0.0001", { precision: 8 }) // Returns "10000"
 */
export function toBaseUnit(
  amount: string,
  assetContext: AssetContextState | null | undefined
): string {
  if (!assetContext || !amount) {
    console.warn('⚠️ [toBaseUnit] Missing assetContext or amount:', { amount, assetContext });
    return '0';
  }

  const decimals = assetContext.precision || 8; // Default to 8 if not specified

  try {
    // Remove any commas and trim whitespace
    const cleanAmount = amount.replace(/,/g, '').trim();

    // Parse the amount as a float
    const amountFloat = parseFloat(cleanAmount);

    if (isNaN(amountFloat)) {
      console.error('❌ [toBaseUnit] Invalid amount:', amount);
      return '0';
    }

    // Convert to base units using multiplication to avoid floating point errors
    // Multiply by 10^decimals
    const multiplier = BigInt(10) ** BigInt(decimals);

    // Split into integer and fractional parts to handle decimals precisely
    const [integerPart, fractionalPart = ''] = cleanAmount.split('.');
    const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);

    const integerValue = BigInt(integerPart || '0') * multiplier;
    const fractionalValue = BigInt(paddedFractional || '0');

    const baseUnits = integerValue + fractionalValue;

    return baseUnits.toString();
  } catch (error) {
    console.error('❌ [toBaseUnit] Conversion error:', error, { amount, decimals });
    return '0';
  }
}

/**
 * Convert base units to human-readable amount
 *
 * @param baseAmount - Amount in base units as string
 * @param assetContext - Asset context containing precision/decimals
 * @param isThorchainQuote - If true, assumes 8 decimal THORChain format (default: false)
 * @returns Human-readable amount as string
 *
 * @example
 * fromBaseUnit("150000000", { precision: 8 }) // Returns "1.5"
 * fromBaseUnit("1500000", { precision: 6 }) // Returns "1.5" (USDT)
 * fromBaseUnit("150000000", { precision: 18 }, true) // Returns "1.5" (THORChain 8-decimal quote)
 */
export function fromBaseUnit(
  baseAmount: string,
  assetContext: AssetContextState | null | undefined,
  isThorchainQuote: boolean = false
): string {
  if (!assetContext || !baseAmount) {
    console.warn('⚠️ [fromBaseUnit] Missing assetContext or baseAmount:', { baseAmount, assetContext });
    return '0';
  }

  // THORChain always returns amounts in 8 decimal format
  const decimals = isThorchainQuote ? 8 : (assetContext.precision || 8);

  try {
    // Remove any commas and trim whitespace
    const cleanAmount = baseAmount.replace(/,/g, '').trim();

    const baseValue = BigInt(cleanAmount);
    const divisor = BigInt(10) ** BigInt(decimals);

    // Divide to get integer part
    const integerPart = baseValue / divisor;

    // Get remainder for fractional part
    const remainder = baseValue % divisor;
    const fractionalPart = remainder.toString().padStart(decimals, '0');

    // Trim trailing zeros from fractional part
    const trimmedFractional = fractionalPart.replace(/0+$/, '');

    if (trimmedFractional === '') {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedFractional}`;
  } catch (error) {
    console.error('❌ [fromBaseUnit] Conversion error:', error, { baseAmount, decimals });
    return '0';
  }
}

/**
 * Get decimal precision for an asset from its context
 *
 * @param assetContext - Asset context state
 * @returns Number of decimal places (defaults to 8 if not found)
 *
 * @example
 * getAssetDecimals({ precision: 18 }) // Returns 18 (ETH)
 * getAssetDecimals({ precision: 6 }) // Returns 6 (USDT)
 * getAssetDecimals(null) // Returns 8 (default)
 */
export function getAssetDecimals(
  assetContext: AssetContextState | null | undefined
): number {
  if (!assetContext) {
    console.warn('⚠️ [getAssetDecimals] No assetContext provided, using default 8 decimals');
    return 8;
  }

  return assetContext.precision || 8;
}

/**
 * Convert CAIP identifier to THORChain asset format
 *
 * @param caip - CAIP-2 identifier (e.g., "eip155:1/slip44:60" or "eip155:1/erc20:0xa0b8...")
 * @returns THORChain asset format (e.g., "ETH.ETH" or "ETH.USDC-0XA0B8")
 *
 * @example
 * convertCaipToThorAsset("eip155:1/slip44:60") // Returns "ETH.ETH"
 * convertCaipToThorAsset("bip122:000.../slip44:0") // Returns "BTC.BTC"
 * convertCaipToThorAsset("eip155:1/erc20:0xa0b8...") // Returns "ETH.USDC-0XA0B8"
 */
export function convertCaipToThorAsset(caip: string): string {
  const parts = caip.split('/');
  const chainPart = parts[0];
  const assetPart = parts[1];

  // Determine chain
  let chain: string;
  if (chainPart.startsWith('bip122:')) {
    chain = 'BTC';
  } else if (chainPart.startsWith('eip155:1')) {
    chain = 'ETH';
  } else if (chainPart.includes('cosmoshub')) {
    chain = 'GAIA';
  } else if (chainPart.includes('thorchain')) {
    chain = 'THOR';
  } else if (chainPart.includes('binance')) {
    chain = 'BNB';
  } else if (chainPart.includes('osmosis')) {
    chain = 'OSMO';
  } else {
    console.warn(`⚠️ [convertCaipToThorAsset] Unsupported chain in CAIP: ${chainPart}, defaulting to chain extraction`);
    // Try to extract chain from CAIP
    chain = chainPart.split(':')[0].toUpperCase();
  }

  // Determine asset
  if (assetPart.startsWith('slip44:')) {
    // Native asset
    return `${chain}.${chain}`;
  } else if (assetPart.startsWith('erc20:')) {
    // ERC20 token
    const tokenAddress = assetPart.split(':')[1];
    const tokenSymbol = getTokenSymbol(tokenAddress);
    return `${chain}.${tokenSymbol}-${tokenAddress.substring(0, 8).toUpperCase()}`;
  } else {
    console.warn(`⚠️ [convertCaipToThorAsset] Unsupported asset type: ${assetPart}`);
    return `${chain}.${chain}`;
  }
}

/**
 * Get token symbol from contract address
 *
 * @param address - Contract address (lowercase or checksummed)
 * @returns Token symbol or 'TOKEN' if unknown
 */
function getTokenSymbol(address: string): string {
  const tokens: Record<string, string> = {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
    '0x514910771af9ca656af840dff83e8264ecf986ca': 'LINK',
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'UNI'
  };
  return tokens[address.toLowerCase()] || 'TOKEN';
}

/**
 * Extract chain ID from CAIP identifier
 *
 * @param caip - CAIP-2 identifier (e.g., "eip155:1/slip44:60")
 * @returns Chain ID (e.g., "1" for Ethereum mainnet)
 */
export function getChainIdFromCAIP(caip: string): string {
  const parts = caip.split('/');
  const chainPart = parts[0]; // e.g., "eip155:1"
  const chainId = chainPart.split(':')[1];
  return chainId;
}

/**
 * Extract token contract address from CAIP identifier
 *
 * @param caip - CAIP-2 identifier for ERC20 token (e.g., "eip155:1/erc20:0xa0b8...")
 * @returns Contract address or empty string if not an ERC20
 */
export function getTokenAddressFromCAIP(caip: string): string {
  const parts = caip.split('/');
  const assetPart = parts[1]; // e.g., "erc20:0xa0b8..."

  if (assetPart && assetPart.startsWith('erc20:')) {
    return assetPart.split(':')[1];
  }

  return '';
}

/**
 * Format time in seconds to human-readable string
 *
 * @param seconds - Number of seconds
 * @returns Formatted time string (e.g., "2m 5s" or "45s")
 *
 * @example
 * formatTime(125) // Returns "2m 5s"
 * formatTime(45) // Returns "45s"
 * formatTime(120) // Returns "2m"
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
