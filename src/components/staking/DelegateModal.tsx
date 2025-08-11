'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  HStack,
  Spinner,
  Badge,
  Flex,
  IconButton,
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
import { FaTimes, FaCoins, FaExternalLinkAlt } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';

// Theme colors
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface Validator {
  address: string;
  moniker: string;
  commission: string;
  status: string;
  jailed: boolean;
  tokens: string;
  delegator_shares: string;
  description?: {
    moniker: string;
    identity: string;
    website: string;
    details: string;
  };
}

interface DelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetContext: any;
  availableBalance: string;
  onSuccess?: () => void;
}

export const DelegateModal: React.FC<DelegateModalProps> = ({
  isOpen,
  onClose,
  assetContext,
  availableBalance,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [validatorAddress, setValidatorAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'form' | 'confirm' | 'sign' | 'broadcast' | 'success'>('form');
  const [txHash, setTxHash] = useState('');
  const [estimatedFee, setEstimatedFee] = useState('0.005');
  const [unsignedTx, setUnsignedTx] = useState<any>(null);

  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Get the expected validator prefix based on network
  const getValidatorPrefix = (networkId: string): string => {
    if (networkId.includes('osmosis')) return 'osmovaloper';
    if (networkId.includes('thorchain')) return 'thorvaloper';
    if (networkId.includes('mayachain')) return 'mayavaloper';
    if (networkId.includes('juno')) return 'junovaloper';
    if (networkId.includes('akash')) return 'akashvaloper';
    if (networkId.includes('stargaze')) return 'starsvaloper';
    if (networkId.includes('secret')) return 'secretvaloper';
    if (networkId.includes('kava')) return 'kavavaloper';
    if (networkId.includes('injective')) return 'injvaloper';
    if (networkId.includes('persistence')) return 'persistencevaloper';
    if (networkId.includes('sommelier')) return 'sommvaloper';
    if (networkId.includes('cosmoshub')) return 'cosmosvaloper';
    return 'cosmosvaloper'; // Default to cosmos
  };

  // Validate validator address format
  const validateValidatorAddress = (address: string): boolean => {
    if (!address) return false;
    const expectedPrefix = getValidatorPrefix(assetContext?.networkId || '');
    return address.startsWith(expectedPrefix);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleMaxClick = () => {
    // Leave some balance for fees
    const maxAmount = Math.max(0, parseFloat(availableBalance) - parseFloat(estimatedFee));
    setAmount(maxAmount.toString());
  };

  const buildDelegateTransaction = async () => {
    if (!amount || !validatorAddress || !assetContext) {
      throw new Error('Missing required fields');
    }

    // Validate validator address format
    if (!validateValidatorAddress(validatorAddress)) {
      const expectedPrefix = getValidatorPrefix(assetContext.networkId);
      throw new Error(`Invalid validator address. Must start with "${expectedPrefix}" for ${assetContext.symbol}`);
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔨 Building delegate transaction:', {
        amount,
        validator: validatorAddress,
        networkId: assetContext.networkId,
        caip: assetContext.caip
      });

      // Build the staking transaction using new buildDelegateTx method
      const stakingParams = {
        validatorAddress: validatorAddress,
        amount: parseFloat(amount),
        memo: 'Delegation via KeepKey Vault'
      };

      console.log('📤 Staking params:', stakingParams);

      // Use Pioneer SDK to build the delegation transaction
      const unsignedTxResult = await app.buildDelegateTx(assetContext.caip, stakingParams);
      
      console.log('✅ Unsigned transaction built:', unsignedTxResult);
      setUnsignedTx(unsignedTxResult);
      
      return unsignedTxResult;
    } catch (error) {
      console.error('❌ Error building delegate transaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signTransaction = async (unsignedTx: any) => {
    setLoading(true);
    try {
      console.log('✍️ Signing transaction:', unsignedTx);
      
      const signedTxResult = await app.signTx({
        caip: assetContext.caip,
        unsignedTx: unsignedTx
      });
      
      console.log('✅ Transaction signed:', signedTxResult);
      return signedTxResult;
    } catch (error) {
      console.error('❌ Error signing transaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const broadcastTransaction = async (signedTx: any) => {
    setLoading(true);
    try {
      console.log('📡 Broadcasting transaction:', signedTx);
      
      const broadcastResult = await app.broadcastTx(assetContext.caip, signedTx);
      
      console.log('✅ Transaction broadcasted:', broadcastResult);
      
      // Extract transaction hash
      const txHash = typeof broadcastResult === 'string' 
        ? broadcastResult 
        : broadcastResult?.txHash || broadcastResult?.txid || '';
      
      setTxHash(txHash);
      return broadcastResult;
    } catch (error) {
      console.error('❌ Error broadcasting transaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDelegate = async () => {
    try {
      setTransactionStep('confirm');
      
      // Build transaction
      const unsignedTx = await buildDelegateTransaction();
      
      // Sign transaction
      setTransactionStep('sign');
      const signedTx = await signTransaction(unsignedTx);
      
      // Broadcast transaction
      setTransactionStep('broadcast');
      await broadcastTransaction(signedTx);
      
      // Success
      setTransactionStep('success');
      
      // Call success callback after a delay
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Delegation error:', error);
      setError(error.message || 'Failed to delegate tokens');
      setTransactionStep('form');
    }
  };

  const handleClose = () => {
    setAmount('');
    setValidatorAddress('');
    setError(null);
    setTransactionStep('form');
    setTxHash('');
    setUnsignedTx(null);
    onClose();
  };

  const isValidValidatorAddress = validateValidatorAddress(validatorAddress);
  const canDelegate = amount && validatorAddress && isValidValidatorAddress && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(availableBalance);

  return (
    <DialogRoot open={isOpen} onOpenChange={({ open }) => !open && handleClose()}>
      <DialogContent maxWidth="500px" bg={theme.cardBg} borderColor={theme.border}>
        <DialogHeader>
          <DialogTitle color={theme.gold}>
            <HStack gap={2}>
              <FaCoins />
              <Text>Delegate {assetContext?.symbol}</Text>
            </HStack>
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <VStack gap={4} align="stretch">
            {error && (
              <Box p={3} bg="red.900" borderColor="red.500" borderWidth="1px" borderRadius="md">
                <Text color="red.200" fontSize="sm" fontWeight="bold">
                  ❌ Error: {error}
                </Text>
              </Box>
            )}

            {transactionStep === 'form' && (
              <>
                {/* Available Balance */}
                <Box p={3} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border}>
                  <HStack justify="space-between">
                    <Text color="gray.400" fontSize="sm">Available Balance:</Text>
                    <Text color="white" fontWeight="bold">
                      {availableBalance} {assetContext?.symbol}
                    </Text>
                  </HStack>
                </Box>

                {/* Validator Address Input */}
                <VStack align="stretch" gap={2}>
                  <Text color="white" fontWeight="medium">Validator Address</Text>
                  <Input
                    value={validatorAddress}
                    onChange={(e) => setValidatorAddress(e.target.value)}
                    placeholder={`Enter validator address (${getValidatorPrefix(assetContext?.networkId || '')}...)`}
                    bg={theme.bg}
                    borderColor={!validatorAddress || isValidValidatorAddress ? theme.border : 'red.500'}
                    color="white"
                    _hover={{ borderColor: theme.goldHover }}
                    _focus={{ borderColor: theme.gold }}
                    fontFamily="mono"
                    fontSize="sm"
                  />
                  
                  {/* Validation feedback */}
                  {validatorAddress && !isValidValidatorAddress && (
                    <Text color="red.400" fontSize="xs">
                      ⚠️ Invalid address format. Must start with "{getValidatorPrefix(assetContext?.networkId || '')}" for {assetContext?.symbol}
                    </Text>
                  )}
                  
                  {validatorAddress && isValidValidatorAddress && (
                    <Text color="green.400" fontSize="xs">
                      ✅ Valid validator address format
                    </Text>
                  )}
                  
                  {/* Helper text with example validators */}
                  <Box p={3} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border}>
                    <VStack align="stretch" gap={2}>
                      <Text color="gray.400" fontSize="xs" fontWeight="bold">
                        ℹ️ How to find validator addresses:
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        • Visit a block explorer like Mintscan or Keplr Dashboard
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        • Browse the validators list for {assetContext?.symbol || 'your network'}
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        • Copy the validator operator address (starts with "{getValidatorPrefix(assetContext?.networkId || '')}")
                      </Text>
                      
                      {assetContext?.networkId?.includes('osmosis') && (
                        <>
                          <Text color="gray.400" fontSize="xs" fontWeight="bold" mt={2}>
                            Example Osmosis validators:
                          </Text>
                          <Text color="gray.300" fontSize="xs" fontFamily="mono">
                            • osmovaloper1q5xvvmf03dx8amz66ku6z0x4u39f0aphqf42wc (Meria)
                          </Text>
                          <Text color="gray.300" fontSize="xs" fontFamily="mono">
                            • osmovaloper1pxphtfhqnx9ny27d53z4052e3r76e7qq495ehm (AutoStake)
                          </Text>
                        </>
                      )}
                      
                      {assetContext?.networkId?.includes('cosmoshub') && (
                        <>
                          <Text color="gray.400" fontSize="xs" fontWeight="bold" mt={2}>
                            Example Cosmos Hub validators:
                          </Text>
                          <Text color="gray.300" fontSize="xs" fontFamily="mono">
                            • cosmosvaloper1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u2lcnj0 (Stake.fish)
                          </Text>
                          <Text color="gray.300" fontSize="xs" fontFamily="mono">
                            • cosmosvaloper14lultfckehtszvzw4ehu0apvsr77afvyju5zzy (DokiaCapital)
                          </Text>
                        </>
                      )}
                    </VStack>
                  </Box>
                </VStack>

                {/* Amount Input */}
                <VStack align="stretch" gap={2}>
                  <Text color="white" fontWeight="medium">Amount to Delegate</Text>
                  <HStack>
                    <Input
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      bg={theme.bg}
                      borderColor={theme.border}
                      color="white"
                      _hover={{ borderColor: theme.goldHover }}
                      _focus={{ borderColor: theme.gold }}
                      flex="1"
                    />
                    <Button
                      onClick={handleMaxClick}
                      size="sm"
                      variant="outline"
                      color={theme.gold}
                      borderColor={theme.border}
                      _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                    >
                      MAX
                    </Button>
                  </HStack>
                  <Text color="gray.400" fontSize="xs">
                    Estimated fee: {estimatedFee} {assetContext?.symbol}
                  </Text>
                </VStack>
              </>
            )}

            {transactionStep === 'confirm' && (
              <VStack gap={4}>
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Confirm Delegation
                </Text>
                <Box p={4} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border} width="100%">
                  <VStack gap={3}>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Amount:</Text>
                      <Text color="white" fontWeight="bold">{amount} {assetContext?.symbol}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Validator:</Text>
                      <Text color="white" fontWeight="bold" fontSize="xs" fontFamily="mono">
                        {validatorAddress.substring(0, 12)}...{validatorAddress.substring(validatorAddress.length - 8)}
                      </Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Fee:</Text>
                      <Text color="white">{estimatedFee} {assetContext?.symbol}</Text>
                    </HStack>
                  </VStack>
                </Box>
                <Spinner color={theme.gold} size="lg" />
                <Text color="gray.400" textAlign="center">
                  Building transaction...
                </Text>
              </VStack>
            )}

            {transactionStep === 'sign' && (
              <VStack gap={4}>
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Sign Transaction
                </Text>
                <Spinner color={theme.gold} size="lg" />
                <Text color="gray.400" textAlign="center">
                  Please confirm the transaction on your KeepKey device
                </Text>
              </VStack>
            )}

            {transactionStep === 'broadcast' && (
              <VStack gap={4}>
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Broadcasting Transaction
                </Text>
                <Spinner color={theme.gold} size="lg" />
                <Text color="gray.400" textAlign="center">
                  Sending transaction to the network...
                </Text>
              </VStack>
            )}

            {transactionStep === 'success' && (
              <VStack gap={4}>
                <Text color="green.400" fontSize="lg" fontWeight="bold">
                  ✅ Delegation Successful!
                </Text>
                <Box p={4} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border} width="100%">
                  <VStack gap={3}>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Amount Delegated:</Text>
                      <Text color="white" fontWeight="bold">{amount} {assetContext?.symbol}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Validator:</Text>
                      <Text color="white" fontWeight="bold" fontSize="xs" fontFamily="mono">
                        {validatorAddress.substring(0, 12)}...{validatorAddress.substring(validatorAddress.length - 8)}
                      </Text>
                    </HStack>
                    {txHash && (
                      <HStack justify="space-between" width="100%">
                        <Text color="gray.400">Transaction:</Text>
                        <HStack>
                          <Text color="white" fontSize="sm" fontFamily="mono">
                            {txHash.substring(0, 8)}...{txHash.substring(txHash.length - 8)}
                          </Text>
                          <IconButton
                            aria-label="View transaction"
                            size="xs"
                            variant="ghost"
                            color={theme.gold}
                            onClick={() => {
                              const explorerUrl = getExplorerUrl(assetContext.networkId, txHash);
                              if (explorerUrl) window.open(explorerUrl, '_blank');
                            }}
                          >
                            <FaExternalLinkAlt />
                          </IconButton>
                        </HStack>
                      </HStack>
                    )}
                  </VStack>
                </Box>
                <Text color="gray.400" textAlign="center" fontSize="sm">
                  Your delegation will be active in the next block. This modal will close automatically.
                </Text>
              </VStack>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter>
          {transactionStep === 'form' && (
            <HStack gap={3} width="100%">
              <Button
                onClick={handleClose}
                variant="outline"
                color={theme.gold}
                borderColor={theme.border}
                _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                flex="1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelegate}
                bg={theme.gold}
                color="black"
                _hover={{ bg: theme.goldHover }}
                disabled={!canDelegate || loading}
                loading={loading}
                flex="1"
              >
                Delegate
              </Button>
            </HStack>
          )}
          
          {transactionStep === 'success' && (
            <Button
              onClick={handleClose}
              bg={theme.gold}
              color="black"
              _hover={{ bg: theme.goldHover }}
              width="100%"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

// Helper function to get explorer URL
const getExplorerUrl = (networkId: string, txHash: string): string | null => {
  console.log('Getting explorer URL for staking tx:', { networkId, txHash });
  
  if (networkId.includes('cosmos:cosmoshub')) {
    return `https://www.mintscan.io/cosmos/tx/${txHash}`;
  } else if (networkId.includes('cosmos:osmosis')) {
    return `https://www.mintscan.io/osmosis/tx/${txHash}`;
  } else if (networkId.includes('cosmos:thorchain')) {
    return `https://viewblock.io/thorchain/tx/${txHash}`;
  } else if (networkId.includes('cosmos:mayachain')) {
    return `https://www.mintscan.io/mayachain/tx/${txHash}`;
  } else if (networkId.includes('cosmos:kaiyo-1')) {
    return `https://www.mintscan.io/kujira/tx/${txHash}`;
  } else if (networkId.includes('cosmos:')) {
    const chainName = networkId.split(':')[1].split('/')[0];
    console.warn(`Using generic Mintscan for Cosmos chain: ${chainName}`);
    return `https://www.mintscan.io/${chainName}/tx/${txHash}`;
  }
  
  console.error(`No explorer configured for network: ${networkId}`);
  return null;
};

export default DelegateModal; 