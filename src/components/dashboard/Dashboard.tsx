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
  Grid,
  GridItem,
  useDisclosure,
} from '@chakra-ui/react';
import { Skeleton, SkeletonCircle } from "@/components/ui/skeleton"
import { usePioneerContext } from '@/components/providers/pioneer'
import { DonutChart, DonutChartItem, ChartLegend } from '@/components/chart';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';

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
  <HStack gap="4" p={5} bg={theme.cardBg} borderRadius="2xl" boxShadow="lg">
    <SkeletonCircle size="12" />
    <Stack flex="1">
      <Skeleton height="5" width="120px" />
      <Skeleton height="4" width="80px" />
    </Stack>
    <Stack align="flex-end">
      <Skeleton height="5" width="70px" />
      <Skeleton height="4" width="40px" />
    </Stack>
  </HStack>
);

const Dashboard = ({ onSettingsClick, onAddNetworkClick }: DashboardProps) => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSliceIndex, setActiveSliceIndex] = useState<number | undefined>(0);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const router = useRouter();

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

  // Add a utility function for middle ellipsis
  const middleEllipsis = (text: string, visibleChars = 16) => {
    if (!text) return '';
    if (text.length <= visibleChars) return text;
    
    const charsToShow = Math.floor(visibleChars / 2);
    return `${text.substring(0, charsToShow)}...${text.substring(text.length - charsToShow)}`;
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

  // Set up interval to sync market data every 15 seconds
  useEffect(() => {
    if (!app) return;
    
    const intervalId = setInterval(() => {
      app
        .syncMarket()
        .then(() => {
          console.log("📊 [Dashboard] syncMarket called from Dashboard");
          // Artificially adjust all balances by +0.01 for testing
          if (app.dashboard?.networks && Array.isArray(app.dashboard.networks)) {
            app.dashboard.networks = app.dashboard.networks.map((network: any) => {
              const oldVal = parseFloat(network.totalValueUsd || 0);
              const newVal = oldVal + 0.01;
              return { ...network, totalValueUsd: newVal };
            });
            
            // Update total portfolio value
            if (app.dashboard) {
              const total = app.dashboard.networks.reduce(
                (sum: number, network: any) => sum + network.totalValueUsd, 
                0
              );
              app.dashboard.totalValueUsd = total;
            }
          }
          setLastSync(Date.now());
          fetchDashboard();
        })
        .catch((error: any) => {
          console.error("❌ [Dashboard] Error in syncMarket:", error);
        });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [app]);

  const fetchDashboard = async () => {
    console.log('📊 [Dashboard] Fetching dashboard data');
    setLoading(true);
    try {
      if(app && app.dashboard) {
        const dashboard = app.dashboard;
        console.log('📊 [Dashboard] Dashboard data received:', dashboard);
        setDashboard(dashboard);
        
        // Set activeSliceIndex to the index of the top asset (with highest value)
        if (dashboard.networks && dashboard.networks.length > 0) {
          const sortedNetworks = [...dashboard.networks]
            .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0)
            .sort((a, b) => b.totalValueUsd - a.totalValueUsd);
            
          if (sortedNetworks.length > 0) {
            // Find the index of the top asset in the original filtered data
            const topAsset = sortedNetworks[0];
            const topAssetIndex = dashboard.networks
              .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0)
              .findIndex((network: Network) => network.networkId === topAsset.networkId);
              
            if (topAssetIndex >= 0) {
              console.log('📊 [Dashboard] Setting active slice to top asset:', topAsset.gasAssetSymbol);
              setActiveSliceIndex(topAssetIndex);
            }
          }
        }
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

  // Handle slice or legend hover
  const handleHover = (index: number | null) => {
    // Only update if hovering over a different asset or returning to the default
    if (index === null) {
      // Find the top asset index again when mouse leaves
      if (dashboard?.networks && dashboard.networks.length > 0) {
        const sortedNetworks = [...dashboard.networks]
          .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0)
          .sort((a, b) => b.totalValueUsd - a.totalValueUsd);
          
        if (sortedNetworks.length > 0) {
          const topAsset = sortedNetworks[0];
          const topAssetIndex = dashboard.networks
            .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0)
            .findIndex((network: Network) => network.networkId === topAsset.networkId);
            
          if (topAssetIndex >= 0) {
            setActiveSliceIndex(topAssetIndex);
            return;
          }
        }
      }
      // Fallback to first item if we can't find top asset
      setActiveSliceIndex(0);
    } else if (index !== activeSliceIndex) {
      setActiveSliceIndex(index);
    }
  };

  // Modify formatValueForChart to use CountUp
  const formatValueForChart = (value: number) => {
    return formatUsd(value);
  };

  return (
    <Box height="100vh" bg={theme.bg}>
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
        p={6}
        {...scrollbarStyles}
      >
        <VStack gap={8} align="stretch">
          {/* Portfolio Overview with Chart */}
          <Box 
            p={8} 
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
            <Flex 
              justify="center" 
              align="center" 
              position="relative" 
              zIndex={2}
              direction="column"
              gap={6}
              width="100%"
            >
              {loading ? (
                <Flex direction="column" align="center" justify="center" py={6} width="100%">
                  <SkeletonCircle size="180px" />
                  <Skeleton height="4" width="140px" mt={4} />
                </Flex>
              ) : dashboard ? (
                <>
                  <Box 
                    width="100%"
                    maxWidth="210px"  
                    height="210px" 
                    mx="auto"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <DonutChart 
                      data={chartData} 
                      formatValue={(value) => formatValueForChart(value)}
                      height={210}
                      width={210}
                      activeIndex={activeSliceIndex}
                      onHoverSlice={handleHover}
                    />
                  </Box>
                  <Box 
                    width="100%"
                    maxWidth="400px"
                    pt={2}
                    mt={1}
                    mx="auto"
                    height="40px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderTop="1px solid"
                    borderColor="whiteAlpha.100"
                  >
                    <ChartLegend 
                      data={chartData} 
                      total={dashboard.totalValueUsd}
                      formatValue={(value) => formatUsd(value)}
                      activeIndex={activeSliceIndex}
                      onHoverItem={handleHover}
                    />
                  </Box>
                </>
              ) : (
                <Text color={theme.gold}>No portfolio data available</Text>
              )}
            </Flex>
          </Box>

          {/* Network List */}
          <Box>
            <HStack justify="space-between" mb={5}>
              <HStack gap={2}>
                <Text fontSize="md" color="gray.400">Your Assets</Text>
                <Text fontSize="xs" color="gray.600">
                  ({dashboard?.networks.length || 0})
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
            
            <VStack gap={4}>
              {loading || !dashboard ? (
                <>
                  <NetworkSkeleton />
                  <NetworkSkeleton />
                  <NetworkSkeleton />
                </>
              ) : (
                dashboard?.networks
                  .map((network) => {
                    const { integer, largePart, smallPart } = formatBalance(network.totalNativeBalance);
                    const percentage = dashboard.networkPercentages.find(
                      np => np.networkId === network.networkId
                    )?.percentage || 0;

                    return (
                      <Box 
                        key={network.networkId}
                        w="100%"
                        p={5}
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
                          console.log('📋 [Dashboard] Navigating to asset page:', network);
                          
                          // We always use the full CAIP from gasAssetCaip for navigation
                          const caip = network.gasAssetCaip;
                          
                          console.log('📋 [Dashboard] Using CAIP for navigation:', caip);
                          console.log('📋 [Dashboard] Network object:', network);
                          
                          // Use Base64 encoding for complex IDs to avoid URL encoding issues
                          const encodedCaip = btoa(caip);
                          
                          console.log('📋 [Dashboard] Encoded parameters:', { encodedCaip });
                          
                          // Navigate using encoded parameters to the simplified route
                          router.push(`/asset/${encodedCaip}`);
                        }}
                        role="button"
                        aria-label={`Select ${network.gasAssetSymbol} network`}
                      >
                        <Flex align="center" justify="space-between">
                          <HStack gap={4}>
                            <Box 
                              borderRadius="full" 
                              overflow="hidden" 
                              boxSize="44px"
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
                                boxSize="44px"
                                objectFit="cover"
                              />
                            </Box>
                            <Stack gap={0.5}>
                              <Text fontSize="md" fontWeight="bold" color={network.color}>
                                {network.gasAssetSymbol}
                              </Text>
                              <Text 
                                fontSize="xs" 
                                color="gray.500" 
                                mb={1}
                                title={network.gasAssetCaip || network.networkId} // Show full value on hover
                                cursor="help"
                                _hover={{
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dotted'
                                }}
                              >
                                {middleEllipsis(network.gasAssetCaip || network.networkId, 14)}
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
                          <Stack align="flex-end" gap={0.5}>
                            <Text fontSize="md" color={network.color}>
                              $<CountUp 
                                key={`network-${network.networkId}-${lastSync}`}
                                end={network.totalValueUsd} 
                                decimals={2}
                                duration={1.5}
                                separator=","
                              />
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
            p={6}
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
            <Flex justify="center" align="center" py={2}>
              <Button
                variant="ghost"
                color={theme.gold}
                size="lg"
                _hover={{ bg: 'transparent', color: theme.goldHover }}
              >
                Add Network
              </Button>
            </Flex>
          </Box>
          
          {/* Add some padding at the bottom for better scrolling */}
          <Box height="20px" />
        </VStack>
      </Box>
    </Box>
  );
};

export default Dashboard; 