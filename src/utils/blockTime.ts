/**
 * Block time estimation utility for different blockchain networks
 * Provides estimated confirmation times based on network characteristics
 */

export interface BlockTimeEstimate {
  /** Average block time in seconds */
  blockTime: number;
  /** Number of confirmations typically considered safe */
  safeConfirmations: number;
  /** Estimated time to first confirmation in seconds */
  estimatedTime: number;
  /** Human-readable time estimate (e.g., "~10 minutes") */
  displayTime: string;
}

/**
 * Get block time estimates for a given network
 * @param networkId - The network identifier (e.g., 'eip155:1', 'bip122:000000000019d6689c085ae165831e93')
 * @returns Block time estimate information
 */
export function getBlockTimeEstimate(networkId: string): BlockTimeEstimate {
  // Default values
  let blockTime = 15; // seconds
  let safeConfirmations = 1;

  // UTXO Networks (Bitcoin-like)
  if (networkId.startsWith('bip122:') || networkId.includes('bitcoin')) {
    blockTime = 600; // 10 minutes
    safeConfirmations = 1;
  }
  // Bitcoin testnet
  else if (networkId.includes('testnet')) {
    blockTime = 600; // 10 minutes
    safeConfirmations = 1;
  }
  // Litecoin
  else if (networkId.includes('litecoin')) {
    blockTime = 150; // 2.5 minutes
    safeConfirmations = 1;
  }
  // Dogecoin
  else if (networkId.includes('dogecoin')) {
    blockTime = 60; // 1 minute
    safeConfirmations = 1;
  }
  // Bitcoin Cash
  else if (networkId.includes('bitcoincash')) {
    blockTime = 600; // 10 minutes
    safeConfirmations = 1;
  }
  // Dash
  else if (networkId.includes('dash')) {
    blockTime = 150; // 2.5 minutes
    safeConfirmations = 1;
  }
  // EVM Networks (Ethereum-like)
  else if (networkId.startsWith('eip155:')) {
    const chainId = networkId.split(':')[1];

    switch (chainId) {
      case '1': // Ethereum Mainnet
        blockTime = 12; // 12 seconds
        safeConfirmations = 1;
        break;
      case '137': // Polygon
        blockTime = 2; // 2 seconds
        safeConfirmations = 1;
        break;
      case '56': // BSC
        blockTime = 3; // 3 seconds
        safeConfirmations = 1;
        break;
      case '43114': // Avalanche C-Chain
        blockTime = 2; // 2 seconds
        safeConfirmations = 1;
        break;
      case '250': // Fantom
        blockTime = 1; // 1 second
        safeConfirmations = 1;
        break;
      case '42161': // Arbitrum
        blockTime = 1; // ~1 second
        safeConfirmations = 1;
        break;
      case '10': // Optimism
        blockTime = 2; // 2 seconds
        safeConfirmations = 1;
        break;
      default:
        blockTime = 15; // Default for EVM chains
        safeConfirmations = 1;
    }
  }
  // Cosmos/Tendermint Networks
  else if (networkId.startsWith('cosmos:') || networkId.includes('cosmos')) {
    blockTime = 7; // ~7 seconds for Cosmos Hub
    safeConfirmations = 1;
  }
  // Osmosis
  else if (networkId.includes('osmosis')) {
    blockTime = 6; // ~6 seconds
    safeConfirmations = 1;
  }
  // THORChain
  else if (networkId.includes('thorchain')) {
    blockTime = 6; // ~6 seconds
    safeConfirmations = 1;
  }
  // Maya Protocol
  else if (networkId.includes('maya')) {
    blockTime = 6; // ~6 seconds
    safeConfirmations = 1;
  }
  // Binance Chain (not BSC)
  else if (networkId.includes('binance')) {
    blockTime = 1; // ~1 second
    safeConfirmations = 1;
  }
  // Ripple (XRP)
  else if (networkId.includes('ripple') || networkId.includes('xrp')) {
    blockTime = 4; // ~4 seconds
    safeConfirmations = 1;
  }

  const estimatedTime = blockTime * safeConfirmations;
  const displayTime = formatTimeEstimate(estimatedTime);

  return {
    blockTime,
    safeConfirmations,
    estimatedTime,
    displayTime,
  };
}

/**
 * Format time estimate into human-readable string
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "~30 seconds", "~2 minutes")
 */
function formatTimeEstimate(seconds: number): string {
  if (seconds < 60) {
    return `~${Math.round(seconds)} second${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `~${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.round(minutes / 60);
  return `~${hours} hour${hours !== 1 ? 's' : ''}`;
}

/**
 * Get a user-friendly confirmation message based on network and confirmation status
 * @param networkId - The network identifier
 * @param detected - Whether transaction is detected in mempool
 * @param confirmations - Current number of confirmations
 * @returns User-friendly status message
 */
export function getConfirmationMessage(
  networkId: string,
  detected: boolean,
  confirmations: number
): string {
  const estimate = getBlockTimeEstimate(networkId);

  if (confirmations >= estimate.safeConfirmations) {
    return 'Transaction confirmed!';
  }

  if (confirmations > 0) {
    return `${confirmations} of ${estimate.safeConfirmations} confirmation${estimate.safeConfirmations > 1 ? 's' : ''}`;
  }

  if (detected) {
    return `Waiting for confirmation (${estimate.displayTime})`;
  }

  return `Broadcasting to network...`;
}
