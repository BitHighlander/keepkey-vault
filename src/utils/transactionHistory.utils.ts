/**
 * Transaction History Utilities
 * Shared logic for transaction filtering, grouping, and asset lookup
 */

// @ts-ignore - pioneer-discovery module doesn't have type declarations
import { assetData } from '@pioneer-platform/pioneer-discovery';
import { networkIdToSymbol } from './transactionUtils';

export interface AssetContext {
  icon?: string;
  caip?: string;
  symbol: string;
  name: string;
  color?: string;
}

export interface Transaction {
  txid: string;
  networkId: string;
  caip?: string;
  timestamp: number;
  type: string;
  direction: string;
  status: string;
  value: string;
  swapMetadata?: {
    isSwap: boolean;
    status: string;
    protocol?: string;
    fromAsset?: string;
    toAsset?: string;
    fromAmount?: string;
    outputAmount?: string;
    inputAmount?: string;
    inboundTxHash?: string;
    outboundTxHash?: string;
    memo?: string;
    createdAt?: number;
  };
}

/**
 * Get asset context from CAIP identifier
 * Handles both direct matches and fallback to assetData lookup
 */
export function getAssetContextFromCaip(
  caip: string | undefined,
  symbol: string,
  existingContext?: AssetContext
): AssetContext | null {
  // First check if existing context matches
  if (existingContext && existingContext.symbol === symbol) {
    return existingContext;
  }

  // Try to look up from assetData using CAIP
  if (caip) {
    // @ts-ignore - assetData is a JSON object indexed by CAIP
    const assetInfo = assetData[caip] || assetData[caip.toLowerCase()];
    if (assetInfo) {
      return {
        icon: assetInfo.icon,
        caip,
        symbol,
        name: assetInfo.name || symbol,
        color: assetInfo.color,
      };
    }
  }

  return null;
}

/**
 * Filter transactions by asset (CAIP or networkId)
 * Includes related swap transactions where asset is source or destination
 */
export function filterTransactionsByAsset(
  transactions: Transaction[],
  caip?: string,
  networkId?: string
): Transaction[] {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Filter by networkId
  if (networkId) {
    return transactions.filter((tx) =>
      tx.networkId === networkId ||
      // Include swaps where this asset is the source or destination
      (tx.swapMetadata?.fromAsset && tx.swapMetadata.fromAsset.includes(networkId)) ||
      (tx.swapMetadata?.toAsset && tx.swapMetadata.toAsset.includes(networkId))
    );
  }

  // Filter by CAIP
  if (caip) {
    let filtered = transactions.filter((tx) =>
      tx.caip === caip ||
      // Include swaps where this asset is the source or destination
      tx.swapMetadata?.fromAsset === caip ||
      tx.swapMetadata?.toAsset === caip
    );

    // Fallback: if no exact matches and CAIP contains network part, try network-level filtering
    if (filtered.length === 0 && caip.includes('/')) {
      const networkPart = caip.split('/')[0];
      filtered = transactions.filter(
        (tx) =>
          tx.networkId === networkPart ||
          tx.caip?.startsWith(networkPart) ||
          // Check if fromAsset or toAsset matches this network
          (tx.swapMetadata?.fromAsset && tx.swapMetadata.fromAsset.startsWith(networkPart)) ||
          (tx.swapMetadata?.toAsset && tx.swapMetadata.toAsset.startsWith(networkPart))
      );
    }

    return filtered;
  }

  return transactions;
}

/**
 * Group transactions by coin symbol
 * Returns map of symbol -> transactions array (sorted by timestamp desc)
 */
export function groupTransactionsByCoin(
  transactions: Transaction[]
): Record<string, Transaction[]> {
  const grouped: Record<string, Transaction[]> = {};

  transactions.forEach((tx) => {
    const symbol = networkIdToSymbol(tx.networkId);
    if (!grouped[symbol]) {
      grouped[symbol] = [];
    }
    grouped[symbol].push(tx);
  });

  // Sort each group by timestamp (newest first)
  Object.keys(grouped).forEach((symbol) => {
    grouped[symbol].sort((a, b) => b.timestamp - a.timestamp);
  });

  return grouped;
}

/**
 * Group swap transactions by status
 * Returns map of status -> swap transactions array
 */
export function groupSwapsByStatus(
  transactions: Transaction[]
): Record<string, Transaction[]> {
  const swaps = transactions.filter((tx) => tx.swapMetadata?.isSwap);
  const grouped: Record<string, Transaction[]> = {};

  swaps.forEach((tx) => {
    const status = tx.swapMetadata?.status || 'UNKNOWN';
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(tx);
  });

  return grouped;
}

/**
 * Sort grouped transactions by group size (descending)
 * Returns array of [symbol, transactions] entries
 */
export function sortGroupsBySize(
  grouped: Record<string, Transaction[]>
): [string, Transaction[]][] {
  return Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);
}

/**
 * Standard swap status order for display
 */
export const SWAP_STATUS_ORDER = [
  'PENDING',
  'CONFIRMING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'UNKNOWN',
];
