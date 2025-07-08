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
    return stakingBalances;
  };

  // Load staking data when component mounts or context changes
  useEffect(() => {
    if (isExpanded && isCosmosNetwork) {
      const positions = getStakingPositions();
      setStakingPositions(positions);
      setLoading(false);
      setError(null);
    }
  }, [isExpanded, isCosmosNetwork, assetContext, app?.balances]);

  // Calculate totals
  const totalStakingValue = stakingPositions.reduce((sum, pos) => sum + (pos.valueUsd || 0), 0);
  const delegationPositions = stakingPositions.filter(pos => pos.type === 'delegation');
  const rewardPositions = stakingPositions.filter(pos => pos.type === 'reward');
  const unbondingPositions = stakingPositions.filter(pos => pos.type === 'unbonding');

  // Don't render for non-cosmos networks
  if (!isCosmosNetwork) return null;

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
        <Icon 
          as={isExpanded ? FaChevronUp : FaChevronDown} 
          color={theme.gold}
          boxSize={4}
        />
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
                  onClick={() => {
                    console.log('🚀 [CosmosStaking] Delegate button clicked - TODO: Implement delegation');
                    // TODO: Implement delegation modal/flow
                  }}
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
                  onClick={() => {
                    console.log('🚀 [CosmosStaking] Undelegate button clicked - TODO: Implement undelegation');
                    // TODO: Implement undelegation modal/flow
                  }}
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
                </Box>
              )}
            </>
          )}
        </VStack>
      )}
    </Box>
  );
};

export default CosmosStaking; 