/**
 * Network Icon Utilities
 *
 * Provides network/chain icon URLs and color coding for multi-chain assets.
 * Uses CAIP networkId format (e.g., "eip155:1", "bip122:000...")
 *
 * **Data Source**: @pioneer-platform/pioneer-discovery
 * All network metadata (names, colors, icons) is derived from native asset data.
 */

// @ts-expect-error - No type definitions available for pioneer-discovery
import { assetData } from '@pioneer-platform/pioneer-discovery';

export interface NetworkConfig {
  /** Network display name */
  name: string;
  /** Icon URL */
  icon: string;
  /** Brand color for UI theming */
  color: string;
  /** Short identifier for sorting */
  sortOrder: number;
}

/**
 * Cache of native assets indexed by chainId
 * Built from pioneer-discovery assetData on first access
 */
let nativeAssetCache: Map<string, any> | null = null;

/**
 * Build cache of native assets by chainId
 * Native assets define the network's name, icon, and color
 */
const buildNativeAssetCache = (): Map<string, any> => {
  if (nativeAssetCache) return nativeAssetCache;

  nativeAssetCache = new Map();

  // Find all native assets in assetData
  Object.values(assetData).forEach((asset: any) => {
    if (asset.isNative === true && asset.chainId) {
      nativeAssetCache!.set(asset.chainId, asset);
    }
  });

  return nativeAssetCache;
};

/**
 * Get native asset for a given chainId
 */
const getNativeAsset = (chainId: string): any | null => {
  const cache = buildNativeAssetCache();
  return cache.get(chainId) || null;
};

/**
 * Network sort order for consistent grouping
 * Bitcoin first, then major EVM chains, then others
 */
const NETWORK_SORT_ORDER: Record<string, number> = {
  // Bitcoin family first
  'bip122:000000000019d6689c085ae165831e93': 0, // BTC
  'bip122:000000000000000000651ef99cb9fcbe': 1, // BCH
  'bip122:12a765e31ffd4059bada1e25190f6e98': 2, // LTC
  'bip122:00000000001a91e3dace36e2be3bf030': 3, // DOGE
  'bip122:000007d91d1254d60e2dd1ae58038307': 4, // DASH

  // Major EVM chains
  'eip155:1': 10,     // Ethereum
  'eip155:8453': 11,  // Base
  'eip155:56': 12,    // BNB Chain
  'eip155:137': 13,   // Polygon
  'eip155:43114': 14, // Avalanche
  'eip155:42161': 15, // Arbitrum
  'eip155:10': 16,    // Optimism

  // Cosmos ecosystem
  'cosmos:cosmoshub-4': 20,  // Cosmos
  'cosmos:thorchain-1': 21,  // THORChain
  'cosmos:mayachain-mainnet-v1': 22, // MayaChain

  // Newer chains
  'eip155:41454': 30, // Monad
  'eip155:2868': 31,  // Hyperliquid
};

/**
 * Get network icon URL from networkId (CAIP format)
 * Returns icon from native asset for that chain
 */
export const getNetworkIconUrl = (networkId: string): string | null => {
  const nativeAsset = getNativeAsset(networkId);
  return nativeAsset?.icon || null;
};

/**
 * Get network color from networkId (CAIP format)
 * Returns color from native asset for that chain
 */
export const getNetworkColor = (networkId: string): string => {
  const nativeAsset = getNativeAsset(networkId);
  return nativeAsset?.color || '#666666'; // Default gray
};

/**
 * Get network name from networkId (CAIP format)
 * Returns name from native asset for that chain
 */
export const getNetworkName = (networkId: string): string => {
  const nativeAsset = getNativeAsset(networkId);
  return nativeAsset?.name || 'Unknown';
};

/**
 * Get network sort order for grouping assets by chain
 * Returns predefined sort order or 999 for unknown chains
 */
export const getNetworkSortOrder = (networkId: string): number => {
  return NETWORK_SORT_ORDER[networkId] ?? 999; // Unknown networks go to the end
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
