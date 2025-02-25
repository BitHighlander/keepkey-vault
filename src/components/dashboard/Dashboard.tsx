'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Stack,
  HStack,
  Button,
  Image,
  VStack,
} from '@chakra-ui/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { Skeleton, SkeletonCircle } from "@/components/ui/skeleton"
import { usePioneerContext } from '@/components/providers/pioneer'

// Custom scrollbar styles
const scrollbarStyles = {
  css: {
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-track': {
      width: '6px',
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#4A5568',
      borderRadius: '24px',
    },
  }
};

// Theme colors
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface Network {
  networkId: string;
  totalValueUsd: number;
  gasAssetCaip: string;
  gasAssetSymbol: string;
  icon: string;
  color: string;
  totalNativeBalance: string;
}

interface NetworkPercentage {
  networkId: string;
  percentage: number;
}

interface Pubkey {
  networks: string[];
  type: string;
  master: string;
  address: string;
  pubkey: string;
  path: string;
  scriptType: string;
  note: string;
  context: string;
}

interface Dashboard {
  networks: Network[];
  totalValueUsd: number;
  networkPercentages: NetworkPercentage[];
}

interface DashboardProps {
  onSettingsClick: () => void;
  onAddNetworkClick: () => void;
}

const NetworkSkeleton = () => (
  <HStack gap="4" p={4} bg={theme.cardBg} borderRadius="2xl" boxShadow="lg">
    <SkeletonCircle size="8" />
    <Stack flex="1">
      <Skeleton height="4" width="120px" />
      <Skeleton height="3" width="80px" />
    </Stack>
    <Stack align="flex-end">
      <Skeleton height="4" width="60px" />
      <Skeleton height="3" width="40px" />
    </Stack>
  </HStack>
);

const Dashboard = ({ onSettingsClick, onAddNetworkClick }: DashboardProps) => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Format balance for display
  const formatBalance = (balance: string) => {
    try {
      const numericBalance = parseFloat(balance);
      const safeBalance = isNaN(numericBalance) ? '0' : balance;
      const [integer, decimal] = safeBalance.split('.');
      const largePart = decimal?.slice(0, 4) || '0000';
      const smallPart = decimal?.slice(4, 6) || '00';
      return { integer, largePart, smallPart };
    } catch (error) {
      console.error('Error in formatBalance:', error);
      return { integer: '0', largePart: '0000', smallPart: '00' };
    }
  };

  // Format USD value
  const formatUsd = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0.00';
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  useEffect(() => {
    console.log('📊 [Dashboard] Component mounted');
    fetchDashboard();
    return () => console.log('📊 [Dashboard] Component unmounting');
  }, [app, app?.dashboard]);

  // Add new useEffect to reload dashboard when assetContext becomes null
  useEffect(() => {
    console.log('📊 [Dashboard] AssetContext changed:', app?.assetContext);
    if (!app?.assetContext) {
      console.log('📊 [Dashboard] AssetContext is null, reloading dashboard');
      fetchDashboard();
    }
  }, [app?.assetContext]);

  const fetchDashboard = async () => {
    console.log('📊 [Dashboard] Fetching dashboard data');
    setLoading(true);
    try {
      if(app && app.dashboard) {
        const dashboard = app.dashboard;
        console.log('📊 [Dashboard] Dashboard data received:', dashboard);
        setDashboard(dashboard);
      } else {
        console.log('📊 [Dashboard] No dashboard data available');
      }
    } catch (error) {
      console.error('📊 [Dashboard] Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      console.log('📊 [Dashboard] Fetch complete');
    }
  };

  // Prepare data for donut chart
  const chartData = dashboard?.networks
    .filter(network => parseFloat(network.totalNativeBalance) > 0)
    .map(network => ({
      name: network.gasAssetSymbol,
      value: network.totalValueUsd,
      color: network.color,
    })) || [];

  return (
    <Box height="600px" bg={theme.bg}>
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
        backdropFilter="blur(10px)"
        position="relative"
        _after={{
          content: '""',
          position: "absolute",
          bottom: "-1px",
          left: "0",
          right: "0",
          height: "1px",
          background: `linear-gradient(90deg, transparent 0%, ${theme.gold}40 50%, transparent 100%)`,
        }}
      >
        <HStack justify="space-between" align="center">
          <HStack gap={3}>
            <Image src="/images/kk-icon-gold.png" alt="KeepKey" height="24px" />
            <Text fontSize="lg" fontWeight="bold" color={theme.gold}>
              KeepKey Vault
            </Text>
          </HStack>
          <Button
            size="sm"
            variant="ghost"
            color={theme.gold}
            _hover={{ color: theme.goldHover, bg: 'rgba(255, 215, 0, 0.1)' }}
            onClick={onSettingsClick}
          >
            <HStack gap={2} align="center">
              <Text>Settings</Text>
              <Box 
                w="2px" 
                h="2px" 
                borderRadius="full" 
                bg={theme.gold} 
              />
            </HStack>
          </Button>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box 
        height="calc(100% - 60px)" 
        overflowY="auto" 
        overflowX="hidden"
        p={4}
        {...scrollbarStyles}
      >
        <VStack gap={6} align="stretch">
          {/* Portfolio Overview with Chart */}
          <Box 
            p={6} 
            borderRadius="2xl" 
            boxShadow={!loading && dashboard && chartData.length > 0 
              ? `0 4px 20px ${chartData[0].color}20, inset 0 0 20px ${chartData[0].color}10`
              : 'lg'
            }
            border="1px solid"
            borderColor={!loading && dashboard && chartData.length > 0 
              ? `${chartData[0].color}40`
              : theme.border
            }
            position="relative"
            overflow="hidden"
            bg={!loading && dashboard && chartData.length > 0 ? `${chartData[0].color}15` : theme.cardBg}
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: !loading && dashboard && chartData.length > 0
                ? `linear-gradient(135deg, ${chartData[0].color}40 0%, ${chartData[0].color}20 100%)`
                : 'none',
              opacity: 0.6,
              zIndex: 0,
            }}
            _after={{
              content: '""',
              position: "absolute",
              top: "-50%",
              left: "-50%",
              right: "-50%",
              bottom: "-50%",
              background: "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.8) 100%)",
              zIndex: 1,
            }}
          >
            <Flex direction={{ base: 'column', sm: 'row' }} gap={6} align="center" position="relative" zIndex={2}>
              {/* Portfolio Value */}
              <Stack gap={1} flex="1">
                {loading ? (
                  <>
                    <Skeleton height="4" width="140px" />
                    <Skeleton height="8" width="180px" />
                  </>
                ) : (
                  <>
                    <Text fontSize="sm" color={chartData.length > 0 ? `${chartData[0].color}80` : "gray.400"}>
                      Total Portfolio Value
                    </Text>
                    <Text fontSize="3xl" fontWeight="bold" color={chartData.length > 0 ? chartData[0].color : theme.gold}>
                      ${formatUsd(dashboard?.totalValueUsd)}
                    </Text>
                  </>
                )}
              </Stack>

              {/* Donut Chart */}
              {!loading && dashboard && (
                <Box width="120px" height="120px">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value, cx, cy, midAngle, innerRadius, outerRadius }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          const percent = ((value / dashboard.totalValueUsd) * 100).toFixed(0);
                          
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={theme.gold}
                              textAnchor={x > cx ? 'start' : 'end'}
                              dominantBaseline="central"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              {name} ({percent}%)
                            </text>
                          );
                        }}
                        labelLine={{
                          stroke: theme.gold,
                          strokeWidth: 1,
                          strokeOpacity: 0.5,
                        }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={theme.cardBg}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`$${formatUsd(value)}`, 'Value']}
                        contentStyle={{
                          backgroundColor: theme.cardBg,
                          borderColor: theme.border,
                          borderRadius: '8px',
                          color: 'white'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Flex>
          </Box>

          {/* Network List */}
          <Box>
            <HStack justify="space-between" mb={4}>
              <HStack gap={2}>
                <Text fontSize="sm" color="gray.400">Your Assets</Text>
                <Text fontSize="xs" color="gray.600">
                  ({dashboard?.networks.filter(n => parseFloat(n.totalNativeBalance) > 0).length || 0})
                </Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                color={theme.gold}
                _hover={{ color: theme.goldHover }}
              >
                View All
              </Button>
            </HStack>
            
            <VStack gap={2}>
              {loading || !dashboard ? (
                <>
                  <NetworkSkeleton />
                  <NetworkSkeleton />
                  <NetworkSkeleton />
                </>
              ) : (
                dashboard?.networks
                  .filter(network => parseFloat(network.totalNativeBalance) > 0)
                  .map((network) => {
                    const { integer, largePart, smallPart } = formatBalance(network.totalNativeBalance);
                    const percentage = dashboard.networkPercentages.find(
                      np => np.networkId === network.networkId
                    )?.percentage || 0;

                    return (
                      <Box 
                        key={network.networkId}
                        w="100%"
                        p={4}
                        borderRadius="2xl"
                        borderWidth="1px"
                        borderColor={`${network.color}40`}
                        boxShadow={`0 4px 20px ${network.color}20, inset 0 0 20px ${network.color}10`}
                        position="relative"
                        bg={`${network.color}15`}
                        _before={{
                          content: '""',
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(135deg, ${network.color}40 0%, ${network.color}20 100%)`,
                          opacity: 0.6,
                          borderRadius: "inherit",
                        }}
                        _after={{
                          content: '""',
                          position: "absolute",
                          top: "-50%",
                          left: "-50%",
                          right: "-50%",
                          bottom: "-50%",
                          background: "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.8) 100%)",
                          opacity: 0.5,
                          borderRadius: "inherit",
                        }}
                        _hover={{ 
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 24px ${network.color}30, inset 0 0 30px ${network.color}20`,
                          borderColor: network.color,
                          bg: `${network.color}25`,
                          _before: {
                            opacity: 0.8,
                            background: `linear-gradient(135deg, ${network.color}50 0%, ${network.color}30 100%)`,
                          },
                          _after: {
                            opacity: 0.7,
                          },
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          if (app?.setAssetContext) {
                            console.log('Setting AssetContext from network:', network);
                            const assetContextData = {
                              networkId: network.networkId,
                              chainId: network.networkId,
                              assetId: network.gasAssetCaip,
                              caip: network.gasAssetCaip,
                              name: network.gasAssetSymbol,
                              networkName: network.networkId.split(':').pop() || '',
                              symbol: network.gasAssetSymbol,
                              icon: network.icon,
                              color: network.color,
                              balance: network.totalNativeBalance,
                              value: network.totalValueUsd,
                              precision: 18,
                              priceUsd: network.totalValueUsd / parseFloat(network.totalNativeBalance),
                              explorer: network.networkId.startsWith('eip155') 
                                ? `https://${network.networkId.split(':').pop()?.toLowerCase()}.etherscan.io`
                                : network.networkId.startsWith('cosmos')
                                ? `https://www.mintscan.io/${network.networkId.split(':')[1]}`
                                : `https://explorer.pioneers.dev/${network.networkId}`,
                              explorerAddressLink: network.networkId.startsWith('eip155')
                                ? `https://${network.networkId.split(':').pop()?.toLowerCase()}.etherscan.io/address/`
                                : network.networkId.startsWith('cosmos')
                                ? `https://www.mintscan.io/${network.networkId.split(':')[1]}/account/`
                                : `https://explorer.pioneers.dev/${network.networkId}/address/`,
                              explorerTxLink: network.networkId.startsWith('eip155')
                                ? `https://${network.networkId.split(':').pop()?.toLowerCase()}.etherscan.io/tx/`
                                : network.networkId.startsWith('cosmos')
                                ? `https://www.mintscan.io/${network.networkId.split(':')[1]}/txs/`
                                : `https://explorer.pioneers.dev/${network.networkId}/tx/`,
                              pubkeys: (app.pubkeys as Pubkey[] || []).filter(p => p.networks.includes(network.networkId))
                            };
                            console.log('AssetContext data being set:', assetContextData);
                            app.setAssetContext(assetContextData);
                          }
                        }}
                        role="button"
                        aria-label={`Select ${network.gasAssetSymbol} network`}
                      >
                        <Flex align="center" justify="space-between">
                          <HStack gap={3}>
                            <Box 
                              borderRadius="full" 
                              overflow="hidden" 
                              boxSize="32px"
                              bg={network.color}
                              boxShadow={`lg, inset 0 0 10px ${network.color}40`}
                              position="relative"
                              _after={{
                                content: '""',
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: `linear-gradient(135deg, ${network.color}40 0%, transparent 100%)`,
                                opacity: 0.6,
                              }}
                            >
                              <Image 
                                src={network.icon} 
                                alt={network.networkId}
                                boxSize="32px"
                                objectFit="cover"
                              />
                            </Box>
                            <Stack gap={0}>
                              <Text fontSize="sm" fontWeight="bold" color={network.color}>
                                {network.gasAssetSymbol}
                              </Text>
                              <HStack gap={2} align="center">
                                <Text fontSize="sm" color="gray.300">
                                  {integer}.{largePart}
                                  <Text as="span" fontSize="xs" color="gray.400">
                                    {smallPart}
                                  </Text>
                                </Text>
                                <Text fontSize="xs" color={network.color}>
                                  {network.gasAssetSymbol}
                                </Text>
                              </HStack>
                            </Stack>
                          </HStack>
                          <Stack align="flex-end" gap={0}>
                            <Text fontSize="sm" color={network.color}>
                              ${formatUsd(network.totalValueUsd)}
                            </Text>
                            <Text fontSize="xs" color={`${network.color}80`}>
                              {percentage.toFixed(1)}%
                            </Text>
                          </Stack>
                        </Flex>
                      </Box>
                    );
                  })
              )}
            </VStack>
          </Box>

          {/* Add Network Button */}
          <Box
            p={4}
            borderRadius="2xl"
            borderStyle="dashed"
            borderWidth="2px"
            borderColor={theme.border}
            position="relative"
            _hover={{
              borderColor: theme.gold,
              bg: 'rgba(255, 215, 0, 0.05)',
              _after: {
                opacity: 0.3,
              }
            }}
            _after={{
              content: '""',
              position: "absolute",
              top: "-50%",
              left: "-50%",
              right: "-50%",
              bottom: "-50%",
              background: "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.8) 100%)",
              opacity: 0.2,
              transition: "opacity 0.2s",
            }}
            transition="all 0.2s"
            cursor="pointer"
            onClick={onAddNetworkClick}
          >
            <Flex justify="center" align="center">
              <Button
                variant="ghost"
                color={theme.gold}
                _hover={{ bg: 'transparent', color: theme.goldHover }}
              >
                Add Network
              </Button>
            </Flex>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
};

export default Dashboard; 