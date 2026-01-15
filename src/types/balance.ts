// Balance type definitions for multi-address support

export type AddressType = 'legacy' | 'segwit' | 'native-segwit' | 'taproot' | 'default';

// Pending balance state during swaps
export interface PendingBalance {
  isPending: boolean;
  swapTxHash: string;
  originalAmount: string;
  debitedAmount: string;
  status: 'pending_swap';
  createdAt: number;
  estimatedCompletionTime?: number;
}

export interface BalanceDetail {
  address: string;
  pubkey: string;
  balance: string;
  valueUsd: number;
  addressType: AddressType;
  label?: string;
  percentage?: number;
  networkId: string;
  fetchedAt?: number;      // Unix timestamp when balance was fetched from blockchain
  fetchedAtISO?: string;   // ISO 8601 string for display (e.g., "2025-01-11T12:34:56.789Z")
  isStale?: boolean;       // True if balance is older than 5 minutes
  pending?: PendingBalance; // Pending swap state
}

export interface AggregatedBalance {
  symbol: string;
  totalBalance: string;
  totalValueUsd: number;
  balances: BalanceDetail[];
  networkId: string;
  caip: string;
  hasPendingSwaps?: boolean;  // True if any balance has pending swap
  pendingDebits?: string;      // Total amount reserved for swaps
}

// Helper to detect Bitcoin address type from address format
export function detectBitcoinAddressType(address: string): AddressType {
  if (!address) return 'default';
  
  // Legacy addresses start with 1
  if (address.startsWith('1')) return 'legacy';
  
  // SegWit (P2SH) addresses start with 3
  if (address.startsWith('3')) return 'segwit';
  
  // Native SegWit (Bech32) addresses start with bc1
  if (address.startsWith('bc1')) return 'native-segwit';
  
  // Taproot addresses start with bc1p
  if (address.startsWith('bc1p')) return 'taproot';
  
  return 'default';
}

// Get user-friendly label for address type
export function getAddressTypeLabel(type: AddressType): string {
  switch (type) {
    case 'legacy':
      return 'Legacy (P2PKH)';
    case 'segwit':
      return 'SegWit (P2SH)';
    case 'native-segwit':
      return 'Native SegWit';
    case 'taproot':
      return 'Taproot';
    default:
      return 'Standard';
  }
}

// Get icon for address type
export function getAddressTypeIcon(type: AddressType): string {
  switch (type) {
    case 'legacy':
      return '🔑';
    case 'segwit':
      return '🔒';
    case 'native-segwit':
      return '⚡';
    case 'taproot':
      return '🎯';
    default:
      return '📍';
  }
}

// Calculate percentage of total for each balance
export function calculateBalancePercentages(balances: BalanceDetail[]): BalanceDetail[] {
  const total = balances.reduce((sum, b) => sum + parseFloat(b.balance || '0'), 0);
  
  if (total === 0) return balances;
  
  return balances.map(balance => ({
    ...balance,
    percentage: (parseFloat(balance.balance || '0') / total) * 100
  }));
}

// Aggregate balances from multiple pubkeys/addresses
export function aggregateBalances(
  balances: any[],
  pubkeys: any[],
  networkId: string,
  symbol: string,
  priceUsd: number
): AggregatedBalance {
  const balanceDetails: BalanceDetail[] = [];
  let totalBalance = 0;
  let totalValueUsd = 0;

  // Process each balance
  balances.forEach(balance => {
    if (balance.networkId !== networkId) return;
    
    const amount = parseFloat(balance.balance || '0');
    const valueUsd = amount * priceUsd;
    
    totalBalance += amount;
    totalValueUsd += valueUsd;
    
    // Find corresponding pubkey for address info
    const pubkey = pubkeys.find(pk => 
      pk.address === balance.address || 
      pk.pubkey === balance.pubkey ||
      pk.master === balance.master
    );
    
    const address = balance.address || pubkey?.address || pubkey?.pubkey || '';
    const addressType = networkId.includes('bitcoin') 
      ? detectBitcoinAddressType(address)
      : 'default';
    
    balanceDetails.push({
      address,
      pubkey: balance.pubkey || pubkey?.pubkey || '',
      balance: balance.balance || '0',
      valueUsd,
      addressType,
      label: getAddressTypeLabel(addressType),
      networkId,
      percentage: 0 // Will be calculated after
    });
  });

  // Calculate percentages
  const detailsWithPercentages = calculateBalancePercentages(balanceDetails);

  // Check for pending swaps
  const hasPendingSwaps = balances.some(b => b.pending?.isPending);
  const pendingDebits = balances
    .filter(b => b.pending?.isPending)
    .reduce((sum, b) => sum + parseFloat(b.pending!.debitedAmount || '0'), 0)
    .toFixed(8);

  return {
    symbol,
    totalBalance: totalBalance.toString(),
    totalValueUsd,
    balances: detailsWithPercentages,
    networkId,
    caip: `${networkId}/${symbol.toLowerCase()}`,
    hasPendingSwaps,
    pendingDebits: hasPendingSwaps ? pendingDebits : undefined
  };
}

// Format address for display (middle ellipsis)
export function formatAddress(address: string, visibleChars = 16): string {
  if (!address) return '';
  if (address.length <= visibleChars) return address;
  
  const charsToShow = Math.floor(visibleChars / 2);
  return `${address.substring(0, charsToShow)}...${address.substring(address.length - charsToShow)}`;
}