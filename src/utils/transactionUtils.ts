/**
 * Transaction utilities for formatting and display
 */

/**
 * Extracts asset symbol from CAIP string
 * Examples:
 * - "eip155:1/slip44:60" -> "ETH"
 * - "eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7" -> "ERC20"
 */
export function extractAssetSymbolFromCAIP(caip: string): string {
  if (!caip) return '?';

  // Handle slip44 (native assets)
  if (caip.includes('/slip44:')) {
    const networkId = caip.split('/')[0];
    return networkIdToSymbol(networkId);
  }

  // Handle ERC20 tokens
  if (caip.includes('/erc20:')) {
    return 'ERC20';
  }

  // Handle other token standards
  if (caip.includes('/')) {
    const parts = caip.split('/');
    const networkId = parts[0];
    return networkIdToSymbol(networkId);
  }

  return networkIdToSymbol(caip);
}

/**
 * Extracts network ID from CAIP string
 */
export function extractNetworkIdFromCAIP(caip: string): string | null {
  if (!caip) return null;
  return caip.split('/')[0];
}

/**
 * Maps networkId to coin symbol
 */
export function networkIdToSymbol(networkId: string): string {
  const networkMap: { [key: string]: string } = {
    'bip122:000000000019d6689c085ae165831e93': 'BTC',
    'bip122:000000000000000000651ef99cb9fcbe': 'BCH',
    'bip122:000007d91d1254d60e2dd1ae58038307': 'DASH',
    'bip122:00000000001a91e3dace36e2be3bf030': 'DOGE',
    'bip122:12a765e31ffd4059bada1e25190f6e98': 'LTC',
    'bip122:4da631f2ac1bed857bd968c67c913978': 'DGB',
    'bip122:00040fe8ec8471911baa1db1266ea15d': 'ZEC',
    'eip155:1': 'ETH',
    'eip155:137': 'MATIC',
    'eip155:56': 'BNB',
    'eip155:8453': 'BASE',
    'eip155:10': 'OP',
    'eip155:42161': 'ARB',
    'cosmos:cosmoshub-4': 'ATOM',
    'cosmos:osmosis-1': 'OSMO',
    'cosmos:thorchain-mainnet-v1': 'RUNE',
    'cosmos:mayachain-mainnet-v1': 'CACAO',
    'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'XRP',
  };

  // Try exact match first
  if (networkMap[networkId]) {
    return networkMap[networkId];
  }

  // Fallback: extract namespace prefix
  const prefix = networkId.split(':')[0];
  if (prefix === 'eip155') return 'EVM';
  if (prefix === 'bip122') return 'UTXO';
  if (prefix === 'cosmos') return 'COSMOS';
  return prefix.toUpperCase();
}

/**
 * Converts base unit value to human-readable format based on network type
 */
export function formatTransactionValue(value: string, networkId: string, type: string): string {
  try {
    const valueBigInt = BigInt(value);

    // Determine decimals based on network type
    let decimals = 0;
    if (networkId.startsWith('eip155')) {
      // EVM chains use 18 decimals for native assets
      decimals = type === 'token_transfer' ? 18 : 18;
    } else if (networkId.startsWith('bip122')) {
      // Bitcoin-like chains use 8 decimals (satoshis)
      decimals = 8;
    } else if (networkId.startsWith('cosmos')) {
      // Cosmos-based chains typically use 6 decimals
      decimals = 6;
    } else if (networkId.startsWith('ripple')) {
      // Ripple uses 6 decimals (drops)
      decimals = 6;
    }

    // Convert from base units to human-readable
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = valueBigInt / divisor;
    const fractionalPart = valueBigInt % divisor;

    // Format with appropriate precision
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const displayDecimals = Math.min(decimals, 8); // Show max 8 decimal places
    const trimmedFractional = fractionalStr.substring(0, displayDecimals).replace(/0+$/, '');

    if (trimmedFractional) {
      return `${wholePart}.${trimmedFractional}`;
    } else {
      return wholePart.toString();
    }
  } catch (error) {
    // Fallback for invalid values
    return value;
  }
}

/**
 * Formats timestamp to readable date string
 */
export function formatTransactionDate(timestamp: number): string {
  try {
    // Detect if timestamp is in seconds or milliseconds
    // Timestamps in seconds are typically < 10000000000 (year 2286)
    const timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;

    const date = new Date(timestampMs);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toISOString().substring(0, 19).replace('T', ' ');
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Returns color scheme for transaction type badges
 */
export function getTypeColorScheme(type: string): string {
  const typeMap: { [key: string]: string } = {
    'transfer': 'blue',
    'token_transfer': 'purple',
    'contract_execution': 'orange',
    'contract_creation': 'pink',
    'approval': 'cyan',
    'swap': 'teal',
    'send': 'red',
    'receive': 'green',
  };
  return typeMap[type.toLowerCase()] || 'gray';
}

/**
 * Returns color scheme for transaction direction
 */
export function getDirectionColorScheme(direction: string): string {
  if (direction === 'received') return 'green';
  if (direction === 'sent') return 'red';
  return 'gray';
}

/**
 * Returns color scheme for transaction status
 */
export function getStatusColorScheme(status: string): string {
  if (status === 'confirmed') return 'green';
  if (status === 'pending') return 'yellow';
  return 'red';
}

/**
 * Returns color scheme for swap status
 */
export function getSwapStatusColorScheme(status: string): string {
  const statusMap: { [key: string]: string } = {
    'COMPLETED': 'green',
    'FAILED': 'red',
    'PENDING': 'yellow',
    'CONFIRMING': 'blue',
    'REFUNDED': 'orange',
  };
  return statusMap[status] || 'gray';
}

/**
 * Formats transaction hash with middle ellipsis
 * @param txid - Transaction hash
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Formatted string like "0x1234...5678"
 */
export function formatTxIdMiddleEllipsis(
  txid: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!txid || txid.length <= startChars + endChars) {
    return txid;
  }
  return `${txid.substring(0, startChars)}...${txid.substring(txid.length - endChars)}`;
}

/**
 * Gets block explorer URL for a transaction
 * @param txid - Transaction hash
 * @param networkId - Network identifier (CAIP format)
 * @returns Block explorer URL or null if not available
 */
export function getBlockExplorerUrl(txid: string, networkId: string): string | null {
  if (!txid || !networkId) return null;

  const explorerMap: { [key: string]: string } = {
    // Bitcoin
    'bip122:000000000019d6689c085ae165831e93': `https://mempool.space/tx/${txid}`,
    // Ethereum
    'eip155:1': `https://etherscan.io/tx/${txid}`,
    // Polygon
    'eip155:137': `https://polygonscan.com/tx/${txid}`,
    // BSC
    'eip155:56': `https://bscscan.com/tx/${txid}`,
    // Base
    'eip155:8453': `https://basescan.org/tx/${txid}`,
    // Optimism
    'eip155:10': `https://optimistic.etherscan.io/tx/${txid}`,
    // Arbitrum
    'eip155:42161': `https://arbiscan.io/tx/${txid}`,
    // Cosmos
    'cosmos:cosmoshub-4': `https://www.mintscan.io/cosmos/txs/${txid}`,
    // Osmosis
    'cosmos:osmosis-1': `https://www.mintscan.io/osmosis/txs/${txid}`,
    // THORChain
    'cosmos:thorchain-mainnet-v1': `https://viewblock.io/thorchain/tx/${txid}`,
    // Mayachain
    'cosmos:mayachain-mainnet-v1': `https://www.mayascan.org/tx/${txid}`,
    // XRP
    'ripple:4109c6f2045fc7eff4cde8f9905d19c2': `https://xrpscan.com/tx/${txid}`,
  };

  // Try exact match first
  if (explorerMap[networkId]) {
    return explorerMap[networkId];
  }

  // Fallback for EVM chains
  if (networkId.startsWith('eip155:')) {
    return `https://etherscan.io/tx/${txid}`;
  }

  return null;
}
