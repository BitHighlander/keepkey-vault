/**
 * Network Icon Utilities
 *
 * Provides network/chain icon URLs and color coding for multi-chain assets.
 * Uses CAIP networkId format (e.g., "eip155:1", "bip122:000...")
 */

export interface NetworkConfig {
  /** Network display name */
  name: string;
  /** Icon URL from KeepKey CDN */
  icon: string;
  /** Brand color for UI theming */
  color: string;
  /** Short identifier for sorting */
  sortOrder: number;
}

/**
 * Network configurations mapped by CAIP networkId
 * Icons are served from KeepKey CDN using CAIP-encoded filenames
 */
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  // Ethereum Mainnet
  'eip155:1': {
    name: 'Ethereum',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjEvc2xpcDQ0OjYw.png', // eip155:1/slip44:60
    color: '#627EEA',
    sortOrder: 1,
  },
  // BNB Chain (BSC)
  'eip155:56': {
    name: 'BNB Chain',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjU2L3NsaXA0NDo2MA==.png', // eip155:56/slip44:60
    color: '#F3BA2F',
    sortOrder: 2,
  },
  // Avalanche C-Chain
  'eip155:43114': {
    name: 'Avalanche',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjQzMTE0L3NsaXA0NDo2MA==.png', // eip155:43114/slip44:60
    color: '#E84142',
    sortOrder: 3,
  },
  // Arbitrum
  'eip155:42161': {
    name: 'Arbitrum',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjQyMTYxL3NsaXA0NDo2MA==.png', // eip155:42161/slip44:60
    color: '#2D374B',
    sortOrder: 4,
  },
  // Optimism
  'eip155:10': {
    name: 'Optimism',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjEwL3NsaXA0NDo2MA==.png', // eip155:10/slip44:60
    color: '#FF0420',
    sortOrder: 5,
  },
  // Polygon
  'eip155:137': {
    name: 'Polygon',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjEzNy9zbGlwNDQ6NjA=.png', // eip155:137/slip44:60
    color: '#8247E5',
    sortOrder: 6,
  },
  // Bitcoin
  'bip122:000000000019d6689c085ae165831e93': {
    name: 'Bitcoin',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/YmlwMTIyOjAwMDAwMDAwMDAxOWQ2Njg5YzA4NWFlMTY1ODMxZTkzL3NsaXA0NDow.png', // bip122:000.../slip44:0
    color: '#F7931A',
    sortOrder: 0, // Bitcoin first
  },
  // Bitcoin Cash
  'bip122:000000000000000000651ef99cb9fcbe': {
    name: 'Bitcoin Cash',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/YmlwMTIyOjAwMDAwMDAwMDAwMDAwMDAwMDY1MWVmOTljYjlmY2JlL3NsaXA0NDoxNDU=.png', // bch caip
    color: '#8DC351',
    sortOrder: 7,
  },
  // Litecoin (WRONG networkId from THORChain - all zeros)
  'bip122:00000000000000000000000000000000': {
    name: 'Litecoin',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/YmlwMTIyOjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwL3NsaXA0NDoy.png', // Wrong hash
    color: '#345D9D',
    sortOrder: 8,
  },
  // Litecoin (CORRECT networkId)
  'bip122:12a765e31ffd4059bada1e25190f6e98': {
    name: 'Litecoin',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/YmlwMTIyOjEyYTc2NWUzMWZmZDQwNTliYWRhMWUyNTE5MGY2ZTk4L3NsaXA0NDoy.png',
    color: '#345D9D',
    sortOrder: 8,
  },
  // Dogecoin (WRONG networkId from THORChain - all zeros + 1)
  'bip122:000000000000000000000000000000001': {
    name: 'Dogecoin',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/YmlwMTIyOjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEvhc2xpcDQ0OjM=.png', // Wrong hash
    color: '#C2A633',
    sortOrder: 9,
  },
  // Dogecoin (CORRECT networkId)
  'bip122:1a91e3dace36e2be3bf030a65679fe82': {
    name: 'Dogecoin',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/YmlwMTIyOjFhOTFlM2RhY2UzNmUyYmUzYmYwMzBhNjU2NzlmZTgyL3NsaXA0NDoz.png',
    color: '#C2A633',
    sortOrder: 9,
  },
  // Cosmos Hub
  'cosmos:cosmoshub-4': {
    name: 'Cosmos',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/Y29zbW9zOmNvc21vc2h1Yi00L3NsaXA0NDoxMTg=.png', // cosmos caip
    color: '#2E3148',
    sortOrder: 10,
  },
  // THORChain
  'cosmos:thorchain-1': {
    name: 'THORChain',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/Y29zbW9zOnRob3JjaGFpbi0xL3NsaXA0NDo5MzE=.png', // thorchain caip
    color: '#00CCFF',
    sortOrder: 11,
  },
  // Monad (eip155:41454) - High performance EVM L1
  'eip155:41454': {
    name: 'Monad',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjQxNDU0L3NsaXA0NDo2MA==.png', // eip155:41454/slip44:60
    color: '#6B46C1', // Purple brand color
    sortOrder: 12,
  },
  // Hyperliquid/HyperEVM (eip155:2868)
  'eip155:2868': {
    name: 'Hyperliquid',
    icon: 'https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/ZWlwMTU1OjI4Njgvhc2xpcDQ0OjYw.png', // eip155:2868/slip44:60
    color: '#00D4AA', // Teal/cyan brand color
    sortOrder: 13,
  },
};

/**
 * Get network icon URL from networkId (CAIP format)
 */
export const getNetworkIconUrl = (networkId: string): string | null => {
  const config = NETWORK_CONFIGS[networkId];
  return config?.icon || null;
};

/**
 * Get network color from networkId (CAIP format)
 */
export const getNetworkColor = (networkId: string): string => {
  const config = NETWORK_CONFIGS[networkId];
  return config?.color || '#666666'; // Default gray
};

/**
 * Get network name from networkId (CAIP format)
 */
export const getNetworkName = (networkId: string): string => {
  const config = NETWORK_CONFIGS[networkId];
  return config?.name || 'Unknown';
};

/**
 * Get network sort order for grouping assets by chain
 */
export const getNetworkSortOrder = (networkId: string): number => {
  const config = NETWORK_CONFIGS[networkId];
  return config?.sortOrder ?? 999; // Unknown networks go to the end
};

/**
 * Extract networkId from CAIP identifier
 * Examples:
 *   "eip155:1/slip44:60" => "eip155:1"
 *   "bip122:000.../slip44:0" => "bip122:000..."
 */
export const extractNetworkId = (caip: string): string => {
  if (!caip || !caip.includes('/')) return caip;
  return caip.split('/')[0];
};
