// Balance types and utilities for the report system

export interface BalanceDetail {
  address: string;
  pubkey?: string;
  balance: string;
  valueUsd: number;
  networkId: string;
  symbol: string;
  path?: string;
  master?: string;
  type?: string;
  addressType: string;
  label: string;
  percentage?: number;
}

export interface AggregatedBalance {
  networkId: string;
  symbol: string;
  totalBalance: string;
  totalValueUsd: number;
  balances: BalanceDetail[];
  pubkeys: any[];
}

export interface ReportData {
  asset: {
    name: string;
    symbol: string;
    networkId: string;
    caip: string;
    chainId?: string;
    priceUsd: number;
  };
  accounts: AccountData[];
  summary: {
    totalAccounts: number;
    totalBalance: number;
    totalValueUsd: number;
    generatedAt: string;
  };
}

export interface AccountData {
  index: number;
  note: string;
  type?: string;
  address?: string;
  pubkey?: string;
  xpub?: string;
  path?: string;
  pathMaster?: string;
  networks?: string[];
  balance: string;
  valueUsd: number;
  receiveIndex?: number;
  changeIndex?: number;
  totalReceived?: string;
  totalSent?: string;
  txCount?: number;
  usedAddresses?: number;
}

// Get address type from path or pubkey type
export const getAddressType = (pubkey: any): string => {
  if (pubkey.type) {
    return pubkey.type;
  }
  
  if (pubkey.path) {
    // Bitcoin address types based on BIP
    if (pubkey.path.includes("44'")) return 'Legacy (P2PKH)';
    if (pubkey.path.includes("49'")) return 'SegWit (P2SH)';
    if (pubkey.path.includes("84'")) return 'Native SegWit (Bech32)';
  }
  
  if (pubkey.scriptType) {
    if (pubkey.scriptType === 'p2pkh') return 'Legacy (P2PKH)';
    if (pubkey.scriptType === 'p2sh-p2wpkh') return 'SegWit (P2SH)';
    if (pubkey.scriptType === 'p2wpkh') return 'Native SegWit (Bech32)';
  }
  
  return 'Standard';
};

// Get icon for address type
export const getAddressTypeIcon = (type: string): string => {
  if (type.includes('Legacy')) return '🔑';
  if (type.includes('SegWit') && !type.includes('Native')) return '🔐';
  if (type.includes('Native')) return '⚡';
  if (type.includes('Taproot')) return '🌿';
  return '📍';
};

// Format address for display
export const formatAddress = (address: string, maxLength: number = 16): string => {
  if (!address) return '';
  if (address.length <= maxLength) return address;
  
  const charsToShow = Math.floor(maxLength / 2);
  return `${address.substring(0, charsToShow)}...${address.substring(address.length - charsToShow)}`;
};

// Aggregate balances by pubkey
export const aggregateBalances = (
  balances: any[],
  pubkeys: any[],
  networkId: string,
  symbol: string,
  priceUsd: number
): AggregatedBalance => {
  // Create balance details for each balance
  const balanceDetails: BalanceDetail[] = balances.map((balance, index) => {
    const matchingPubkey = pubkeys.find(pk => 
      pk.address === balance.address || 
      pk.pubkey === balance.pubkey ||
      pk.master === balance.master
    );
    
    const addressType = getAddressType(matchingPubkey || balance);
    const hasBalance = parseFloat(balance.balance) > 0;
    
    return {
      address: balance.address || balance.master || '',
      pubkey: balance.pubkey,
      balance: balance.balance || '0',
      valueUsd: balance.valueUsd || (parseFloat(balance.balance || '0') * priceUsd),
      networkId: balance.networkId || networkId,
      symbol: balance.symbol || symbol,
      path: balance.path || matchingPubkey?.path,
      master: balance.master,
      type: balance.type || matchingPubkey?.type,
      addressType,
      label: matchingPubkey?.note || `${addressType} Account ${index}`,
      percentage: 0, // Will be calculated below
    };
  });
  
  // Calculate total balance and value
  const totalBalance = balanceDetails.reduce((sum, b) => sum + parseFloat(b.balance), 0);
  const totalValueUsd = balanceDetails.reduce((sum, b) => sum + b.valueUsd, 0);
  
  // Calculate percentages
  balanceDetails.forEach(detail => {
    if (totalBalance > 0) {
      detail.percentage = (parseFloat(detail.balance) / totalBalance) * 100;
    }
  });
  
  return {
    networkId,
    symbol,
    totalBalance: totalBalance.toString(),
    totalValueUsd,
    balances: balanceDetails,
    pubkeys,
  };
};

// XPUB types for Bitcoin
export const XPUB_TYPES = [
  { name: 'Legacy', bip: 44, prefix: 'xpub', scriptType: 'p2pkh' },
  { name: 'SegWit', bip: 49, prefix: 'ypub', scriptType: 'p2sh-p2wpkh' },
  { name: 'Native SegWit', bip: 84, prefix: 'zpub', scriptType: 'p2wpkh' },
] as const;

// Convert BIP32 path to address_n array
export const bip32ToAddressNList = (path: string): number[] => {
  if (!path) return [];
  
  const parts = path.split('/').filter(p => p !== 'm');
  return parts.map(part => {
    const isHardened = part.includes("'");
    const num = parseInt(part.replace("'", ""));
    return isHardened ? 0x80000000 + num : num;
  });
};