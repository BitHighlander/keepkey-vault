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
import { FaTimes, FaMinus, FaExternalLinkAlt } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';

// Theme colors
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface StakingPosition {
  type: 'delegation' | 'reward' | 'unbonding';
  balance: string;
  ticker: string;
  valueUsd: number;
  validator: string;
  validatorAddress: string;
  status: string;
  caip: string;
}

interface UndelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetContext: any;
  stakingPositions: StakingPosition[];
  onSuccess?: () => void;
}

export const UndelegateModal: React.FC<UndelegateModalProps> = ({
  isOpen,
  onClose,
  assetContext,
  stakingPositions,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [selectedDelegation, setSelectedDelegation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'form' | 'confirm' | 'sign' | 'broadcast' | 'success'>('form');
  const [txHash, setTxHash] = useState('');
  const [estimatedFee, setEstimatedFee] = useState('0.005');
  const [unsignedTx, setUnsignedTx] = useState<any>(null);

  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Filter only delegation positions
  const delegationPositions = stakingPositions.filter(pos => pos.type === 'delegation');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setSelectedDelegation('');
      setError(null);
      setTransactionStep('form');
      setTxHash('');
      setUnsignedTx(null);
    }
  }, [isOpen]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleMaxClick = () => {
    const selectedPosition = delegationPositions.find(pos => pos.validatorAddress === selectedDelegation);
    if (selectedPosition) {
      setAmount(selectedPosition.balance);
    }
  };

  const buildUndelegateTransaction = async () => {
    if (!amount || !selectedDelegation || !assetContext) {
      throw new Error('Missing required fields');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔨 Building undelegate transaction:', {
        amount,
        validator: selectedDelegation,
        networkId: assetContext.networkId,
        caip: assetContext.caip
      });

      // Build the unstaking transaction using new buildUndelegateTx method
      const unstakingParams = {
        validatorAddress: selectedDelegation,
        amount: parseFloat(amount),
        memo: 'Undelegation via KeepKey Vault'
      };

      console.log('📤 Unstaking params:', unstakingParams);

      // Use Pioneer SDK to build the undelegation transaction
      const unsignedTxResult = await app.buildUndelegateTx(assetContext.caip, unstakingParams);
      
      console.log('✅ Unsigned transaction built:', unsignedTxResult);
      setUnsignedTx(unsignedTxResult);
      
      return unsignedTxResult;
    } catch (error) {
      console.error('❌ Error building undelegate transaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signTransaction = async (unsignedTx: any) => {
    setLoading(true);
    try {
      console.log('✍️ Signing transaction:', unsignedTx);

      // Call the SDK's signTx method with TWO separate parameters (not an object)
      // See: pioneer-sdk/src/index.ts signTx(caip: string, unsignedTx: any)
      const signedTxResult = await app.signTx(
        assetContext.caip,
        unsignedTx
      );
      
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

  const handleUndelegate = async () => {
    try {
      setTransactionStep('confirm');
      
      // Build transaction
      const unsignedTx = await buildUndelegateTransaction();
      
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
      console.error('❌ Undelegation error:', error);
      setError(error.message || 'Failed to undelegate tokens');
      setTransactionStep('form');
    }
  };

  const handleClose = () => {
    setAmount('');
    setSelectedDelegation('');
    setError(null);
    setTransactionStep('form');
    setTxHash('');
    setUnsignedTx(null);
    onClose();
  };

  const selectedPosition = delegationPositions.find(pos => pos.validatorAddress === selectedDelegation);
  const canUndelegate = amount && selectedDelegation && parseFloat(amount) > 0 && selectedPosition && parseFloat(amount) <= parseFloat(selectedPosition.balance);

  // Get unbonding period info based on network
  const getUnbondingPeriod = (networkId: string): string => {
    if (networkId.includes('cosmos:cosmoshub')) return '21 days';
    if (networkId.includes('cosmos:osmosis')) return '14 days';
    if (networkId.includes('cosmos:thorchain')) return '3 days';
    if (networkId.includes('cosmos:mayachain')) return '10 days';
    return '21 days'; // Default
  };

  const unbondingPeriod = getUnbondingPeriod(assetContext?.networkId || '');

  return (
    <DialogRoot open={isOpen} onOpenChange={({ open }) => !open && handleClose()}>
      <DialogContent maxWidth="500px" bg={theme.cardBg} borderColor={theme.border}>
        <DialogHeader>
          <DialogTitle color={theme.gold}>
            <HStack gap={2}>
              <FaMinus />
              <Text>Undelegate {assetContext?.symbol}</Text>
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
                {/* Warning about unbonding period */}
                <Box p={3} bg="yellow.900" borderColor="yellow.500" borderWidth="1px" borderRadius="md">
                  <Text color="yellow.200" fontSize="sm" fontWeight="bold">
                    ⚠️ Unbonding Period: {unbondingPeriod}
                  </Text>
                  <Text color="yellow.300" fontSize="xs" mt={1}>
                    Your tokens will be locked for {unbondingPeriod} after undelegation and will not earn rewards during this period.
                  </Text>
                </Box>

                {/* Delegation Selection */}
                <VStack align="stretch" gap={2}>
                  <Text color="white" fontWeight="medium">Select Delegation to Undelegate</Text>
                  {delegationPositions.length === 0 ? (
                    <Box p={4} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border} textAlign="center">
                      <Text color="gray.400">No active delegations found</Text>
                    </Box>
                  ) : (
                    <select
                      value={selectedDelegation}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDelegation(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        borderWidth: '1px',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Choose a delegation...</option>
                      {delegationPositions.map((position, index) => (
                        <option key={index} value={position.validatorAddress}>
                          {position.validator} - {position.balance} {position.ticker}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {selectedPosition && (
                    <Box p={3} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border}>
                      <VStack align="stretch" gap={2}>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">Validator:</Text>
                          <Text color="white" fontWeight="medium">{selectedPosition.validator}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">Delegated Amount:</Text>
                          <Text color="white" fontWeight="medium">
                            {selectedPosition.balance} {selectedPosition.ticker}
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">USD Value:</Text>
                          <Text color={theme.gold} fontWeight="medium">
                            ${selectedPosition.valueUsd?.toFixed(2) || '0.00'}
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">Status:</Text>
                          <Badge colorScheme="green" variant="subtle">
                            {selectedPosition.status}
                          </Badge>
                        </HStack>
                      </VStack>
                    </Box>
                  )}
                </VStack>

                {/* Amount Input */}
                {selectedPosition && (
                  <VStack align="stretch" gap={2}>
                    <Text color="white" fontWeight="medium">Amount to Undelegate</Text>
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
                      Available: {selectedPosition.balance} {selectedPosition.ticker}
                    </Text>
                    <Text color="gray.400" fontSize="xs">
                      Estimated fee: {estimatedFee} {assetContext?.symbol}
                    </Text>
                  </VStack>
                )}
              </>
            )}

            {transactionStep === 'confirm' && (
              <VStack gap={4}>
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Confirm Undelegation
                </Text>
                <Box p={4} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border} width="100%">
                  <VStack gap={3}>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Amount:</Text>
                      <Text color="white" fontWeight="bold">{amount} {assetContext?.symbol}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Validator:</Text>
                      <Text color="white" fontWeight="bold">{selectedPosition?.validator}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Fee:</Text>
                      <Text color="white">{estimatedFee} {assetContext?.symbol}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Unbonding Period:</Text>
                      <Text color="yellow.300" fontWeight="bold">{unbondingPeriod}</Text>
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
                  ✅ Undelegation Successful!
                </Text>
                <Box p={4} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border} width="100%">
                  <VStack gap={3}>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Amount Undelegated:</Text>
                      <Text color="white" fontWeight="bold">{amount} {assetContext?.symbol}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Validator:</Text>
                      <Text color="white" fontWeight="bold">{selectedPosition?.validator}</Text>
                    </HStack>
                    <HStack justify="space-between" width="100%">
                      <Text color="gray.400">Unbonding Period:</Text>
                      <Text color="yellow.300" fontWeight="bold">{unbondingPeriod}</Text>
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
                  Your tokens will be available after the {unbondingPeriod} unbonding period. This modal will close automatically.
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
                onClick={handleUndelegate}
                bg={theme.gold}
                color="black"
                _hover={{ bg: theme.goldHover }}
                disabled={!canUndelegate || loading || delegationPositions.length === 0}
                loading={loading}
                flex="1"
              >
                Undelegate
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
  console.log('Getting explorer URL for unstaking tx:', { networkId, txHash });
  
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

export default UndelegateModal; 