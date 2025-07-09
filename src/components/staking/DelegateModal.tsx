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
  const [selectedValidator, setSelectedValidator] = useState('');
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingValidators, setLoadingValidators] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'form' | 'confirm' | 'sign' | 'broadcast' | 'success'>('form');
  const [txHash, setTxHash] = useState('');
  const [estimatedFee, setEstimatedFee] = useState('0.005');
  const [unsignedTx, setUnsignedTx] = useState<any>(null);

  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Load validators when modal opens
  useEffect(() => {
    if (isOpen && assetContext?.networkId) {
      loadValidators();
    }
  }, [isOpen, assetContext?.networkId]);

  const loadValidators = async () => {
    setLoadingValidators(true);
    setError(null);
    
    try {
      console.log('🔍 Loading validators for network:', assetContext.networkId);
      
      // Try to get validators from Pioneer API
      if (app?.pioneer) {
        try {
          const validatorsResponse = await app.pioneer.GetValidators({
            networkId: assetContext.networkId
          });
          
          console.log('📊 Validators response:', validatorsResponse);
          
          if (validatorsResponse?.data && Array.isArray(validatorsResponse.data)) {
            // Filter active validators and sort by tokens (descending)
            const activeValidators = validatorsResponse.data
              .filter((v: any) => v.status === 'BOND_STATUS_BONDED' && !v.jailed)
              .sort((a: any, b: any) => parseFloat(b.tokens || '0') - parseFloat(a.tokens || '0'));
            
            setValidators(activeValidators);
            console.log('✅ Loaded validators:', activeValidators.length);
          } else {
            console.warn('⚠️ No validators data in response');
            setValidators([]);
          }
        } catch (apiError) {
          console.error('❌ Failed to load validators from API:', apiError);
          
          // Fallback to mock validators for common networks
          const mockValidators = getMockValidators(assetContext.networkId);
          setValidators(mockValidators);
          console.log('🔄 Using mock validators:', mockValidators.length);
        }
      } else {
        // Fallback to mock validators
        const mockValidators = getMockValidators(assetContext.networkId);
        setValidators(mockValidators);
        console.log('🔄 Using mock validators (no pioneer):', mockValidators.length);
      }
    } catch (error) {
      console.error('❌ Error loading validators:', error);
      setError('Failed to load validators. Please try again.');
    } finally {
      setLoadingValidators(false);
    }
  };

  // Mock validators for common networks
  const getMockValidators = (networkId: string): Validator[] => {
    const baseValidators = [
      {
        address: 'cosmosvaloper1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u2lcnj0',
        moniker: 'Stake.fish',
        commission: '0.05',
        status: 'BOND_STATUS_BONDED',
        jailed: false,
        tokens: '1000000000000',
        delegator_shares: '1000000000000',
        description: {
          moniker: 'Stake.fish',
          identity: '',
          website: 'https://stake.fish',
          details: 'Reliable validator with high uptime'
        }
      },
      {
        address: 'cosmosvaloper1c4k24jzduc365kywrsvf5ujz4ya6mwympnc4en',
        moniker: 'Coinbase Custody',
        commission: '0.20',
        status: 'BOND_STATUS_BONDED',
        jailed: false,
        tokens: '800000000000',
        delegator_shares: '800000000000',
        description: {
          moniker: 'Coinbase Custody',
          identity: '',
          website: 'https://custody.coinbase.com',
          details: 'Institutional grade validator'
        }
      },
      {
        address: 'cosmosvaloper14lultfckehtszvzw4ehu0apvsr77afvyju5zzy',
        moniker: 'DokiaCapital',
        commission: '0.03',
        status: 'BOND_STATUS_BONDED',
        jailed: false,
        tokens: '600000000000',
        delegator_shares: '600000000000',
        description: {
          moniker: 'DokiaCapital',
          identity: '',
          website: 'https://dokia.capital',
          details: 'Professional validator service'
        }
      }
    ];

    // Customize based on network
    if (networkId.includes('osmosis')) {
      return baseValidators.map(v => ({
        ...v,
        address: v.address.replace('cosmosvaloper', 'osmovaloper')
      }));
    } else if (networkId.includes('thorchain')) {
      return baseValidators.map(v => ({
        ...v,
        address: v.address.replace('cosmosvaloper', 'thorvaloper')
      }));
    } else if (networkId.includes('mayachain')) {
      return baseValidators.map(v => ({
        ...v,
        address: v.address.replace('cosmosvaloper', 'mayavaloper')
      }));
    }

    return baseValidators;
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
    if (!amount || !selectedValidator || !assetContext) {
      throw new Error('Missing required fields');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔨 Building delegate transaction:', {
        amount,
        validator: selectedValidator,
        networkId: assetContext.networkId,
        caip: assetContext.caip
      });

      // Build the staking transaction using new buildDelegateTx method
      const stakingParams = {
        validatorAddress: selectedValidator,
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
    setSelectedValidator('');
    setError(null);
    setTransactionStep('form');
    setTxHash('');
    setUnsignedTx(null);
    onClose();
  };

  const selectedValidatorData = validators.find(v => v.address === selectedValidator);
  const canDelegate = amount && selectedValidator && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(availableBalance);

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

                {/* Validator Selection */}
                <VStack align="stretch" gap={2}>
                  <Text color="white" fontWeight="medium">Select Validator</Text>
                  {loadingValidators ? (
                    <Flex justify="center" p={4}>
                      <Spinner color={theme.gold} />
                    </Flex>
                  ) : (
                    <select
                      value={selectedValidator}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedValidator(e.target.value)}
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
                      <option value="">Choose a validator...</option>
                      {validators.map((validator) => (
                        <option key={validator.address} value={validator.address}>
                          {validator.moniker} - {(parseFloat(validator.commission) * 100).toFixed(1)}% commission
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {selectedValidatorData && (
                    <Box p={3} bg={theme.bg} borderRadius="md" borderWidth="1px" borderColor={theme.border}>
                      <VStack align="stretch" gap={2}>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">Validator:</Text>
                          <Text color="white" fontWeight="medium">{selectedValidatorData.moniker}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">Commission:</Text>
                          <Badge colorScheme="blue" variant="subtle">
                            {(parseFloat(selectedValidatorData.commission) * 100).toFixed(1)}%
                          </Badge>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.400" fontSize="sm">Status:</Text>
                          <Badge colorScheme="green" variant="subtle">
                            Active
                          </Badge>
                        </HStack>
                      </VStack>
                    </Box>
                  )}
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
                      <Text color="white" fontWeight="bold">{selectedValidatorData?.moniker}</Text>
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
                      <Text color="white" fontWeight="bold">{selectedValidatorData?.moniker}</Text>
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
  if (networkId.includes('cosmos:cosmoshub')) {
    return `https://www.mintscan.io/cosmos/tx/${txHash}`;
  } else if (networkId.includes('cosmos:osmosis')) {
    return `https://www.mintscan.io/osmosis/tx/${txHash}`;
  } else if (networkId.includes('cosmos:thorchain')) {
    return `https://viewblock.io/thorchain/tx/${txHash}`;
  } else if (networkId.includes('cosmos:mayachain')) {
    return `https://www.mintscan.io/mayachain/tx/${txHash}`;
  } else if (networkId.includes('cosmos:')) {
    const chainName = networkId.split(':')[1].split('/')[0];
    return `https://www.mintscan.io/${chainName}/tx/${txHash}`;
  }
  return null;
};

export default DelegateModal; 