'use client'

// Debug flag - set to false to reduce console noise
const DEBUG_VERBOSE = false;
const DEBUG_USD = true; // Keep USD debugging on

import React, { useState, useEffect, useTransition } from 'react';
import { logger } from '@/lib/logger';
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
  IconButton,
  Badge,
} from '@chakra-ui/react';
import { FaSyncAlt } from 'react-icons/fa';
import { keyframes } from '@emotion/react';
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph';
import { usePioneerContext } from '@/components/providers/pioneer'
import { DonutChart, DonutChartItem, ChartLegend } from '@/components/chart';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';
import { getAssetIconUrl } from '@/lib/utils/assetIcons';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { ChatPopup } from '@/components/chat/ChatPopup';
import { usePendingSwaps } from '@/hooks/usePendingSwaps';
import { isFeatureEnabled, isPioneerV2Enabled } from '@/config/features';

// Add sound effect imports
const chachingSound = typeof Audio !== 'undefined' ? new Audio('/sounds/chaching.mp3') : null;

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
  fetchedAt?: number;      // Unix timestamp of balance fetch
  fetchedAtISO?: string;   // ISO 8601 string
  isStale?: boolean;       // True if > 5 minutes old
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
  // Check if network has any value (native balance OR tokens)
  const aHasBalance = parseFloat(a.totalNativeBalance) > 0 || a.totalValueUsd > 0;
  const bHasBalance = parseFloat(b.totalNativeBalance) > 0 || b.totalValueUsd > 0;

  if (aHasBalance && !bHasBalance) return -1;
  if (!aHasBalance && bHasBalance) return 1;

  // If both have balance, sort by USD value (highest first)
  if (aHasBalance && bHasBalance) {
    return b.totalValueUsd - a.totalValueUsd;
  }

  // If both have 0 balance (no native balance AND no token value), apply special sorting
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
  
  // Pending swaps - using same pattern as other working hooks
  const { pendingSwaps, getPendingForAsset, getDebitsForAsset, getCreditsForAsset } = usePendingSwaps();

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
      logger.error('Error in formatBalance:', error);
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

    // Debug: Log all assetsMap keys once
    if (!window.assetsMapLogged) {
      logger.debug('🗺️ [Dashboard] assetsMap keys:', Array.from(app.assetsMap.keys()));
      window.assetsMapLogged = true;
    }

    try {
      const assetInfo = app.assetsMap.get(caip);
      const name = assetInfo?.name || null;

      // Debug logging
      if (assetInfo && DEBUG_VERBOSE) {
        logger.debug('🏷️ [Dashboard] Asset lookup:', { caip, name, assetInfo });
      }

      return name;
    } catch (error) {
      logger.error('❌ [Dashboard] Error getting asset name:', error);
      return null;
    }
  };

  useEffect(() => {
    if (DEBUG_VERBOSE) {
      logger.debug('📊 [Dashboard] Component mounted');
      logger.debug('🖼️ [Dashboard] Background image should be: url(/images/backgrounds/splash-bg.png)');
      logger.debug('🎨 [Dashboard] Theme background color:', theme.bg);
    }

    // Check if the image is actually loading (use native Image, not Chakra's Image component)
    const img = new window.Image();
    img.onload = () => {
      if (DEBUG_VERBOSE) logger.debug('✅ [Dashboard] Background image loaded successfully');
    };
    img.onerror = (e) => {
      logger.error('❌ [Dashboard] Background image failed to load:', e);
    };
    img.src = '/images/backgrounds/splash-bg.png';

    fetchDashboard();
    return () => {
      if (DEBUG_VERBOSE) logger.debug('📊 [Dashboard] Component unmounting');
    };
  }, [app, app?.dashboard]);

  // Add new useEffect to reload dashboard when assetContext becomes null
  useEffect(() => {
    if (DEBUG_VERBOSE) logger.debug('📊 [Dashboard] AssetContext changed:', app?.assetContext);
    if (!app?.assetContext) {
      if (DEBUG_VERBOSE) logger.debug('📊 [Dashboard] AssetContext is null, reloading dashboard');
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
          if (DEBUG_VERBOSE) logger.debug("📊 [Dashboard] syncMarket called from Dashboard");
          // We now track real balance changes instead of artificial adjustments
          setLastSync(Date.now());
          fetchDashboard();
        })
        .catch((error: any) => {
          logger.error("❌ [Dashboard] Error in syncMarket:", error);
        });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [app]);

  // Listen for real-time dashboard updates from Pioneer SDK
  useEffect(() => {
    if (!app?.events) return;

    const handleDashboardUpdate = (data: any) => {
      logger.debug('🔄 [Dashboard] Real-time update received:', {
        trigger: data.trigger,
        affectedAsset: data.affectedAsset,
        valueChange: `$${data.previousTotal.toFixed(2)} → $${data.newTotal.toFixed(2)}`
      });

      // Update dashboard with new data
      setDashboard(data.dashboard);

      // Check for value increases and play sound if enabled
      if (data.newTotal > data.previousTotal && data.previousTotal > 0) {
        logger.debug("💰 [Dashboard] Portfolio value increased!", {
          previous: data.previousTotal,
          current: data.newTotal,
          increase: data.newTotal - data.previousTotal
        });
        // playSound(chachingSound); // Disabled - sound is annoying
      }

      setPreviousTotalValue(data.newTotal);
    };

    // Subscribe to dashboard update events
    logger.debug('📡 [Dashboard] Subscribing to DASHBOARD_UPDATE events');
    app.events.on('DASHBOARD_UPDATE', handleDashboardUpdate);

    // Cleanup on unmount
    return () => {
      logger.debug('📡 [Dashboard] Unsubscribing from DASHBOARD_UPDATE events');
      app.events.off('DASHBOARD_UPDATE', handleDashboardUpdate);
    };
  }, [app?.events]);

  const fetchDashboard = async () => {
    if (DEBUG_VERBOSE) logger.debug('📊 [Dashboard] Fetching dashboard data');
    setLoading(true);
    try {
      if(app && app.dashboard) {
        const dashboard = app.dashboard;
        if (DEBUG_VERBOSE) logger.debug('📊 [Dashboard] Dashboard data received:', dashboard);

        // USD debugging - check if we have balances and prices
        if (DEBUG_USD) {
          logger.debug('💰 [USD DEBUG] Dashboard USD info:', {
            totalValueUsd: dashboard.totalValueUsd,
            networksCount: dashboard.networks?.length || 0,
            hasBalances: app.balances?.length || 0,
            sampleBalance: app.balances?.[0],
            sampleNetwork: dashboard.networks?.[0]
          });
        }
        
        // Compare new total value with previous total value
        const newTotalValue = dashboard.totalValueUsd || 0;
        const prevTotalValue = previousTotalValue;
        
        // Check if portfolio value has increased
        if (newTotalValue > prevTotalValue && prevTotalValue > 0) {
          logger.debug("💰 [Dashboard] Portfolio value increased!", {
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
            .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0 || network.totalValueUsd > 0)
            .sort((a, b) => b.totalValueUsd - a.totalValueUsd);

          if (sortedNetworks.length > 0) {
            // Find the index of the top asset in the original filtered data
            const topAsset = sortedNetworks[0];
            const topAssetIndex = dashboard.networks
              .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0 || network.totalValueUsd > 0)
              .findIndex((network: Network) => network.networkId === topAsset.networkId);

            if (topAssetIndex >= 0) {
              logger.debug('📊 [Dashboard] Setting active slice to top asset:', topAsset.gasAssetSymbol);
              setActiveSliceIndex(topAssetIndex);
            }
          }
        }
      } else {
        logger.debug('📊 [Dashboard] No dashboard data available');
      }
    } catch (error) {
      logger.error('📊 [Dashboard] Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      logger.debug('📊 [Dashboard] Fetch complete');
    }
  };

  // Prepare data for donut chart
  // Include networks with either native balance OR token value (totalValueUsd > 0)
  const networksWithBalance = dashboard?.networks
    ?.filter((network: Network) =>
      parseFloat(network.totalNativeBalance) > 0 || network.totalValueUsd > 0
    ) || [];

  // Get staking positions from app.balances with chart === 'staking'
  // NOTE: Don't filter by valueUsd - prices may not be calculated yet
  const stakingBalances = app?.balances?.filter((balance: any) =>
    balance.chart === 'staking' && parseFloat(balance.balance || 0) > 0
  ) || [];

  // Calculate total staking value
  const totalStakingValue = stakingBalances.reduce((sum: number, balance: any) =>
    sum + parseFloat(balance.valueUsd || 0), 0
  );

  const hasAnyBalance = networksWithBalance.length > 0 || stakingBalances.length > 0;

  const chartData = hasAnyBalance
    ? [
        // Network balances
        ...networksWithBalance.map((network: Network) => ({
          name: network.gasAssetSymbol,
          value: network.totalValueUsd,
          color: network.color,
        })),
        // Staking positions (if any)
        ...(totalStakingValue > 0 ? [{
          name: 'STAKING',
          value: totalStakingValue,
          color: '#9333EA', // Purple color for staking
        }] : [])
      ]
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
              .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0 || network.totalValueUsd > 0)
              .sort((a, b) => b.totalValueUsd - a.totalValueUsd);

            if (sortedNetworks.length > 0) {
              const topAsset = sortedNetworks[0];
              const topAssetIndex = dashboard.networks
                .filter((network: Network) => parseFloat(network.totalNativeBalance) > 0 || network.totalValueUsd > 0)
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
  const handlePortfolioRefresh = async (forceRefresh = false) => {
    logger.debug(`🔄 [Dashboard] User clicked to ${forceRefresh ? 'FORCE' : ''} refresh portfolio`);
    setIsRefreshing(true);
    try {
      const v2Enabled = isPioneerV2Enabled();

      // Only call v2 APIs if they're enabled
      if (v2Enabled) {
        if (app && typeof app.refresh === 'function') {
          logger.debug(`🔄 [Dashboard] Calling app.refresh(${forceRefresh})`);
          await app.refresh(forceRefresh);
        } else if (app && typeof app.sync === 'function') {
          logger.debug('🔄 [Dashboard] Calling app.sync()');
          await app.sync();
        }
      } else {
        logger.debug('ℹ️ [Dashboard] Skipping v2 API calls (refresh/sync) - v2 APIs disabled');
        // For v1, we can call getBalances directly
        if (app && typeof app.getBalances === 'function') {
          logger.debug('🔄 [Dashboard] Calling app.getBalances() (v1 fallback)');
          await app.getBalances();
        }
      }

      // Also get charts/tokens (with error handling for staking position bug)
      if (app && typeof app.getCharts === 'function' && app.pubkeys && app.pubkeys.length > 0) {
        logger.debug('🔄 [Dashboard] Calling app.getCharts()');
        try {
          await app.getCharts();
        } catch (chartError) {
          logger.warn('⚠️ [Dashboard] getCharts failed (likely staking position parameter bug):', chartError);
          // Don't throw - this is a known issue with the Pioneer SDK
        }
      }

      // Fetch dashboard data after refresh (only if v2 enabled)
      if (v2Enabled) {
        await fetchDashboard();
      }

      logger.debug('✅ [Dashboard] Portfolio refresh completed');
    } catch (error) {
      logger.error('❌ [Dashboard] Portfolio refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
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
      onLoad={() => logger.debug('🖼️ [Dashboard] Container with background rendered')}
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
          <HStack gap={2}>
            <IconButton
              aria-label="Force refresh balances"
              title="Force Refresh (bypass cache)"
              icon={<FaSyncAlt />}
              size="sm"
              variant="ghost"
              color={theme.gold}
              _hover={{ color: theme.goldHover, bg: 'rgba(255, 215, 0, 0.1)' }}
              onClick={() => handlePortfolioRefresh(true)}
              isLoading={isRefreshing}
              isDisabled={isRefreshing}
            />
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
            {/* Pending Swaps Badge - Top Right Corner (only when swaps feature is enabled) */}
            {isFeatureEnabled('enableSwaps') && pendingSwaps && pendingSwaps.filter(s => s.status === 'pending' || s.status === 'confirming').length > 0 && (
              <Box
                position="absolute"
                top={4}
                right={4}
                zIndex={10}
                px={3}
                py={2}
                borderRadius="lg"
                bg="blue.900"
                borderWidth="2px"
                borderColor="blue.500"
                boxShadow="0 4px 12px rgba(66, 153, 225, 0.3)"
                cursor="pointer"
                _hover={{
                  bg: "blue.800",
                  borderColor: "blue.400",
                  transform: "scale(1.05)",
                }}
                transition="all 0.2s"
                onClick={(e) => {
                  e.stopPropagation();
                  // Check if swap feature is enabled before navigating
                  if (isFeatureEnabled('enableSwaps')) {
                    // Navigate to ETH swap view (safe default that always exists)
                    const ethCaip = 'eip155:1/slip44:60';
                    router.push(`/asset/${btoa(ethCaip)}?view=swap`);
                  } else {
                    logger.warn('🚫 [Dashboard] Swap feature is disabled');
                  }
                }}
              >
                <VStack gap={1} align="center">
                  <Text fontSize="xs" color="blue.300" fontWeight="bold">
                    ⏳ PENDING
                  </Text>
                  <Text fontSize="2xl" color="blue.200" fontWeight="bold">
                    {pendingSwaps.filter(s => s.status === 'pending' || s.status === 'confirming').length}
                  </Text>
                  <Text fontSize="2xs" color="blue.400">
                    swaps
                  </Text>
                </VStack>
              </Box>
            )}

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

                    // Check if this network has tokens but no native gas
                    const hasNativeBalance = parseFloat(network.totalNativeBalance) > 0;
                    const hasTokenValue = network.totalValueUsd > 0 && !hasNativeBalance;

                    return (
                      <Box
                        key={network.networkId}
                        w="100%"
                        p={5}
                        borderRadius="2xl"
                        borderWidth="1px"
                        borderColor={`${network.color}70`}
                        borderLeftWidth="4px"
                        borderLeftColor={network.color}
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
                          boxShadow: `0 8px 24px ${network.color}40, inset 0 0 30px ${network.color}20`,
                          borderColor: network.color,
                          borderLeftWidth: "5px",
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
                          logger.debug('📋 [Dashboard] Navigating to asset page:', network);

                          // We always use the full CAIP from gasAssetCaip for navigation
                          const caip = network.gasAssetCaip;

                          logger.debug('📋 [Dashboard] Using CAIP for navigation:', caip);
                          logger.debug('📋 [Dashboard] Network object:', network);

                          // Set loading state immediately for instant feedback
                          setLoadingAssetCaip(caip);

                          // Use Base64 encoding for complex IDs to avoid URL encoding issues
                          const encodedCaip = btoa(caip);

                          logger.debug('📋 [Dashboard] Encoded parameters:', { encodedCaip });

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
                              <AssetIcon
                                src={network.icon}
                                alt={network.networkId}
                                boxSize="44px"
                                color={network.color}
                                caip={network.gasAssetCaip}
                              />
                            </Box>
                            <Stack gap={0.5} flex="1">
                              <HStack gap={2} align="center">
                                <Text 
                                  fontSize="md" 
                                  fontWeight="bold" 
                                  color={network.gasAssetSymbol === 'XRP' ? 'white' : network.color}
                                >
                                  {network.gasAssetSymbol}
                                </Text>
                                {(() => {
                                  // Check if this network has tokens but no native gas
                                  const hasNativeBalance = parseFloat(network.totalNativeBalance) > 0;
                                  const hasTokenValue = network.totalValueUsd > 0 && !hasNativeBalance;

                                  if (hasTokenValue) {
                                    return (
                                      <Box
                                        fontSize="xs"
                                        fontWeight="bold"
                                        px={2}
                                        py={1}
                                        borderRadius="md"
                                        bg="red.500"
                                        color="white"
                                        title="CRITICAL: No gas for transactions - tokens are stranded!"
                                        cursor="help"
                                        boxShadow="0 2px 8px rgba(255, 0, 0, 0.4)"
                                        border="1px solid"
                                        borderColor="red.600"
                                      >
                                        ⚠️ NO GAS
                                      </Box>
                                    );
                                  }
                                  return null;
                                })()}
                              </HStack>
                              {(() => {
                                const assetName = network.gasAssetName || getAssetName(network.gasAssetCaip);
                                return assetName ? (
                                  <Text fontSize="sm" color="gray.100" fontWeight="semibold">
                                    {assetName}
                                  </Text>
                                ) : null;
                              })()}
                              {/* Balance Timestamp */}
                              {network.fetchedAtISO && (
                                <HStack gap={1.5} fontSize="2xs" color="gray.500">
                                  <Text>
                                    Updated: {new Date(network.fetchedAtISO).toLocaleTimeString()}
                                  </Text>
                                  {network.isStale ? (
                                    <Box
                                      as="span"
                                      px={1.5}
                                      py={0.5}
                                      borderRadius="sm"
                                      bg="orange.900"
                                      color="orange.300"
                                      fontSize="2xs"
                                      fontWeight="medium"
                                      border="1px solid"
                                      borderColor="orange.700"
                                    >
                                      ⚠️ Stale
                                    </Box>
                                  ) : (
                                    <Box
                                      as="span"
                                      px={1.5}
                                      py={0.5}
                                      borderRadius="sm"
                                      bg="green.900"
                                      color="green.300"
                                      fontSize="2xs"
                                      fontWeight="medium"
                                      border="1px solid"
                                      borderColor="green.700"
                                    >
                                      ✓ Fresh
                                    </Box>
                                  )}
                                </HStack>
                              )}
                              {(() => {
                                // Show warning if tokens but no gas
                                const hasNativeBalance = parseFloat(network.totalNativeBalance) > 0;
                                const hasTokenValue = network.totalValueUsd > 0 && !hasNativeBalance;

                                if (hasTokenValue) {
                                  return (
                                    <Box
                                      bg="red.900"
                                      px={2}
                                      py={1}
                                      borderRadius="md"
                                      borderLeft="3px solid"
                                      borderColor="red.500"
                                    >
                                      <HStack gap={1} align="center">
                                        <Text fontSize="xs" color="red.400" fontWeight="bold">
                                          Add {network.gasAssetSymbol} to move tokens
                                        </Text>
                                      </HStack>
                                    </Box>
                                  );
                                }
                                return null;
                              })()}
                              <Box
                                fontSize="xs"
                                color="gray.500"
                                mb={1}
                                title={network.gasAssetCaip || network.networkId}
                                cursor="help"
                                _hover={{
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dotted',
                                  color: 'gray.400'
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
                                <Text 
                                  fontSize="xs" 
                                  color="gray.400"
                                  fontWeight="medium"
                                >
                                  {network.gasAssetSymbol}
                                </Text>
                              </HStack>
                            </Stack>
                          </HStack>

                          {/* Token Icons Display - Center Section for All Networks with Tokens */}
                          {(() => {
                            // Get tokens for this network (regardless of native balance)
                            const networkTokens = app?.balances?.filter((balance: any) => {
                              const balanceNetworkId = balance.networkId;
                              const isMatchingNetwork =
                                balanceNetworkId === network.networkId ||
                                (network.networkId === 'eip155:*' && balanceNetworkId?.startsWith('eip155:'));

                              // Check if it's a token (has balance and not the native asset)
                              const isToken = balance.caip !== network.gasAssetCaip &&
                                              parseFloat(balance.balance || '0') > 0;

                              return isMatchingNetwork && isToken;
                            }) || [];

                            if (networkTokens.length === 0) return null;

                            // Limit to first 5 tokens for display
                            const displayTokens = networkTokens.slice(0, 5);
                            const hasMore = networkTokens.length > 5;

                            return (
                              <Flex
                                direction="column"
                                align="center"
                                justify="center"
                                gap={1}
                                px={4}
                              >
                                {/* Stacked Token Icons */}
                                <Flex
                                  position="relative"
                                  height="44px"
                                  width={`${44 + (displayTokens.length - 1) * 28}px`}
                                  alignItems="center"
                                >
                                  {displayTokens.map((token: any, index: number) => {
                                    const assetInfo = app.assetsMap?.get(token.caip) || app.assetsMap?.get(token.caip.toLowerCase());
                                    const tokenColor = assetInfo?.color || token.color || '#FFD700';

                                    return (
                                      <Box
                                        key={`${token.caip}-${index}`}
                                        position="absolute"
                                        left={`${index * 28}px`}
                                        borderRadius="full"
                                        overflow="hidden"
                                        boxSize="44px"
                                        bg={tokenColor}
                                        boxShadow={`0 2px 8px ${tokenColor}40, inset 0 0 10px ${tokenColor}20`}
                                        border="2px solid"
                                        borderColor="gray.900"
                                        title={`${token.symbol || token.ticker} - ${token.balance}`}
                                        cursor="help"
                                        transition="all 0.2s"
                                        zIndex={displayTokens.length - index}
                                        _hover={{
                                          transform: 'scale(1.15) translateY(-4px)',
                                          zIndex: 100,
                                          boxShadow: `0 6px 16px ${tokenColor}60, inset 0 0 15px ${tokenColor}30`,
                                        }}
                                      >
                                        <AssetIcon
                                          src={getAssetIconUrl(token.caip, token.icon)}
                                          alt={token.symbol || token.ticker}
                                          boxSize="40px"
                                          color={tokenColor}
                                          caip={token.caip}
                                        />
                                      </Box>
                                    );
                                  })}
                                </Flex>

                                {/* Token Count Label */}
                                <Text fontSize="xs" color="gray.400" fontWeight="semibold">
                                  {networkTokens.length} token{networkTokens.length !== 1 ? 's' : ''}
                                  {hasMore && ` (+${networkTokens.length - 5} more)`}
                                </Text>
                              </Flex>
                            );
                          })()}

                          <Stack
                            align="flex-end"
                            gap={2}
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
                            <Stack align="flex-end" gap={0.5}>
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

                            <Button
                              size="sm"
                              variant="solid"
                              bg={network.color}
                              color="black"
                              fontWeight="bold"
                              px={4}
                              py={2}
                              borderRadius="lg"
                              boxShadow={`0 2px 8px ${network.color}40`}
                              _hover={{
                                bg: network.color,
                                transform: 'translateY(-1px)',
                                boxShadow: `0 4px 12px ${network.color}60`,
                                filter: 'brightness(1.1)',
                              }}
                              _active={{
                                transform: 'translateY(0px)',
                                boxShadow: `0 1px 4px ${network.color}40`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const caip = network.gasAssetCaip;
                                setLoadingAssetCaip(caip);
                                const encodedCaip = btoa(caip);
                                startTransition(() => {
                                  router.push(`/asset/${encodedCaip}`);
                                });
                              }}
                              whiteSpace="nowrap"
                            >
                              Select {network.gasAssetSymbol}
                            </Button>
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
                //   logger.debug('🔍 [Dashboard] Checking balance for token classification:', {
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
              logger.debug('🪙 [Dashboard] Total balances:', app.balances.length);
              //logger.debug('🪙 [Dashboard] All balance CAIPs:', app.balances.map((b: any) => b.caip));
              logger.debug('🪙 [Dashboard] Token balances found:', tokenBalances.length);
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
                            logger.debug('🔍 [Dashboard] User clicked refresh tokens');
                            setIsRefreshing(true);
                            try {
                              const v2Enabled = isPioneerV2Enabled();

                              // Only call v2 APIs if they're enabled
                              if (v2Enabled) {
                                if (app && typeof app.refresh === 'function') {
                                  logger.debug('🔄 [Dashboard] Calling app.refresh()');
                                  await app.refresh();
                                } else if (app && typeof app.sync === 'function') {
                                  logger.debug('🔄 [Dashboard] Calling app.sync()');
                                  await app.sync();
                                }
                              } else {
                                logger.debug('ℹ️ [Dashboard] Skipping v2 API calls (refresh/sync) - v2 APIs disabled');
                                // For v1, we can call getBalances directly
                                if (app && typeof app.getBalances === 'function') {
                                  logger.debug('🔄 [Dashboard] Calling app.getBalances() (v1 fallback)');
                                  await app.getBalances();
                                }
                              }

                              // Also get charts/tokens (with error handling for staking position bug)
                              if (app && typeof app.getCharts === 'function' && app.pubkeys && app.pubkeys.length > 0) {
                                logger.debug('🔄 [Dashboard] Calling app.getCharts()');
                                try {
                                  await app.getCharts();

                                  // Verify tokens were loaded
                                  const tokens = app.balances?.filter((b: any) => b.token === true) || [];
                                  logger.debug('✅ [Dashboard] getCharts returned', tokens.length, 'tokens');

                                  if (tokens.length === 0) {
                                    logger.warn('⚠️ [Dashboard] getCharts completed but returned 0 tokens');
                                  }
                                } catch (chartError: any) {
                                  logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                                  logger.error('❌ [Dashboard] getCharts failed:', chartError);
                                  logger.error('Error details:', {
                                    message: chartError?.message,
                                    type: chartError?.constructor?.name,
                                    pioneer: !!app?.pioneer,
                                    pubkeys: app?.pubkeys?.length || 0
                                  });
                                  logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                                }
                              } else if (app && typeof app.getCharts === 'function') {
                                logger.debug('⏭️ [Dashboard] Skipping getCharts - no pubkeys available (wallet not paired)');
                              }

                              // Fetch dashboard data after refresh (only if v2 enabled)
                              if (v2Enabled) {
                                await fetchDashboard();
                              }
                              
                              logger.debug('✅ [Dashboard] Refresh completed');
                            } catch (error) {
                              logger.error('❌ [Dashboard] Refresh failed:', error);
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

                     // Get token color with better fallbacks
                     const assetInfo = app.assetsMap?.get(token.caip) || app.assetsMap?.get(token.caip.toLowerCase());
                     let tokenColor = assetInfo?.color || token.color;

                     // logger.debug('🔍 [Dashboard] Token info:', {
                     //   caip: token.caip,
                     //   color: tokenColor
                     // });

                     // Determine token symbol and name
                     const tokenSymbol = token.symbol || token.ticker || 'TOKEN';
                     const tokenName = token.name || tokenSymbol;

                     // Set fallback color based on token type if not provided
                     if (!tokenColor) {
                       if (token.caip?.includes('MAYA.') || token.caip?.includes('cosmos:mayachain-mainnet-v1/denom:maya')) {
                         tokenColor = '#00D4AA';
                       } else if (token.caip?.includes('THOR.')) {
                         tokenColor = '#00CCFF';
                       } else if (token.caip?.includes('eip155:')) {
                         tokenColor = '#627EEA';
                       } else {
                         tokenColor = '#FFD700';
                       }
                     }

                     // Debug logging for token detection
                     // logger.debug('🪙 [Dashboard] Token detected:', {
                     //   caip: token.caip,
                     //   symbol: tokenSymbol,
                     //   balance: token.balance,
                     //   valueUsd: tokenValueUsd,
                     //   type: token.type,
                     //   iconSource: 'keepkey.info CDN (CAIP-based)'
                     // });

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
                          logger.debug('🪙 [Dashboard] Navigating to token page:', token);

                          // Use the token's CAIP for navigation
                          const caip = token.caip;

                          logger.debug('🪙 [Dashboard] Using token CAIP for navigation:', caip);
                          logger.debug('🪙 [Dashboard] Token object:', token);

                          // Set loading state immediately for instant feedback
                          setLoadingAssetCaip(caip);

                          // Use Base64 encoding for complex IDs to avoid URL encoding issues
                          const encodedCaip = btoa(caip);

                          logger.debug('🪙 [Dashboard] Encoded token parameters:', { encodedCaip });

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
                              <AssetIcon
                                src={getAssetIconUrl(token.caip, token.icon)}
                                alt={tokenName}
                                boxSize="44px"
                                color={tokenColor}
                                caip={token.caip}
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

          {/* Staking Positions Section - Always Show */}
          {(() => {
            // Filter staking positions from balances
            let stakingPositions: any[] = [];
            if (app?.balances) {
              stakingPositions = app.balances.filter((balance: any) => {
                const isStaking = balance.chart === 'staking';
                const hasBalance = balance.balance && parseFloat(balance.balance) > 0;

                // Debug logging
                if (isStaking) {
                  logger.debug('🔍 [Dashboard] Found staking balance:', {
                    caip: balance.caip,
                    chart: balance.chart,
                    balance: balance.balance,
                    valueUsd: balance.valueUsd,
                    type: balance.type,
                    ticker: balance.ticker
                  });
                }

                return isStaking && hasBalance;
              });

              // Sort staking positions by USD value (highest first)
              stakingPositions.sort((a: any, b: any) => {
                const valueA = parseFloat(a.valueUsd || 0);
                const valueB = parseFloat(b.valueUsd || 0);
                return valueB - valueA; // Descending order
              });

              logger.debug('🏦 [Dashboard] Staking positions found:', stakingPositions.length);
            }

            return (
              <Box w="100%">
                <HStack justify="space-between" mb={5}>
                  <HStack gap={2}>
                    <Text fontSize="md" color="gray.400">Staking Positions</Text>
                    <Text fontSize="xs" color="gray.600">
                      ({stakingPositions.length})
                    </Text>
                    {stakingPositions.length > 0 && (
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
                  {stakingPositions.length === 0 ? (
                    // Empty state when no staking positions found
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
                          <Text fontSize="2xl">🏦</Text>
                        </Box>
                        <Text fontSize="md" color="gray.400" fontWeight="medium">
                          No Staking Positions
                        </Text>
                        <Text fontSize="sm" color="gray.500" textAlign="center" maxW="320px">
                          Delegations, rewards, and unbonding positions will appear here when you stake on Cosmos chains.
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
                            logger.debug('🔍 [Dashboard] User clicked refresh staking');
                            setIsRefreshing(true);
                            try {
                              if (app && typeof app.getCharts === 'function' && app.pubkeys && app.pubkeys.length > 0) {
                                logger.debug('🔄 [Dashboard] Calling app.getCharts() for staking');
                                try {
                                  await app.getCharts();
                                  logger.debug('✅ [Dashboard] getCharts completed for staking');
                                } catch (chartError: any) {
                                  logger.error('❌ [Dashboard] getCharts failed:', chartError);
                                }
                              }
                              await fetchDashboard();
                            } catch (error) {
                              logger.error('❌ [Dashboard] Refresh failed:', error);
                            } finally {
                              setIsRefreshing(false);
                            }
                          }}
                          loading={isRefreshing}
                          loadingText="Refreshing..."
                        >
                          Refresh Staking
                        </Button>
                      </VStack>
                    </Box>
                  ) : (
                    // Show actual staking positions when found
                    stakingPositions.map((position: any, index: number) => {
                    const { integer, largePart, smallPart } = formatBalance(position.balance);
                    const stakingValueUsd = parseFloat(position.valueUsd || 0);

                     // Get staking color
                     const stakingColor = '#9333EA'; // Purple for staking positions

                     // Determine position type and badge color
                     const positionType = position.type || 'delegation';
                     const badgeColorScheme =
                       positionType === 'delegation' ? 'purple' :
                       positionType === 'reward' ? 'green' :
                       positionType === 'unbonding' ? 'yellow' : 'purple';

                     // Determine ticker
                     const positionTicker = position.ticker || position.symbol || 'ATOM';
                     const positionName = position.name || `${positionTicker} Staking`;

                    return (
                      <Box
                        key={`${position.caip}_${position.pubkey}_${index}`}
                        w="100%"
                        p={5}
                        borderRadius="2xl"
                        borderWidth="1px"
                        borderColor={`${stakingColor}40`}
                        boxShadow={`0 4px 20px ${stakingColor}20, inset 0 0 20px ${stakingColor}10`}
                        position="relative"
                        bg={`${stakingColor}15`}
                        _before={{
                          content: '""',
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(135deg, ${stakingColor}40 0%, ${stakingColor}20 100%)`,
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
                          boxShadow: `0 8px 24px ${stakingColor}30, inset 0 0 30px ${stakingColor}20`,
                          borderColor: stakingColor,
                          bg: `${stakingColor}25`,
                          _before: {
                            opacity: 0.8,
                            background: `linear-gradient(135deg, ${stakingColor}50 0%, ${stakingColor}30 100%)`,
                          },
                          _after: {
                            opacity: 0.7,
                          },
                        }}
                        _active={{
                          transform: 'scale(0.98) translateY(-1px)',
                          boxShadow: `0 2px 12px ${stakingColor}20`,
                          transition: 'all 0.1s ease-in-out',
                        }}
                        _focus={{
                          outline: 'none',
                          boxShadow: `0 0 0 2px ${stakingColor}, 0 8px 24px ${stakingColor}30`,
                        }}
                        cursor="pointer"
                        onClick={() => {
                          logger.debug('🏦 [Dashboard] Navigating to staking asset page:', position);

                          // Use the position's CAIP for navigation (the native asset CAIP, not a staking-specific one)
                          const caip = position.caip;

                          logger.debug('🏦 [Dashboard] Using position CAIP for navigation:', caip);

                          // Set loading state
                          setLoadingAssetCaip(caip);

                          // Use Base64 encoding for complex IDs
                          const encodedCaip = btoa(caip);

                          // Navigate using startTransition
                          startTransition(() => {
                            router.push(`/asset/${encodedCaip}`);
                          });
                        }}
                        role="button"
                        aria-label={`Select ${positionTicker} ${positionType}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/asset/${btoa(position.caip)}`);
                          }
                        }}
                        transition="all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                      >
                        {/* Loading overlay with spinner */}
                        {loadingAssetCaip === position.caip && (
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
                              color={stakingColor}
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
                              bg={stakingColor}
                              boxShadow={`lg, inset 0 0 10px ${stakingColor}40`}
                              position="relative"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              _after={{
                                content: '""',
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: `linear-gradient(135deg, ${stakingColor}40 0%, transparent 100%)`,
                                opacity: 0.6,
                                pointerEvents: "none",
                              }}
                            >
                              <Text fontSize="2xl">
                                {positionType === 'delegation' ? '🔒' :
                                 positionType === 'reward' ? '💰' :
                                 positionType === 'unbonding' ? '⏳' : '🏦'}
                              </Text>
                            </Box>
                            <Stack gap={0.5}>
                              <HStack gap={2}>
                                <Text fontSize="md" fontWeight="bold" color={stakingColor}>
                                  {positionTicker}
                                </Text>
                                <Badge
                                  colorScheme={badgeColorScheme}
                                  variant="subtle"
                                  fontSize="xs"
                                  textTransform="uppercase"
                                >
                                  {positionType}
                                </Badge>
                              </HStack>
                              {position.validatorAddress && (
                                <Box
                                  fontSize="xs"
                                  color="gray.400"
                                  mb={1}
                                  title={position.validatorAddress}
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
                                    {middleEllipsis(position.validatorAddress, 14)}
                                  </Box>
                                  <Box
                                    as="span"
                                    display={{ base: 'none', md: 'inline' }}
                                  >
                                    {position.validatorAddress}
                                  </Box>
                                </Box>
                              )}
                              <HStack gap={2} align="center">
                                <Text fontSize="sm" color="gray.200" fontWeight="medium">
                                  {integer}.{largePart}
                                  <Text as="span" fontSize="xs" color="gray.300">
                                    {smallPart}
                                  </Text>
                                </Text>
                                <Text fontSize="xs" color={stakingColor} fontWeight="medium">
                                  {positionTicker}
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
                              bg: `${stakingColor}30`,
                              boxShadow: `0 0 8px ${stakingColor}40`,
                            }}
                          >
                            <Text
                              fontSize="md"
                              color={stakingColor}
                              fontWeight="medium"
                            >
                              $<CountUp
                                key={`staking-${position.caip}-${position.pubkey}-${index}-${lastSync}`}
                                end={stakingValueUsd}
                                decimals={2}
                                duration={1.5}
                                separator=","
                              />
                            </Text>
                            <Text
                              fontSize="xs"
                              color={`${stakingColor}80`}
                              fontWeight="medium"
                              px={1}
                              py={0.5}
                              borderRadius="sm"
                              bg={`${stakingColor}20`}
                            >
                              STAKING
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

    {/* Chat Assistant - Global floating chat button */}
    <ChatPopup app={app} />
    </>
  );
};

export default Dashboard; 
