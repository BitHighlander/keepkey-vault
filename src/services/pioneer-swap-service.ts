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
    // DIAGNOSTIC: Check available pubkeys and their address types BEFORE swap
    console.log(`${tag} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${tag} 🔍 PRE-SWAP DIAGNOSTICS`);
    console.log(`${tag} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Extract network from CAIP
    const networkIdIn = request.caipIn.split('/')[0];
    const networkIdOut = request.caipOut.split('/')[0];

    console.log(`${tag} Input network: ${networkIdIn}`);
    console.log(`${tag} Output network: ${networkIdOut}`);

    // Find all pubkeys for input network
    const pubkeysIn = app.pubkeys?.filter((pk: any) =>
      pk.networks?.includes(networkIdIn) ||
      pk.networks?.some((n: string) => n.startsWith(networkIdIn.split(':')[0]))
    ) || [];

    console.log(`${tag} Found ${pubkeysIn.length} pubkeys for input network ${networkIdIn}`);
    pubkeysIn.forEach((pk: any, idx: number) => {
      console.log(`${tag}   [${idx}] ${pk.note || 'Unnamed'}`);
      console.log(`${tag}       type: ${pk.type} (xpub/ypub/zpub/address)`);
      console.log(`${tag}       script_type: ${pk.script_type} (p2pkh/p2sh-p2wpkh/p2wpkh)`);
      console.log(`${tag}       address: ${pk.address?.substring(0, 20)}...`);
      console.log(`${tag}       master: ${pk.master?.substring(0, 20)}...`);
      console.log(`${tag}       path: m/${pk.addressNList?.map((n: number) => n >= 0x80000000 ? `${n - 0x80000000}'` : n).join('/')}`);
    });

    // Check specifically for zpub (p2wpkh) addresses
    const zpubKeys = pubkeysIn.filter((pk: any) => pk.type === 'zpub' || pk.script_type === 'p2wpkh');
    const ypubKeys = pubkeysIn.filter((pk: any) => pk.type === 'ypub' || pk.script_type === 'p2sh-p2wpkh');
    const xpubKeys = pubkeysIn.filter((pk: any) => pk.type === 'xpub' || pk.script_type === 'p2pkh');

    console.log(`${tag} Address type breakdown for input network:`);
    console.log(`${tag}   ✅ Native SegWit (zpub/p2wpkh): ${zpubKeys.length}`);
    console.log(`${tag}   ⚠️  Wrapped SegWit (ypub/p2sh-p2wpkh): ${ypubKeys.length}`);
    console.log(`${tag}   ❌ Legacy (xpub/p2pkh): ${xpubKeys.length}`);

    if (zpubKeys.length === 0) {
      console.error(`${tag} ⚠️ WARNING: No p2wpkh (Native SegWit) addresses available!`);
      console.error(`${tag} This will cause swap to fail if protocol requires p2wpkh for change address`);
    }

    console.log(`${tag} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Set asset contexts (required by Pioneer SDK before calling swap)
    console.log(`${tag} Setting asset contexts...`);
    await app.setAssetContext({ caip: request.caipIn });
    await app.setOutboundAssetContext({ caip: request.caipOut });

    // DIAGNOSTIC: Log what contexts were actually set
    console.log(`${tag} Asset contexts set:`);
    console.log(`${tag}   assetContext:`, JSON.stringify({
      caip: app.assetContext?.caip,
      symbol: app.assetContext?.symbol,
      address: app.assetContext?.address?.substring(0, 20) + '...',
      networkId: app.assetContext?.networkId
    }, null, 2));
    console.log(`${tag}   outboundAssetContext:`, JSON.stringify({
      caip: app.outboundAssetContext?.caip,
      symbol: app.outboundAssetContext?.symbol,
      address: app.outboundAssetContext?.address?.substring(0, 20) + '...',
      networkId: app.outboundAssetContext?.networkId
    }, null, 2));

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
    console.error(`${tag} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`${tag} ❌ SWAP QUOTE FAILED`);
    console.error(`${tag} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`${tag} Error message:`, error.message);
    console.error(`${tag} Error stack:`, error.stack);
    console.error(`${tag} Full error object:`, JSON.stringify(error, null, 2));

    // Check if error is related to address types
    if (error.message?.includes('p2wpkh') || error.message?.includes('xpub') || error.message?.includes('change address')) {
      console.error(`${tag} 🔍 ADDRESS TYPE ERROR DETECTED`);
      console.error(`${tag} This error indicates the swap requires p2wpkh (Native SegWit) addresses`);
      console.error(`${tag} but only p2pkh (Legacy) addresses are available.`);
      console.error(`${tag}`);
      console.error(`${tag} Possible causes:`);
      console.error(`${tag} 1. Wallet not paired or pubkeys not loaded`);
      console.error(`${tag} 2. Native SegWit (BIP84/zpub) paths not registered`);
      console.error(`${tag} 3. Asset context set to wrong address type`);
      console.error(`${tag} 4. Regression in path configuration`);
    }

    console.error(`${tag} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

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
