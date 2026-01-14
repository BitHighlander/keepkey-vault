/**
 * Quote Service
 *
 * Wraps Pioneer SDK and THORNode API for fetching swap quotes, exchange rates,
 * and time estimates. All quote operations should go through this service.
 */

import type { AssetContextState } from '@/components/providers/pioneer';
import { convertCaipToThorAsset } from '@/lib/asset-utils';

// THORNode API base URL
const THORNODE_API_URL = 'https://thornode.ninerealms.com';

/**
 * Quote response from THORChain
 */
export interface ThorchainQuote {
  expected_amount_out: string; // Amount in 8-decimal format
  fees: {
    outbound: string;
    liquidity: string;
    affiliate: string;
    total: string;
    totalBps?: number;
  };
  slippage_bps: number;
  streaming_swap_blocks?: number;
  streaming_swap_seconds?: number;
  inbound_confirmation_seconds: number;
  inbound_confirmation_blocks: number;
  outbound_delay_seconds: number;
  outbound_delay_blocks: number;
  total_swap_seconds: number;
  memo: string;
  integration?: string;
}

/**
 * Time estimate for swap completion
 */
export interface SwapTimeEstimate {
  total_swap_seconds: number;
  inbound_confirmation_seconds: number;
  inbound_confirmation_blocks: number;
  outbound_delay_seconds: number;
  outbound_delay_blocks: number;
  streaming_swap_seconds?: number;
  streaming_swap_blocks?: number;
  fees: {
    outbound: string;
    liquidity: string;
    affiliate: string;
    total: string;
  };
  slippage_bps: number;
  expected_amount_out: string;
  fetchedAt: number;
}

/**
 * Fetch swap quote from THORChain
 *
 * @param fromSymbol - Source asset symbol (e.g., "BTC", "ETH", "USDC")
 * @param toSymbol - Destination asset symbol
 * @param amount - Amount in base units (8 decimals for THORChain)
 * @param destination - Optional destination address
 * @returns THORChain quote data or null if failed
 *
 * @example
 * const quote = await getThorchainQuote("BTC", "ETH", "10000000"); // 0.1 BTC
 */
export async function getThorchainQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: string,
  destination?: string
): Promise<ThorchainQuote | null> {
  try {
    // Build query parameters
    const params = new URLSearchParams({
      from_asset: `${fromSymbol}.${fromSymbol}`, // e.g., "BTC.BTC"
      to_asset: `${toSymbol}.${toSymbol}`, // e.g., "ETH.ETH"
      amount: amount, // Base units (8 decimals)
    });

    if (destination) {
      params.append('destination', destination);
    }

    const url = `${THORNODE_API_URL}/thorchain/quote/swap?${params.toString()}`;

    console.log(`[SWAP-DEBUG] 🔍 Quote API: ${fromSymbol}.${fromSymbol} → ${toSymbol}.${toSymbol} amount=${amount}`);
    console.log(`[SWAP-DEBUG] 🌐 URL: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SWAP-DEBUG] ❌ THORNode HTTP error: ${response.status} ${response.statusText}`);
      console.error(`[SWAP-DEBUG] ❌ Response body:`, errorText);
      throw new Error(`THORNode returned ${response.status}: ${errorText}`);
    }

    const quoteData = await response.json();

    console.log(`[SWAP-DEBUG] ✅ Quote received: expectedOut=${quoteData.expected_amount_out} slippage=${quoteData.slippage_bps}bps`);

    return quoteData as ThorchainQuote;
  } catch (error: any) {
    console.error(`[SWAP-DEBUG] ❌ Quote fetch failed:`, {
      error,
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Fetch swap quote using CAIP identifiers (alternative method)
 *
 * @param fromCaip - Source asset CAIP (e.g., "eip155:1/slip44:60")
 * @param toCaip - Destination asset CAIP
 * @param amount - Amount in base units
 * @param destination - Optional destination address
 * @returns THORChain quote data or null if failed
 */
export async function getThorchainQuoteByCAIP(
  fromCaip: string,
  toCaip: string,
  amount: string,
  destination?: string
): Promise<ThorchainQuote | null> {
  try {
    // Convert CAIP to THORChain asset format
    const fromAsset = convertCaipToThorAsset(fromCaip);
    const toAsset = convertCaipToThorAsset(toCaip);

    console.log('🔄 [getThorchainQuoteByCAIP] Converting CAIP:', {
      fromCaip,
      toCaip,
      fromAsset,
      toAsset
    });

    // Build query parameters
    const params = new URLSearchParams({
      from_asset: fromAsset, // e.g., "BTC.BTC" or "ETH.USDC-0XA0B8"
      to_asset: toAsset,
      amount: amount,
    });

    if (destination) {
      params.append('destination', destination);
    }

    const url = `${THORNODE_API_URL}/thorchain/quote/swap?${params.toString()}`;

    console.log('🔍 [getThorchainQuoteByCAIP] Fetching quote:', url);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [getThorchainQuoteByCAIP] THORNode error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`THORNode returned ${response.status}: ${errorText}`);
    }

    const quoteData = await response.json();

    console.log('✅ [getThorchainQuoteByCAIP] Quote received:', {
      expectedOut: quoteData.expected_amount_out,
      fees: quoteData.fees
    });

    return quoteData as ThorchainQuote;
  } catch (error: any) {
    console.error('❌ [getThorchainQuoteByCAIP] Failed to fetch quote:', error.message);
    return null;
  }
}

/**
 * Calculate exchange rate between two assets
 *
 * @param fromSymbol - Source asset symbol
 * @param toSymbol - Destination asset symbol
 * @param amount - Optional amount for quote-based rate (defaults to "1")
 * @returns Exchange rate or null if failed
 *
 * @example
 * const rate = await getExchangeRate("BTC", "ETH"); // Returns ~15.5 (1 BTC = 15.5 ETH)
 */
export async function getExchangeRate(
  fromSymbol: string,
  toSymbol: string,
  amount: string = '100000000' // Default: 1 unit in 8 decimals
): Promise<number | null> {
  try {
    console.log('📊 [getExchangeRate] Fetching rate:', {
      from: fromSymbol,
      to: toSymbol,
      amount
    });

    // Get quote for the specified amount
    const quote = await getThorchainQuote(fromSymbol, toSymbol, amount);

    if (!quote || !quote.expected_amount_out) {
      console.warn('⚠️ [getExchangeRate] No quote data available');
      return null;
    }

    // Calculate rate: output / input
    // Both are in 8 decimal format from THORChain
    const inputAmount = parseFloat(amount);
    const outputAmount = parseFloat(quote.expected_amount_out);

    const rate = outputAmount / inputAmount;

    console.log('✅ [getExchangeRate] Rate calculated:', {
      input: inputAmount,
      output: outputAmount,
      rate: rate.toFixed(6)
    });

    return rate;
  } catch (error: any) {
    console.error('❌ [getExchangeRate] Failed to calculate rate:', error.message);
    return null;
  }
}

/**
 * Fetch swap time estimate from THORNode
 *
 * @param fromAsset - Source asset in THORChain format (e.g., "BTC.BTC")
 * @param toAsset - Destination asset in THORChain format
 * @param amount - Amount in base units
 * @param destination - Optional destination address
 * @returns Time estimate or null if failed
 */
export async function getSwapTimeEstimate(
  fromAsset: string,
  toAsset: string,
  amount: string,
  destination?: string
): Promise<SwapTimeEstimate | null> {
  try {
    console.log('⏱️ [getSwapTimeEstimate] Fetching time estimate:', {
      from: fromAsset,
      to: toAsset,
      amount
    });

    // Use the quote endpoint which includes timing data
    const params = new URLSearchParams({
      from_asset: fromAsset,
      to_asset: toAsset,
      amount: amount,
    });

    if (destination) {
      params.append('destination', destination);
    }

    const url = `${THORNODE_API_URL}/thorchain/quote/swap?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`THORNode returned ${response.status}`);
    }

    const data = await response.json();

    // Extract timing and fee information
    const estimate: SwapTimeEstimate = {
      total_swap_seconds: data.total_swap_seconds || 3600, // Default: 1 hour
      inbound_confirmation_seconds: data.inbound_confirmation_seconds || 600,
      inbound_confirmation_blocks: data.inbound_confirmation_blocks || 6,
      outbound_delay_seconds: data.outbound_delay_seconds || 1800,
      outbound_delay_blocks: data.outbound_delay_blocks || 180,
      streaming_swap_seconds: data.streaming_swap_seconds,
      streaming_swap_blocks: data.streaming_swap_blocks,
      fees: {
        outbound: data.fees?.outbound || '0',
        liquidity: data.fees?.liquidity || '0',
        affiliate: data.fees?.affiliate || '0',
        total: data.fees?.total || '0',
      },
      slippage_bps: data.slippage_bps || 0,
      expected_amount_out: data.expected_amount_out || '0',
      fetchedAt: Date.now(),
    };

    console.log('✅ [getSwapTimeEstimate] Estimate received:', {
      totalSeconds: estimate.total_swap_seconds,
      inboundSeconds: estimate.inbound_confirmation_seconds,
      outboundSeconds: estimate.outbound_delay_seconds
    });

    return estimate;
  } catch (error: any) {
    console.error('❌ [getSwapTimeEstimate] Failed to fetch estimate:', error.message);
    return null;
  }
}

/**
 * Get default time estimates (fallback when API unavailable)
 *
 * @returns Default timing estimates in seconds
 */
export function getDefaultTimeEstimates() {
  return {
    input_detection: 60,              // 1 minute
    input_first_confirmation: 300,    // 5 minutes
    input_full_confirmation: 600,     // 10 minutes
    protocol_processing: 1800,        // 30 minutes
    output_detection: 300,            // 5 minutes
    output_confirmation: 600,         // 10 minutes
    total: 3600,                      // 1 hour total
  };
}

/**
 * Get THORChain inbound vault address for a specific chain
 *
 * @param chain - Chain identifier (e.g., "BTC", "ETH", "BCH")
 * @returns Vault address information or null if failed
 *
 * @example
 * const vault = await getThorchainInboundAddress("BTC");
 * // Returns: { address: "bc1q...", chain: "BTC", gas_rate: "10" }
 */
export async function getThorchainInboundAddress(
  chain: string
): Promise<{ address: string; chain: string; gas_rate?: string } | null> {
  try {
    console.log('🏦 [getThorchainInboundAddress] Fetching vault address for chain:', chain);

    const url = `${THORNODE_API_URL}/thorchain/inbound_addresses`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`THORNode returned ${response.status}`);
    }

    const inboundAddresses = await response.json();

    // Find the address for the requested chain
    const vaultInfo = inboundAddresses.find(
      (addr: any) => addr.chain?.toUpperCase() === chain.toUpperCase()
    );

    if (!vaultInfo) {
      console.warn(`⚠️ [getThorchainInboundAddress] No vault found for chain: ${chain}`);
      return null;
    }

    console.log('✅ [getThorchainInboundAddress] Vault address found:', {
      chain: vaultInfo.chain,
      address: vaultInfo.address,
      gasRate: vaultInfo.gas_rate
    });

    return {
      address: vaultInfo.address,
      chain: vaultInfo.chain,
      gas_rate: vaultInfo.gas_rate,
    };
  } catch (error: any) {
    console.error('❌ [getThorchainInboundAddress] Failed to fetch vault address:', error.message);
    return null;
  }
}
