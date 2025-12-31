// THORChain quote service for native asset swaps
import { THORCHAIN_POOLS } from '../config/thorchain-pools';

export const THORNODE_URL = 'https://thornode.ninerealms.com';
export const MIDGARD_URL = 'https://midgard.ninerealms.com';
export const THORCHAIN_TRACKER_URL = 'https://track.ninerealms.com';

// Dynamically generate asset mapping from THORChain pools config
// This ensures we always have the latest pool assets without manual updates
// Prefer native assets over tokens, and Ethereum mainnet over other chains for tokens
const THORCHAIN_ASSETS: Record<string, string> = THORCHAIN_POOLS.reduce((acc, pool) => {
  // If symbol already exists, check priority
  if (acc[pool.symbol]) {
    // Always prefer native assets (BTC.BTC, ETH.ETH, etc.)
    if (!pool.isNative) {
      // For tokens: prefer Ethereum mainnet (chain === 'ETH') over other chains
      const existingIsEth = acc[pool.symbol].startsWith('ETH.');
      const currentIsEth = pool.chain === 'ETH';

      // Keep existing if it's ETH and current isn't, otherwise override with ETH
      if (existingIsEth && !currentIsEth) {
        return acc; // Keep Ethereum mainnet
      }
      // Otherwise keep existing (it's native or we already have a good match)
      if (!currentIsEth) {
        return acc;
      }
    } else if (acc[pool.symbol].includes('.')) {
      // Current is native but existing is token - always prefer native
      acc[pool.symbol] = pool.asset;
      return acc;
    }
  }
  acc[pool.symbol] = pool.asset;
  return acc;
}, {} as Record<string, string>);

// Maya Protocol assets (for Maya swaps)
const MAYA_ASSETS: Record<string, string> = {
  'BTC': 'BTC.BTC',
  'ETH': 'ETH.ETH',
  'RUNE': 'THOR.RUNE',
  'CACAO': 'MAYA.CACAO',
};

interface SwapQuote {
  expected_amount_out: string;
  fees: {
    affiliate: string;
    asset: string;
    outbound: string;
    liquidity: string;
    total: string;
    slippage_bps: number;
  };
  slippage_bps: number;
  streaming_slippage_bps: number;
  router?: string;
  expiry: number;
  warning?: string;
  notes?: string;
  dust_threshold?: string;
  recommended_gas_rate?: string;
  gas_rate_units?: string;
  memo?: string;
  inbound_address?: string;
  outbound_delay_blocks?: number;
  outbound_delay_seconds?: number;
  total_swap_seconds?: number;
  confidence?: number;
}

interface PoolData {
  asset: string;
  status: string;
  balance_asset: string;
  balance_rune: string;
  pending_inbound_asset: string;
  pending_inbound_rune: string;
  pool_units: string;
  LP_units: string;
  synth_units: string;
  synth_supply: string;
  savers_depth: string;
  savers_units: string;
  synth_mint_paused: boolean;
  synth_supply_remaining: string;
  loan_collateral: string;
  loan_cr: string;
}

// Convert CAIP to THORChain asset format
export function caipToThorchainAsset(caip: string, symbol: string): string | null {
  // Use symbol to get THORChain asset format
  return THORCHAIN_ASSETS[symbol] || null;
}

// Get THORChain inbound address (vault) for a specific chain
export async function getThorchainInboundAddress(chain: string): Promise<{ address: string; chain: string; gas_rate?: string } | null> {
  try {
    const url = `${THORNODE_URL}/thorchain/inbound_addresses`;
    console.log('🔍 [THORChain] Fetching inbound addresses from:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch inbound addresses:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('✅ [THORChain] Inbound addresses received:', data);
    
    // Find the inbound address for the specified chain
    const inboundInfo = data.find((item: any) => item.chain === chain);
    
    if (inboundInfo) {
      console.log(`✅ [THORChain] Found inbound address for ${chain}:`, inboundInfo.address);
      return {
        address: inboundInfo.address,
        chain: inboundInfo.chain,
        gas_rate: inboundInfo.gas_rate
      };
    }
    
    console.error(`❌ [THORChain] No inbound address found for chain: ${chain}`);
    return null;
  } catch (error) {
    console.error('Error fetching THORChain inbound address:', error);
    return null;
  }
}

// Get swap quote from THORChain
export async function getThorchainQuote(
  fromAsset: string,
  toAsset: string,
  amount: number, // in base units (sats for BTC, wei for ETH, etc)
  destinationAddress?: string,
  affiliateAddress?: string,
  affiliateBps?: number
): Promise<SwapQuote | null> {
  try {
    const fromThorAsset = THORCHAIN_ASSETS[fromAsset];
    const toThorAsset = THORCHAIN_ASSETS[toAsset];
    
    if (!fromThorAsset || !toThorAsset) {
      console.error('Asset not supported on THORChain:', { fromAsset, toAsset });
      return null;
    }

    console.log('🔍 [THORChain] Preparing quote request:', {
      fromAsset,
      toAsset,
      fromThorAsset,
      toThorAsset,
      amount,
      amountFormatted: amount.toLocaleString(),
      destinationAddress
    });

    // Build query parameters
    const params = new URLSearchParams({
      from_asset: fromThorAsset,
      to_asset: toThorAsset,
      amount: amount.toString(),
      ...(destinationAddress && { destination: destinationAddress }),
      ...(affiliateAddress && { affiliate: affiliateAddress }),
      ...(affiliateBps && { affiliate_bps: affiliateBps.toString() }),
    });

    const url = `${THORNODE_URL}/thorchain/quote/swap?${params.toString()}`;
    console.log('📡 [THORChain] Fetching quote from:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [THORChain] Failed to fetch quote:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      // Try to parse error message and extract meaningful info
      let errorMessage = 'Failed to fetch swap quote';
      try {
        const errorData = JSON.parse(errorText);
        console.error('❌ [THORChain] Error details:', errorData);

        // Extract the most relevant error message
        if (errorData.message) {
          errorMessage = errorData.message;

          // Make specific errors more user-friendly
          if (errorMessage.includes('trading is halted')) {
            errorMessage = 'THORChain trading is currently halted. Please try again later.';
          } else if (errorMessage.includes('insufficient funds')) {
            errorMessage = 'Insufficient liquidity in pool for this swap.';
          } else if (errorMessage.includes('pool is suspended')) {
            errorMessage = 'This trading pool is temporarily suspended.';
          }
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Not JSON, use status text if available
        if (response.statusText) {
          errorMessage = `${response.statusText}: ${errorText}`;
        } else {
          errorMessage = errorText || 'Unknown error from THORChain';
        }
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ [THORChain] Quote response:', {
      expectedAmountOut: data.expected_amount_out,
      fees: data.fees,
      memo: data.memo,
      inboundAddress: data.inbound_address,
      warning: data.warning,
      notes: data.notes,
      fullResponse: data
    });
    
    // Validate the response has required fields
    if (!data.expected_amount_out || data.expected_amount_out === "0") {
      console.error('⚠️ [THORChain] Invalid quote - zero or missing expected_amount_out:', data);
      throw new Error('Invalid quote: zero output amount. Pool may have insufficient liquidity.');
    }

    return data;
  } catch (error) {
    console.error('❌ [THORChain] Error fetching quote:', error);
    // Re-throw the error so it can be caught by the caller with proper error message
    throw error;
  }
}

// Get pool information
export async function getPool(asset: string): Promise<PoolData | null> {
  try {
    const thorAsset = THORCHAIN_ASSETS[asset];
    if (!thorAsset) {
      console.error('Asset not supported on THORChain:', asset);
      return null;
    }

    const url = `${THORNODE_URL}/thorchain/pool/${thorAsset}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Failed to fetch pool:', response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pool:', error);
    return null;
  }
}

// Calculate exchange rate from pools
export async function getExchangeRate(fromAsset: string, toAsset: string): Promise<number | null> {
  try {
    // For RUNE pairs, we can calculate directly
    if (fromAsset === 'RUNE' || toAsset === 'RUNE') {
      const nonRuneAsset = fromAsset === 'RUNE' ? toAsset : fromAsset;
      const pool = await getPool(nonRuneAsset);
      
      if (!pool) return null;
      
      const assetBalance = parseFloat(pool.balance_asset);
      const runeBalance = parseFloat(pool.balance_rune);
      
      if (fromAsset === 'RUNE') {
        return assetBalance / runeBalance;
      } else {
        return runeBalance / assetBalance;
      }
    }
    
    // For non-RUNE pairs, we need to go through RUNE
    const fromPool = await getPool(fromAsset);
    const toPool = await getPool(toAsset);
    
    if (!fromPool || !toPool) return null;
    
    const fromAssetBalance = parseFloat(fromPool.balance_asset);
    const fromRuneBalance = parseFloat(fromPool.balance_rune);
    const toAssetBalance = parseFloat(toPool.balance_asset);
    const toRuneBalance = parseFloat(toPool.balance_rune);
    
    // Calculate: fromAsset -> RUNE -> toAsset
    const fromToRune = fromRuneBalance / fromAssetBalance;
    const runeToTo = toAssetBalance / toRuneBalance;
    
    return fromToRune * runeToTo;
  } catch (error) {
    console.error('Error calculating exchange rate:', error);
    return null;
  }
}

/**
 * Get the decimal precision for an asset from Pioneer SDK assetContext
 *
 * CRITICAL: This function REQUIRES assetContext from Pioneer SDK.
 * We do NOT use hardcoded decimals or fallbacks - always trust the SDK.
 *
 * @param assetContext - Asset context from Pioneer SDK (REQUIRED)
 * @returns Decimal precision for the asset
 * @throws Error if assetContext is missing or lacks decimals/precision
 */
export function getAssetDecimals(assetContext: any): number {
  // CRITICAL: Always use SDK assetContext data, NEVER hardcoded fallbacks
  if (!assetContext) {
    console.error('❌ CRITICAL: getAssetDecimals called without assetContext!');
    throw new Error('getAssetDecimals requires assetContext from Pioneer SDK');
  }

  // Try precision first, then decimals
  const decimals = assetContext.precision ?? assetContext.decimals;

  if (decimals === undefined || decimals === null) {
    console.error('❌ CRITICAL: assetContext missing decimals/precision:', assetContext);
    throw new Error(`Asset ${assetContext.symbol || 'unknown'} has no decimals/precision in assetContext`);
  }

  return decimals;
}

// Convert amount to base units based on asset
// IMPORTANT: THORChain uses 8 decimals for ALL assets, regardless of native decimals
export function toBaseUnit(amount: string, assetContext: any): number {
  const value = parseFloat(amount);
  const decimal = 8; // THORChain always uses 8 decimals internally
  const result = Math.floor(value * Math.pow(10, decimal));

  console.log('🔢 [THORChain] Converting to base units:', {
    symbol: assetContext?.symbol || 'unknown',
    inputAmount: amount,
    value,
    decimals: decimal,
    result,
    resultFormatted: result.toLocaleString(),
    note: 'THORChain uses 8 decimals for all assets'
  });

  return result;
}

// Convert from base units to display units
// IMPORTANT: THORChain uses 8 decimals for ALL assets internally
export function fromBaseUnit(amount: string, assetContext: any, isThorchainResponse: boolean = false): string {
  const value = parseFloat(amount);

  // THORChain always uses 8 decimals internally, regardless of the asset
  const decimal = isThorchainResponse ? 8 : getAssetDecimals(assetContext);
  const result = value / Math.pow(10, decimal);

  console.log('💱 [THORChain] Converting from base units:', {
    symbol: assetContext?.symbol || 'unknown',
    baseAmount: amount,
    value,
    decimals: decimal,
    isThorchainResponse,
    result,
    resultFormatted: result.toFixed(18)
  });

  // Format based on size - handle very small numbers better
  if (result === 0) return '0';
  if (result < 0.000001) return result.toExponential(2); // Use scientific notation for very small numbers
  if (result < 0.0001) return result.toFixed(8);
  if (result < 1) return result.toFixed(6);
  if (result < 100) return result.toFixed(4);
  return result.toFixed(2);
}