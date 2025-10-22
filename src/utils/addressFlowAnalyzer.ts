/**
 * Address Flow Analyzer
 *
 * Analyzes Bitcoin transactions to extract address flow:
 * - Addresses we sent BTC TO (external outputs)
 * - Addresses that sent BTC TO us (external inputs)
 * - Marks our addresses vs external addresses
 *
 * Adapted from e2e integration tests for vault integration
 */

import { TransactionData } from '@/components/asset/reportGenerators/types';

export interface AddressFlow {
  address: string;
  amount: number;
  txCount: number;
  txids: string[];
  isOwn: boolean;
  path?: string | null;
}

export interface AddressFlowAnalysis {
  // Addresses we sent BTC TO (external outputs)
  sentTo: AddressFlow[];

  // Addresses that sent BTC TO us (external inputs)
  receivedFrom: AddressFlow[];

  // Summary stats
  totalSentTo: number;
  totalReceivedFrom: number;
  uniqueSentToCount: number;
  uniqueReceivedFromCount: number;
}

/**
 * Analyze address flow from LOD 5 transaction data
 */
export function analyzeAddressFlow(transactions: TransactionData[]): AddressFlowAnalysis {
  const sentToMap = new Map<string, AddressFlow>();
  const receivedFromMap = new Map<string, AddressFlow>();

  for (const tx of transactions) {
    // Skip if no inputs/outputs
    if (!tx.inputs || !tx.outputs) continue;

    // Analyze OUTPUTS (addresses we sent TO)
    // Only count outputs that are NOT ours (isOwn=false)
    for (const output of tx.outputs) {
      if (!output.isOwn && output.address) {
        const existing = sentToMap.get(output.address);
        if (existing) {
          existing.amount += output.value;
          existing.txCount++;
          if (!existing.txids.includes(tx.txid)) {
            existing.txids.push(tx.txid);
          }
        } else {
          sentToMap.set(output.address, {
            address: output.address,
            amount: output.value,
            txCount: 1,
            txids: [tx.txid],
            isOwn: false,
            path: null
          });
        }
      }
    }

    // Analyze INPUTS (addresses that sent TO us)
    // Only count inputs that are NOT ours (isOwn=false)
    for (const input of tx.inputs) {
      if (!input.isOwn && input.address) {
        const existing = receivedFromMap.get(input.address);
        if (existing) {
          existing.amount += input.value;
          existing.txCount++;
          if (!existing.txids.includes(tx.txid)) {
            existing.txids.push(tx.txid);
          }
        } else {
          receivedFromMap.set(input.address, {
            address: input.address,
            amount: input.value,
            txCount: 1,
            txids: [tx.txid],
            isOwn: false,
            path: null
          });
        }
      }
    }
  }

  // Convert to arrays and sort by amount (highest first)
  const sentTo = Array.from(sentToMap.values())
    .sort((a, b) => b.amount - a.amount);

  const receivedFrom = Array.from(receivedFromMap.values())
    .sort((a, b) => b.amount - a.amount);

  // Calculate totals
  const totalSentTo = sentTo.reduce((sum, addr) => sum + addr.amount, 0);
  const totalReceivedFrom = receivedFrom.reduce((sum, addr) => sum + addr.amount, 0);

  return {
    sentTo,
    receivedFrom,
    totalSentTo,
    totalReceivedFrom,
    uniqueSentToCount: sentTo.length,
    uniqueReceivedFromCount: receivedFrom.length
  };
}

/**
 * Generate summary text for address flow analysis
 */
export function generateAddressFlowSummary(analysis: AddressFlowAnalysis): string[] {
  return [
    `Total BTC Sent to External Addresses: ${analysis.totalSentTo.toFixed(8)} BTC`,
    `Total BTC Received from External Addresses: ${analysis.totalReceivedFrom.toFixed(8)} BTC`,
    `Unique External Addresses Sent To: ${analysis.uniqueSentToCount}`,
    `Unique External Addresses Received From: ${analysis.uniqueReceivedFromCount}`,
    ``,
    `Top 5 Addresses We Sent To:`,
    ...analysis.sentTo.slice(0, 5).map((addr, idx) =>
      `  ${idx + 1}. ${addr.address.substring(0, 40)}... → ${addr.amount.toFixed(8)} BTC (${addr.txCount} tx${addr.txCount > 1 ? 's' : ''})`
    ),
    ``,
    `Top 5 Addresses That Sent To Us:`,
    ...analysis.receivedFrom.slice(0, 5).map((addr, idx) =>
      `  ${idx + 1}. ${addr.address.substring(0, 40)}... → ${addr.amount.toFixed(8)} BTC (${addr.txCount} tx${addr.txCount > 1 ? 's' : ''})`
    )
  ];
}
