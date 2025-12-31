/**
 * Chain Metadata for Transaction Event Notifications
 *
 * Maps chain symbols (BTC, LTC, ETH) to CAIP identifiers and metadata
 * used by TransactionEventManager to convert pioneer:tx events to PaymentEvents
 */

export interface ChainMetadata {
  caip: string
  networkId: string
  symbol: string
  decimals: number
  name: string
}

/**
 * Supported chains for transaction event notifications
 * These chains have WebSocket transaction event support via pioneer:tx
 */
export const CHAIN_METADATA: Record<string, ChainMetadata> = {
  BTC: {
    caip: 'bip122:000000000019d6689c085ae165831e93',
    networkId: 'bitcoin',
    symbol: 'BTC',
    decimals: 8,
    name: 'Bitcoin',
  },
  LTC: {
    caip: 'bip122:12a765e31ffd4059bada1e25190f6e98',
    networkId: 'litecoin',
    symbol: 'LTC',
    decimals: 8,
    name: 'Litecoin',
  },
  ETH: {
    caip: 'eip155:1/slip44:60',
    networkId: 'ethereum',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ethereum',
  },
  DASH: {
    caip: 'bip122:00000ffd590b1485b3caadc19b22e637',
    networkId: 'dash',
    symbol: 'DASH',
    decimals: 8,
    name: 'Dash',
  },
  DOGE: {
    caip: 'bip122:1a91e3dace36e2be3bf030a65679fe82',
    networkId: 'dogecoin',
    symbol: 'DOGE',
    decimals: 8,
    name: 'Dogecoin',
  },
  BCH: {
    caip: 'bip122:000000000000000000651ef99cb9fcbe',
    networkId: 'bitcoincash',
    symbol: 'BCH',
    decimals: 8,
    name: 'Bitcoin Cash',
  },
}

/**
 * Get chain metadata by chain symbol
 * @param chainSymbol - Chain symbol (e.g., "BTC", "LTC", "ETH")
 * @returns Chain metadata or undefined if not found
 */
export function getChainMetadata(chainSymbol: string): ChainMetadata | undefined {
  return CHAIN_METADATA[chainSymbol.toUpperCase()]
}

/**
 * Check if a chain has transaction event support
 * @param chainSymbol - Chain symbol (e.g., "BTC", "LTC")
 * @returns True if chain has WebSocket transaction event support
 */
export function hasTxEventSupport(chainSymbol: string): boolean {
  return chainSymbol.toUpperCase() in CHAIN_METADATA
}

/**
 * Get all supported chain symbols
 * @returns Array of chain symbols with tx event support
 */
export function getSupportedChains(): string[] {
  return Object.keys(CHAIN_METADATA)
}

/**
 * Get all supported networkIds
 * @returns Set of networkIds with tx event support
 */
export function getSupportedNetworkIds(): Set<string> {
  return new Set(Object.values(CHAIN_METADATA).map((meta) => meta.networkId))
}
