// THORChain quote service for native asset swaps
const THORNODE_URL = 'https://thornode.ninerealms.com';
const MIDGARD_URL = 'https://midgard.ninerealms.com';

// Asset mapping for THORChain
const THORCHAIN_ASSETS: Record<string, string> = {
  'BTC': 'BTC.BTC',
  'ETH': 'ETH.ETH',
  'BCH': 'BCH.BCH',
  'LTC': 'LTC.LTC',
  'DOGE': 'DOGE.DOGE',
  'RUNE': 'THOR.RUNE',
  'ATOM': 'GAIA.ATOM',
  'AVAX': 'AVAX.AVAX',
  'BNB': 'BNB.BNB',
  'CACAO': 'MAYA.CACAO',
};

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
      
      // Try to parse error message
      try {
        const errorData = JSON.parse(errorText);
        console.error('❌ [THORChain] Error details:', errorData);
      } catch (e) {
        // Not JSON, log as is
      }
      
      return null;
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
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ [THORChain] Error fetching quote:', error);
    return null;
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

// Convert amount to base units based on asset
export function toBaseUnit(amount: string, symbol: string): number {
  const value = parseFloat(amount);
  
  // Define decimals for each asset
  const decimals: Record<string, number> = {
    'BTC': 8,
    'ETH': 18,
    'BCH': 8,
    'LTC': 8,
    'DOGE': 8,
    'RUNE': 8,
    'ATOM': 6,
    'AVAX': 18,
    'BNB': 8,
    'CACAO': 10,
    'OSMO': 6,
  };
  
  const decimal = decimals[symbol] || 8;
  const result = Math.floor(value * Math.pow(10, decimal));
  
  console.log('🔢 [THORChain] Converting to base units:', {
    symbol,
    inputAmount: amount,
    value,
    decimals: decimal,
    result,
    resultFormatted: result.toLocaleString()
  });
  
  return result;
}

// Convert from base units to display units
// IMPORTANT: THORChain uses 8 decimals for ALL assets internally
export function fromBaseUnit(amount: string, symbol: string, isThorchainResponse: boolean = false): string {
  const value = parseFloat(amount);
  
  const decimals: Record<string, number> = {
    'BTC': 8,
    'ETH': 18,
    'BCH': 8,
    'LTC': 8,
    'DOGE': 8,
    'RUNE': 8,
    'ATOM': 6,
    'AVAX': 18,
    'BNB': 8,
    'CACAO': 10,
    'OSMO': 6,
  };
  
  // THORChain always uses 8 decimals internally, regardless of the asset
  const decimal = isThorchainResponse ? 8 : (decimals[symbol] || 8);
  const result = value / Math.pow(10, decimal);
  
  console.log('💱 [THORChain] Converting from base units:', {
    symbol,
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