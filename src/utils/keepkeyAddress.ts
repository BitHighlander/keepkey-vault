import { bip32ToAddressNList, COIN_MAP_KEEPKEY_LONG } from '@pioneer-platform/pioneer-coins';

// Network ID to chain mapping - Maps to COIN_MAP_KEEPKEY_LONG keys (uppercase symbols)
const NetworkIdToChain: Record<string, string> = {
  'bip122:000000000019d6689c085ae165831e93': 'BTC',     // Bitcoin mainnet
  'bip122:000000000000000000651ef99cb9fcbe': 'TEST',    // Bitcoin testnet
  'bip122:000007d91d1254d60e2dd1ae58038307': 'LTC',     // Litecoin
  'bip122:00000000001a91e3dace36e2be3bf030': 'DOGE',    // Dogecoin
  'bip122:12a765e31ffd4059bada1e25190f6e98': 'DASH',    // Dash
  'cosmos:mayachain-mainnet-v1': 'MAYA',                 // MayaChain
  'cosmos:osmosis-1': 'OSMO',                            // Osmosis
  'cosmos:cosmoshub-4': 'ATOM',                          // Cosmos
  'cosmos:kaiyo-1': 'KUJI',                              // Kujira
  'cosmos:thorchain-mainnet-v1': 'THOR',                 // THORChain
  'eip155:1': 'ETH',                                     // Ethereum
  'eip155:137': 'MATIC',                                 // Polygon
  'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'XRP',     // Ripple
  'zcash:main': 'ZEC',                                   // Zcash
};

// Map network IDs to their types for KeepKey SDK
export const networkIdToType: Record<string, string> = {
  'bip122:000000000019d6689c085ae165831e93': 'UTXO', // Bitcoin mainnet
  'bip122:000000000000000000651ef99cb9fcbe': 'UTXO', // Bitcoin testnet
  'bip122:000007d91d1254d60e2dd1ae58038307': 'UTXO', // Litecoin
  'bip122:00000000001a91e3dace36e2be3bf030': 'UTXO', // Dogecoin
  'bip122:12a765e31ffd4059bada1e25190f6e98': 'UTXO', // Dash
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

  console.log('🔑 [getAndVerifyAddress] Starting with params:', {
    networkId,
    pathMaster,
    scriptType,
    receiveIndex,
    showDisplay,
    hasExpectedAddress: !!expectedAddress
  });

  // Check for network type - handle EIP155 chains dynamically
  let networkType = networkIdToType[networkId];
  if (!networkType) {
    // Check if it's an EIP155 chain (any EVM chain)
    if (networkId.startsWith('eip155:')) {
      networkType = 'EVM';
    } else {
      console.error('❌ [getAndVerifyAddress] Unsupported network ID:', networkId);
      throw new Error(`Unsupported network ID: ${networkId}`);
    }
  }
  
  console.log('📊 [getAndVerifyAddress] Network type resolved:', networkType);

  const addressInfo: any = {
    address_n: bip32ToAddressNList(pathMaster),
    show_display: showDisplay
  };
  
  console.log('🔑 [getAndVerifyAddress] address_n array:', addressInfo.address_n);
  console.log('🔑 [getAndVerifyAddress] show_display value:', addressInfo.show_display);
  
  // Add script_type if available (mainly for Bitcoin/UTXO chains)
  if (scriptType) {
    addressInfo.script_type = scriptType;
  }
  
  // Add coin for UTXO chains - using COIN_MAP_KEEPKEY_LONG exactly like the sample
  if (networkType === 'UTXO') {
    const chainSymbol = NetworkIdToChain[networkId];
    console.log('🔍 [getAndVerifyAddress] Chain symbol lookup:', { networkId, chainSymbol });
    
    if (chainSymbol) {
      // @ts-ignore - COIN_MAP_KEEPKEY_LONG uses symbol keys
      addressInfo.coin = COIN_MAP_KEEPKEY_LONG[chainSymbol];
      
      if (!addressInfo.coin) {
        console.error('❌ [getAndVerifyAddress] Failed to find coin for symbol:', chainSymbol);
        console.error('❌ [getAndVerifyAddress] Available keys in COIN_MAP_KEEPKEY_LONG:', Object.keys(COIN_MAP_KEEPKEY_LONG));
      } else {
        console.log('✅ [getAndVerifyAddress] Found coin mapping:', { symbol: chainSymbol, coin: addressInfo.coin });
      }
    }
  }

  console.log('🔑 [KeepKey] Address info for device:', addressInfo);

  let address: string;
  
  // Call the appropriate SDK method based on network type
  console.log('🎯 [getAndVerifyAddress] Calling SDK method for networkType:', networkType);
  
  try {
    let response: any;
    switch (networkType) {
      case 'UTXO':
        console.log('📞 [getAndVerifyAddress] Calling utxoGetAddress with:', addressInfo);
        console.log('⏳ [getAndVerifyAddress] Waiting for device to display address...');
        
        // The SDK call should trigger the device display when show_display is true
        // The user needs to look at their device and confirm
        response = await keepKeySdk.address.utxoGetAddress(addressInfo);
        
        console.log('📦 [getAndVerifyAddress] Full SDK response:', response);
        console.log('🔍 [getAndVerifyAddress] Response type:', typeof response);
        console.log('🔍 [getAndVerifyAddress] Response keys:', Object.keys(response));
        
        address = response.address;
        break;
      case 'EVM':
        console.log('📞 [getAndVerifyAddress] Calling ethereumGetAddress...');
        ({ address } = await keepKeySdk.address.ethereumGetAddress(addressInfo));
        break;
      case 'OSMOSIS':
        console.log('📞 [getAndVerifyAddress] Calling osmosisGetAddress...');
        ({ address } = await keepKeySdk.address.osmosisGetAddress(addressInfo));
        break;
      case 'COSMOS':
        console.log('📞 [getAndVerifyAddress] Calling cosmosGetAddress...');
        ({ address } = await keepKeySdk.address.cosmosGetAddress(addressInfo));
        break;
      case 'MAYACHAIN':
        console.log('📞 [getAndVerifyAddress] Calling mayachainGetAddress...');
        ({ address } = await keepKeySdk.address.mayachainGetAddress(addressInfo));
        break;
      case 'THORCHAIN':
        console.log('📞 [getAndVerifyAddress] Calling thorchainGetAddress...');
        ({ address } = await keepKeySdk.address.thorchainGetAddress(addressInfo));
        break;
      case 'XRP':
        console.log('📞 [getAndVerifyAddress] Calling xrpGetAddress...');
        ({ address } = await keepKeySdk.address.xrpGetAddress(addressInfo));
        break;
      default:
        console.error('❌ [getAndVerifyAddress] Unsupported network type:', networkType);
        throw new Error(`Unsupported network type "${networkType}" for networkId: ${networkId}`);
    }
  } catch (error) {
    console.error('❌ [getAndVerifyAddress] SDK call failed:', error);
    throw error;
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