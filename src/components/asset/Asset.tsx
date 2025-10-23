'use client'

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  Stack,
  Button,
  Image,
  VStack,
  HStack,
  IconButton,
  useDisclosure,
  Icon,
  Badge,
  Spinner,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { motion } from 'framer-motion';
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph';

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

// Add sound effect imports
const chachingSound = typeof Audio !== 'undefined' ? new Audio('/sounds/chaching.mp3') : null;

// Play sound utility function
const playSound = (sound: HTMLAudioElement | null) => {
  if (sound) {
    sound.currentTime = 0; // Reset to start
    sound.play().catch(err => console.error('Error playing sound:', err));
  }
};

import { usePioneerContext } from '@/components/providers/pioneer';
import { FaTimes, FaChevronDown, FaChevronUp, FaPaperPlane, FaQrcode, FaExchangeAlt, FaFileExport, FaPlus, FaCopy, FaCheck, FaSync, FaCoins, FaList } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';
import { CosmosStaking } from './CosmosStaking';
import { isFeatureEnabled } from '@/config/features';
import { BalanceDistribution } from '../balance/BalanceDistribution';
import { aggregateBalances, AggregatedBalance } from '@/types/balance';
import { ReportDialog } from './ReportDialog';
import { AddPathDialog } from './AddPathDialog';
import { CustomTokenDialog } from './CustomTokenDialog';
import { useCustomTokens } from '@/hooks/useCustomTokens';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

// Create motion wrapper for Chakra components
const MotionBox = motion(Box);

interface AssetProps {
  onBackClick?: () => void;
  onSendClick?: () => void;
  onReceiveClick?: () => void;
  onSwapClick?: () => void;
}

// Icon component with fallback for broken/empty images
const IconWithFallback = ({ src, alt, boxSize, color }: { src: string | null, alt: string, boxSize: string, color: string }) => {
  const [error, setError] = useState(false);

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
      objectFit="contain"
      onError={(e) => {
        console.log('🖼️ [IconWithFallback] Image load error:', cleanUrl);
        setError(true);
      }}
    />
  );
};

export const Asset = ({ onBackClick, onSendClick, onReceiveClick, onSwapClick }: AssetProps) => {
  // State for managing the component's loading status
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  // Add state for tracking expanded/collapsed state of asset details
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  // Add state to track previous balance for comparison
  const [previousBalance, setPreviousBalance] = useState<string>('0');
  // Add flag to track if this is the initial load to prevent sound on first balance set
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Add state to track selected address in Balance Distribution
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  // Toggle to show all pubkeys including 0-balance accounts (default: false)
  const [showAllPubkeys, setShowAllPubkeys] = useState(false);
  // Add state for report dialog
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  // Add state for add path dialog
  const [isAddPathDialogOpen, setIsAddPathDialogOpen] = useState(false);
  // Add state for custom token dialog
  const [isCustomTokenDialogOpen, setIsCustomTokenDialogOpen] = useState(false);
  // Add state for tracking back navigation loading
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  // Custom tokens hook
  const { customTokens, addCustomToken, removeCustomToken, refreshCustomTokens } = useCustomTokens();
  // Add state for tracking copied addresses/pubkeys
  const [copiedItems, setCopiedItems] = useState<{[key: string]: boolean}>({});
  // Add state for refreshing charts
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Access pioneer context in the same way as the Dashboard component
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const assetContext = app?.assetContext;
  
  const router = useRouter();

  // Calculate the price (moved up for use in useMemo)
  const priceUsd = assetContext?.priceUsd || 0;

  // Prepare aggregated balance for multi-pubkey display (must be called with other hooks)
  const aggregatedBalance: AggregatedBalance | null = useMemo(() => {
    if (!assetContext?.networkId || !assetContext?.symbol) return null;
    
    // Get all pubkeys for this network
    const networkPubkeys = assetContext.pubkeys || [];
    if (networkPubkeys.length === 0) return null; // Only return null if no pubkeys at all
    
    // Get balances for this asset
    const assetBalances = app?.balances?.filter((balance: any) => 
      balance.networkId === assetContext.networkId && 
      balance.symbol === assetContext.symbol
    ) || [];
    
    // Create a comprehensive list that includes all pubkeys, even those with 0 balance
    const allPubkeyBalances = networkPubkeys.map((pubkey: any) => {
      // Find existing balance for this pubkey
      const existingBalance = assetBalances.find((balance: any) => 
        balance.address === pubkey.address || 
        balance.pubkey === pubkey.pubkey ||
        balance.master === pubkey.master
      );
      
      if (existingBalance) {
        return existingBalance;
      } else {
        // Create a 0 balance entry for pubkeys without balance
        return {
          address: pubkey.address || pubkey.pubkey,
          pubkey: pubkey.pubkey,
          balance: '0',
          valueUsd: 0,
          networkId: assetContext.networkId,
          symbol: assetContext.symbol,
          path: pubkey.path,
          master: pubkey.master
        };
      }
    });
    
    // Filter based on showAllPubkeys toggle
    const filteredBalances = showAllPubkeys 
      ? allPubkeyBalances 
      : allPubkeyBalances.filter((balance: any) => parseFloat(balance.balance || '0') > 0);
    
    if (filteredBalances.length === 0) return null; // No balances to show
    
    const result = aggregateBalances(
      filteredBalances,
      networkPubkeys,
      assetContext.networkId,
      assetContext.symbol,
      priceUsd
    );
    
    // Debug logging to understand structure
    console.log('📊 Aggregated Balance:', result);
    console.log('🔑 Network Pubkeys:', networkPubkeys);
    console.log('💰 Filtered Balances:', filteredBalances);
    console.log('🔄 Show All Pubkeys:', showAllPubkeys);
    
    return result;
  }, [app?.balances, assetContext, priceUsd, showAllPubkeys]);

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

  // Add component mount/unmount logging and handle loading state
  useEffect(() => {
    console.log('🎯 [Asset] Component mounted with context:', assetContext);

    // For debugging - log the Pioneer context
    console.log('🎯 [Asset] Pioneer context:', {
      app,
      hasApp: !!app,
      hasAssetContext: !!app?.assetContext,
      hasSetAssetContext: !!app?.setAssetContext
    });

    // Reset component state when assetContext changes (navigating to new asset)
    if (assetContext) {
      console.log('✅ [Asset] AssetContext available, resetting component state');
      // Reset all component state for the new asset
      setPreviousBalance(assetContext.balance || '0');
      setIsInitialLoad(true); // Mark as initial load for new asset
      setSelectedAddress(null); // Clear selected address
      setLoading(false);
      return;
    }
    
    // Set a timeout to wait for assetContext to be populated
    let checkCount = 0;
    const maxChecks = 10;
    
    const checkAssetContext = () => {
      // Re-access the latest context values
      const currentApp = pioneer?.state?.app;
      const currentAssetContext = currentApp?.assetContext;
      
      if (currentAssetContext) {
        console.log('✅ [Asset] AssetContext became available on check', checkCount);
        setLoading(false);
        return true;
      }
      
      checkCount++;
      if (checkCount >= maxChecks) {
        console.log('❌ [Asset] AssetContext still null after', maxChecks, 'checks');
        console.log('❌ [Asset] Current app state:', {
          hasApp: !!currentApp,
          hasAssetContext: !!currentApp?.assetContext,
          hasSetAssetContext: !!currentApp?.setAssetContext,
          isDashboardAvailable: !!currentApp?.dashboard
        });
        setLoading(false);
        return true;
      }
      
      return false;
    };
    
    // Immediately check once
    if (checkAssetContext()) return;
    
    // Then set up an interval for repeated checks
    const timer = setInterval(() => {
      if (checkAssetContext()) {
        clearInterval(timer);
      }
    }, 500); // Check every 500ms
    
    return () => {
      console.log('👋 [Asset] Component unmounting');
      clearInterval(timer);
    };
  }, [app, assetContext, pioneer]);

  // Set up interval to sync market data every 15 seconds
  useEffect(() => {
    if (!app) return;
    
    // Initialize previousBalance when component mounts
    if (app.assetContext?.balance) {
      setPreviousBalance(app.assetContext.balance);
      // Mark as no longer initial load after first balance is set
      setIsInitialLoad(false);
    }
    
    const intervalId = setInterval(() => {
      app
        .syncMarket()
        .then(() => {
          console.log("📊 [Asset] syncMarket called from Asset component");
          
          // Check if balance has increased
          if (app.assetContext?.balance) {
            const currentBalance = app.assetContext.balance;
            const prevBalance = previousBalance;
            
            console.log("💰 [Asset] Balance comparison:", { 
              previous: prevBalance, 
              current: currentBalance,
              increased: parseFloat(currentBalance) > parseFloat(prevBalance),
              isInitialLoad
            });
            
            // Only play sound if this is not the initial load and balance actually increased
            // if (!isInitialLoad && parseFloat(currentBalance) > parseFloat(prevBalance)) {
            //   console.log("🎵 [Asset] Balance increased! Playing chaching sound");
            //   playSound(chachingSound);
            // }
            
            // Update previous balance for next comparison
            setPreviousBalance(currentBalance);
          }
          
          setLastSync(Date.now());
        })
        .catch((error: any) => {
          console.error("❌ [Asset] Error in syncMarket:", error);
        });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [app, previousBalance, isInitialLoad]);

  const handleBack = () => {
    // Set loading state
    setIsNavigatingBack(true);

    // Small delay for visual feedback
    setTimeout(() => {
      if (onBackClick) {
        // Use the provided onBackClick handler if available
        console.log('🔙 [Asset] Using custom back handler');
        onBackClick();
      } else {
        // Default behavior - navigate to dashboard
        console.log('🔙 [Asset] Back button clicked, navigating to dashboard');
        router.push('/');
      }
    }, 200);
  };

  const handleClose = () => {
    // Close button always goes to dashboard regardless of back button behavior
    console.log('❌ [Asset] Close button clicked, navigating to dashboard');
    router.push('/');
  };

  // Add a utility function for middle ellipsis
  const middleEllipsis = (text: string, visibleChars = 16) => {
    if (!text) return '';
    if (text.length <= visibleChars) return text;
    
    const charsToShow = Math.floor(visibleChars / 2);
    return `${text.substring(0, charsToShow)}...${text.substring(text.length - charsToShow)}`;
  };

  // Toggle details expanded/collapsed state
  const toggleDetails = () => {
    setIsDetailsExpanded(!isDetailsExpanded);
  };

  // Copy to clipboard helper function
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedItems(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setCopiedItems(prev => ({ ...prev, [key]: false }));
        }, 2000);
        console.log(`📋 [Asset] Copied to clipboard: ${key}`);
      })
      .catch(err => {
        console.error('❌ [Asset] Error copying to clipboard:', err);
      });
  };

  // Refresh charts to discover tokens for the current network
  const handleRefreshCharts = async () => {
    if (!assetContext?.networkId) {
      console.error('❌ [Asset] No networkId available');
      return;
    }

    console.log('🔄 [Asset] Refreshing charts for network:', assetContext.networkId);
    setIsRefreshing(true);
    try {
      if (app && typeof app.getCharts === 'function') {
        console.log('🔄 [Asset] Calling app.getCharts() with networkId:', assetContext.networkId);
        await app.getCharts([assetContext.networkId]);
        console.log('✅ [Asset] Charts refresh completed for', assetContext.networkId);
      }
    } catch (error) {
      console.error('❌ [Asset] Charts refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    // Show loading state while waiting for context
    return (
      <Box 
        height="600px" 
        bg={theme.bg} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        flexDirection="column"
        width="100%" 
        mx="auto"
        backgroundImage="url(/images/backgrounds/splash-bg.png)"
        backgroundSize="cover"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
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
        <Text color={theme.gold} fontSize="lg" fontWeight="medium">Loading asset data...</Text>
      </Box>
    );
  }

  if (!assetContext) {
    console.log('❌ [Asset] AssetContext is null or undefined');
    console.log('❌ [Asset] This may indicate an issue with the context provider or URL parameters');
    
    // Show a user-friendly error message with a back button
    return (
      <Box height="600px" bg={theme.bg} width="100%" mx="auto">
        <Box 
          borderBottom="1px" 
          borderColor={theme.border}
          p={4}
          bg={theme.cardBg}
        >
          <HStack justify="space-between" align="center">
            <Button
              size="sm"
              variant="ghost"
              color={theme.gold}
              onClick={handleBack}
              _hover={{ color: theme.goldHover }}
            >
              <Text>Back</Text>
            </Button>
          </HStack>
        </Box>
        
        <Box 
          p={8} 
          textAlign="center" 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center"
          height="400px"
        >
          <Box 
            w="80px" 
            h="80px" 
            borderRadius="full" 
            bg="rgba(254, 215, 226, 0.1)" 
            display="flex" 
            alignItems="center" 
            justifyContent="center"
            mb={4}
          >
            <FaTimes color="#FC8181" size="32px" />
          </Box>
          
          <Text fontSize="xl" fontWeight="bold" color="white" mb={2}>
            Asset Data Not Found
          </Text>
          
          <Text color="gray.400" maxWidth="sm" mb={6}>
            We couldn't load the asset data. This could be due to an invalid URL or a connection issue.
          </Text>
          
          <Button
            variant="outline"
            color={theme.gold}
            borderColor={theme.gold}
            onClick={handleBack}
          >
            Return to Previous Page
          </Button>
        </Box>
      </Box>
    );
  }

  const formatBalance = (balance: string | number) => {
    const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
    return numBalance.toFixed(8);
  };

  // Calculate the USD value - use aggregated balance if available
  const displayBalance = aggregatedBalance?.totalBalance || assetContext.balance || '0';
  const usdValue = aggregatedBalance 
    ? aggregatedBalance.totalValueUsd
    : (assetContext.value !== undefined && assetContext.value !== null) 
      ? assetContext.value 
      : (assetContext.balance && assetContext.priceUsd) 
        ? parseFloat(assetContext.balance) * assetContext.priceUsd 
        : 0;

  return (
    <Box 
      width="100%" 
      position="relative"
      pb={8} // Add bottom padding to ensure content doesn't get cut off
    >
      <Box
        borderBottom="1px"
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <HStack justify="space-between" align="center">
          <MotionBox
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Button
              size="sm"
              variant="ghost"
              color={theme.gold}
              onClick={handleBack}
              isDisabled={isNavigatingBack}
              _hover={{
                color: theme.goldHover,
                bg: 'rgba(255, 215, 0, 0.1)',
                shadow: '0 0 20px rgba(255, 215, 0, 0.3)'
              }}
              _active={{
                bg: 'rgba(255, 215, 0, 0.2)',
                shadow: '0 0 30px rgba(255, 215, 0, 0.5)'
              }}
              transition="all 0.2s"
            >
              {isNavigatingBack ? (
                <HStack gap={2}>
                  <Spinner size="xs" color={theme.gold} />
                  <Text>Going Back...</Text>
                </HStack>
              ) : (
                <Text>Back</Text>
              )}
            </Button>
          </MotionBox>
          <Button
            size="sm"
            variant="ghost"
            color={theme.gold}
            onClick={handleClose}
            _hover={{ color: theme.goldHover }}
          >
            <Text>Close</Text>
          </Button>
        </HStack>
      </Box>
      
      <Box p={6}>
        <Flex
          direction={{ base: 'column', lg: isDetailsExpanded ? 'row' : 'column' }}
          gap={6}
          align="flex-start"
        >
          {/* Main Content - Left Side when expanded */}
          <VStack 
            gap={6} 
            align="stretch" 
            flex={{ base: '1', lg: isDetailsExpanded ? '1' : 'initial' }}
            width={{ base: '100%', lg: isDetailsExpanded ? 'auto' : '100%' }}
            maxW={{ base: '100%', lg: isDetailsExpanded ? '500px' : '100%' }}
            mx={{ base: 'auto', lg: isDetailsExpanded ? '0' : 'auto' }}
          >
            {/* Asset Info Card */}
            <Box 
              bg={theme.cardBg} 
              p={6} 
              borderRadius="2xl" 
              boxShadow="lg"
              border="1px solid"
              borderColor={theme.border}
            >
              <VStack align="center" gap={4}>
                {/* Compound Avatar for Tokens */}
                {assetContext.isToken ? (
                  <Box position="relative">
                    {/* Main Network Icon */}
                    <Box 
                      borderRadius="full" 
                      overflow="hidden" 
                      boxSize="80px"
                      bg={theme.cardBg}
                      boxShadow="lg"
                      p={2}
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      {/* Get network icon based on networkId */}
                      <Image 
                        src={(() => {
                          // Map networkId to network icon
                          const networkId = assetContext.networkId;
                          if (networkId.includes('mayachain')) return 'https://pioneers.dev/coins/maya.png';
                          if (networkId.includes('thorchain')) return 'https://pioneers.dev/coins/thorchain.png';
                          if (networkId.includes('osmosis')) return 'https://pioneers.dev/coins/osmosis.png';
                          if (networkId.includes('eip155:1')) return 'https://pioneers.dev/coins/ethereum.png';
                          if (networkId.includes('eip155:137')) return 'https://pioneers.dev/coins/polygon.png';
                          if (networkId.includes('eip155:43114')) return 'https://pioneers.dev/coins/avalanche.png';
                          if (networkId.includes('eip155:56')) return 'https://pioneers.dev/coins/binance.png';
                          if (networkId.includes('eip155:8453')) return 'https://pioneers.dev/coins/base.png';
                          if (networkId.includes('eip155:10')) return 'https://pioneers.dev/coins/optimism.png';
                          if (networkId.includes('eip155:42161')) return 'https://pioneers.dev/coins/arbitrum.png';
                          // Default network icon
                          return 'https://pioneers.dev/coins/pioneer.png';
                        })()}
                        alt="Network Icon"
                        boxSize="100%"
                        objectFit="contain"
                      />
                    </Box>
                    
                    {/* Token Icon as smaller overlay */}
                    <Box
                      position="absolute"
                      bottom="-2"
                      right="-2"
                      borderRadius="full"
                      overflow="hidden"
                      boxSize="32px"
                      bg={theme.cardBg}
                      boxShadow="md"
                      p={1}
                      borderWidth="2px"
                      borderColor={theme.bg}
                    >
                      <IconWithFallback
                        src={assetContext.icon}
                        alt={`${assetContext.name} Icon`}
                        boxSize="100%"
                        color={theme.gold}
                      />
                    </Box>
                  </Box>
                ) : (
                  /* Native Asset Icon */
                  <Box
                    borderRadius="full"
                    overflow="hidden"
                    boxSize="80px"
                    bg={theme.cardBg}
                    boxShadow="lg"
                    p={2}
                    borderWidth="1px"
                    borderColor={assetContext.color || theme.border}
                  >
                    <IconWithFallback
                      src={assetContext.icon}
                      alt={`${assetContext.name} Icon`}
                      boxSize="100%"
                      color={assetContext.color || theme.gold}
                    />
                  </Box>
                )}
                
                <Stack align="center" gap={1}>
                  <Text fontSize="2xl" fontWeight="bold" color="white">
                    {assetContext.name}
                  </Text>
                  <HStack gap={2} align="center">
                    <Text fontSize="md" color="gray.400">
                      {assetContext.symbol}
                    </Text>
                    {assetContext.isToken && (
                      <Badge 
                        colorScheme="purple" 
                        variant="subtle"
                        fontSize="xs"
                      >
                        TOKEN
                      </Badge>
                    )}
                  </HStack>
                  
                  {/* Display CAIP in small text */}
                  <Text fontSize="xs" color="gray.500" fontFamily="mono">
                    {assetContext.caip}
                  </Text>
                  
                  <Text fontSize="3xl" fontWeight="bold" color={theme.gold}>
                    $<CountUp 
                      key={`value-${lastSync}`}
                      end={usdValue} 
                      decimals={2}
                      duration={1.5}
                      separator=","
                    />
                  </Text>
                  
                  {/* Show if balance is aggregated from multiple addresses */}
                  {aggregatedBalance && aggregatedBalance.balances.length > 1 && (
                    <Badge 
                      colorScheme="blue" 
                      variant="subtle"
                      fontSize="xs"
                      px={2}
                      py={1}
                    >
                      Combined from {aggregatedBalance.balances.length} Pubkeys
                    </Badge>
                  )}
                  
                  {/* For tokens, show BOTH balances clearly */}
                  {assetContext.isToken ? (
                    <VStack gap={2}>
                      {/* Token Balance */}
                      <Box textAlign="center">
                        <Text fontSize="lg" fontWeight="bold" color="white">
                          {formatBalance(displayBalance)} {assetContext.symbol}
                        </Text>
                        <Text fontSize="xs" color="gray.500">Token Balance</Text>
                      </Box>
                      
                      {/* Native Balance with warning if zero */}
                      <Box 
                        textAlign="center"
                        p={2}
                        borderRadius="md"
                        borderWidth={assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 ? "2px" : "0"}
                        borderColor="red.500"
                        position="relative"
                        _hover={assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 ? {
                          '& .warning-tooltip': { opacity: 1, visibility: 'visible' }
                        } : {}}
                      >
                        <Text fontSize="md" color={assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 ? "red.400" : "gray.300"}>
                          {assetContext.nativeBalance ? formatBalance(assetContext.nativeBalance) : '0'} {assetContext.nativeSymbol || 'GAS'}
                        </Text>
                        <Text fontSize="xs" color="gray.500">Gas Balance</Text>
                        
                        {/* Warning tooltip for zero balance */}
                        {assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 && (
                          <Box
                            className="warning-tooltip"
                            position="absolute"
                            top="-40px"
                            left="50%"
                            transform="translateX(-50%)"
                            bg="red.600"
                            color="white"
                            px={3}
                            py={1}
                            borderRadius="md"
                            fontSize="xs"
                            whiteSpace="nowrap"
                            opacity={0}
                            visibility="hidden"
                            transition="all 0.2s"
                            zIndex={10}
                            _before={{
                              content: '""',
                              position: 'absolute',
                              bottom: '-4px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '4px solid transparent',
                              borderRight: '4px solid transparent',
                              borderTop: '4px solid',
                              borderTopColor: 'red.600',
                            }}
                          >
                            ⚠️ Gas required to transfer tokens
                          </Box>
                        )}
                      </Box>
                    </VStack>
                  ) : (
                    /* Native Asset Balance */
                    <Text fontSize="md" color="white">
                      {formatBalance(displayBalance)} {assetContext.symbol}
                    </Text>
                  )}
                </Stack>
              </VStack>
            </Box>

            {/* Action Buttons */}
            <VStack gap={3}>
              <HStack gap={3} width="100%">
                <Button
                  flex="1"
                  size="lg"
                  bg={theme.cardBg}
                  color={theme.gold}
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                    borderColor: theme.gold,
                  }}
                  onClick={onSendClick}
                >
                  <Flex gap={2} align="center">
                    <FaPaperPlane />
                    <Text>Send</Text>
                  </Flex>
                </Button>
                <Button
                  flex="1"
                  size="lg"
                  bg={theme.cardBg}
                  color={theme.gold}
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                    borderColor: theme.gold,
                  }}
                  onClick={onReceiveClick}
                >
                  <Flex gap={2} align="center">
                    <FaQrcode />
                    <Text>Receive</Text>
                  </Flex>
                </Button>
              </HStack>
              {/* Refresh Charts Button - Discover Tokens */}
              {/* Commented out - doesn't seem to do anything */}
              {/* <Button
                width="100%"
                size="lg"
                bg={theme.cardBg}
                color="#00D9FF"
                borderColor={theme.border}
                borderWidth="1px"
                _hover={{
                  bg: 'rgba(0, 217, 255, 0.1)',
                  borderColor: '#00D9FF',
                }}
                onClick={handleRefreshCharts}
                isLoading={isRefreshing}
                loadingText="Discovering tokens..."
              >
                <Flex gap={2} align="center">
                  <FaSync />
                  <Text>Discover Tokens</Text>
                </Flex>
              </Button> */}
              {isFeatureEnabled('enableSwaps') && (
                <Button
                  width="100%"
                  size="lg"
                  bg={theme.cardBg}
                  color="#9F7AEA"
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(159, 122, 234, 0.1)',
                    borderColor: '#9F7AEA',
                  }}
                  onClick={onSwapClick}
                >
                  <Flex gap={2} align="center">
                    <FaExchangeAlt />
                    <Text>Swap</Text>
                  </Flex>
                </Button>
              )}
              <Button
                width="100%"
                size="lg"
                bg={theme.cardBg}
                color="#00D9FF"
                borderColor={theme.border}
                borderWidth="1px"
                _hover={{
                  bg: 'rgba(0, 217, 255, 0.1)',
                  borderColor: '#00D9FF',
                }}
                onClick={() => setIsReportDialogOpen(true)}
              >
                <Flex gap={2} align="center">
                  <FaFileExport />
                  <Text>Report</Text>
                </Flex>
              </Button>
              <Button
                width="100%"
                size="lg"
                bg={theme.cardBg}
                color="#23DCC8"
                borderColor={theme.border}
                borderWidth="1px"
                _hover={{
                  bg: 'rgba(35, 220, 200, 0.1)',
                  borderColor: '#23DCC8',
                }}
                onClick={() => setIsCustomTokenDialogOpen(true)}
              >
                <Flex gap={2} align="center">
                  <FaList />
                  <Text>Custom Tokens</Text>
                  {customTokens.length > 0 && (
                    <Badge
                      bg="#23DCC8"
                      color="black"
                      borderRadius="full"
                      px={2}
                      fontSize="xs"
                    >
                      {customTokens.length}
                    </Badge>
                  )}
                </Flex>
              </Button>
            </VStack>
          </VStack>
          
          {/* Asset Details Section - Right column version for desktop when expanded */}
          {isDetailsExpanded && (
            <Box 
              bg={theme.cardBg}
              borderRadius="2xl"
              overflow="hidden"
              borderColor={theme.border}
              borderWidth="1px"
              flex="1"
              display={{ base: 'none', lg: 'block' }}
              minW="400px"
              maxW="600px"
            >
              {/* Clickable header */}
              <Flex 
                p={4} 
                borderBottom="1px"
                borderColor={theme.border}
                justifyContent="space-between"
                alignItems="center"
                onClick={toggleDetails}
                cursor="pointer"
                _hover={{
                  bg: 'rgba(255, 215, 0, 0.05)',
                }}
                transition="background 0.2s"
              >
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Asset Details
                </Text>
                <Box color={theme.gold}>
                  <FaChevronUp size={16} />
                </Box>
              </Flex>
              
              {/* Details content */}
              <VStack align="stretch" p={4} gap={4}>
                {/* Balance Distribution for multi-address assets - MOVED TO TOP */}
                {aggregatedBalance && aggregatedBalance.balances.length > 1 && (
                  <Box>
                    <VStack align="stretch" gap={3}>
                      {/* Header with toggle button */}
                      <Flex justify="space-between" align="center">
                        <Text color="gray.400" fontSize="sm" fontWeight="medium">
                          All Accounts ({showAllPubkeys
                            ? aggregatedBalance.balances.length
                            : aggregatedBalance.balances.filter((b: any) => parseFloat(b.balance || '0') > 0).length
                          })
                        </Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          color={theme.gold}
                          onClick={() => setShowAllPubkeys(!showAllPubkeys)}
                          rightIcon={<Icon as={showAllPubkeys ? FaChevronUp : FaChevronDown} />}
                          _hover={{
                            bg: 'rgba(255, 215, 0, 0.1)',
                          }}
                        >
                          {showAllPubkeys ? 'Hide' : 'Show All'}
                        </Button>
                      </Flex>
                      <BalanceDistribution
                        aggregatedBalance={aggregatedBalance}
                        selectedAddress={selectedAddress}
                        onAddressClick={(address) => {
                          // Update selected address when clicked
                          setSelectedAddress(address);
                          console.log('Address selected:', address);
                        }}
                      />
                    </VStack>
                  </Box>
                )}

                {/* Network Info */}
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Network Information
                  </Text>
                  <HStack justify="space-between">
                    <Text color="gray.400">Type</Text>
                    <Text color="white">{assetContext.isToken ? 'Token' : 'Native Asset'}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.400">Network</Text>
                    <Text color="white">{assetContext.networkName || assetContext.networkId?.split(':').pop()}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.400">Chain ID</Text>
                    <Text color="white" fontSize="sm" fontFamily="mono">
                      {assetContext.chainId}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.400">CAIP</Text>
                    <Text 
                      color="white" 
                      fontSize="sm" 
                      fontFamily="mono"
                      title={assetContext.caip || assetContext.assetId}
                      cursor="help"
                      _hover={{
                        textDecoration: 'underline',
                        textDecorationStyle: 'dotted'
                      }}
                    >
                      {assetContext.caip}
                    </Text>
                  </HStack>
                </VStack>

                {/* Asset Info */}
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Asset Information
                  </Text>
                  <HStack justify="space-between">
                    <Text color="gray.400">Precision</Text>
                    <Text color="white">{assetContext.precision}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.400">Price</Text>
                    <Text color="white">
                      $<CountUp 
                        key={`price-${lastSync}`}
                        end={priceUsd} 
                        decimals={2}
                        duration={1.5}
                        separator=","
                      />
                    </Text>
                  </HStack>
                </VStack>

                {/* Address Info - Show ALL pubkeys with paths */}
                {assetContext.pubkeys && assetContext.pubkeys.length > 0 && (
                  <VStack align="stretch" gap={3}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">
                      Wallet Information ({assetContext.pubkeys.length} {assetContext.pubkeys.length === 1 ? 'Pubkey' : 'Pubkeys'})
                    </Text>
                    <VStack align="stretch" gap={3}>
                      {assetContext.pubkeys.map((pubkey: any, index: number) => {
                        // Determine the correct XPUB label based on path or script type
                        let xpubLabel = 'XPUB';
                        const isUtxo = assetContext.networkId?.startsWith('bip122:');

                        if (isUtxo) {
                          // Check path for address type indicators
                          if (pubkey.path?.includes("84'") || pubkey.scriptType === 'p2wpkh') {
                            xpubLabel = 'ZPUB'; // Native SegWit
                          } else if (pubkey.path?.includes("49'") || pubkey.scriptType === 'p2sh-p2wpkh') {
                            xpubLabel = 'YPUB'; // P2SH-wrapped SegWit
                          } else if (pubkey.path?.includes("86'")) {
                            xpubLabel = 'XPUB'; // Taproot
                          }
                        }

                        // Check if this is the selected address
                        const isSelected = selectedAddress && (
                          pubkey.address === selectedAddress ||
                          pubkey.pubkey === selectedAddress
                        );

                        return (
                          <Box
                            key={`pubkey-${index}-${pubkey.pubkey || pubkey.address}`}
                            p={3}
                            bg={theme.bg}
                            borderRadius="lg"
                            borderWidth="2px"
                            borderColor={isSelected ? theme.gold : theme.border}
                            transition="all 0.2s"
                            cursor="pointer"
                            onClick={async () => {
                              const addressToSelect = pubkey.address || pubkey.pubkey;
                              setSelectedAddress(addressToSelect);
                              console.log('🔑 [Asset] Selected pubkey:', addressToSelect, pubkey);

                              // Set pubkey context in Pioneer SDK for transactions
                              if (app?.setPubkeyContext) {
                                try {
                                  await app.setPubkeyContext(pubkey);
                                  console.log('✅ [Asset] Pubkey context set in Pioneer SDK:', pubkey);
                                } catch (error) {
                                  console.error('❌ [Asset] Error setting pubkey context:', error);
                                }
                              }
                            }}
                            _hover={{
                              borderColor: theme.gold,
                              bg: 'rgba(255, 215, 0, 0.05)',
                            }}
                          >
                            <VStack align="stretch" gap={2}>
                              {/* Header with index */}
                              <Flex justify="space-between" align="center">
                                <Badge
                                  colorScheme={isSelected ? "yellow" : "gray"}
                                  variant="subtle"
                                  fontSize="xs"
                                >
                                  {isUtxo ? xpubLabel : 'Address'} #{index + 1}
                                </Badge>
                                {isSelected && (
                                  <Badge colorScheme="yellow" fontSize="xs">
                                    Selected
                                  </Badge>
                                )}
                              </Flex>

                              {/* Pubkey or Address */}
                              <Box position="relative">
                                <Flex justify="space-between" align="flex-start" gap={2}>
                                  <Box flex="1">
                                    <Text color="gray.400" fontSize="xs" mb={1}>
                                      {isUtxo ? 'Public Key' : 'Address'}
                                    </Text>
                                    <Text color="white" fontSize="xs" fontFamily="mono" wordBreak="break-all" pr={8}>
                                      {isUtxo ? pubkey.pubkey : pubkey.address}
                                    </Text>
                                  </Box>
                                  <IconButton
                                    aria-label="Copy to clipboard"
                                    icon={copiedItems[`pubkey-${index}-main`] ? <FaCheck /> : <FaCopy />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme={copiedItems[`pubkey-${index}-main`] ? "green" : "gray"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(isUtxo ? pubkey.pubkey : pubkey.address, `pubkey-${index}-main`);
                                    }}
                                    _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                                  />
                                </Flex>
                              </Box>

                              {/* Path - Always show if available */}
                              {(pubkey.path || pubkey.pathMaster) && (
                                <HStack justify="space-between">
                                  <Text color="gray.400" fontSize="xs">Path</Text>
                                  <Text color={theme.gold} fontSize="xs" fontFamily="mono">
                                    {pubkey.path || pubkey.pathMaster}
                                  </Text>
                                </HStack>
                              )}

                              {/* Address for UTXO (if different from pubkey) */}
                              {isUtxo && pubkey.address && (
                                <Box position="relative">
                                  <Flex justify="space-between" align="flex-start" gap={2}>
                                    <Box flex="1">
                                      <Text color="gray.400" fontSize="xs" mb={1}>
                                        Address
                                      </Text>
                                      <Text color="white" fontSize="xs" fontFamily="mono" wordBreak="break-all" pr={8}>
                                        {pubkey.address}
                                      </Text>
                                    </Box>
                                    <IconButton
                                      aria-label="Copy address to clipboard"
                                      icon={copiedItems[`pubkey-${index}-address`] ? <FaCheck /> : <FaCopy />}
                                      size="xs"
                                      variant="ghost"
                                      colorScheme={copiedItems[`pubkey-${index}-address`] ? "green" : "gray"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(pubkey.address, `pubkey-${index}-address`);
                                      }}
                                      _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                                    />
                                  </Flex>
                                </Box>
                              )}

                              {/* Script Type for UTXO */}
                              {isUtxo && pubkey.scriptType && (
                                <HStack justify="space-between">
                                  <Text color="gray.400" fontSize="xs">Script Type</Text>
                                  <Text color="white" fontSize="xs" fontFamily="mono">
                                    {pubkey.scriptType}
                                  </Text>
                                </HStack>
                              )}
                            </VStack>
                          </Box>
                        );
                      })}
                    </VStack>
                  </VStack>
                )}

                {/* Explorer Links */}
                {assetContext.explorer && (
                  <VStack align="stretch" gap={3}>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium">
                      Explorer Links
                    </Text>
                    <HStack gap={2}>
                      <Button
                        size="sm"
                        variant="outline"
                        color={theme.gold}
                        borderColor={theme.border}
                        _hover={{
                          bg: 'rgba(255, 215, 0, 0.1)',
                          borderColor: theme.gold,
                        }}
                        onClick={() => window.open(assetContext.explorer, '_blank')}
                        flex="1"
                      >
                        View Explorer
                      </Button>
                      {assetContext.pubkeys?.[0] && (
                        <Button
                          size="sm"
                          variant="outline"
                          color={theme.gold}
                          borderColor={theme.border}
                          _hover={{
                            bg: 'rgba(255, 215, 0, 0.1)',
                            borderColor: theme.gold,
                          }}
                          onClick={() => {
                            // For UTXO coins, use XPUB explorer if available
                            if (assetContext.networkId?.startsWith('bip122:') && assetContext.explorerXpubLink) {
                              window.open(`${assetContext.explorerXpubLink}${assetContext.pubkeys[0].pubkey}`, '_blank');
                            } else {
                              // Fallback to address explorer
                              window.open(`${assetContext.explorerAddressLink}${assetContext.pubkeys[0].address}`, '_blank');
                            }
                          }}
                          flex="1"
                        >
                          TX History
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                )}

                {/* Add Path Button */}
                <Button
                  width="100%"
                  size="md"
                  bg={theme.cardBg}
                  color="#9F7AEA"
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(159, 122, 234, 0.1)',
                    borderColor: '#9F7AEA',
                  }}
                  onClick={() => setIsAddPathDialogOpen(true)}
                >
                  <Flex gap={2} align="center">
                    <FaPlus />
                    <Text>Add Path</Text>
                  </Flex>
                </Button>
              </VStack>
            </Box>
          )}
        </Flex>

        {/* Asset Details Section - Collapsed/Mobile version */}
        <Box 
          bg={theme.cardBg}
          borderRadius="2xl"
          overflow="hidden"
          borderColor={theme.border}
          borderWidth="1px"
          mt={6}
          display={{ base: 'block', lg: isDetailsExpanded ? 'none' : 'block' }}
        >
          {/* Clickable header */}
          <Flex 
            p={4} 
            borderBottom={isDetailsExpanded ? "1px" : "none"} 
            borderColor={theme.border}
            justifyContent="space-between"
            alignItems="center"
            onClick={toggleDetails}
            cursor="pointer"
            _hover={{
              bg: 'rgba(255, 215, 0, 0.05)',
            }}
            transition="background 0.2s"
          >
            <Text color={theme.gold} fontSize="lg" fontWeight="bold">
              Asset Details
            </Text>
            <Box color={theme.gold}>
              {isDetailsExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
            </Box>
          </Flex>
          
          {/* Collapsible content */}
          {isDetailsExpanded && (
            <VStack align="stretch" p={4} gap={4}>
              {/* Network Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Network Information
                </Text>
                <HStack justify="space-between">
                  <Text color="gray.400">Type</Text>
                  <Text color="white">{assetContext.isToken ? 'Token' : 'Native Asset'}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Network</Text>
                  <Text color="white">{assetContext.networkName || assetContext.networkId?.split(':').pop()}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Chain ID</Text>
                  <Text color="white" fontSize="sm" fontFamily="mono">
                    {assetContext.chainId}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">CAIP</Text>
                  <Text 
                    color="white" 
                    fontSize="sm" 
                    fontFamily="mono"
                    title={assetContext.caip || assetContext.assetId}
                    cursor="help"
                    _hover={{
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted'
                    }}
                  >
                    {middleEllipsis(assetContext.caip || assetContext.assetId, 16)}
                  </Text>
                </HStack>
              </VStack>

              {/* Asset Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Asset Information
                </Text>
                <HStack justify="space-between">
                  <Text color="gray.400">Precision</Text>
                  <Text color="white">{assetContext.precision}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Price</Text>
                  <Text color="white">
                    $<CountUp 
                      key={`price-${lastSync}`}
                      end={priceUsd} 
                      decimals={2}
                      duration={1.5}
                      separator=","
                    />
                  </Text>
                </HStack>
              </VStack>

              {/* Address Info - Show ALL pubkeys with paths */}
              {assetContext.pubkeys && assetContext.pubkeys.length > 0 && (
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Wallet Information ({assetContext.pubkeys.length} {assetContext.pubkeys.length === 1 ? 'Pubkey' : 'Pubkeys'})
                  </Text>
                  <VStack align="stretch" gap={3}>
                    {assetContext.pubkeys.map((pubkey: any, index: number) => {
                      // Determine the correct XPUB label based on path or script type
                      let xpubLabel = 'XPUB';
                      const isUtxo = assetContext.networkId?.startsWith('bip122:');

                      if (isUtxo) {
                        // Check path for address type indicators
                        if (pubkey.path?.includes("84'") || pubkey.scriptType === 'p2wpkh') {
                          xpubLabel = 'ZPUB'; // Native SegWit
                        } else if (pubkey.path?.includes("49'") || pubkey.scriptType === 'p2sh-p2wpkh') {
                          xpubLabel = 'YPUB'; // P2SH-wrapped SegWit
                        } else if (pubkey.path?.includes("86'")) {
                          xpubLabel = 'XPUB'; // Taproot
                        }
                      }

                      // Check if this is the selected address
                      const isSelected = selectedAddress && (
                        pubkey.address === selectedAddress ||
                        pubkey.pubkey === selectedAddress
                      );

                      return (
                        <Box
                          key={`pubkey-mobile-${index}-${pubkey.pubkey || pubkey.address}`}
                          p={3}
                          bg={theme.bg}
                          borderRadius="lg"
                          borderWidth="2px"
                          borderColor={isSelected ? theme.gold : theme.border}
                          transition="all 0.2s"
                          cursor="pointer"
                          onClick={async () => {
                            const addressToSelect = pubkey.address || pubkey.pubkey;
                            setSelectedAddress(addressToSelect);
                            console.log('🔑 [Asset] Selected pubkey (mobile):', addressToSelect, pubkey);

                            // Set pubkey context in Pioneer SDK for transactions
                            if (app?.setPubkeyContext) {
                              try {
                                await app.setPubkeyContext(pubkey);
                                console.log('✅ [Asset] Pubkey context set in Pioneer SDK (mobile):', pubkey);
                              } catch (error) {
                                console.error('❌ [Asset] Error setting pubkey context (mobile):', error);
                              }
                            }
                          }}
                          _hover={{
                            borderColor: theme.gold,
                            bg: 'rgba(255, 215, 0, 0.05)',
                          }}
                        >
                          <VStack align="stretch" gap={2}>
                            {/* Header with index */}
                            <Flex justify="space-between" align="center">
                              <Badge
                                colorScheme={isSelected ? "yellow" : "gray"}
                                variant="subtle"
                                fontSize="xs"
                              >
                                {isUtxo ? xpubLabel : 'Address'} #{index + 1}
                              </Badge>
                              {isSelected && (
                                <Badge colorScheme="yellow" fontSize="xs">
                                  Selected
                                </Badge>
                              )}
                            </Flex>

                            {/* Pubkey or Address */}
                            <Box position="relative">
                              <Flex justify="space-between" align="flex-start" gap={2}>
                                <Box flex="1">
                                  <Text color="gray.400" fontSize="xs" mb={1}>
                                    {isUtxo ? 'Public Key' : 'Address'}
                                  </Text>
                                  <Text color="white" fontSize="xs" fontFamily="mono" wordBreak="break-all" pr={8}>
                                    {isUtxo ? pubkey.pubkey : pubkey.address}
                                  </Text>
                                </Box>
                                <IconButton
                                  aria-label="Copy to clipboard"
                                  icon={copiedItems[`pubkey-mobile-${index}-main`] ? <FaCheck /> : <FaCopy />}
                                  size="xs"
                                  variant="ghost"
                                  colorScheme={copiedItems[`pubkey-mobile-${index}-main`] ? "green" : "gray"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(isUtxo ? pubkey.pubkey : pubkey.address, `pubkey-mobile-${index}-main`);
                                  }}
                                  _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                                />
                              </Flex>
                            </Box>

                            {/* Path - Always show if available */}
                            {(pubkey.path || pubkey.pathMaster) && (
                              <HStack justify="space-between">
                                <Text color="gray.400" fontSize="xs">Path</Text>
                                <Text color={theme.gold} fontSize="xs" fontFamily="mono">
                                  {pubkey.path || pubkey.pathMaster}
                                </Text>
                              </HStack>
                            )}

                            {/* Address for UTXO (if different from pubkey) */}
                            {isUtxo && pubkey.address && (
                              <Box position="relative">
                                <Flex justify="space-between" align="flex-start" gap={2}>
                                  <Box flex="1">
                                    <Text color="gray.400" fontSize="xs" mb={1}>
                                      Address
                                    </Text>
                                    <Text color="white" fontSize="xs" fontFamily="mono" wordBreak="break-all" pr={8}>
                                      {pubkey.address}
                                    </Text>
                                  </Box>
                                  <IconButton
                                    aria-label="Copy address to clipboard"
                                    icon={copiedItems[`pubkey-mobile-${index}-address`] ? <FaCheck /> : <FaCopy />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme={copiedItems[`pubkey-mobile-${index}-address`] ? "green" : "gray"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(pubkey.address, `pubkey-mobile-${index}-address`);
                                    }}
                                    _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                                  />
                                </Flex>
                              </Box>
                            )}

                            {/* Script Type for UTXO */}
                            {isUtxo && pubkey.scriptType && (
                              <HStack justify="space-between">
                                <Text color="gray.400" fontSize="xs">Script Type</Text>
                                <Text color="white" fontSize="xs" fontFamily="mono">
                                  {pubkey.scriptType}
                                </Text>
                              </HStack>
                            )}
                          </VStack>
                        </Box>
                      );
                    })}
                  </VStack>
                </VStack>
              )}

              {/* Explorer Links */}
              {assetContext.explorer && (
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Explorer Links
                  </Text>
                  <HStack gap={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      color={theme.gold}
                      borderColor={theme.border}
                      _hover={{
                        bg: 'rgba(255, 215, 0, 0.1)',
                        borderColor: theme.gold,
                      }}
                      onClick={() => window.open(assetContext.explorer, '_blank')}
                      flex="1"
                    >
                      View Explorer
                    </Button>
                    {assetContext.pubkeys?.[0] && (
                      <Button
                        size="sm"
                        variant="outline"
                        color={theme.gold}
                        borderColor={theme.border}
                        _hover={{
                          bg: 'rgba(255, 215, 0, 0.1)',
                          borderColor: theme.gold,
                        }}
                        onClick={() => {
                          // For UTXO coins, use XPUB explorer if available
                          if (assetContext.networkId?.startsWith('bip122:') && assetContext.explorerXpubLink) {
                            window.open(`${assetContext.explorerXpubLink}${assetContext.pubkeys[0].pubkey}`, '_blank');
                          } else {
                            // Fallback to address explorer
                            window.open(`${assetContext.explorerAddressLink}${assetContext.pubkeys[0].address}`, '_blank');
                          }
                        }}
                        flex="1"
                      >
                        {assetContext.networkId?.startsWith('bip122:') ? 'View XPUB' : 'View Address'}
                      </Button>
                    )}
                  </HStack>
                </VStack>
              )}

              {/* Add Path Button - Mobile/Collapsed Version */}
              <Button
                width="100%"
                size="md"
                bg={theme.cardBg}
                color="#9F7AEA"
                borderColor={theme.border}
                borderWidth="1px"
                _hover={{
                  bg: 'rgba(159, 122, 234, 0.1)',
                  borderColor: '#9F7AEA',
                }}
                onClick={() => setIsAddPathDialogOpen(true)}
              >
                <Flex gap={2} align="center">
                  <FaPlus />
                  <Text>Add Path</Text>
                </Flex>
              </Button>
            </VStack>
          )}
        </Box>

        {/* Cosmos Staking Section */}
        <CosmosStaking assetContext={assetContext} />

        {/* EVM Tokens Section */}
        {(() => {
          // Filter tokens for the current network from app.balances
          const networkTokens = app?.balances?.filter((balance: any) =>
            balance.networkId === assetContext.networkId &&
            balance.token === true &&
            parseFloat(balance.balance || '0') > 0
          ) || [];

          // Sort by USD value
          networkTokens.sort((a: any, b: any) => {
            const valueA = parseFloat(a.valueUsd || 0);
            const valueB = parseFloat(b.valueUsd || 0);
            return valueB - valueA;
          });

          if (networkTokens.length === 0) return null;

          return (
            <Box
              bg={theme.cardBg}
              borderRadius="2xl"
              overflow="hidden"
              borderColor={theme.border}
              borderWidth="1px"
              mt={6}
            >
              <Box p={4} borderBottom="1px" borderColor={theme.border}>
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Tokens on {assetContext.symbol} Network ({networkTokens.length})
                </Text>
              </Box>

              <VStack align="stretch" p={4} gap={3}>
                {networkTokens.map((token: any, index: number) => {
                  const tokenValueUsd = parseFloat(token.valueUsd || 0);
                  const tokenBalance = parseFloat(token.balance || 0);

                  return (
                    <Box
                      key={`${token.caip}-${index}`}
                      p={4}
                      bg={theme.bg}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor={theme.border}
                      _hover={{
                        borderColor: theme.gold,
                        bg: 'rgba(255, 215, 0, 0.05)',
                      }}
                      transition="all 0.2s"
                      cursor="pointer"
                      onClick={() => {
                        console.log('🪙 [Asset] Token clicked:', token);
                        router.push(`/asset/${btoa(token.caip)}`);
                      }}
                    >
                      <Flex justify="space-between" align="center">
                        <HStack gap={3}>
                          <Box
                            borderRadius="full"
                            overflow="hidden"
                            boxSize="40px"
                            bg={theme.cardBg}
                            borderWidth="1px"
                            borderColor={theme.border}
                          >
                            <IconWithFallback
                              src={token.icon}
                              alt={token.name || token.symbol}
                              boxSize="40px"
                              color={theme.gold}
                            />
                          </Box>
                          <VStack align="flex-start" gap={0}>
                            <Text fontSize="md" fontWeight="bold" color="white">
                              {token.symbol || 'Unknown'}
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                              {token.name || 'Unknown Token'}
                            </Text>
                          </VStack>
                        </HStack>

                        <VStack align="flex-end" gap={0}>
                          <Text fontSize="md" color={theme.gold} fontWeight="medium">
                            ${formatUsd(tokenValueUsd)}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {tokenBalance.toFixed(6)} {token.symbol}
                          </Text>
                        </VStack>
                      </Flex>
                    </Box>
                  );
                })}
              </VStack>
            </Box>
          );
        })()}
      </Box>
      
      {/* Report Dialog */}
      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        assetContext={assetContext}
      />

      {/* Add Path Dialog */}
      <AddPathDialog
        isOpen={isAddPathDialogOpen}
        onClose={() => setIsAddPathDialogOpen(false)}
        assetContext={assetContext}
      />

      {/* Custom Token Dialog */}
      <CustomTokenDialog
        isOpen={isCustomTokenDialogOpen}
        onClose={() => setIsCustomTokenDialogOpen(false)}
        onAddToken={async (token) => {
          const result = await addCustomToken(token);
          if (result.success) {
            // Refresh charts to show the new token
            await refreshCustomTokens();
          }
          return result;
        }}
        onRemoveToken={async (networkId, tokenAddress) => {
          const success = await removeCustomToken(networkId, tokenAddress);
          if (success) {
            // Refresh charts after removing token
            await refreshCustomTokens();
          }
        }}
        customTokens={customTokens}
        defaultNetwork={assetContext?.networkId}
      />
    </Box>
  );
};

export default Asset; 