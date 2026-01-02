/**
 * ERC20 Token Utilities for Swap Approvals
 *
 * Handles checking and building approval transactions for ERC20 tokens
 * Required for THORChain swaps where the router needs permission to transfer tokens
 *
 * NOTE: Uses Pioneer SDK which internally uses Pioneer Server API for all RPC calls
 * This leverages failover and retry logic without directly calling the API
 */

/**
 * Check if a spender (like THORChain router) has sufficient allowance to spend tokens
 *
 * @param sdk - Pioneer SDK instance (from state.app, not app.pioneer!)
 * @param tokenAddress - ERC20 token contract address (e.g., USDT)
 * @param ownerAddress - Token owner's address (your wallet)
 * @param spenderAddress - Address that will spend tokens (THORChain router)
 * @param requiredAmount - Amount needed in base units (e.g., 1000000 for 1 USDT)
 * @param networkId - Network ID (e.g., "eip155:1" for Ethereum mainnet)
 * @returns Object with hasApproval boolean and current allowance
 */
export async function checkERC20Allowance(
  sdk: any,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: string,
  networkId: string = 'eip155:1'
): Promise<{ hasApproval: boolean; currentAllowance: string; requiredAmount: string }> {
  try {
    console.log('🔍 Checking ERC20 allowance via Pioneer SDK:', {
      token: tokenAddress,
      owner: ownerAddress,
      spender: spenderAddress,
      requiredAmount,
      networkId
    });

    // DEBUG: Verify SDK object and methods
    console.log('🔧 DEBUG - SDK object type:', typeof sdk);
    console.log('🔧 DEBUG - CheckERC20Allowance exists:', typeof sdk?.CheckERC20Allowance);
    console.log('🔧 DEBUG - SDK keys sample:', Object.keys(sdk || {}).filter(k => k.includes('ERC20') || k.includes('Check')).slice(0, 10));

    // Call Pioneer SDK method (Pascal case)
    const result = await sdk.CheckERC20Allowance({
      networkId,
      contractAddress: tokenAddress,
      ownerAddress,
      spenderAddress
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to check allowance');
    }

    const allowanceString = result.data.allowance;

    // Check if allowance is sufficient
    const hasApproval = BigInt(allowanceString) >= BigInt(requiredAmount);

    console.log('✅ ERC20 Allowance Check Result:', {
      currentAllowance: allowanceString,
      requiredAmount,
      hasApproval,
    });

    return {
      hasApproval,
      currentAllowance: allowanceString,
      requiredAmount,
    };
  } catch (error) {
    console.error('❌ Error checking ERC20 allowance:', error);
    throw new Error(`Failed to check token allowance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build an ERC20 approval transaction
 *
 * @param sdk - Pioneer SDK instance (from state.app, not app.pioneer!)
 * @param tokenAddress - ERC20 token contract address
 * @param spenderAddress - Address to approve (THORChain router)
 * @param amount - Amount to approve in base units (or 'max' for unlimited)
 * @param ownerAddress - Token owner's address (for transaction 'from' field)
 * @param networkId - Network ID (e.g., "eip155:1" for Ethereum mainnet)
 * @returns Unsigned transaction object ready to be signed
 */
export async function buildERC20ApprovalTx(
  sdk: any,
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  ownerAddress: string,
  networkId: string = 'eip155:1'
): Promise<{
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  nonce: number;
  gasLimit: string;
  gasPrice: string;
}> {
  try {
    console.log('🔨 Building ERC20 approval tx via Pioneer SDK:', {
      token: tokenAddress,
      spender: spenderAddress,
      amount: amount === 'max' ? 'UNLIMITED' : amount,
      from: ownerAddress,
      networkId
    });

    // Call Pioneer SDK method (Pascal case)
    const result = await sdk.BuildERC20ApprovalTx({
      networkId,
      contractAddress: tokenAddress,
      spenderAddress,
      ownerAddress,
      amount
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to build approval transaction');
    }

    console.log('✅ Approval transaction built successfully');

    return result.data.tx;
  } catch (error) {
    console.error('❌ Error building approval transaction:', error);
    throw new Error(`Failed to build approval tx: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper to detect if an asset is an ERC20 token (not native ETH)
 *
 * @param caip - CAIP identifier (e.g., "eip155:1/erc20:0xdac17...")
 * @returns true if it's an ERC20 token
 */
export function isERC20Token(caip: string): boolean {
  return caip.includes('/erc20:') || caip.includes('/erc-20:');
}

/**
 * Extract token contract address from CAIP identifier
 *
 * @param caip - CAIP identifier (e.g., "eip155:1/erc20:0xdac17...")
 * @returns Token contract address or null if not ERC20
 */
export function getTokenAddressFromCAIP(caip: string): string | null {
  if (!isERC20Token(caip)) {
    return null;
  }

  // Extract address after "erc20:" or "erc-20:"
  const match = caip.match(/erc-?20:0x[a-fA-F0-9]{40}/i);
  if (!match) {
    return null;
  }

  // Return just the address part (after "erc20:")
  return match[0].split(':')[1];
}

/**
 * Get chain ID from CAIP network identifier
 *
 * @param caip - CAIP identifier (e.g., "eip155:1/erc20:...")
 * @returns Chain ID (e.g., 1 for Ethereum mainnet)
 */
export function getChainIdFromCAIP(caip: string): number {
  const match = caip.match(/eip155:(\d+)/);
  if (!match) {
    return 1; // Default to Ethereum mainnet
  }
  return parseInt(match[1], 10);
}

/**
 * Poll for approval transaction confirmation and verify allowance
 *
 * @param sdk - Pioneer SDK instance
 * @param txHash - Transaction hash to monitor
 * @param tokenAddress - ERC20 token contract address
 * @param ownerAddress - Token owner's address
 * @param spenderAddress - Spender address (THORChain router)
 * @param requiredAmount - Required approval amount
 * @param networkId - Network ID (e.g., "eip155:1")
 * @param options - Polling options (timeout, interval)
 * @returns Promise that resolves when approval is confirmed
 */
export async function pollForApprovalConfirmation(
  sdk: any,
  txHash: string,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: string,
  networkId: string = 'eip155:1',
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 120000; // 2 minutes default
  const initialInterval = options.interval || 2000; // 2 seconds default
  const maxInterval = 10000; // Max 10 seconds between polls
  const startTime = Date.now();

  console.log('⏳ Polling for approval transaction confirmation:', {
    txHash,
    timeout: `${timeout / 1000}s`,
    initialInterval: `${initialInterval / 1000}s`
  });

  let attempts = 0;
  let currentInterval = initialInterval;

  while (Date.now() - startTime < timeout) {
    attempts++;

    try {
      // Check if transaction is confirmed
      console.log(`🔍 Polling attempt ${attempts} (interval: ${currentInterval / 1000}s)...`);

      // Use Pioneer SDK to get transaction receipt
      const receiptResult = await sdk.GetTransactionReceipt({
        networkId,
        txHash
      });

      if (receiptResult.success && receiptResult.data?.receipt) {
        const receipt = receiptResult.data.receipt;
        console.log('📝 Receipt found:', {
          blockNumber: receipt.blockNumber,
          status: receipt.status,
          gasUsed: receipt.gasUsed
        });

        // Check if transaction was successful
        if (receipt.status === '0x1' || receipt.status === 1 || receipt.status === true) {
          console.log('✅ Transaction confirmed successfully');

          // Re-check allowance to verify it actually increased
          console.log('🔍 Verifying allowance increased...');
          const allowanceCheck = await checkERC20Allowance(
            sdk,
            tokenAddress,
            ownerAddress,
            spenderAddress,
            requiredAmount,
            networkId
          );

          if (allowanceCheck.hasApproval) {
            console.log('✅ Allowance confirmed increased:', allowanceCheck.currentAllowance);
            return; // Success!
          } else {
            console.warn('⚠️ Transaction confirmed but allowance not sufficient:', {
              current: allowanceCheck.currentAllowance,
              required: requiredAmount
            });
            throw new Error('Approval transaction confirmed but allowance not updated');
          }
        } else {
          console.error('❌ Transaction failed on-chain');
          throw new Error('Approval transaction reverted');
        }
      }

      // No receipt yet, wait and try again with exponential backoff
      await new Promise(resolve => setTimeout(resolve, currentInterval));

      // Increase interval for next attempt (exponential backoff)
      currentInterval = Math.min(currentInterval * 1.5, maxInterval);

    } catch (error: any) {
      // If error is a confirmation failure, throw it
      if (error.message?.includes('reverted') || error.message?.includes('not updated')) {
        throw error;
      }

      // Otherwise, it might be a transient error, continue polling
      console.log(`⚠️ Error during polling (will retry): ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, currentInterval));
      currentInterval = Math.min(currentInterval * 1.5, maxInterval);
    }
  }

  // Timeout reached
  console.error('❌ Approval confirmation timeout after', (Date.now() - startTime) / 1000, 'seconds');
  throw new Error(`Approval transaction not confirmed within ${timeout / 1000} seconds. Transaction may still be pending.`);
}
