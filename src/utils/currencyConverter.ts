/**
 * Currency conversion utilities for Send component
 */

export interface AssetPriceContext {
  priceUsd?: string | number;
}

/**
 * Format USD value with proper currency formatting
 */
export const formatUsd = (value: number): string => {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
};

/**
 * Check if price data is available for the asset
 */
export const isPriceAvailable = (assetContext: AssetPriceContext): boolean => {
  return !!(assetContext?.priceUsd && parseFloat(String(assetContext.priceUsd)) > 0);
};

/**
 * Convert USD amount to native token amount
 */
export const usdToNative = (usdAmount: string, priceUsd?: string | number): string => {
  if (!usdAmount || !priceUsd || parseFloat(String(priceUsd)) === 0) return '0';

  const parsedUsd = parseFloat(usdAmount);
  const parsedPrice = parseFloat(String(priceUsd));

  // Check for NaN or invalid values
  if (isNaN(parsedUsd) || isNaN(parsedPrice) || parsedPrice === 0) {
    console.warn('Invalid USD to native conversion:', { usdAmount, priceUsd });
    return '0';
  }

  const nativeAmount = parsedUsd / parsedPrice;

  // Check if result is NaN
  if (isNaN(nativeAmount)) {
    console.warn('NaN result in USD to native conversion:', { parsedUsd, parsedPrice });
    return '0';
  }

  // Return formatted with appropriate decimal places
  return nativeAmount.toFixed(8);
};

/**
 * Convert native token amount to USD
 */
export const nativeToUsd = (nativeAmount: string, priceUsd?: string | number): string => {
  if (!nativeAmount || !priceUsd) return '0';

  const usdAmount = parseFloat(nativeAmount) * parseFloat(String(priceUsd));
  // Return with 2 decimal places for USD
  return usdAmount.toFixed(2);
};

/**
 * Calculate fee in USD based on network type
 * @param feeInNative - Fee amount in native token units
 * @param priceUsd - Price of the native token in USD
 * @param networkType - Type of network (UTXO, EVM, etc.)
 * @param networkId - Network ID for special handling
 * @returns Fee in USD as string with 2 decimal places
 */
export const calculateFeeInUsd = (
  feeInNative: string,
  priceUsd: string | number | undefined,
  networkType: string,
  networkId?: string
): string => {
  if (!feeInNative || !priceUsd) {
    return '0.00';
  }

  try {
    let feeValue = parseFloat(feeInNative);

    // Handle wildcard network IDs - extract actual network ID from fee object if needed
    // This is a simplified version; the full logic may need networkId resolution

    // For UTXO networks, the fee is already in BTC (or native units)
    // For EVM networks, the fee is in ETH or native gas token
    // Convert native fee to USD
    const priceValue = parseFloat(String(priceUsd));
    const feeUsd = feeValue * priceValue;

    return feeUsd.toFixed(2);
  } catch (error) {
    console.error('Error calculating fee in USD:', error);
    return '0.00';
  }
};
