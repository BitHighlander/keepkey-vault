/**
 * Swap Data Adapter
 *
 * Transforms swap data between PendingSwap format and Transaction format
 * for use with TransactionDetailDialog
 */

// @ts-ignore
import { caipToNetworkId } from '@pioneer-platform/pioneer-caip';

export interface PendingSwap {
  txHash: string;
  sellAsset: {
    caip: string;
    symbol: string;
    amount: string;
    icon?: string;
    name?: string;
    address?: string;
  };
  buyAsset: {
    caip: string;
    symbol: string;
    amount: string;
    icon?: string;
    name?: string;
    address?: string;
  };
  status: 'pending' | 'confirming' | 'completed' | 'failed' | 'refunded' | 'output_detected' | 'output_confirming' | 'output_confirmed';
  confirmations: number;
  createdAt: string;
  integration: string;
  outboundConfirmations?: number;
  outboundRequiredConfirmations?: number;
  outputDetectedAt?: string;
  quote?: { memo?: string };
  error?: {
    type?: string;
    severity?: string;
    userMessage?: string;
    actionable?: string;
    message?: string;
  };
  thorchainData?: {
    outboundTxHash?: string;
    swapStatus?: string;
  };
  timingData?: any;
}

export interface Transaction {
  txid: string;
  timestamp: number;
  status: string;
  direction: string;
  type: string;
  value: string;
  from?: string[];
  to?: string[];
  confirmations: number;
  memo?: string;
  networkId: string;
  swapMetadata?: {
    isSwap: true;
    fromAsset: string;
    toAsset: string;
    fromAmount: string;
    toAmount: string;
    integration: string;
    status: string;
    confirmations: number;
    outboundConfirmations?: number;
    outboundRequiredConfirmations?: number;
    outputDetectedAt?: string;
    inboundTxHash: string;
    outboundTxHash?: string;
    thorchainData?: any;
    timingData?: any;
    memo?: string;
    error?: any;
  };
}

/**
 * Transform PendingSwap to Transaction format
 *
 * @param swap - PendingSwap data from API
 * @param pendingSwapData - Optional additional data from CreatePendingSwap
 * @returns Transaction compatible with TransactionDetailDialog
 */
export function transformSwapToTransaction(
  swap: PendingSwap,
  pendingSwapData?: any
): Transaction {
  return {
    txid: swap.txHash,
    timestamp: new Date(swap.createdAt).getTime(),
    status: swap.status,
    direction: 'sent',
    type: 'swap',
    value: swap.sellAsset.amount,
    from: [swap.sellAsset.address || pendingSwapData?.addresses?.[0] || ''],
    to: [swap.buyAsset.address || pendingSwapData?.addresses?.[0] || ''],
    confirmations: swap.confirmations,
    memo: swap.quote?.memo,
    networkId: caipToNetworkId(swap.sellAsset.caip),
    swapMetadata: {
      isSwap: true,
      fromAsset: swap.sellAsset.caip,
      toAsset: swap.buyAsset.caip,
      fromAmount: swap.sellAsset.amount,
      toAmount: swap.buyAsset.amount,
      integration: swap.integration,
      status: swap.status,
      confirmations: swap.confirmations,
      outboundConfirmations: swap.outboundConfirmations,
      outboundRequiredConfirmations: swap.outboundRequiredConfirmations,
      outputDetectedAt: swap.outputDetectedAt,
      inboundTxHash: swap.txHash,
      outboundTxHash: swap.thorchainData?.outboundTxHash,
      thorchainData: swap.thorchainData,
      timingData: swap.timingData,
      memo: swap.quote?.memo,
      error: swap.error
    }
  };
}

/**
 * Create optimistic transaction immediately after broadcast
 * Used to show UI before backend confirms the swap
 *
 * @param txid - Transaction ID from broadcast
 * @param fromAsset - Asset being swapped from
 * @param toAsset - Asset being swapped to
 * @param inputAmount - Amount being swapped
 * @param outputAmount - Expected output amount
 * @param quote - Optional quote data with memo
 * @returns Transaction with optimistic data
 */
export function createOptimisticSwapTransaction(
  txid: string,
  fromAsset: any,
  toAsset: any,
  inputAmount: string,
  outputAmount: string,
  quote?: any
): Transaction {
  return {
    txid,
    timestamp: Date.now(),
    status: 'pending',
    direction: 'sent',
    type: 'swap',
    value: inputAmount,
    confirmations: 0,
    memo: quote?.memo,
    networkId: caipToNetworkId(fromAsset.caip),
    swapMetadata: {
      isSwap: true,
      fromAsset: fromAsset.caip,
      toAsset: toAsset.caip,
      fromAmount: inputAmount,
      toAmount: outputAmount,
      integration: 'thorchain',
      status: 'pending',
      confirmations: 0,
      inboundTxHash: txid,
      memo: quote?.memo
    }
  };
}

/**
 * Merge swap:event data into existing transaction
 * Used for real-time updates from WebSocket events
 *
 * @param transaction - Current transaction state
 * @param eventData - Event data from swap:event
 * @returns Updated transaction with merged data
 */
export function mergeSwapStatusUpdate(
  transaction: Transaction,
  eventData: any
): Transaction {
  if (!transaction.swapMetadata) {
    console.warn('mergeSwapStatusUpdate called on non-swap transaction');
    return transaction;
  }

  return {
    ...transaction,
    status: eventData.status || transaction.status,
    confirmations: eventData.confirmations ?? transaction.confirmations,
    swapMetadata: {
      ...transaction.swapMetadata,
      status: eventData.status || transaction.swapMetadata.status,
      confirmations: eventData.confirmations ?? transaction.swapMetadata.confirmations,
      outboundConfirmations: eventData.outboundConfirmations ?? transaction.swapMetadata.outboundConfirmations,
      outboundRequiredConfirmations: eventData.outboundRequiredConfirmations ?? transaction.swapMetadata.outboundRequiredConfirmations,
      outboundTxHash: eventData.thorchainData?.outboundTxHash || transaction.swapMetadata.outboundTxHash,
      thorchainData: eventData.thorchainData || transaction.swapMetadata.thorchainData,
      timingData: eventData.timingData || transaction.swapMetadata.timingData,
      error: eventData.error || transaction.swapMetadata.error
    }
  };
}
