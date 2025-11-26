// We'll define the mappings directly since the import might not be available
const NetworkIdToChain: Record<string, string> = {
  'bip122:000000000019d6689c085ae165831e93': 'bitcoin',
  'bip122:000000000000000000651ef99cb9fcbe': 'bitcoincash',  // ✅ BCH genesis hash
  'bip122:12a765e31ffd4059bada1e25190f6e98': 'litecoin',  // ✅ FIXED - LTC genesis hash
  'bip122:00000000001a91e3dace36e2be3bf030': 'dogecoin',
  'bip122:000007d91d1254d60e2dd1ae58038307': 'dash',      // ✅ FIXED - DASH genesis hash
  'bip122:4da631f2ac1bed857bd968c67c913978': 'digibyte',  // ✅ DGB genesis hash
  'cosmos:mayachain-mainnet-v1': 'mayachain',
  'cosmos:osmosis-1': 'osmosis',
  'cosmos:cosmoshub-4': 'cosmos',
  'cosmos:kaiyo-1': 'kujira',
  'cosmos:thorchain-mainnet-v1': 'thorchain',
  'eip155:1': 'ethereum',
  'eip155:137': 'polygon',
  'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'ripple',
  'zcash:main': 'zcash',
};

const COIN_MAP_KEEPKEY: Record<string, string> = {
  'bitcoin': 'Bitcoin',
  'bitcoincash': 'BitcoinCash',
  'testnet': 'Testnet',
  'litecoin': 'Litecoin',
  'dogecoin': 'Dogecoin',
  'dash': 'Dash',
  'digibyte': 'DigiByte',
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'ripple': 'Ripple',
  'zcash': 'Zcash',
  'cosmos': 'Cosmos',
  'osmosis': 'Osmosis',
  'mayachain': 'MayaChain',
  'thorchain': 'THORChain',
  'kujira': 'Kujira',
};

// Map network IDs to their types for KeepKey SDK
export const networkIdToType: Record<string, string> = {
  'bip122:000000000019d6689c085ae165831e93': 'UTXO', // Bitcoin mainnet
  'bip122:000000000000000000651ef99cb9fcbe': 'UTXO', // Bitcoin Cash ✅ BCH
  'bip122:12a765e31ffd4059bada1e25190f6e98': 'UTXO', // Litecoin ✅ FIXED
  'bip122:00000000001a91e3dace36e2be3bf030': 'UTXO', // Dogecoin
  'bip122:000007d91d1254d60e2dd1ae58038307': 'UTXO', // Dash ✅ FIXED
  'bip122:4da631f2ac1bed857bd968c67c913978': 'UTXO', // DigiByte ✅ DGB
  'cosmos:mayachain-mainnet-v1': 'MAYACHAIN',
  'cosmos:osmosis-1': 'OSMOSIS',
  'cosmos:cosmoshub-4': 'COSMOS',
  'cosmos:kaiyo-1': 'COSMOS',
  'cosmos:thorchain-mainnet-v1': 'THORCHAIN',
  'eip155:1': 'EVM',      // Ethereum mainnet
  'eip155:137': 'EVM',    // Polygon
  'eip155:8453': 'EVM',   // BASE
  'eip155:*': 'EVM',      // Catch-all for other EVM chains
  'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'XRP',
  'zcash:main': 'UTXO',
};

// Convert BIP32 path to address_n array
export function bip32ToAddressNList(path: string): number[] {
  if (!path) return [];
  
  const parts = path.split('/').filter(p => p !== 'm');
  return parts.map(part => {
    const isHardened = part.includes("'");
    const num = parseInt(part.replace("'", ""));
    return isHardened ? 0x80000000 + num : num;
  });
}

// Build address_n list with updated indices
// For UTXO chains: modifies last two positions (change/receive indices)
// For account-based chains: uses path as-is (indices already in path)
export function buildAddressNListWithIndices(
  pathMaster: string,
  receiveIndex: number = 0,
  isChange: boolean = false,
  isAccountBased: boolean = false
): number[] {
  if (!pathMaster) return [];

  const parts = pathMaster.split('/').filter(p => p !== 'm');
  return parts.map((part, index) => {
    const isHardened = part.includes("'");
    const num = parseInt(part.replace("'", ""));

    // For account-based chains (Cosmos, EVM, etc.), use path as-is
    // The address index is already encoded in the path
    if (isAccountBased) {
      return isHardened ? 0x80000000 + num : num;
    }

    // For UTXO chains only: Last two positions are change and address index
    if (index === parts.length - 2) {
      // Change index position (0 for receive, 1 for change)
      return isChange ? 1 : 0;
    } else if (index === parts.length - 1) {
      // Address index position - use the receiveIndex
      return receiveIndex;
    }

    return isHardened ? 0x80000000 + num : num;
  });
}

interface AddressVerificationParams {
  keepKeySdk: any;
  networkId: string;
  pathMaster: string;
  scriptType?: string;
  receiveIndex?: number;
  expectedAddress?: string;
  showDisplay?: boolean;
}

/**
 * Get and optionally verify an address on the KeepKey device
 * @param params - Parameters for address verification
 * @returns The address from the device
 * @throws Error if address doesn't match expected or network type is unsupported
 */
export async function getAndVerifyAddress(params: AddressVerificationParams): Promise<string> {
  const {
    keepKeySdk,
    networkId,
    pathMaster,
    scriptType,
    receiveIndex = 0,
    expectedAddress,
    showDisplay = true
  } = params;

  // Check for network type - handle EIP155 chains dynamically
  let networkType = networkIdToType[networkId];
  if (!networkType) {
    // Check if it's an EIP155 chain (any EVM chain)
    if (networkId.startsWith('eip155:')) {
      networkType = 'EVM';
    } else {
      throw new Error(`Unsupported network ID: ${networkId}`);
    }
  }

  // Get the chain name and coin for this network
  // For EIP155 networks, normalize to mainnet for chain lookup
  let lookupNetworkId = networkId;
  if (networkId.indexOf('eip155') >= 0) {
    lookupNetworkId = 'eip155:1';
  }
  
  const chainName = NetworkIdToChain[lookupNetworkId];
  if (!chainName) {
    throw new Error(`Unknown network ID: ${lookupNetworkId}`);
  }
  
  const coin = COIN_MAP_KEEPKEY[chainName];
  if (!coin) {
    console.warn(`Unknown coin for chain: ${chainName}, using default`);
  }

  // Determine if this is an account-based chain (vs UTXO)
  // Account-based: Cosmos chains, EVM chains, XRP
  // UTXO: Bitcoin, Litecoin, Dogecoin, etc.
  const isAccountBased = networkType !== 'UTXO';

  console.log('🔍 [KeepKey] Chain type:', {
    networkType,
    isAccountBased,
    pathMaster,
    receiveIndex,
    willModifyPath: !isAccountBased
  });

  // Build address info for KeepKey SDK
  const addressInfo: any = {
    address_n: buildAddressNListWithIndices(pathMaster, receiveIndex, false, isAccountBased),
    show_display: showDisplay
  };

  // Add script_type if available (mainly for Bitcoin/UTXO chains)
  if (scriptType) {
    addressInfo.script_type = scriptType;
  }

  // Add coin for UTXO chains
  if (networkType === 'UTXO' && coin) {
    addressInfo.coin = coin;
  }

  console.log('🔑 [KeepKey] Address info for device:', addressInfo);

  let address: string;
  
  // Call the appropriate SDK method based on network type
  switch (networkType) {
    case 'UTXO':
      ({ address } = await keepKeySdk.address.utxoGetAddress(addressInfo));
      break;
    case 'EVM':
      ({ address } = await keepKeySdk.address.ethereumGetAddress(addressInfo));
      break;
    case 'OSMOSIS':
      ({ address } = await keepKeySdk.address.osmosisGetAddress(addressInfo));
      break;
    case 'COSMOS':
      ({ address } = await keepKeySdk.address.cosmosGetAddress(addressInfo));
      break;
    case 'MAYACHAIN':
      ({ address } = await keepKeySdk.address.mayachainGetAddress(addressInfo));
      break;
    case 'THORCHAIN':
      ({ address } = await keepKeySdk.address.thorchainGetAddress(addressInfo));
      break;
    case 'XRP':
      ({ address } = await keepKeySdk.address.xrpGetAddress(addressInfo));
      break;
    default:
      throw new Error(`Unsupported network type "${networkType}" for networkId: ${networkId}`);
  }

  console.log('✅ [KeepKey] Device provided address:', address);

  // Verify address matches if expected address is provided
  if (expectedAddress) {
    console.log('🔍 [KeepKey] Expected address:', expectedAddress);
    if (address !== expectedAddress) {
      throw new Error(`Address verification failed! Device: ${address}, Expected: ${expectedAddress}`);
    }
    console.log('✅ [KeepKey] Address verification successful!');
  }

  return address;
}