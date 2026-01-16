/**
 * UTXO Address Usage Utilities
 *
 * Helper functions for fetching and parsing UTXO address usage information
 * from the Pioneer API, including receive/change indices and used address counts.
 */

export interface AddressUsageInfo {
  receiveIndex: number;
  changeIndex: number;
  usedReceiveAddresses: number;
  usedChangeAddresses: number;
}

export interface Pubkey {
  address?: string;
  master?: string;
  pubkey?: string;
  note: string;
  pathMaster: string;
  networks: string[];
  scriptType?: string;
  // UTXO address usage info
  receiveIndex?: number;
  changeIndex?: number;
  usedReceiveAddresses?: number;
  usedChangeAddresses?: number;
}

/**
 * Helper function to parse BIP44 path and extract change/address indices
 *
 * @param path - BIP44 path string (e.g., "m/84'/0'/0'/0/5")
 * @returns Object with changeIndicator (0=receive, 1=change) and addressIndex, or null if invalid
 */
export const parseBIP44Path = (path: string): { changeIndicator: number; addressIndex: number } | null => {
  if (!path) return null;

  // BIP44 path format: m/purpose'/coin_type'/account'/change/address_index
  // After split: ['m', "purpose'", "coin_type'", "account'", 'change', 'address_index']
  const pathParts = path.split('/');

  if (pathParts.length !== 6) return null;

  const changeIndicator = parseInt(pathParts[4], 10);
  const addressIndex = parseInt(pathParts[5], 10);

  if (isNaN(changeIndicator) || isNaN(addressIndex)) return null;

  return { changeIndicator, addressIndex };
};

/**
 * Map network ID to chain symbol for Pioneer API
 *
 * @param network - Network ID (e.g., "bip122:000000000019d6689c085ae165831e93")
 * @returns Chain symbol (BTC, LTC, DOGE, DASH, BCH)
 */
export const getChainSymbolFromNetwork = (network: string): string => {
  if (network.includes('12a765e31ffd4059bada1e25190f6e98')) return 'LTC';
  if (network.includes('000000000933ea01ad0ee984209779ba')) return 'DOGE';
  if (network.includes('000000000000024b89b42a942fe0d9fea3bb44ab7bd1b19115dd6a759c0808b8')) return 'DASH';
  if (network.includes('000000000000000000651ef99cb9fcbe')) return 'BCH';
  return 'BTC'; // Default to Bitcoin
};

/**
 * Fetch UTXO address usage info (receive/change indices) from Pioneer API
 *
 * @param pubkey - Extended public key (xpub, ypub, zpub)
 * @param network - Network ID
 * @param serverUrl - Pioneer API server URL (optional, defaults to env or localhost)
 * @returns Address usage info or null if fetch fails
 */
export const fetchUTXOAddressUsageInfo = async (
  pubkey: string,
  network: string,
  serverUrl?: string
): Promise<AddressUsageInfo | null> => {
  try {
    // Get Pioneer server URL from parameter, environment, or default to localhost
    const apiUrl = serverUrl ||
                   process.env.NEXT_PUBLIC_PIONEER_URL_SPEC?.replace('/spec/swagger.json', '') ||
                   'http://localhost:9001';

    // Map network ID to chain symbol for API
    const chain = getChainSymbolFromNetwork(network);

    //console.log(`🔍 [UTXO Utils] Fetching address usage info for ${chain} xpub:`, pubkey.substring(0, 20) + '...');

    // Call Pioneer API to get pubkey info with used addresses
    const response = await fetch(`${apiUrl}/api/v1/utxo/pubkey-info/${chain}/${pubkey}?tokens=used`);

    if (!response.ok) {
      console.warn(`⚠️ [UTXO Utils] Failed to fetch address usage info: ${response.status}`);
      return null;
    }

    const data = await response.json();

    console.log(`✅ [UTXO Utils] Received pubkey info with ${data.usedTokens || 0} used addresses`);

    // Parse address usage from tokens array
    let maxReceiveIndex = -1;
    let receiveAddresses = 0;
    let maxChangeIndex = -1;
    let changeAddresses = 0;

    if (data.tokens && Array.isArray(data.tokens)) {
      for (const token of data.tokens) {
        if (token.path) {
          const parsed = parseBIP44Path(token.path);
          if (parsed) {
            if (parsed.changeIndicator === 0) {
              // Receive address
              receiveAddresses++;
              if (parsed.addressIndex > maxReceiveIndex) {
                maxReceiveIndex = parsed.addressIndex;
              }
            } else if (parsed.changeIndicator === 1) {
              // Change address
              changeAddresses++;
              if (parsed.addressIndex > maxChangeIndex) {
                maxChangeIndex = parsed.addressIndex;
              }
            }
          }
        }
      }
    }

    const result: AddressUsageInfo = {
      receiveIndex: maxReceiveIndex >= 0 ? maxReceiveIndex + 1 : 0,
      changeIndex: maxChangeIndex >= 0 ? maxChangeIndex + 1 : 0,
      usedReceiveAddresses: receiveAddresses,
      usedChangeAddresses: changeAddresses
    };

    console.log(`📊 [UTXO Utils] Address usage:`, result);

    return result;
  } catch (error) {
    console.error('❌ [UTXO Utils] Error fetching address usage info:', error);
    return null;
  }
};

/**
 * Enrich pubkeys with UTXO address usage information
 *
 * @param pubkeys - Array of pubkeys to enrich
 * @param networkId - Network ID
 * @param serverUrl - Pioneer API server URL (optional)
 * @returns Array of enriched pubkeys with usage info
 */
export const enrichPubkeysWithUsageInfo = async (
  pubkeys: Pubkey[],
  networkId: string,
  serverUrl?: string
): Promise<Pubkey[]> => {
  if (!pubkeys || pubkeys.length === 0) {
    return pubkeys;
  }

  console.log(`🔄 [UTXO Utils] Enriching ${pubkeys.length} pubkeys with usage info...`);

  // Fetch usage info for all pubkeys in parallel
  const enrichedPubkeys = await Promise.all(
    pubkeys.map(async (pubkey: Pubkey) => {
      const xpub = pubkey.pubkey || pubkey.master || pubkey.address;
      if (!xpub) return pubkey;

      const usageInfo = await fetchUTXOAddressUsageInfo(xpub, networkId, serverUrl);

      if (usageInfo) {
        return {
          ...pubkey,
          receiveIndex: usageInfo.receiveIndex,
          changeIndex: usageInfo.changeIndex,
          usedReceiveAddresses: usageInfo.usedReceiveAddresses,
          usedChangeAddresses: usageInfo.usedChangeAddresses
        };
      }

      return pubkey;
    })
  );

  console.log('✅ [UTXO Utils] Pubkeys enriched with address usage info');

  return enrichedPubkeys;
};

/**
 * Check if a network is a UTXO-based blockchain
 *
 * @param networkId - Network ID to check
 * @returns True if UTXO network, false otherwise
 */
export const isUTXONetwork = (networkId: string): boolean => {
  const UTXO_NETWORKS = [
    'bip122:000000000019d6689c085ae165831e93', // Bitcoin
    'bip122:12a765e31ffd4059bada1e25190f6e98', // Litecoin
    'bip122:000000000933ea01ad0ee984209779ba', // Dogecoin
    'bip122:000000000000000000651ef99cb9fcbe', // Bitcoin Cash
    'bip122:000000000000024b89b42a942fe0d9fea3bb44ab7bd1b19115dd6a759c0808b8', // Dash
  ];

  return UTXO_NETWORKS.some(id => networkId.includes(id)) || networkId.startsWith('bip122:');
};
