'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
  Badge,
  Spinner,
} from '@chakra-ui/react';

import { usePioneerContext } from '@/components/providers/pioneer';
import { FaChevronDown, FaChevronUp, FaPlus, FaMinus, FaCoins } from 'react-icons/fa';
import { DelegateModal } from '@/components/staking/DelegateModal';
import { UndelegateModal } from '@/components/staking/UndelegateModal';

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

interface CosmosStakingProps {
  assetContext: any;
}

export const CosmosStaking = ({ assetContext }: CosmosStakingProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [showUndelegateModal, setShowUndelegateModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Check if this is a cosmos network
  const isCosmosNetwork = assetContext?.networkId?.includes('cosmos:');

  // Get staking positions from existing balances (they should already be loaded by getCharts)
  const getStakingPositions = () => {
    if (!app?.balances || !assetContext?.pubkeys?.[0]?.address || !isCosmosNetwork) {
      return [];
    }

    const address = assetContext.pubkeys[0].address;
    const networkId = assetContext.networkId;

    console.log('🔍 [CosmosStaking] Looking for staking positions in balances:', { 
      address, 
      networkId,
      totalBalances: app.balances.length 
    });
    
    // Debug: Show all cosmos-related balances
    const cosmosBalances = app.balances.filter((balance: any) => 
      balance.networkId?.includes('cosmos') || balance.caip?.includes('cosmos')
    );
    console.log('🔍 [CosmosStaking] All cosmos balances found:', cosmosBalances.length);
    cosmosBalances.forEach((balance: any, index: number) => {
      console.log(`🔍 [CosmosStaking] Cosmos balance ${index}:`, {
        caip: balance.caip,
        chart: balance.chart,
        pubkey: balance.pubkey,
        networkId: balance.networkId,
        type: balance.type,
        balance: balance.balance
      });
    });
    
    // Debug: Show all balances with chart property
    const chartBalances = app.balances.filter((balance: any) => balance.chart);
    console.log('🔍 [CosmosStaking] Balances with chart property:', chartBalances.length);
    chartBalances.forEach((balance: any, index: number) => {
      console.log(`🔍 [CosmosStaking] Chart balance ${index}:`, {
        chart: balance.chart,
        caip: balance.caip,
        pubkey: balance.pubkey,
        type: balance.type
      });
    });

    // Filter balances for staking positions
    const stakingBalances = app.balances.filter((balance: any) => {
      const isStaking = balance.chart === 'staking';
      const matchesAddress = balance.pubkey === address;
      const matchesNetwork = balance.networkId === networkId;
      
      console.log('🔍 [CosmosStaking] Checking balance:', {
        caip: balance.caip,
        chart: balance.chart,
        pubkey: balance.pubkey,
        networkId: balance.networkId,
        isStaking,
        matchesAddress,
        matchesNetwork
      });
      
      return isStaking && matchesAddress && matchesNetwork;
    });

    console.log('✅ [CosmosStaking] Found staking positions in balances:', stakingBalances);
    
    // Transform balances to match StakingPosition interface
    return stakingBalances.map((balance: any) => ({
      type: balance.type || 'delegation',
      balance: balance.balance || '0',
      ticker: balance.ticker || balance.symbol || assetContext.symbol,
      valueUsd: balance.valueUsd || 0,
      validator: balance.validator || balance.validatorName || 'Unknown Validator',
      validatorAddress: balance.validatorAddress || balance.validator || '',
      status: balance.status || 'active',
      caip: balance.caip || assetContext.caip
    }));
  };

  // Refresh staking positions by calling GetStakingPositions API directly
  const refreshStakingPositions = async () => {
    if (!assetContext?.networkId || !assetContext?.pubkeys?.[0]?.address) {
      console.log('⏭️ [CosmosStaking] Cannot refresh - missing networkId or address');
      return;
    }

    setIsRefreshing(true);
    setLoading(true);
    try {
      const address = assetContext.pubkeys[0].address;
      const networkId = assetContext.networkId;

      console.log('🔄 [CosmosStaking] Fetching staking positions for:', { networkId, address });

      if (!app?.pioneer) {
        console.error('❌ [CosmosStaking] Pioneer client not available');
        setError('Pioneer client not initialized');
        return;
      }

      // Convert networkId to network name for API (same as SDK does)
      let network: string;
      if (networkId === 'cosmos:cosmoshub-4') {
        network = 'cosmos';
      } else if (networkId === 'cosmos:osmosis-1') {
        network = 'osmosis';
      } else {
        console.error('❌ [CosmosStaking] Unsupported networkId for staking:', networkId);
        setError(`Staking not supported for ${networkId}`);
        setIsRefreshing(false);
        setLoading(false);
        return;
      }

      console.log('🔄 [CosmosStaking] Converted networkId to network:', { networkId, network });

      // Use converted network name for API call
      const response = await app.pioneer.GetStakingPositions({ network, address });

      console.log('✅ [CosmosStaking] Staking API response:', response);
      console.log('🔍 [CosmosStaking] Response.data type:', typeof response?.data);
      console.log('🔍 [CosmosStaking] Response.data isArray:', Array.isArray(response?.data));
      console.log('🔍 [CosmosStaking] Response.data content:', JSON.stringify(response?.data, null, 2));

      if (response?.data && Array.isArray(response.data)) {
        // Transform API response to match StakingPosition interface
        const positions = response.data.map((pos: any) => ({
          type: pos.type || 'delegation',
          balance: pos.balance?.toString() || '0',
          ticker: pos.ticker || pos.symbol || 'ATOM',
          valueUsd: pos.valueUsd || 0,
          validator: pos.validator || pos.validatorName || 'Unknown Validator',
          validatorAddress: pos.validatorAddress || pos.validator || '',
          status: pos.status || 'active',
          caip: pos.caip || assetContext.caip
        }));

        setStakingPositions(positions);
        console.log('✅ [CosmosStaking] Updated positions:', positions.length);
      } else {
        setStakingPositions([]);
        console.log('⏭️ [CosmosStaking] No staking positions found');
      }
    } catch (error) {
      console.error('❌ [CosmosStaking] Error refreshing staking positions:', error);
      setError('Failed to refresh staking positions');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  // Load staking data when component mounts or context changes
  useEffect(() => {
    const loadStakingData = async () => {
      if (!isExpanded || !isCosmosNetwork || !assetContext?.networkId) {
        return;
      }

      console.log('🔄 [CosmosStaking] Loading staking data for:', assetContext.networkId);

      // Call getCharts for this specific cosmos network to fetch staking positions
      if (app && typeof app.getCharts === 'function') {
        setLoading(true);
        try {
          console.log('🔄 [CosmosStaking] Calling app.getCharts for:', [assetContext.networkId]);
          await app.getCharts([assetContext.networkId]);
          console.log('✅ [CosmosStaking] getCharts completed');
        } catch (error) {
          console.error('❌ [CosmosStaking] getCharts failed:', error);
        }
      }

      // Now get the staking positions from app.balances
      const positions = getStakingPositions();
      setStakingPositions(positions);
      setLoading(false);
      setError(null);
    };

    loadStakingData();
  }, [isExpanded, isCosmosNetwork, assetContext?.networkId]);

  // Calculate totals
  const totalStakingValue = stakingPositions.reduce((sum, pos) => sum + (pos.valueUsd || 0), 0);
  const delegationPositions = stakingPositions.filter(pos => pos.type === 'delegation');
  const rewardPositions = stakingPositions.filter(pos => pos.type === 'reward');
  const unbondingPositions = stakingPositions.filter(pos => pos.type === 'unbonding');

  // Get available balance for delegation
  const getAvailableBalance = () => {
    if (!app?.balances || !assetContext?.pubkeys?.[0]?.address) return '0';
    
    const address = assetContext.pubkeys[0].address;
    const caip = assetContext.caip;
    
    // Find the native balance for this asset
    const nativeBalance = app.balances.find((balance: any) => 
      balance.caip === caip && balance.pubkey === address
    );
    
    return nativeBalance?.balance || '0';
  };

  // Handle successful delegation/undelegation
  const handleStakingSuccess = () => {
    // Refresh staking positions after successful transaction
    refreshStakingPositions();
  };

  // Don't render for non-cosmos networks
  if (!isCosmosNetwork) return null;

  // Don't render staking UI for THORChain
  const isThorchain = assetContext?.caip === 'cosmos:thorchain-mainnet-v1/slip44:931' ||
                      assetContext?.networkId === 'cosmos:thorchain-mainnet-v1';
  if (isThorchain) return null;

  return (
    <Box 
      bg={theme.cardBg}
      borderRadius="2xl"
      overflow="hidden"
      borderColor={theme.border}
      borderWidth="1px"
      mt={6}
    >
      {/* Header */}
      <Flex 
        p={4} 
        borderBottom={isExpanded ? "1px" : "none"} 
        borderColor={theme.border}
        justifyContent="space-between"
        alignItems="center"
        onClick={() => setIsExpanded(!isExpanded)}
        cursor="pointer"
        _hover={{
          bg: 'rgba(255, 215, 0, 0.05)',
        }}
        transition="background 0.2s"
      >
        <HStack gap={3}>
          <Icon as={FaCoins} color={theme.gold} boxSize={5} />
          <Text color={theme.gold} fontSize="lg" fontWeight="bold">
            Staking Positions
          </Text>
          {totalStakingValue > 0 && (
            <Badge colorScheme="green" variant="subtle">
              ${totalStakingValue.toFixed(2)}
            </Badge>
          )}
        </HStack>
        <HStack gap={2}>
          {isExpanded && (
                         <Button
               size="sm"
               variant="ghost"
               color={theme.gold}
               _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
               onClick={(e) => {
                 e.stopPropagation();
                 refreshStakingPositions();
               }}
               loading={isRefreshing}
               loadingText="Syncing..."
             >
               🔄 Sync
             </Button>
          )}
          <Icon 
            as={isExpanded ? FaChevronUp : FaChevronDown} 
            color={theme.gold}
            boxSize={4}
          />
        </HStack>
      </Flex>
      
      {/* Content */}
      {isExpanded && (
        <VStack align="stretch" p={4} gap={4}>
          {error && (
            <Box p={3} bg="red.900" borderColor="red.500" borderWidth="1px" borderRadius="md">
              <Text color="red.200" fontSize="sm">
                ❌ Error: {error}
              </Text>
            </Box>
          )}

          {loading ? (
            <Flex justify="center" p={8}>
              <Spinner color={theme.gold} size="lg" />
            </Flex>
          ) : (
            <>
              {/* Summary */}
              {stakingPositions.length > 0 && (
                <Box p={4} bg={theme.bg} borderRadius="lg" borderWidth="1px" borderColor={theme.border}>
                  <VStack gap={2}>
                    <Text color="white" fontSize="lg" fontWeight="bold">
                      Total Staking Value: ${totalStakingValue.toFixed(2)}
                    </Text>
                    <HStack gap={6}>
                      <VStack gap={0}>
                        <Text color={theme.gold} fontWeight="bold">{delegationPositions.length}</Text>
                        <Text color="gray.400" fontSize="sm">Delegations</Text>
                      </VStack>
                      <VStack gap={0}>
                        <Text color={theme.gold} fontWeight="bold">{rewardPositions.length}</Text>
                        <Text color="gray.400" fontSize="sm">Rewards</Text>
                      </VStack>
                      <VStack gap={0}>
                        <Text color={theme.gold} fontWeight="bold">{unbondingPositions.length}</Text>
                        <Text color="gray.400" fontSize="sm">Unbonding</Text>
                      </VStack>
                    </HStack>
                  </VStack>
                </Box>
              )}

              {/* Action Buttons */}
              <HStack gap={3}>
                <Button
                  flex="1"
                  bg={theme.cardBg}
                  color={theme.gold}
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                    borderColor: theme.gold,
                  }}
                  onClick={() => setShowDelegateModal(true)}
                >
                  <HStack gap={2}>
                    <Icon as={FaPlus} boxSize={3} />
                    <Text>Delegate</Text>
                  </HStack>
                </Button>
                <Button
                  flex="1"
                  bg={theme.cardBg}
                  color={theme.gold}
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                    borderColor: theme.gold,
                  }}
                  disabled={delegationPositions.length === 0}
                  onClick={() => setShowUndelegateModal(true)}
                >
                  <HStack gap={2}>
                    <Icon as={FaMinus} boxSize={3} />
                    <Text>Undelegate</Text>
                  </HStack>
                </Button>
              </HStack>

              {/* Staking Positions List */}
              {stakingPositions.length > 0 ? (
                <VStack align="stretch" gap={2}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Current Positions
                  </Text>
                  {stakingPositions.map((position, index) => (
                    <Box
                      key={index}
                      p={3}
                      bg={theme.bg}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <HStack justify="space-between">
                        <VStack align="start" gap={0}>
                          <HStack gap={2}>
                            <Badge 
                              colorScheme={
                                position.type === 'delegation' ? 'blue' :
                                position.type === 'reward' ? 'green' : 'yellow'
                              }
                              variant="subtle"
                              fontSize="xs"
                            >
                              {position.type}
                            </Badge>
                            <Text color="white" fontSize="sm" fontWeight="medium">
                              {position.balance} {position.ticker}
                            </Text>
                          </HStack>
                          <Text color="gray.400" fontSize="xs" fontFamily="mono">
                            {position.validator}
                          </Text>
                        </VStack>
                        <VStack align="end" gap={0}>
                          <Text color={theme.gold} fontSize="sm" fontWeight="bold">
                            ${position.valueUsd?.toFixed(2) || '0.00'}
                          </Text>
                          <Text color="gray.400" fontSize="xs">
                            {position.status}
                          </Text>
                        </VStack>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Box p={6} textAlign="center">
                  <Text color="gray.400">No staking positions found</Text>
                  <Text color="gray.500" fontSize="sm" mt={1}>
                    Start by delegating some {assetContext.symbol} to earn rewards
                  </Text>
                                     <Button
                     mt={3}
                     size="sm"
                     variant="outline"
                     color={theme.gold}
                     borderColor={theme.border}
                     _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                     onClick={refreshStakingPositions}
                     loading={isRefreshing}
                     loadingText="Syncing..."
                   >
                     🔄 Sync Staking Positions
                   </Button>
                </Box>
              )}
            </>
          )}
        </VStack>
      )}
      
      {/* Staking Modals */}
      <DelegateModal
        isOpen={showDelegateModal}
        onClose={() => setShowDelegateModal(false)}
        assetContext={assetContext}
        availableBalance={getAvailableBalance()}
        onSuccess={handleStakingSuccess}
      />
      
      <UndelegateModal
        isOpen={showUndelegateModal}
        onClose={() => setShowUndelegateModal(false)}
        assetContext={assetContext}
        stakingPositions={stakingPositions}
        onSuccess={handleStakingSuccess}
      />
    </Box>
  );
};

export default CosmosStaking; 