'use client'

import React, { useState, useEffect, useTransition } from 'react';
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
  Spinner,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph';
import { usePioneerContext } from '@/components/providers/pioneer'
import { DonutChart, DonutChartItem, ChartLegend } from '@/components/chart';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';
import { FaCoins } from 'react-icons/fa';

// Add sound effect imports
const chachingSound = typeof Audio !== 'undefined' ? new Audio('/sounds/chaching.mp3') : null;

// Icon component with fallback
const IconWithFallback = ({ src, alt, boxSize, color }: { src: string | null, alt: string, boxSize: string, color: string }) => {
  const [error, setError] = useState(false);

  // Clean URL - handle comma-separated URLs
  const cleanUrl = React.useMemo(() => {
    // Check for null, undefined, or empty string
    if (!src || src.trim() === '') {
      console.log('🖼️ [IconWithFallback] Empty or null src:', src);
      return null;
    }

    // Handle comma-separated URLs (take first valid one)
    if (src.includes(',')) {
      const urls = src.split(',')
        .map(u => u.trim())
        .filter(u => u.startsWith('http://') || u.startsWith('https://'));

      const firstUrl = urls[0] || null;
      console.log('🖼️ [IconWithFallback] Multi URL detected:', { src, urls, firstUrl });
      return firstUrl;
    }

    // Return null if URL doesn't start with http (invalid)
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      console.log('🖼️ [IconWithFallback] Invalid URL (no protocol):', src);
      return null;
    }

    console.log('🖼️ [IconWithFallback] Valid URL:', src);
    return src;
  }, [src]);

  if (!cleanUrl || error) {
    return (
      <Box
        boxSize={boxSize}
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize="lg"
        color={color}
      >
        <FaCoins />
      </Box>
    );
  }

  return (
    <Image
      src={cleanUrl}
      alt={alt}
      boxSize={boxSize}
      objectFit="cover"
      onError={(e) => {
        console.log('🖼️ [IconWithFallback] Image load error:', cleanUrl);
        setError(true);
      }}
    />
  );
};

// Play sound utility function
const playSound = (sound: HTMLAudioElement | null) => {
  if (sound) {
    sound.currentTime = 0; // Reset to start
    sound.play().catch(err => console.error('Error playing sound:', err));
  }
};

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
  gasAssetName?: string | null;
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

// Animated KeepKey logo pulse effect
const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
`;

const LoadingScreen = () => (
  <Flex 
    direction="column" 
    align="center" 
    justify="center" 
    height="100%"
    width="100%"
    position="relative"
  >
    <Box
      animation={`${pulseAnimation} 2s ease-in-out infinite`}
      mb={8}
    >
      <KeepKeyUiGlyph 
        width="100px" 
        height="100px" 
        color={theme.gold}
      />
    </Box>
    <Text fontSize="lg" color={theme.gold} fontWeight="medium">
      Loading portfolio...
    </Text>
  </Flex>
);

// Sort networks with specific priority for 0 balance assets
const sortNetworks = (a: Network, b: Network) => {
  // First sort by balance (non-zero first)
  const aHasBalance = parseFloat(a.totalNativeBalance) > 0;
  const bHasBalance = parseFloat(b.totalNativeBalance) > 0;
  
  if (aHasBalance && !bHasBalance) return -1;
  if (!aHasBalance && bHasBalance) return 1;
  
  // If both have balance, sort by USD value (highest first)
  if (aHasBalance && bHasBalance) {
    return b.totalValueUsd - a.totalValueUsd;
  }
  
  // If both have 0 balance, apply special sorting
  if (!aHasBalance && !bHasBalance) {
    const aIsUTXO = a.networkId.startsWith('bip122:');
    const bIsUTXO = b.networkId.startsWith('bip122:');
    const aIsEVM = a.networkId.startsWith('eip155:');
    const bIsEVM = b.networkId.startsWith('eip155:');
    const aIsBitcoin = a.networkId === 'bip122:000000000019d6689c085ae165831e93';
    const bIsBitcoin = b.networkId === 'bip122:000000000019d6689c085ae165831e93';
    const aIsETHMainnet = a.networkId === 'eip155:1';
    const bIsETHMainnet = b.networkId === 'eip155:1';
    
    // Priority order for 0 balance:
    // 1. Bitcoin first
    if (aIsBitcoin) return -1;
    if (bIsBitcoin) return 1;
    
    // 2. ETH mainnet second
    if (aIsETHMainnet) return -1;
    if (bIsETHMainnet) return 1;
    
    // 3. Other UTXO chains (Litecoin, Dogecoin, etc.)
    if (aIsUTXO && !bIsUTXO) return -1;
    if (!aIsUTXO && bIsUTXO) return 1;
    
    // 4. Other EVM chains sorted by chain ID
    if (aIsEVM && bIsEVM) {
      const aChainId = parseInt(a.networkId.split(':')[1]);
      const bChainId = parseInt(b.networkId.split(':')[1]);
      return aChainId - bChainId;
    }
    
    // 5. EVM chains before other chains
    if (aIsEVM && !bIsEVM) return -1;
    if (!aIsEVM && bIsEVM) return 1;
    
    // 6. All other chains sorted alphabetically by symbol
    return (a.gasAssetSymbol || '').localeCompare(b.gasAssetSymbol || '');
  }
  
  return 0;
};

const Dashboard = ({ onSettingsClick, onAddNetworkClick }: DashboardProps) => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSliceIndex, setActiveSliceIndex] = useState<number>(0);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [previousTotalValue, setPreviousTotalValue] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingAssetCaip, setLoadingAssetCaip] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  // Helper function to get asset name from assetsMap
  const getAssetName = (caip: string): string | null => {
    if (!app?.assetsMap || !caip) return null;

    try {
      const assetInfo = app.assetsMap.get(caip);
      const name = assetInfo?.name || null;

      // Debug logging
      if (assetInfo) {
        console.log('🏷️ [Dashboard] Asset lookup:', { caip, name, assetInfo });
      }

      return name;
    } catch (error) {
      console.error('❌ [Dashboard] Error getting asset name:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log('📊 [Dashboard] Component mounted');
    console.log('🖼️ [Dashboard] Background image should be: url(/images/backgrounds/splash-bg.png)');
    console.log('🎨 [Dashboard] Theme background color:', theme.bg);
    
    // Check if the image is actually loading (use native Image, not Chakra's Image component)
    const img = new window.Image();
    img.onload = () => {
      console.log('✅ [Dashboard] Background image loaded successfully');
    };
    img.onerror = (e) => {
      console.error('❌ [Dashboard] Background image failed to load:', e);
    };
    img.src = '/images/backgrounds/splash-bg.png';
    
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
          // We now track real balance changes instead of artificial adjustments
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
        
        // Compare new total value with previous total value
        const newTotalValue = dashboard.totalValueUsd || 0;
        const prevTotalValue = previousTotalValue;
        
        // Check if portfolio value has increased
        if (newTotalValue > prevTotalValue && prevTotalValue > 0) {
          console.log("💰 [Dashboard] Portfolio value increased!", {
            previous: prevTotalValue,
            current: newTotalValue
          });
          // playSound(chachingSound); // Disabled - sound is annoying
        }
        
        // Update previous total value for next comparison
        setPreviousTotalValue(newTotalValue);
        
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
  const networksWithBalance = dashboard?.networks
    ?.filter((network: Network) => parseFloat(network.totalNativeBalance) > 0) || [];
  
  const hasAnyBalance = networksWithBalance.length > 0;
  
  const chartData = hasAnyBalance 
    ? networksWithBalance.map((network: Network) => ({
        name: network.gasAssetSymbol,
        value: network.totalValueUsd,
        color: network.color,
      }))
    : [];

  // Handle slice or legend hover
  const handleHover = (index: number | null) => {
    // Only update if hovering over a different asset or returning to the default
    if (index === null) {
      // If we're currently not hovering over anything, maintain the current selection
      // or revert to the top asset
      
      // Only reset if we actually have dashboard data
      if (dashboard?.networks && dashboard.networks.length > 0) {
        // Use a slight delay for smoother transitions between hover states
        // This prevents flickering when moving between elements
        setTimeout(() => {
          // Only apply the reset if we're still not hovering over anything
          if (activeSliceIndex === null) {
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
            // Fallback to first item if we can't find top asset
            setActiveSliceIndex(0);
          }
        }, 50);
      }
    } else if (index !== activeSliceIndex) {
      // Immediate update when hovering over a specific slice
      setActiveSliceIndex(index);
    }
  };

  // Modify formatValueForChart to use CountUp
  const formatValueForChart = (value: number) => {
    return formatUsd(value);
  };

  // Handle portfolio refresh
  const handlePortfolioRefresh = async () => {
    console.log('🔄 [Dashboard] User clicked to refresh portfolio');
    setIsRefreshing(true);
    try {
      if (app && typeof app.refresh === 'function') {
        console.log('🔄 [Dashboard] Calling app.refresh()');
        await app.refresh();
      } else if (app && typeof app.sync === 'function') {
        console.log('🔄 [Dashboard] Calling app.sync()');
        await app.sync();
      }

      // Also get charts/tokens (with error handling for staking position bug)
      if (app && typeof app.getCharts === 'function' && app.pubkeys && app.pubkeys.length > 0) {
        console.log('🔄 [Dashboard] Calling app.getCharts()');
        try {
          await app.getCharts();
        } catch (chartError) {
          console.warn('⚠️ [Dashboard] getCharts failed (likely staking position parameter bug):', chartError);
          // Don't throw - this is a known issue with the Pioneer SDK
        }
      }

      // Fetch dashboard data after refresh
      await fetchDashboard();

      console.log('✅ [Dashboard] Portfolio refresh completed');
    } catch (error) {
      console.error('❌ [Dashboard] Portfolio refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Box 
      height="100vh" 
      bg={theme.bg}
      backgroundImage="url(/images/backgrounds/splash-bg.png)"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
      sx={{
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'inherit',
          backgroundSize: 'inherit',
          backgroundPosition: 'inherit',
          zIndex: -1,
        }
      }}
      onLoad={() => console.log('🖼️ [Dashboard] Container with background rendered')}
    >
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
        backdropFilter="blur(5px)"
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
        {...scrollbarStyles}
      >
        <Box
          maxW="1200px"
          mx="auto"
          px={8}
          py={6}
        >
                    <VStack gap={8} align="center">
            {/* Portfolio Overview with Chart - Centered and Contained */}
            <Box
              maxW="500px"
              w="100%"
            >
              <Box
                p={8}
                borderRadius="2xl"
                boxShadow={!loading && dashboard && hasAnyBalance && chartData.length > 0
                  ? `0 4px 20px ${chartData[0].color}20, inset 0 0 20px ${chartData[0].color}10`
                  : 'lg'
                }
                border="1px solid"
                borderColor={!loading && dashboard && hasAnyBalance && chartData.length > 0
                  ? `${chartData[0].color}40`
                  : theme.border
                }
                position="relative"
                overflow="hidden"
                bg={!loading && dashboard && hasAnyBalance && chartData.length > 0 ? `${chartData[0].color}15` : theme.cardBg}
                cursor="pointer"
                onClick={handlePortfolioRefresh}
                _hover={{
                  transform: 'scale(1.02)',
                  boxShadow: !loading && dashboard && hasAnyBalance && chartData.length > 0
                    ? `0 6px 24px ${chartData[0].color}30, inset 0 0 25px ${chartData[0].color}15`
                    : 'xl',
                }}
                _active={{
                  transform: 'scale(0.98)',
                }}
                transition="all 0.2s ease-in-out"
                role="button"
                aria-label="Click to refresh portfolio balances"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePortfolioRefresh();
                  }
                }}
                _before={{
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: !loading && dashboard && hasAnyBalance && chartData.length > 0
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
              {/* Refreshing overlay */}
              {isRefreshing && (
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  bg="rgba(0, 0, 0, 0.7)"
                  backdropFilter="blur(4px)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  zIndex={10}
                  borderRadius="2xl"
                >
                  <VStack gap={3}>
                    <Box
                      animation={`${pulseAnimation} 1.5s ease-in-out infinite`}
                    >
                      <KeepKeyUiGlyph
                        width="60px"
                        height="60px"
                        color={theme.gold}
                      />
                    </Box>
                    <Text fontSize="md" color={theme.gold} fontWeight="medium">
                      Refreshing balances...
                    </Text>
                  </VStack>
                </Box>
              )}

              {loading || !dashboard ? (
                <LoadingScreen />
              ) : hasAnyBalance ? (
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
                      formatValue={(value: number) => formatValueForChart(value)}
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
                      formatValue={(value: number) => formatUsd(value)}
                      activeIndex={activeSliceIndex}
                      onHoverItem={handleHover}
                    />
                  </Box>
                </>
              ) : (
                <VStack gap={4} py={8}>
                  <Box
                    borderRadius="full"
                    p={4}
                    bg="gray.800"
                    color="gray.500"
                  >
                    <Text fontSize="3xl">📊</Text>
                  </Box>
                  <Text fontSize="lg" color="gray.400" fontWeight="medium">
                    No Portfolio Balance
                  </Text>
                  <Text fontSize="sm" color="gray.500" textAlign="center" maxW="320px">
                    Your portfolio is empty. Add funds to your networks to see your portfolio breakdown.
                  </Text>
                  <Text fontSize="2xl" color={theme.gold} fontWeight="bold">
                    $0.00
                  </Text>
                </VStack>
              )}
            </Flex>
          </Box>
        </Box>

          {/* Network List - Full Width */}
          <Box w="100%">
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
                <LoadingScreen />
              ) : (
                <>
                  {dashboard?.networks
                    ?.sort(sortNetworks)
                    ?.map((network: Network) => {
                    const { integer, largePart, smallPart } = formatBalance(network.totalNativeBalance);
                    const percentage = dashboard.networkPercentages?.find(
                      (np: NetworkPercentage) => np.networkId === network.networkId
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
                          pointerEvents: "none",
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
                          pointerEvents: "none",
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
                        }}
                        _active={{
                          transform: 'scale(0.98) translateY(-1px)',
                          boxShadow: `0 2px 12px ${network.color}20`,
                          transition: 'all 0.1s ease-in-out',
                        }}
                        _focus={{
                          outline: 'none',
                          boxShadow: `0 0 0 2px ${network.color}, 0 8px 24px ${network.color}30`,
                        }}
                        cursor="pointer"
                        onClick={() => {
                          console.log('📋 [Dashboard] Navigating to asset page:', network);

                          // We always use the full CAIP from gasAssetCaip for navigation
                          const caip = network.gasAssetCaip;

                          console.log('📋 [Dashboard] Using CAIP for navigation:', caip);
                          console.log('📋 [Dashboard] Network object:', network);

                          // Set loading state immediately for instant feedback
                          setLoadingAssetCaip(caip);

                          // Use Base64 encoding for complex IDs to avoid URL encoding issues
                          const encodedCaip = btoa(caip);

                          console.log('📋 [Dashboard] Encoded parameters:', { encodedCaip });

                          // Navigate using startTransition for better perceived performance
                          startTransition(() => {
                            router.push(`/asset/${encodedCaip}`);
                          });
                        }}
                        role="button"
                        aria-label={`Select ${network.gasAssetSymbol} network`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/asset/${btoa(network.gasAssetCaip)}`);
                          }
                        }}
                        transition="all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                      >
                        {/* Loading overlay with spinner */}
                        {loadingAssetCaip === network.gasAssetCaip && (
                          <Flex
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            align="center"
                            justify="center"
                            bg="rgba(0, 0, 0, 0.7)"
                            borderRadius="xl"
                            zIndex={3}
                            backdropFilter="blur(4px)"
                          >
                            <Spinner
                              size="lg"
                              color={network.color}
                              thickness="3px"
                              speed="0.6s"
                            />
                          </Flex>
                        )}
                        <Flex align="center" justify="space-between" position="relative" zIndex={1}>
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
                                pointerEvents: "none",
                              }}
                            >
                              <IconWithFallback
                                src={network.icon}
                                alt={network.networkId}
                                boxSize="44px"
                                color={network.color}
                              />
                            </Box>
                            <Stack gap={0.5}>
                              <Text fontSize="md" fontWeight="bold" color={network.color}>
                                {network.gasAssetSymbol}
                              </Text>
                              {(() => {
                                const assetName = network.gasAssetName || getAssetName(network.gasAssetCaip);
                                return assetName ? (
                                  <Text fontSize="sm" color="gray.100" fontWeight="semibold">
                                    {assetName}
                                  </Text>
                                ) : null;
                              })()}
                              <Box
                                fontSize="xs"
                                color="gray.400"
                                mb={1}
                                title={network.gasAssetCaip || network.networkId}
                                cursor="help"
                                _hover={{
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dotted'
                                }}
                              >
                                <Box
                                  as="span"
                                  display={{ base: 'inline', md: 'none' }}
                                >
                                  {middleEllipsis(network.gasAssetCaip || network.networkId, 14)}
                                </Box>
                                <Box
                                  as="span"
                                  display={{ base: 'none', md: 'inline' }}
                                >
                                  {network.gasAssetCaip || network.networkId}
                                </Box>
                              </Box>
                              <HStack gap={2} align="center">
                                <Text fontSize="sm" color="gray.200" fontWeight="medium">
                                  {integer}.{largePart}
                                  <Text as="span" fontSize="xs" color="gray.300">
                                    {smallPart}
                                  </Text>
                                </Text>
                                <Text fontSize="xs" color={network.color} fontWeight="medium">
                                  {network.gasAssetSymbol}
                                </Text>
                              </HStack>
                            </Stack>
                          </HStack>
                          <Stack 
                            align="flex-end" 
                            gap={0.5}
                            p={1}
                            borderRadius="md"
                            position="relative"
                            zIndex={2}
                            transition="all 0.15s ease-in-out"
                            _hover={{
                              bg: `${network.color}30`,
                              boxShadow: `0 0 8px ${network.color}40`,
                            }}
                          >
                            <Text 
                              fontSize="md" 
                              color={network.color}
                              fontWeight="medium"
                            >
                              $<CountUp 
                                key={`network-${network.networkId}-${lastSync}`}
                                end={network.totalValueUsd} 
                                decimals={2}
                                duration={1.5}
                                separator=","
                              />
                            </Text>
                            <Text 
                              fontSize="xs" 
                              color={`${network.color}80`}
                              fontWeight="medium"
                              px={1}
                              py={0.5}
                              borderRadius="sm"
                              bg={`${network.color}20`}
                            >
                              {percentage.toFixed(1)}%
                            </Text>
                          </Stack>
                        </Flex>
                      </Box>
                    );
                  })}
                </>
              )}
            </VStack>
          </Box>

          {/* Tokens Section - Always Show */}
          {(() => {
            // Helper function to determine if a CAIP represents a token vs native asset
            const isTokenCaip = (caip: string): boolean => {
              if (!caip) return false;

              // CRITICAL: Exclude CACAO (Maya's native gas asset) from token classification
              // CACAO uses slip44:931 and is the native asset, NOT a token
              if (caip.includes('mayachain') && caip.includes('slip44:931')) {
                return false; // CACAO is native, not a token
              }

              // Explicit token type
              if (caip.includes('erc20') || caip.includes('eip721')) return true;

              // ERC20 tokens have contract addresses (0x followed by 40 hex chars)
              if (caip.includes('eip155:') && /0x[a-fA-F0-9]{40}/.test(caip)) return true;

              // Maya tokens: denom:maya identifies Maya tokens, but NOT the native CACAO asset
              // This covers synthetic assets like MAYA.BTC, MAYA.ETH, etc.
              if (caip.includes('cosmos:mayachain-mainnet-v1/denom:maya')) return true;

              // Cosmos ecosystem tokens (not using slip44 format)
              if (caip.includes('MAYA.') || caip.includes('THOR.') || caip.includes('OSMO.')) return true;

              // Cosmos tokens using denom or ibc format
              if (caip.includes('/denom:') || caip.includes('/ibc:')) return true;

              // Any CAIP that doesn't use slip44 format is likely a token
              if (!caip.includes('slip44:') && caip.includes('.')) return true;

              return false;
            };

            // Filter tokens from balances if we have balances
            let tokenBalances: any[] = [];
            if (app?.balances) {
              tokenBalances = app.balances.filter((balance: any) => {
                // Check explicit type first
                if (balance.type === 'token') return true;
                
                // Check CAIP pattern
                const isToken = isTokenCaip(balance.caip);
                
                // Only show tokens that have a balance > 0
                const hasBalance = balance.balance && parseFloat(balance.balance) > 0;
                
                // Debug logging for each balance
                // if (balance.caip && (balance.caip.includes('mayachain') || balance.caip.includes('MAYA') || isToken)) {
                //   console.log('🔍 [Dashboard] Checking balance for token classification:', {
                //     caip: balance.caip,
                //     symbol: balance.symbol,
                //     balance: balance.balance,
                //     type: balance.type,
                //     isToken: isToken,
                //     hasBalance: hasBalance,
                //     willInclude: isToken && hasBalance
                //   });
                // }
                
                return isToken && hasBalance;
              });

              // Sort tokens by USD value (highest first)
              tokenBalances.sort((a: any, b: any) => {
                const valueA = parseFloat(a.valueUsd || 0);
                const valueB = parseFloat(b.valueUsd || 0);
                return valueB - valueA; // Descending order (highest first)
              });

              // Debug logging for token detection
              console.log('🪙 [Dashboard] Total balances:', app.balances.length);
              console.log('🪙 [Dashboard] All balance CAIPs:', app.balances.map((b: any) => b.caip));
              console.log('🪙 [Dashboard] Token balances found:', tokenBalances.length);
            }

            return (
              <Box w="100%">
                <HStack justify="space-between" mb={5}>
                  <HStack gap={2}>
                    <Text fontSize="md" color="gray.400">Tokens</Text>
                    <Text fontSize="xs" color="gray.600">
                      ({tokenBalances.length})
                    </Text>
                    {tokenBalances.length > 0 && (
                      <Text fontSize="xs" color="gray.500" fontStyle="italic">
                        • sorted by value
                      </Text>
                    )}
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
                  {tokenBalances.length === 0 ? (
                    // Empty state when no tokens found
                    <Box
                      w="100%"
                      p={6}
                      borderRadius="2xl"
                      borderWidth="2px"
                      borderStyle="dashed"
                      borderColor="gray.600"
                      bg="gray.800"
                      position="relative"
                      _hover={{
                        borderColor: theme.gold,
                        bg: 'rgba(255, 215, 0, 0.05)',
                      }}
                      transition="all 0.2s"
                      cursor="pointer"
                    >
                      <VStack gap={3} py={4}>
                        <Box
                          borderRadius="full"
                          p={3}
                          bg="gray.700"
                          color="gray.400"
                        >
                          <Text fontSize="2xl">🔍</Text>
                        </Box>
                        <Text fontSize="md" color="gray.400" fontWeight="medium">
                          Looking for tokens?
                        </Text>
                        <Text fontSize="sm" color="gray.500" textAlign="center" maxW="320px">
                          No tokens found with balance. Tokens like Maya assets (MAYA, CACAO), ERC20, and other non-native assets will appear here sorted by USD value when detected.
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          color={theme.gold}
                          borderColor={theme.gold}
                          _hover={{ 
                            bg: `${theme.gold}20`,
                            borderColor: theme.goldHover,
                            color: theme.goldHover
                          }}
                          onClick={async () => {
                            console.log('🔍 [Dashboard] User clicked refresh tokens');
                            setIsRefreshing(true);
                            try {
                              if (app && typeof app.refresh === 'function') {
                                console.log('🔄 [Dashboard] Calling app.refresh()');
                                await app.refresh();
                              } else if (app && typeof app.sync === 'function') {
                                console.log('🔄 [Dashboard] Calling app.sync()');
                                await app.sync();
                              }
                              
                              // Also get charts/tokens (with error handling for staking position bug)
                              if (app && typeof app.getCharts === 'function' && app.pubkeys && app.pubkeys.length > 0) {
                                console.log('🔄 [Dashboard] Calling app.getCharts()');
                                try {
                                  await app.getCharts();
                                } catch (chartError) {
                                  console.warn('⚠️ [Dashboard] getCharts failed (likely staking position parameter bug):', chartError);
                                  // Don't throw - this is a known issue with the Pioneer SDK
                                }
                              } else if (app && typeof app.getCharts === 'function') {
                                console.log('⏭️ [Dashboard] Skipping getCharts - no pubkeys available (wallet not paired)');
                              }
                              
                              // Fetch dashboard data after refresh
                              await fetchDashboard();
                              
                              console.log('✅ [Dashboard] Refresh completed');
                            } catch (error) {
                              console.error('❌ [Dashboard] Refresh failed:', error);
                            } finally {
                              setIsRefreshing(false);
                            }
                          }}
                          loading={isRefreshing}
                          loadingText="Refreshing..."
                        >
                          Refresh Balances
                        </Button>
                      </VStack>
                    </Box>
                  ) : (
                    // Show actual tokens when found
                    tokenBalances.map((token: any, index: number) => {
                    const { integer, largePart, smallPart } = formatBalance(token.balance);
                    const tokenValueUsd = parseFloat(token.valueUsd || 0);

                     // Get token icon and color with better fallbacks
                     let tokenIcon = token.icon;
                     let tokenColor = token.color;

                     // Handle comma-separated icon URLs (take first valid one)
                     if (tokenIcon && tokenIcon.includes(',')) {
                       const urls = tokenIcon.split(',').filter((url: string) => url.trim().startsWith('http'));
                       tokenIcon = urls[0] || null;
                     }

                     // Determine token symbol and name
                     const tokenSymbol = token.symbol || token.ticker || 'TOKEN';
                     const tokenName = token.name || tokenSymbol;

                     // Set fallback icon and color based on token type if not provided
                     if (!tokenIcon || !tokenColor) {
                       if (token.caip?.includes('MAYA.') || token.caip?.includes('cosmos:mayachain-mainnet-v1/denom:maya')) {
                         tokenIcon = tokenIcon || 'https://pioneers.dev/coins/maya.png';
                         tokenColor = tokenColor || '#00D4AA';
                       } else if (token.caip?.includes('THOR.')) {
                         tokenIcon = tokenIcon || 'https://pioneers.dev/coins/thorchain.png';
                         tokenColor = tokenColor || '#00CCFF';
                       } else if (token.caip?.includes('eip155:')) {
                         tokenIcon = tokenIcon || 'https://pioneers.dev/coins/ethereum.png';
                         tokenColor = tokenColor || '#627EEA';
                       } else {
                         tokenIcon = tokenIcon || 'https://pioneers.dev/coins/pioneer.png';
                         tokenColor = tokenColor || '#FFD700';
                       }
                     }

                     // Debug logging for token detection
                     console.log('🪙 [Dashboard] Token detected:', {
                       caip: token.caip,
                       symbol: tokenSymbol,
                       balance: token.balance,
                       valueUsd: tokenValueUsd,
                       type: token.type
                     });

                    return (
                      <Box
                        key={`${token.caip}_${token.pubkey}_${index}`}
                        w="100%"
                        p={5}
                        borderRadius="2xl"
                        borderWidth="1px"
                        borderColor={`${tokenColor}40`}
                        boxShadow={`0 4px 20px ${tokenColor}20, inset 0 0 20px ${tokenColor}10`}
                        position="relative"
                        bg={`${tokenColor}15`}
                        _before={{
                          content: '""',
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(135deg, ${tokenColor}40 0%, ${tokenColor}20 100%)`,
                          opacity: 0.6,
                          borderRadius: "inherit",
                          pointerEvents: "none",
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
                          pointerEvents: "none",
                        }}
                        _hover={{ 
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 24px ${tokenColor}30, inset 0 0 30px ${tokenColor}20`,
                          borderColor: tokenColor,
                          bg: `${tokenColor}25`,
                          _before: {
                            opacity: 0.8,
                            background: `linear-gradient(135deg, ${tokenColor}50 0%, ${tokenColor}30 100%)`,
                          },
                          _after: {
                            opacity: 0.7,
                          },
                        }}
                        _active={{
                          transform: 'scale(0.98) translateY(-1px)',
                          boxShadow: `0 2px 12px ${tokenColor}20`,
                          transition: 'all 0.1s ease-in-out',
                        }}
                        _focus={{
                          outline: 'none',
                          boxShadow: `0 0 0 2px ${tokenColor}, 0 8px 24px ${tokenColor}30`,
                        }}
                        cursor="pointer"
                        onClick={() => {
                          console.log('🪙 [Dashboard] Navigating to token page:', token);

                          // Use the token's CAIP for navigation
                          const caip = token.caip;

                          console.log('🪙 [Dashboard] Using token CAIP for navigation:', caip);
                          console.log('🪙 [Dashboard] Token object:', token);

                          // Set loading state immediately for instant feedback
                          setLoadingAssetCaip(caip);

                          // Use Base64 encoding for complex IDs to avoid URL encoding issues
                          const encodedCaip = btoa(caip);

                          console.log('🪙 [Dashboard] Encoded token parameters:', { encodedCaip });

                          // Navigate using startTransition for better perceived performance
                          startTransition(() => {
                            router.push(`/asset/${encodedCaip}`);
                          });
                        }}
                        role="button"
                        aria-label={`Select ${tokenSymbol} token`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/asset/${btoa(token.caip)}`);
                          }
                        }}
                        transition="all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                      >
                        {/* Loading overlay with spinner */}
                        {loadingAssetCaip === token.caip && (
                          <Flex
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            align="center"
                            justify="center"
                            bg="rgba(0, 0, 0, 0.7)"
                            borderRadius="xl"
                            zIndex={3}
                            backdropFilter="blur(4px)"
                          >
                            <Spinner
                              size="lg"
                              color={tokenColor}
                              thickness="3px"
                              speed="0.6s"
                            />
                          </Flex>
                        )}
                        <Flex align="center" justify="space-between" position="relative" zIndex={1}>
                          <HStack gap={4}>
                            <Box
                              borderRadius="full"
                              overflow="hidden"
                              boxSize="44px"
                              bg={tokenColor}
                              boxShadow={`lg, inset 0 0 10px ${tokenColor}40`}
                              position="relative"
                              _after={{
                                content: '""',
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: `linear-gradient(135deg, ${tokenColor}40 0%, transparent 100%)`,
                                opacity: 0.6,
                                pointerEvents: "none",
                              }}
                            >
                              <IconWithFallback
                                src={tokenIcon}
                                alt={tokenName}
                                boxSize="44px"
                                color={tokenColor}
                              />
                            </Box>
                            <Stack gap={0.5}>
                              <Text fontSize="md" fontWeight="bold" color={tokenColor}>
                                {tokenSymbol}
                              </Text>
                              <Box
                                fontSize="xs" 
                                color="gray.400" 
                                mb={1}
                                title={token.caip}
                                cursor="help"
                                _hover={{
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dotted'
                                }}
                              >
                                <Box
                                  as="span"
                                  display={{ base: 'inline', md: 'none' }}
                                >
                                  {middleEllipsis(token.caip, 14)}
                                </Box>
                                <Box
                                  as="span"
                                  display={{ base: 'none', md: 'inline' }}
                                >
                                  {token.caip}
                                </Box>
                              </Box>
                              <HStack gap={2} align="center">
                                <Text fontSize="sm" color="gray.200" fontWeight="medium">
                                  {integer}.{largePart}
                                  <Text as="span" fontSize="xs" color="gray.300">
                                    {smallPart}
                                  </Text>
                                </Text>
                                <Text fontSize="xs" color={tokenColor} fontWeight="medium">
                                  {tokenSymbol}
                                </Text>
                              </HStack>
                            </Stack>
                          </HStack>
                          <Stack 
                            align="flex-end" 
                            gap={0.5}
                            p={1}
                            borderRadius="md"
                            position="relative"
                            zIndex={2}
                            transition="all 0.15s ease-in-out"
                            _hover={{
                              bg: `${tokenColor}30`,
                              boxShadow: `0 0 8px ${tokenColor}40`,
                            }}
                          >
                            <Text 
                              fontSize="md" 
                              color={tokenColor}
                              fontWeight="medium"
                            >
                              $<CountUp
                                key={`token-${token.caip}-${token.pubkey}-${index}-${lastSync}`}
                                end={tokenValueUsd} 
                                decimals={2}
                                duration={1.5}
                                separator=","
                              />
                            </Text>
                            <Text 
                              fontSize="xs" 
                              color={`${tokenColor}80`}
                              fontWeight="medium"
                              px={1}
                              py={0.5}
                              borderRadius="sm"
                              bg={`${tokenColor}20`}
                            >
                              TOKEN
                            </Text>
                          </Stack>
                        </Flex>
                      </Box>
                    );
                  })
                  )}
                </VStack>
              </Box>
            );
          })()}

          {/* Add Network Button - Full Width */}
          <Box
            w="100%"
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
                          opacity: 0.4,
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
    </Box>
  );
};

export default Dashboard; 