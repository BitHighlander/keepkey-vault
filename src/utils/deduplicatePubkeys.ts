/**
 * Utility to deduplicate pubkeys to prevent phantom balances
 * Filters out duplicate pubkeys based on address/master field
 */

export interface Pubkey {
  address?: string;
  master?: string;
  note?: string;
  pathMaster?: string;
  networks?: string[];
  scriptType?: string;
  pubkey?: string;
  path?: string;
  context?: string;
  type?: string;
}

/**
 * Deduplicate pubkeys based on unique identifiers
 * @param pubkeys Array of pubkeys that may contain duplicates
 * @returns Array of unique pubkeys
 */
export function deduplicatePubkeys(pubkeys: Pubkey[]): Pubkey[] {
  if (!pubkeys || !Array.isArray(pubkeys)) {
    return [];
  }

  const seen = new Map<string, Pubkey>();
  
  for (const pubkey of pubkeys) {
    // Create a unique key based on the most identifying fields
    // Priority: address > master > pubkey > pathMaster
    let uniqueKey: string | null = null;
    
    if (pubkey.address) {
      uniqueKey = `address:${pubkey.address}`;
    } else if (pubkey.master) {
      uniqueKey = `master:${pubkey.master}`;
    } else if (pubkey.pubkey) {
      uniqueKey = `pubkey:${pubkey.pubkey}`;
    } else if (pubkey.pathMaster) {
      // Include scriptType to differentiate same path with different script types
      uniqueKey = `path:${pubkey.pathMaster}:${pubkey.scriptType || 'default'}`;
    }
    
    // Only add if we have a unique key and haven't seen it before
    if (uniqueKey && !seen.has(uniqueKey)) {
      seen.set(uniqueKey, pubkey);
    } else if (uniqueKey && seen.has(uniqueKey)) {
      // Log duplicate detection for debugging
      // console.warn('🔍 [Dedup] Duplicate pubkey detected and filtered:', {
      //   duplicate: pubkey,
      //   original: seen.get(uniqueKey),
      //   key: uniqueKey
      // });
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Deduplicate balances based on unique identifiers
 * @param balances Array of balances that may contain duplicates
 * @returns Array of unique balances
 */
export function deduplicateBalances(balances: any[]): any[] {
  if (!balances || !Array.isArray(balances)) {
    return [];
  }

  const seen = new Map<string, any>();
  
  for (const balance of balances) {
    // Create a unique key based on caip and pubkey
    // This ensures we don't double-count the same asset for the same address
    const pubkeyId = balance.pubkey || balance.address || balance.master || '';
    const uniqueKey = `${balance.caip}:${pubkeyId}`;
    
    if (!seen.has(uniqueKey)) {
      seen.set(uniqueKey, balance);
    } else {
      // If we've seen this before, keep the one with higher balance (in case of updates)
      const existing = seen.get(uniqueKey);
      const existingBalance = parseFloat(existing.balance || '0');
      const newBalance = parseFloat(balance.balance || '0');
      
      if (newBalance > existingBalance) {
        seen.set(uniqueKey, balance);
        console.warn('🔍 [Dedup] Updated balance for duplicate:', {
          caip: balance.caip,
          oldBalance: existingBalance,
          newBalance: newBalance
        });
      } else {
        console.warn('🔍 [Dedup] Duplicate balance detected and filtered:', {
          duplicate: balance,
          original: existing,
          key: uniqueKey
        });
      }
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Deduplicate network entries in dashboard
 * @param networks Array of networks that may contain duplicates
 * @returns Array of unique networks
 */
export function deduplicateNetworks(networks: any[]): any[] {
  if (!networks || !Array.isArray(networks)) {
    return [];
  }

  const seen = new Map<string, any>();
  
  for (const network of networks) {
    const uniqueKey = network.networkId || network.gasAssetCaip;
    
    if (uniqueKey && !seen.has(uniqueKey)) {
      seen.set(uniqueKey, network);
    } else if (uniqueKey && seen.has(uniqueKey)) {
      // If duplicate, combine the balances
      const existing = seen.get(uniqueKey);
      console.warn('🔍 [Dedup] Duplicate network detected:', {
        duplicate: network,
        original: existing,
        key: uniqueKey
      });
      
      // Update with higher total value
      if (network.totalValueUsd > existing.totalValueUsd) {
        seen.set(uniqueKey, network);
      }
    }
  }
  
  return Array.from(seen.values());
}