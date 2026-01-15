/**
 * Pioneer Swap Service
 *
 * Proper wrapper around Pioneer SDK's swap/quote functionality.
 * Follows patterns from Pioneer SDK e2e tests.
 *
 * @see projects/pioneer/e2e/swaps/e2e-swap-suite/src/simple-swap.ts
 */

export interface SwapQuoteRequest {
  caipIn: string;      // e.g., "eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7"
  caipOut: string;     // e.g., "bip122:000000000019d6689c085ae165831e93/slip44:0"
  amount: string;      // Decimal string: "100.5"
  slippagePercentage?: number;  // Default: 3
  isMax?: boolean;     // Use max available balance
}

export interface SwapQuoteResponse {
  quote: {
    amountOut: string;
    amountOutMin: string;
    fees: {
      network: string;
      protocol: string;
      affiliate: string;
    };
    memo: string;
    integration: string;
    raw: any;
  };
  txs: Array<{
    type: string;
    chain: string;
    txParams: {
      senderAddress: string;
      recipientAddress: string;
      amount: string;
      token: string;
      memo: string;
      vaultAddress?: string;
    };
  }>;
}

/**
 * Get swap quote from Pioneer SDK
 *
 * This function wraps Pioneer SDK's app.swap() method which internally:
 * 1. Sets asset contexts
 * 2. Calls app.pioneer.Quote()
 * 3. Returns unsigned transaction with quote data
 *
 * @param app - Pioneer SDK app instance
 * @param request - Quote request parameters with CAIP identifiers
 * @returns Quote response with transaction data
 * @throws Error if quote fails or required fields are missing
 */
export async function getSwapQuote(
  app: any,
  request: SwapQuoteRequest
): Promise<SwapQuoteResponse> {
  const tag = '[Pioneer Swap]';

  // Validate required fields (fail fast)
  if (!request.caipIn) {
    throw new Error(`${tag} caipIn required`);
  }
  if (!request.caipOut) {
    throw new Error(`${tag} caipOut required`);
  }
  if (!request.isMax && !request.amount) {
    throw new Error(`${tag} amount or isMax required`);
  }

  console.log(`${tag} 🔍 Getting quote...`);
  console.log(`${tag} From: ${request.caipIn}`);
  console.log(`${tag} To: ${request.caipOut}`);
  console.log(`${tag} Amount: ${request.amount}`);
  console.log(`${tag} Slippage: ${request.slippagePercentage || 3}%`);

  try {
    // Set asset contexts (required by Pioneer SDK before calling swap)
    console.log(`${tag} Setting asset contexts...`);
    await app.setAssetContext({ caip: request.caipIn });
    await app.setOutboundAssetContext({ caip: request.caipOut });

    // Build swap payload
    const swapPayload = {
      caipIn: request.caipIn,
      caipOut: request.caipOut,
      amount: request.amount,
      slippagePercentage: request.slippagePercentage || 3,
      isMax: request.isMax || false,
    };

    console.log(`${tag} Calling app.swap()...`);
    console.log(`${tag} 📦 Swap payload:`, JSON.stringify(swapPayload, null, 2));

    // Call Pioneer SDK's swap method
    // This internally calls app.pioneer.Quote() and returns unsigned tx
    const result = await app.swap(swapPayload);

    console.log(`${tag} ✅ Raw response received from app.swap()`);
    console.log(`${tag} 📦 FULL RESPONSE STRUCTURE:`, JSON.stringify(result, null, 2));
    console.log(`${tag} 📊 Response keys:`, Object.keys(result || {}));
    console.log(`${tag} 📊 Quote exists:`, !!result.quote);
    console.log(`${tag} 📊 Quote keys:`, result.quote ? Object.keys(result.quote) : 'N/A');
    console.log(`${tag} 📊 Quote structure:`, result.quote ? JSON.stringify(result.quote, null, 2) : 'N/A');
    console.log(`${tag} Integration: ${result.quote?.integration || 'unknown'}`);
    console.log(`${tag} Expected output: ${result.quote?.amountOut || '?'}`);
    console.log(`${tag} Minimum output: ${result.quote?.amountOutMin || '?'}`);

    // Validate quote structure
    if (!result.quote) {
      console.error(`${tag} ❌ VALIDATION FAILED: No quote object in response`);
      console.error(`${tag} Full result:`, JSON.stringify(result, null, 2));
      throw new Error(`${tag} No quote in response`);
    }
    if (!result.quote.amountOut) {
      console.error(`${tag} ❌ VALIDATION FAILED: Missing amountOut in quote`);
      console.error(`${tag} Quote object:`, JSON.stringify(result.quote, null, 2));
      throw new Error(`${tag} Missing amountOut in quote`);
    }

    return result;

  } catch (error: any) {
    console.error(`${tag} ❌ Quote failed:`, error);
    throw new Error(
      `${tag} Quote failed for ${request.caipIn} → ${request.caipOut}: ${error.message}`
    );
  }
}

/**
 * Get exchange rate between two assets
 *
 * This is a convenience function that gets a quote and extracts the rate.
 *
 * @param app - Pioneer SDK app instance
 * @param caipIn - Input asset CAIP
 * @param caipOut - Output asset CAIP
 * @param amount - Amount to quote (default: "1")
 * @returns Exchange rate as a number
 */
export async function getExchangeRate(
  app: any,
  caipIn: string,
  caipOut: string,
  amount: string = '1'
): Promise<number> {
  const quote = await getSwapQuote(app, {
    caipIn,
    caipOut,
    amount,
    slippagePercentage: 3,
  });

  const amountOut = parseFloat(quote.quote.amountOut);
  const amountIn = parseFloat(amount);

  return amountOut / amountIn;
}
