import { useState, useCallback } from 'react';
import { saveCustomPath, isPathDuplicate } from '@/lib/storage/customPaths';

// Common script types for different chains
const SCRIPT_TYPES = {
  bitcoin: ['p2pkh', 'p2sh-p2wpkh', 'p2wpkh'],
  ethereum: ['address'],
  cosmos: ['cosmos', 'bech32'],
  mayachain: ['mayachain'],
  thorchain: ['thorchain'],
};

export interface PathConfig {
  note: string;
  type: string;
  addressNList: number[];
  addressNListMaster: number[];
  curve: string;
  script_type: string;
  showDisplay: boolean;
  networks: string[];
}

export interface UsePathManagerProps {
  assetContext: any;
  app: any;
}

export interface PathComponents {
  purpose: number;
  coinType: number;
  account: number;
  change: number;
  address: number;
}

export const usePathManager = ({ assetContext, app }: UsePathManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [accountIndex, setAccountIndex] = useState('0');
  const [addressIndex, setAddressIndex] = useState('0');

  // Determine network type and default script type
  const networkId = assetContext?.networkId || '';
  const isBitcoin = networkId.includes('bip122:');
  const isEthereum = networkId.includes('eip155:');
  // Check Maya and Thor BEFORE generic Cosmos to avoid false positives
  const isMaya = networkId.includes('mayachain');
  const isThor = networkId.includes('thorchain');
  const isCosmos = networkId.includes('cosmos:') && !isMaya && !isThor;

  // Get default script type based on network
  const getDefaultScriptType = useCallback(() => {
    if (isBitcoin) return 'p2wpkh'; // Native SegWit for Bitcoin
    if (isEthereum) return 'address';
    if (isCosmos) return 'cosmos';
    if (isMaya) return 'mayachain';
    if (isThor) return 'thorchain';
    return 'address';
  }, [isBitcoin, isEthereum, isCosmos, isMaya, isThor]);

  // Get chain name for default note
  const getChainName = useCallback(() => {
    if (isBitcoin) return 'Bitcoin';
    if (isEthereum) return 'Ethereum';
    if (isMaya) return 'Maya';
    if (isThor) return 'THORChain';
    if (isCosmos) return 'Cosmos';
    return assetContext?.name || assetContext?.symbol || 'Custom';
  }, [isBitcoin, isEthereum, isMaya, isThor, isCosmos, assetContext]);

  const defaultScriptType = getDefaultScriptType();
  const defaultNote = `Custom ${getChainName()} path 1`;

  // Get coin type from network
  const getCoinType = useCallback(() => {
    if (isBitcoin) return 0;
    if (isEthereum) return 60;
    if (isCosmos) return 118;
    if (isMaya) return 931;
    if (isThor) return 931;
    return 0;
  }, [isBitcoin, isEthereum, isCosmos, isMaya, isThor]);

  // Get BIP44 path components
  const getPathComponents = useCallback((): PathComponents => {
    const coinType = getCoinType();
    const account = parseInt(accountIndex) || 0;
    const change = 0; // External addresses
    const address = parseInt(addressIndex) || 0;

    // Determine purpose based on script type
    let purpose = 44; // BIP44 (Legacy)
    if (defaultScriptType === 'p2sh-p2wpkh') purpose = 49; // BIP49 (SegWit)
    if (defaultScriptType === 'p2wpkh') purpose = 84; // BIP84 (Native SegWit)

    return { purpose, coinType, account, change, address };
  }, [getCoinType, accountIndex, addressIndex, defaultScriptType]);

  // Generate address N list
  const generateAddressNList = useCallback((): number[] => {
    const { purpose, coinType, account, change, address } = getPathComponents();
    return [
      0x80000000 + purpose,
      0x80000000 + coinType,
      0x80000000 + account,
      change,
      address
    ];
  }, [getPathComponents]);

  // Generate derivation path string
  const getDerivationPath = useCallback((): string => {
    const { purpose, coinType, account, change, address } = getPathComponents();
    return `m/${purpose}'/${coinType}'/${account}'/${change}/${address}`;
  }, [getPathComponents]);

  // Add path to SDK and localStorage
  const addPath = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      if (!app?.addPath) {
        throw new Error('addPath method not available in SDK');
      }

      if (!note.trim()) {
        throw new Error('Please provide a note describing this path');
      }

      const addressNList = generateAddressNList();

      // Check for duplicate paths before adding
      if (isPathDuplicate(addressNList)) {
        throw new Error('This derivation path already exists');
      }

      const networks = assetContext?.networks || [networkId];

      const pathConfig: PathConfig = {
        note: note.trim(),
        type: isBitcoin ? 'xpub' : 'address',
        addressNList,
        addressNListMaster: addressNList,
        curve: 'secp256k1',
        script_type: defaultScriptType,
        showDisplay: false,
        networks,
      };

      //console.log('🔧 [usePathManager] Adding path:', pathConfig);

      // Add path to Pioneer SDK
      const result = await app.addPath(pathConfig);

      //console.log('✅ [usePathManager] Path added to SDK:', result);

      // Save to localStorage for persistence across sessions
      try {
        const savedPath = saveCustomPath(pathConfig);
        //console.log('✅ [usePathManager] Path persisted to localStorage:', savedPath.id);
      } catch (storageError: any) {
        console.warn('⚠️ [usePathManager] Failed to persist path to localStorage:', storageError);
        // Don't throw - the path is still added to the current session
      }

      // Trigger balance refresh to subscribe new addresses to chainWatcher
      //console.log('🔄 [usePathManager] Refreshing balances to subscribe new custom path addresses...');
      try {
        await app.refresh(true); // Force refresh to fetch balances for new path
        //console.log('✅ [usePathManager] Balances refreshed - new addresses subscribed to chainWatcher');
      } catch (refreshError: any) {
        console.warn('⚠️ [usePathManager] Failed to refresh balances:', refreshError);
        // Don't throw - the path is still added, balance will be fetched on next sync
      }

      // Reset form
      setNote(defaultNote);
      setAccountIndex('0');
      setAddressIndex('0');

      return result;
    } catch (err: any) {
      console.error('❌ [usePathManager] Error adding path:', err);
      setError(err.message || 'Failed to add path');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [app, note, generateAddressNList, assetContext, networkId, isBitcoin, defaultScriptType, defaultNote]);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setNote(defaultNote);
    setAccountIndex('0');
    setAddressIndex('0');
    setError('');
  }, [defaultNote]);

  return {
    // State
    loading,
    error,
    note,
    accountIndex,
    addressIndex,

    // Setters
    setNote,
    setAccountIndex,
    setAddressIndex,
    setError,

    // Computed values
    defaultScriptType,
    defaultNote,
    derivationPath: getDerivationPath(),
    pathComponents: getPathComponents(),

    // Network type flags
    isBitcoin,
    isEthereum,
    isCosmos,
    isMaya,
    isThor,

    // Methods
    addPath,
    resetForm,
    getChainName,
  };
};
