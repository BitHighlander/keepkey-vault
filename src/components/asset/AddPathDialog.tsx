'use client'

import React, { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  Spinner,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FaPlus } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';
import { saveCustomPath, isPathDuplicate } from '@/lib/storage/customPaths';

// Theme colors - matching the project theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  borderLight: '#333333',
};

interface AddPathDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetContext: any;
}

// Common script types for different chains
const SCRIPT_TYPES = {
  bitcoin: ['p2pkh', 'p2sh-p2wpkh', 'p2wpkh'],
  ethereum: ['address'],
  cosmos: ['cosmos', 'bech32'],
  mayachain: ['mayachain'],
  thorchain: ['thorchain'],
};

export const AddPathDialog: React.FC<AddPathDialogProps> = ({ isOpen, onClose, assetContext }) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Determine network type and default script type
  const networkId = assetContext?.networkId || '';
  const isBitcoin = networkId.includes('bip122:');
  const isEthereum = networkId.includes('eip155:');
  const isCosmos = networkId.includes('cosmos:');
  const isMaya = networkId.includes('mayachain');
  const isThor = networkId.includes('thorchain');

  // Get default script type based on network
  const getDefaultScriptType = () => {
    if (isBitcoin) return 'p2wpkh'; // Native SegWit for Bitcoin
    if (isEthereum) return 'address';
    if (isCosmos) return 'cosmos';
    if (isMaya) return 'mayachain';
    if (isThor) return 'thorchain';
    return 'address';
  };

  // Get chain name for default note
  const getChainName = () => {
    if (isBitcoin) return 'Bitcoin';
    if (isEthereum) return 'Ethereum';
    if (isMaya) return 'Maya';
    if (isThor) return 'THORChain';
    if (isCosmos) return 'Cosmos';
    return assetContext?.name || assetContext?.symbol || 'Custom';
  };

  const defaultScriptType = getDefaultScriptType();
  const defaultNote = `Custom ${getChainName()} path 1`;

  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(defaultNote);
  const [accountIndex, setAccountIndex] = useState('0');
  const [addressIndex, setAddressIndex] = useState('0');
  const [error, setError] = useState('');

  // Get coin type from network
  const getCoinType = () => {
    if (isBitcoin) return 0;
    if (isEthereum) return 60;
    if (isCosmos) return 118;
    if (isMaya) return 931;
    if (isThor) return 931;
    return 0;
  };

  // Get BIP44 path components
  const getPathComponents = () => {
    const coinType = getCoinType();
    const account = parseInt(accountIndex) || 0;
    const change = 0; // External addresses
    const address = parseInt(addressIndex) || 0;

    // Determine purpose based on script type
    let purpose = 44; // BIP44 (Legacy)
    if (defaultScriptType === 'p2sh-p2wpkh') purpose = 49; // BIP49 (SegWit)
    if (defaultScriptType === 'p2wpkh') purpose = 84; // BIP84 (Native SegWit)

    return { purpose, coinType, account, change, address };
  };

  // Generate address N list
  const generateAddressNList = () => {
    const { purpose, coinType, account, change, address } = getPathComponents();
    return [
      0x80000000 + purpose,
      0x80000000 + coinType,
      0x80000000 + account,
      change,
      address
    ];
  };

  const handleAddPath = async () => {
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

      const pathConfig = {
        note: note.trim(),
        type: isBitcoin ? 'xpub' : 'address',
        addressNList,
        addressNListMaster: addressNList,
        curve: 'secp256k1',
        script_type: defaultScriptType,
        showDisplay: false,
        networks,
      };

      console.log('🔧 [AddPathDialog] Adding path:', pathConfig);

      // Add path to Pioneer SDK
      const result = await app.addPath(pathConfig);

      console.log('✅ [AddPathDialog] Path added to SDK:', result);

      // Save to localStorage for persistence across sessions
      try {
        const savedPath = saveCustomPath(pathConfig);
        console.log('✅ [AddPathDialog] Path persisted to localStorage:', savedPath.id);
      } catch (storageError: any) {
        console.warn('⚠️ [AddPathDialog] Failed to persist path to localStorage:', storageError);
        // Don't throw - the path is still added to the current session
      }

      // Close dialog on success
      onClose();

      // Reset form
      setNote(defaultNote);
      setAccountIndex('0');
      setAddressIndex('0');
    } catch (err: any) {
      console.error('❌ [AddPathDialog] Error adding path:', err);
      setError(err.message || 'Failed to add path');
    } finally {
      setLoading(false);
    }
  };

  const { purpose, coinType, account, change, address } = getPathComponents();
  const derivationPath = `m/${purpose}'/${coinType}'/${account}'/${change}/${address}`;

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent
        bg={theme.cardBg}
        borderColor={theme.gold}
        borderWidth="2px"
        borderRadius="xl"
        maxW="600px"
        p={8}
      >
        <DialogHeader borderBottom={`1px solid ${theme.border}`} pb={6} mb={6}>
          <DialogTitle color={theme.gold} fontSize="2xl" fontWeight="bold">
            Add New Path
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody pt={0} pb={6}>
          <VStack gap={6} align="stretch">
            {/* Asset Information */}
            <Box
              p={4}
              bg={theme.bg}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={theme.border}
            >
              <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
                Asset
              </Text>
              <Text color="white" fontSize="lg" fontWeight="bold">
                {assetContext?.symbol || 'Unknown'} ({assetContext?.name || 'Unknown Asset'})
              </Text>
              <Text color="gray.500" fontSize="xs" mt={1}>
                Network: {assetContext?.networkId || 'Unknown'}
              </Text>
            </Box>

            {/* Note Input */}
            <Box>
              <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
                Note *
              </Text>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Account 1, Trading wallet, etc."
                bg={theme.bg}
                borderColor={theme.border}
                color="white"
                _hover={{ borderColor: theme.gold }}
                _focus={{ borderColor: theme.gold, boxShadow: `0 0 0 1px ${theme.gold}` }}
              />
            </Box>

            {/* Account Index */}
            <Box>
              <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
                Account Index
              </Text>
              <Input
                type="number"
                min="0"
                max="999"
                value={accountIndex}
                onChange={(e) => setAccountIndex(e.target.value)}
                bg={theme.bg}
                borderColor={theme.border}
                color="white"
                _hover={{ borderColor: theme.gold }}
                _focus={{ borderColor: theme.gold, boxShadow: `0 0 0 1px ${theme.gold}` }}
              />
            </Box>

            {/* Address Index */}
            <Box>
              <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
                Address Index
              </Text>
              <Input
                type="number"
                min="0"
                max="999"
                value={addressIndex}
                onChange={(e) => setAddressIndex(e.target.value)}
                bg={theme.bg}
                borderColor={theme.border}
                color="white"
                _hover={{ borderColor: theme.gold }}
                _focus={{ borderColor: theme.gold, boxShadow: `0 0 0 1px ${theme.gold}` }}
              />
            </Box>

            {/* Derivation Path Preview */}
            <Box
              p={4}
              bg="rgba(255, 215, 0, 0.05)"
              borderRadius="xl"
              borderWidth="1px"
              borderColor="rgba(255, 215, 0, 0.2)"
            >
              <Text color={theme.gold} fontSize="xs" fontWeight="medium" mb={2}>
                Derivation Path
              </Text>
              <Text color="white" fontSize="sm" fontFamily="mono">
                {derivationPath}
              </Text>
            </Box>

            {/* Error Message */}
            {error && (
              <Box
                p={4}
                bg="rgba(255, 0, 0, 0.1)"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="red.500"
              >
                <Text color="red.400" fontSize="sm">
                  ⚠️ {error}
                </Text>
              </Box>
            )}

            {/* Info Box */}
            <Box
              p={4}
              bg="rgba(255, 215, 0, 0.05)"
              borderRadius="xl"
              borderWidth="1px"
              borderColor="rgba(255, 215, 0, 0.2)"
            >
              <Text color={theme.gold} fontSize="xs" fontWeight="medium" mb={2}>
                ℹ️ Important Information
              </Text>
              <Text color="gray.400" fontSize="xs" mb={2}>
                This will add a new derivation path to your wallet. The new path will be used to generate addresses and fetch balances.
              </Text>
              <Text color="gray.400" fontSize="xs">
                <strong>Note:</strong> Custom paths are stored in your browser's local cache only. KeepKey does not track or store this data across platforms, so you may need to add custom paths again on other devices or browsers.
              </Text>
            </Box>
          </VStack>
        </DialogBody>

        <DialogFooter borderTop={`1px solid ${theme.border}`} pt={6}>
          <HStack gap={4} width="100%">
            <Button
              flex={1}
              size="lg"
              height="56px"
              variant="ghost"
              onClick={onClose}
              color="gray.400"
              _hover={{ bg: theme.border }}
              borderRadius="lg"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              flex={2}
              size="lg"
              height="56px"
              onClick={handleAddPath}
              disabled={loading || !note.trim()}
              bg={theme.gold}
              color="black"
              _hover={{ bg: theme.goldHover }}
              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              borderRadius="lg"
              fontWeight="bold"
            >
              {loading ? (
                <HStack gap={3}>
                  <Spinner size="sm" color="black" />
                  <Text>Adding Path...</Text>
                </HStack>
              ) : (
                <HStack gap={3}>
                  <FaPlus />
                  <Text>Add Path</Text>
                </HStack>
              )}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
