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
 * @param pioneer - Pioneer SDK instance from app.pioneer
 * @param tokenAddress - ERC20 token contract address (e.g., USDT)
 * @param ownerAddress - Token owner's address (your wallet)
 * @param spenderAddress - Address that will spend tokens (THORChain router)
 * @param requiredAmount - Amount needed in base units (e.g., 1000000 for 1 USDT)
 * @param networkId - Network ID (e.g., "eip155:1" for Ethereum mainnet)
 * @returns Object with hasApproval boolean and current allowance
 */
export async function checkERC20Allowance(
  pioneer: any,
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

    // Call Pioneer SDK method (Pascal case)
    const result = await pioneer.CheckERC20Allowance({
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
 * @param pioneer - Pioneer SDK instance from app.pioneer
 * @param tokenAddress - ERC20 token contract address
 * @param spenderAddress - Address to approve (THORChain router)
 * @param amount - Amount to approve in base units (or 'max' for unlimited)
 * @param ownerAddress - Token owner's address (for transaction 'from' field)
 * @param networkId - Network ID (e.g., "eip155:1" for Ethereum mainnet)
 * @returns Unsigned transaction object ready to be signed
 */
export async function buildERC20ApprovalTx(
  pioneer: any,
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
    const result = await pioneer.BuildERC20ApprovalTx({
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
