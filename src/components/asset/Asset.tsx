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
import { BalanceDistribution } from '../balance/BalanceDistribution';
import { aggregateBalances, AggregatedBalance } from '@/types/balance';
import { ReportDialog } from './ReportDialog';
import { AddPathDialog } from './AddPathDialog';
import { CustomTokenDialog } from './CustomTokenDialog';
import { useCustomTokens } from '@/hooks/useCustomTokens';
import { DappStore } from './DappStore';
import { getPoolByCAIP } from '@/config/thorchain-pools';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { isFeatureEnabled } from '@/config/features';

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
  caip: string; // The CAIP identifier for this asset
  onBackClick?: () => void;
  onSendClick?: () => void;
  onReceiveClick?: () => void;
  onSwapClick?: () => void;
}

export const Asset = ({ caip, onBackClick, onSendClick, onReceiveClick, onSwapClick }: AssetProps) => {
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
  // Store the computed asset data locally
  const [assetContext, setAssetContext] = useState<any>(null);

  // Custom tokens hook
  const { customTokens, addCustomToken, removeCustomToken, refreshCustomTokens } = useCustomTokens();
  // Add state for tracking copied addresses/pubkeys
  const [copiedItems, setCopiedItems] = useState<{[key: string]: boolean}>({});
  // Add state for refreshing charts
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Track which networks have been scanned to avoid duplicate token discovery
  const [scannedNetworks, setScannedNetworks] = useState<Set<string>>(new Set());

  // Access pioneer context in the same way as the Dashboard component
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

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

  // Fetch asset data based on CAIP prop
  useEffect(() => {
    console.log('🎯 [Asset] Component mounted with CAIP:', caip);

    // Reset state when CAIP changes
    setLoading(true);
    setSelectedAddress(null);
    setIsInitialLoad(true);

    // Clear old asset context in Pioneer SDK to prevent stale data
    if (app?.clearAssetContext) {
      app.clearAssetContext();
      console.log('🗑️ [Asset] Cleared old asset context from Pioneer SDK');
    }

    // Wait for app to be ready
    if (!app || !app.balances || !app.pubkeys) {
      console.log('⏳ [Asset] Waiting for app to be ready...');
      return;
    }

    console.log('🔍 [Asset] Fetching data for CAIP:', caip);

    // Quick check if this is a token
    const isCacaoNative = caip.includes('mayachain') && caip.includes('slip44:931');
    const isToken = !isCacaoNative && (caip.includes('/denom:') || caip.includes('/ibc:') || caip.includes('erc20') || caip.includes('eip721') || /0x[a-fA-F0-9]{40}/.test(caip));

    if (isToken) {
      // Handle token case
      console.log('🪙 [Asset] Loading token data');
      const tokenBalance = app.balances?.find((balance: any) => balance.caip === caip);

      if (!tokenBalance) {
        console.error('⚠️ [Asset] Token not found:', caip);
        setLoading(false);
        return;
      }

      // Determine the network this token belongs to
      let tokenNetworkId = '';
      if (caip.includes('MAYA.') || caip.includes('cosmos:mayachain-mainnet-v1')) {
        tokenNetworkId = 'cosmos:mayachain-mainnet-v1';
      } else if (caip.includes('THOR.') || caip.includes('cosmos:thorchain-mainnet-v1')) {
        tokenNetworkId = 'cosmos:thorchain-mainnet-v1';
      } else if (caip.includes('OSMO.') || caip.includes('cosmos:osmosis-1')) {
        tokenNetworkId = 'cosmos:osmosis-1';
      } else if (caip.includes('eip155:')) {
        const parts = caip.split('/');
        tokenNetworkId = parts[0];
      } else if (caip.includes('cosmos:')) {
        const parts = caip.split('/');
        tokenNetworkId = parts[0];
      }

      // Map network to native asset
      const nativeAssetMap: { [key: string]: { caip: string, symbol: string } } = {
        'cosmos:mayachain-mainnet-v1': { caip: 'cosmos:mayachain-mainnet-v1/slip44:931', symbol: 'CACAO' },
        'cosmos:thorchain-mainnet-v1': { caip: 'cosmos:thorchain-mainnet-v1/slip44:931', symbol: 'RUNE' },
        'cosmos:osmosis-1': { caip: 'cosmos:osmosis-1/slip44:118', symbol: 'OSMO' },
        'eip155:1': { caip: 'eip155:1/slip44:60', symbol: 'ETH' },
        'eip155:137': { caip: 'eip155:137/slip44:60', symbol: 'MATIC' },
        'eip155:43114': { caip: 'eip155:43114/slip44:60', symbol: 'AVAX' },
        'eip155:56': { caip: 'eip155:56/slip44:60', symbol: 'BNB' },
        'eip155:8453': { caip: 'eip155:8453/slip44:60', symbol: 'ETH' },
        'eip155:10': { caip: 'eip155:10/slip44:60', symbol: 'ETH' },
        'eip155:42161': { caip: 'eip155:42161/slip44:60', symbol: 'ETH' },
      };

      const nativeAssetInfo = nativeAssetMap[tokenNetworkId];
      let nativeBalance = '0';
      let nativeSymbol = nativeAssetInfo?.symbol || 'GAS';

      if (nativeAssetInfo) {
        const nativeAssetBalance = app.balances?.find((balance: any) => balance.caip === nativeAssetInfo.caip);
        if (nativeAssetBalance) {
          nativeBalance = nativeAssetBalance.balance;
        }
      }

      // Get explorer info from assetsMap or fallback to network-specific defaults
      const assetInfo = app.assetsMap?.get(caip);
      const networkAssetInfo = app.assetsMap?.get(tokenNetworkId);

      // Set token asset context
      const tokenAssetContextData = {
        networkId: tokenNetworkId,
        chainId: tokenNetworkId,
        assetId: caip,
        caip: caip,
        name: tokenBalance.name || tokenBalance.symbol || tokenBalance.ticker || 'TOKEN',
        networkName: tokenNetworkId.split(':').pop() || '',
        symbol: tokenBalance.ticker || tokenBalance.symbol || 'TOKEN',
        icon: tokenBalance.icon || tokenBalance.image || '',
        color: tokenBalance.color || '#FFD700',
        balance: tokenBalance.balance || '0',
        value: tokenBalance.valueUsd || tokenBalance.value || 0,
        precision: tokenBalance.precision || 18,
        priceUsd: parseFloat(tokenBalance.priceUsd || tokenBalance.price || 0),
        isToken: true,
        type: 'token',
        nativeBalance: nativeBalance,
        nativeSymbol: nativeSymbol,
        explorer: assetInfo?.explorer || networkAssetInfo?.explorer,
        explorerAddressLink: assetInfo?.explorerAddressLink || networkAssetInfo?.explorerAddressLink,
        explorerTxLink: assetInfo?.explorerTxLink || networkAssetInfo?.explorerTxLink,
        pubkeys: (app.pubkeys || []).filter((p: any) => p.networks.includes(tokenNetworkId))
      };

      console.log('✅ [Asset] Token data loaded:', tokenAssetContextData);
      setAssetContext(tokenAssetContextData);
      setPreviousBalance(tokenAssetContextData.balance);

      // Set asset context in Pioneer SDK for Send/Receive/Swap components
      // Remove custom UI-only fields (nativeBalance, nativeSymbol) before passing to SDK
      if (app?.setAssetContext) {
        const { nativeBalance: _nb, nativeSymbol: _ns, ...sdkContext } = tokenAssetContextData;
        app.setAssetContext(sdkContext).then(() => {
          console.log('✅ [Asset] Token asset context set in Pioneer SDK');
        }).catch((error: any) => {
          console.error('❌ [Asset] Error setting token asset context:', error);
        });
      }

      setLoading(false);
      return;
    }

    // Handle native asset case
    console.log('💎 [Asset] Loading native asset data');

    // Parse the CAIP
    let networkId: string = caip;
    let assetType: string = '';

    if (caip.includes('/')) {
      const parts = caip.split('/');
      networkId = parts[0];
      assetType = parts[1];
    }

    // Find the balance
    let nativeAssetBalance = null;

    // Special case for ETH
    if (caip === 'eip155:1/slip44:60') {
      nativeAssetBalance = app.balances?.find((balance: any) =>
        balance.caip === caip &&
        balance.name !== 'eETH' &&
        balance.appId !== 'ether-fi' &&
        (!balance.appId || balance.appId === 'native' || balance.appId === 'ethereum')
      );
    } else {
      nativeAssetBalance = app.balances?.find((balance: any) =>
        balance.caip === caip &&
        (!balance.appId || balance.appId === 'native' || balance.appId === 'ethereum')
      );
    }

    if (!nativeAssetBalance) {
      nativeAssetBalance = app.balances?.find((balance: any) => balance.caip === caip);
    }

    // CRITICAL FIX: If no balance found (zero balance case), create placeholder from assetsMap
    if (!nativeAssetBalance) {
      console.warn('⚠️ [Asset] Native asset not found in balances, creating zero-balance placeholder:', caip);

      // Get asset metadata from assetsMap
      const assetInfo = app.assetsMap?.get(caip) || app.assetsMap?.get(caip.toLowerCase());

      if (!assetInfo) {
        console.error('❌ [Asset] Asset metadata not found in assetsMap:', caip);
        setLoading(false);
        return;
      }

      // Create zero-balance placeholder with all required fields
      nativeAssetBalance = {
        caip: caip,
        ...assetInfo,
        balance: '0',
        valueUsd: '0',
        price: 0,
        priceUsd: 0,
        networkId: networkId,
        identifier: `${caip}:zero-balance`,
        isZeroBalance: true, // Flag to indicate this is a placeholder
        fetchedAt: Date.now(),
        fetchedAtISO: new Date().toISOString(),
        isStale: false
      };

      console.log('✅ [Asset] Created zero-balance placeholder:', nativeAssetBalance);
    }

    // CRITICAL FIX: For CACAO, override symbol
    const isCacao = caip.includes('mayachain') && caip.includes('slip44:931');

    console.log('🔍 [Asset] nativeAssetBalance source data:', nativeAssetBalance);
    console.log('⏰ [Asset] Source timestamp fields:', {
      fetchedAt: nativeAssetBalance.fetchedAt,
      fetchedAtISO: nativeAssetBalance.fetchedAtISO,
      isStale: nativeAssetBalance.isStale
    });

    const assetContextData = {
      ...nativeAssetBalance,
      caip: caip,
      ...(isCacao && { symbol: 'CACAO' }),
      // CRITICAL FIX: Add pubkeys for balance aggregation across all addresses
      pubkeys: (app.pubkeys || []).filter((p: any) => p.networks.includes(networkId))
    };

    console.log('✅ [Asset] Native asset data loaded:', assetContextData);
    console.log('🔑 [Asset] Pubkeys for aggregation:', assetContextData.pubkeys?.length || 0);
    console.log('⏰ [Asset] Timestamp fields:', {
      fetchedAt: assetContextData.fetchedAt,
      fetchedAtISO: assetContextData.fetchedAtISO,
      isStale: assetContextData.isStale
    });
    setAssetContext(assetContextData);
    setPreviousBalance(assetContextData.balance);

    // Set asset context in Pioneer SDK for Send/Receive/Swap components
    // Remove custom UI-only fields before passing to SDK
    if (app?.setAssetContext) {
      const { nativeBalance: _nb, nativeSymbol: _ns, ...sdkContext } = assetContextData;
      app.setAssetContext(sdkContext).then(() => {
        console.log('✅ [Asset] Native asset context set in Pioneer SDK');
      }).catch((error: any) => {
        console.error('❌ [Asset] Error setting native asset context:', error);
      });
    }

    setLoading(false);
  }, [caip, app]);

  // Set up interval to sync market data every 15 seconds
  // SKIP interval when custom token dialog is open to prevent state refresh from closing the dialog
  useEffect(() => {
    if (!app || isCustomTokenDialogOpen) {
      console.log("⏸️ [Asset] Skipping syncMarket interval - dialog open or app not ready");
      return;
    }

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
  }, [app, previousBalance, isInitialLoad, isCustomTokenDialogOpen]);

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

  // Handle Send button click - ensure asset context is set before switching views
  const handleSendClick = async () => {
    console.log('📤 [Asset] Send button clicked, ensuring asset context is set');

    if (app?.setAssetContext && assetContext) {
      try {
        // Remove custom UI-only fields before passing to SDK
        const { nativeBalance: _nb, nativeSymbol: _ns, ...sdkContext } = assetContext;
        await app.setAssetContext(sdkContext);
        console.log('✅ [Asset] Asset context confirmed set in Pioneer SDK before Send:', assetContext.symbol);
      } catch (error) {
        console.error('❌ [Asset] Error setting asset context before Send:', error);
      }
    }

    // Now call the parent's onSendClick to switch views
    if (onSendClick) {
      onSendClick();
    }
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

  // Force refresh balances with cache busting
  const handleRefreshCharts = async () => {
    if (!assetContext?.networkId) {
      console.error('❌ [Asset] No networkId available');
      return;
    }

    console.log('🔄 [Asset] Force refreshing balances for network:', assetContext.networkId);
    setIsRefreshing(true);
    try {
      if (app && typeof app.getBalances === 'function') {
        console.log('🔄 [Asset] Calling app.getBalances(true) to force cache bust and refresh balances');
        // Pass forceRefresh=true to bypass balance cache and get fresh blockchain data
        await app.getBalances(true);
        console.log('✅ [Asset] Balance refresh completed for', assetContext.networkId);

        // Verify balances were updated
        const assetBalance = app.balances?.find((b: any) =>
          b.networkId === assetContext.networkId && b.isNative
        );
        console.log(`✅ [Asset] Updated balance for ${assetContext.networkId}:`, assetBalance?.balance || '0');

        // Also refresh charts for token discovery (non-blocking)
        if (typeof app.getCharts === 'function') {
          console.log('🔄 [Asset] Also refreshing charts for token discovery...');
          app.getCharts([assetContext.networkId]).catch((err: any) => {
            console.warn('⚠️ [Asset] Token discovery failed (non-critical):', err?.message);
          });
        }
      }
    } catch (error: any) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [Asset] Balance refresh failed:', error);
      console.error('Error details:', {
        message: error?.message,
        type: error?.constructor?.name,
        networkId: assetContext.networkId,
        pioneer: !!app?.pioneer,
        pubkeys: app?.pubkeys?.length || 0
      });
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

  const formatBalance = (balance: string | number, customPrecision?: number) => {
    const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;

    // Use custom precision if provided, otherwise REQUIRE SDK assetContext data
    let decimals: number;
    if (customPrecision !== undefined) {
      decimals = customPrecision;
    } else {
      // CRITICAL: NEVER use fallbacks - fail fast if SDK data missing
      decimals = assetContext.precision ?? assetContext.decimals;

      if (decimals === undefined || decimals === null) {
        const error = `CRITICAL: Asset ${assetContext.symbol || assetContext.caip || 'unknown'} has NO decimals/precision in assetContext! SDK data is missing.`;
        console.error('❌', error, assetContext);
        throw new Error(error);
      }
    }

    return numBalance.toFixed(decimals);
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
              position="relative"
            >
              {/* Last Updated - Top Left */}
              {assetContext.fetchedAtISO && (
                <Box
                  position="absolute"
                  top={4}
                  left={4}
                  zIndex={1}
                >
                  <VStack align="flex-start" gap={0}>
                    <Text fontSize="2xs" color="gray.500" fontWeight="medium">
                      Last Updated
                    </Text>
                    <HStack gap={1}>
                      <Text fontSize="xs" color="gray.300" fontWeight="semibold">
                        {new Date(assetContext.fetchedAtISO).toLocaleTimeString()}
                      </Text>
                      {assetContext.isStale ? (
                        <Box
                          as="span"
                          px={1}
                          py={0.5}
                          borderRadius="sm"
                          bg="orange.900"
                          color="orange.300"
                          fontSize="2xs"
                          fontWeight="medium"
                          border="1px solid"
                          borderColor="orange.700"
                        >
                          ⚠️
                        </Box>
                      ) : (
                        <Box
                          as="span"
                          px={1}
                          py={0.5}
                          borderRadius="sm"
                          bg="green.900"
                          color="green.300"
                          fontSize="2xs"
                          fontWeight="medium"
                          border="1px solid"
                          borderColor="green.700"
                        >
                          ✓
                        </Box>
                      )}
                    </HStack>
                  </VStack>
                </Box>
              )}

              {/* Refresh Button - Top Right */}
              <Button
                size="sm"
                variant="ghost"
                position="absolute"
                top={4}
                right={4}
                color={theme.gold}
                leftIcon={<FaSync />}
                _hover={{
                  color: theme.goldHover,
                  bg: 'rgba(255, 215, 0, 0.1)',
                }}
                onClick={async () => {
                  console.log('🔄 [Asset] Force refresh clicked from card - calling getBalances(true)');
                  setIsRefreshing(true);
                  try {
                    if (app && typeof app.getBalances === 'function') {
                      console.log('🔄 [Asset] Calling app.getBalances(true) to force-refresh balances');
                      await app.getBalances(true); // Force refresh balances with cache bypass
                      console.log('✅ [Asset] Balance refresh completed');

                      // Verify balance was updated
                      const assetBalance = app.balances?.find((b: any) =>
                        b.networkId === assetContext.networkId && b.isNative
                      );
                      console.log(`✅ [Asset] Updated balance for ${assetContext.networkId}:`, assetBalance?.balance || '0');
                    }
                    // Also refresh charts for token discovery (non-blocking)
                    if (assetContext?.networkId && app && typeof app.getCharts === 'function') {
                      console.log('🔄 [Asset] Also refreshing charts for tokens...');
                      app.getCharts([assetContext.networkId]).catch((err: any) => {
                        console.warn('⚠️ [Asset] Token discovery failed (non-critical):', err?.message);
                      });
                    }
                  } catch (error) {
                    console.error('❌ [Asset] Force refresh failed:', error);
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                isLoading={isRefreshing}
                loadingText="Refreshing..."
              >
                Refresh
              </Button>
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
                      opacity={isRefreshing ? 0.5 : 1}
                      transition="opacity 0.3s"
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
                      bottom="-4"
                      right="-4"
                      boxSize="48px"
                      bg="rgba(255, 255, 255, 0.1)"
                      borderRadius="md"
                      boxShadow="0 0 0 3px #000000, 0 0 0 4px rgba(255, 255, 255, 0.2)"
                      p="4px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      opacity={isRefreshing ? 0.5 : 1}
                      transition="opacity 0.3s"
                    >
                      <AssetIcon
                        src={assetContext.icon}
                        caip={assetContext.caip}
                        symbol={assetContext.symbol}
                        alt={`${assetContext.name} Icon`}
                        boxSize="100%"
                        color={assetContext.color || theme.gold}
                      />
                    </Box>

                    {/* Spinner Overlay */}
                    {isRefreshing && (
                      <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        transform="translate(-50%, -50%)"
                        zIndex={10}
                      >
                        <Spinner
                          size="xl"
                          color={theme.gold}
                          thickness="4px"
                          speed="0.8s"
                        />
                      </Box>
                    )}
                  </Box>
                ) : (
                  /* Native Asset Icon */
                  <Box position="relative">
                    <Box
                      borderRadius="full"
                      overflow="hidden"
                      boxSize="80px"
                      bg={theme.cardBg}
                      boxShadow="lg"
                      p={2}
                      borderWidth="1px"
                      borderColor={assetContext.color || theme.border}
                      opacity={isRefreshing ? 0.5 : 1}
                      transition="opacity 0.3s"
                    >
                      <AssetIcon
                        src={assetContext.icon}
                        caip={assetContext.caip}
                        symbol={assetContext.symbol}
                        alt={`${assetContext.name} Icon`}
                        boxSize="100%"
                        color={assetContext.color || theme.gold}
                      />
                    </Box>

                    {/* Spinner Overlay */}
                    {isRefreshing && (
                      <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        transform="translate(-50%, -50%)"
                        zIndex={10}
                      >
                        <Spinner
                          size="xl"
                          color={theme.gold}
                          thickness="4px"
                          speed="0.8s"
                        />
                      </Box>
                    )}
                  </Box>
                )}
                
                <Stack align="center" gap={1}>
                  <Text fontSize="2xl" fontWeight="bold" color="white">
                    {assetContext.name}
                  </Text>
                  <HStack gap={2} align="center">
                    <Text fontSize="md" color="gray.300">
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
                  <Text fontSize="xs" color="gray.400" fontFamily="mono">
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

                  {/* Balance Timestamp */}
                  {assetContext.fetchedAtISO && (
                    <HStack gap={1.5} fontSize="xs" color="gray.500" justify="center">
                      <Text>
                        Updated: {new Date(assetContext.fetchedAtISO).toLocaleTimeString()}
                      </Text>
                      {assetContext.isStale ? (
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

                  {/* Show if balance is aggregated from multiple addresses */}
                  {aggregatedBalance && aggregatedBalance.balances.length > 1 && (
                    <Badge
                      colorScheme="blue"
                      variant="subtle"
                      fontSize="xs"
                      px={2}
                      py={1}
                    >
                      Summed from {aggregatedBalance.balances.length} pubkeys
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
                          {assetContext.nativeBalance ? formatBalance(assetContext.nativeBalance, 18) : '0'} {assetContext.nativeSymbol || 'GAS'}
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
                  onClick={handleSendClick}
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
              {isFeatureEnabled('enableSwaps') && getPoolByCAIP(assetContext.caip) && (
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
              {/* Only show Custom Tokens button for EVM networks (eip155) */}
              {assetContext.caip?.includes('eip155') && (
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
              )}
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

                {/* Data Source Info */}
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Data Source
                  </Text>
                  {assetContext.fetchedAtISO && (
                    <HStack justify="space-between">
                      <Text color="gray.400">Last Fetched</Text>
                      <HStack gap={1}>
                        <Text color="white" fontSize="sm">
                          {new Date(assetContext.fetchedAtISO).toLocaleString()}
                        </Text>
                        {assetContext.isStale ? (
                          <Box
                            as="span"
                            px={1}
                            py={0.5}
                            borderRadius="sm"
                            bg="orange.900"
                            color="orange.300"
                            fontSize="2xs"
                            fontWeight="medium"
                          >
                            Stale
                          </Box>
                        ) : (
                          <Box
                            as="span"
                            px={1}
                            py={0.5}
                            borderRadius="sm"
                            bg="green.900"
                            color="green.300"
                            fontSize="2xs"
                            fontWeight="medium"
                          >
                            Fresh
                          </Box>
                        )}
                      </HStack>
                    </HStack>
                  )}
                  {assetContext.dataSource && (
                    <HStack justify="space-between" align="flex-start">
                      <Text color="gray.400">Blockchain Node</Text>
                      <Text
                        color="white"
                        fontSize="xs"
                        fontFamily="mono"
                        textAlign="right"
                        maxW="60%"
                        wordBreak="break-all"
                      >
                        {(() => {
                          // Mask any API keys in the URL
                          const maskApiKeys = (url: string) => {
                            return url
                              .replace(/apikey=[^&]+/gi, 'apikey=***')
                              .replace(/key=[^&]+/gi, 'key=***')
                              .replace(/token=[^&]+/gi, 'token=***');
                          };
                          return maskApiKeys(assetContext.dataSource);
                        })()}
                      </Text>
                    </HStack>
                  )}
                  <HStack justify="space-between" align="flex-start">
                    <Text color="gray.400">Cache Status</Text>
                    <Text color="white" fontSize="sm">
                      {assetContext.isStale ? 'Needs Refresh' : 'Valid'}
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

                              {/* TX History Button */}
                              {assetContext.explorer && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  color={theme.gold}
                                  borderColor={theme.border}
                                  width="100%"
                                  mt={2}
                                  _hover={{
                                    bg: 'rgba(255, 215, 0, 0.1)',
                                    borderColor: theme.gold,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // For UTXO coins, use XPUB explorer if available
                                    if (assetContext.networkId?.startsWith('bip122:') && assetContext.explorerXpubLink) {
                                      window.open(`${assetContext.explorerXpubLink}${pubkey.pubkey}`, '_blank');
                                    } else {
                                      // Fallback to address explorer
                                      window.open(`${assetContext.explorerAddressLink}${pubkey.address}`, '_blank');
                                    }
                                  }}
                                >
                                  TX History
                                </Button>
                              )}
                            </VStack>
                          </Box>
                        );
                      })}
                    </VStack>
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

              {/* Data Source Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Data Source
                </Text>
                {assetContext.fetchedAtISO && (
                  <HStack justify="space-between">
                    <Text color="gray.400">Last Fetched</Text>
                    <HStack gap={1}>
                      <Text color="white" fontSize="sm">
                        {new Date(assetContext.fetchedAtISO).toLocaleString()}
                      </Text>
                      {assetContext.isStale ? (
                        <Box
                          as="span"
                          px={1}
                          py={0.5}
                          borderRadius="sm"
                          bg="orange.900"
                          color="orange.300"
                          fontSize="2xs"
                          fontWeight="medium"
                        >
                          Stale
                        </Box>
                      ) : (
                        <Box
                          as="span"
                          px={1}
                          py={0.5}
                          borderRadius="sm"
                          bg="green.900"
                          color="green.300"
                          fontSize="2xs"
                          fontWeight="medium"
                        >
                          Fresh
                        </Box>
                      )}
                    </HStack>
                  </HStack>
                )}
                {assetContext.dataSource && (
                  <HStack justify="space-between" align="flex-start">
                    <Text color="gray.400">Blockchain Node</Text>
                    <Text
                      color="white"
                      fontSize="xs"
                      fontFamily="mono"
                      textAlign="right"
                      maxW="60%"
                      wordBreak="break-all"
                    >
                      {(() => {
                        // Mask any API keys in the URL
                        const maskApiKeys = (url: string) => {
                          return url
                            .replace(/apikey=[^&]+/gi, 'apikey=***')
                            .replace(/key=[^&]+/gi, 'key=***')
                            .replace(/token=[^&]+/gi, 'token=***');
                        };
                        return maskApiKeys(assetContext.dataSource);
                      })()}
                    </Text>
                  </HStack>
                )}
                <HStack justify="space-between" align="flex-start">
                  <Text color="gray.400">Cache Status</Text>
                  <Text color="white" fontSize="sm">
                    {assetContext.isStale ? 'Needs Refresh' : 'Valid'}
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

                            {/* TX History Button */}
                            {assetContext.explorer && (
                              <Button
                                size="sm"
                                variant="outline"
                                color={theme.gold}
                                borderColor={theme.border}
                                width="100%"
                                mt={2}
                                _hover={{
                                  bg: 'rgba(255, 215, 0, 0.1)',
                                  borderColor: theme.gold,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // For UTXO coins, use XPUB explorer if available
                                  if (assetContext.networkId?.startsWith('bip122:') && assetContext.explorerXpubLink) {
                                    window.open(`${assetContext.explorerXpubLink}${pubkey.pubkey}`, '_blank');
                                  } else {
                                    // Fallback to address explorer
                                    window.open(`${assetContext.explorerAddressLink}${pubkey.address}`, '_blank');
                                  }
                                }}
                              >
                                TX History
                              </Button>
                            )}
                          </VStack>
                        </Box>
                      );
                    })}
                  </VStack>
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

        {/* Tokens Section - Only show for gas assets on non-UTXO networks */}
        {(() => {
          // Only show for gas assets (not tokens themselves)
          if (assetContext.isToken) return null;

          // Only show for non-UTXO networks (EVM and Cosmos chains)
          const isUtxoNetwork = assetContext.networkId?.startsWith('bip122:');
          if (isUtxoNetwork) return null;

          // Determine network type
          const isEvmNetwork = assetContext.networkId?.startsWith('eip155:');
          const isCosmosNetwork = assetContext.networkId?.startsWith('cosmos:');

          // Helper function to determine if a balance is a token (same logic as Dashboard)
          const isTokenBalance = (balance: any): boolean => {
            // Check explicit type first
            if (balance.type === 'token') return true;

            // Check explicit token flags
            if (balance.token === true || balance.isToken === true) return true;

            // Check if it has a contract address (ERC20, BEP20, etc.)
            if (balance.contract) return true;

            return false;
          };

          // Filter tokens for the current network from app.balances
          const networkTokens = app?.balances?.filter((balance: any) =>
            balance.networkId === assetContext.networkId &&
            isTokenBalance(balance) &&
            parseFloat(balance.balance || '0') > 0
          ) || [];

          // Sort by USD value
          networkTokens.sort((a: any, b: any) => {
            const valueA = parseFloat(a.valueUsd || 0);
            const valueB = parseFloat(b.valueUsd || 0);
            return valueB - valueA;
          });

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
                <Flex justify="space-between" align="center">
                  <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                    {isEvmNetwork ? 'ERC-20 Tokens' : isCosmosNetwork ? 'IBC Tokens' : 'Tokens'} ({networkTokens.length})
                  </Text>
                  <IconButton
                    aria-label="Refresh tokens"
                    icon={<FaSync />}
                    size="sm"
                    variant="ghost"
                    color={theme.gold}
                    isLoading={isRefreshing}
                    onClick={handleRefreshCharts}
                    _hover={{
                      bg: 'rgba(255, 215, 0, 0.1)',
                      color: theme.goldHover,
                    }}
                  />
                </Flex>
              </Box>

              <VStack align="stretch" p={4} gap={3}>
                {networkTokens.length > 0 ? (
                  networkTokens.map((token: any, index: number) => {
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
                          console.log('🪙 [Asset] Navigating to token page:', token);

                          // Use the token's CAIP for navigation
                          const caip = token.caip;

                          console.log('🪙 [Asset] Using token CAIP for navigation:', caip);
                          console.log('🪙 [Asset] Token object:', token);

                          // Use Base64 encoding for complex IDs to avoid URL encoding issues
                          const encodedCaip = btoa(caip);

                          console.log('🪙 [Asset] Encoded token parameters:', { encodedCaip });

                          // Navigate using encoded parameters to the simplified route
                          router.push(`/asset/${encodedCaip}`);
                        }}
                      >
                        <Flex justify="space-between" align="center">
                          <HStack gap={3}>
                            <AssetIcon
                              src={token.icon}
                              caip={token.caip}
                              symbol={token.symbol}
                              alt={token.name || token.symbol}
                              boxSize="40px"
                              color={theme.gold}
                            />
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
                  })
                ) : (
                  <VStack align="center" gap={4} py={8}>
                    <Box
                      w="60px"
                      h="60px"
                      borderRadius="full"
                      bg="rgba(255, 215, 0, 0.1)"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <FaCoins color={theme.gold} size="24px" />
                    </Box>
                    <VStack gap={2}>
                      <Text fontSize="md" fontWeight="medium" color="white">
                        No Tokens Found
                      </Text>
                      <Text fontSize="sm" color="gray.400" textAlign="center" maxW="sm">
                        {isEvmNetwork
                          ? "You don't have any ERC-20 tokens on this network yet. Click 'Discover' to scan for tokens or add custom tokens."
                          : isCosmosNetwork
                          ? "You don't have any IBC tokens on this network yet. Click 'Discover' to scan for tokens."
                          : "You don't have any tokens on this network yet."}
                      </Text>
                    </VStack>
                    <HStack gap={3}>
                      <Button
                        size="md"
                        bg={theme.cardBg}
                        color={theme.gold}
                        borderColor={theme.border}
                        borderWidth="1px"
                        _hover={{
                          bg: 'rgba(255, 215, 0, 0.1)',
                          borderColor: theme.gold,
                        }}
                        onClick={handleRefreshCharts}
                        isLoading={isRefreshing}
                        leftIcon={<FaSync />}
                      >
                        Discover Tokens
                      </Button>
                      {isEvmNetwork && (
                        <Button
                          size="md"
                          bg={theme.cardBg}
                          color="#23DCC8"
                          borderColor={theme.border}
                          borderWidth="1px"
                          _hover={{
                            bg: 'rgba(35, 220, 200, 0.1)',
                            borderColor: '#23DCC8',
                          }}
                          onClick={() => setIsCustomTokenDialogOpen(true)}
                          leftIcon={<FaPlus />}
                        >
                          Add Custom Token
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                )}
              </VStack>
            </Box>
          );
        })()}

        {/* Dapps Section - Show for all networks that support dapps */}
        {assetContext.networkId && (
          <DappStore networkId={assetContext.networkId} />
        )}
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
        onTokenAdded={(caip: string) => {
          // ✨ AUTO-NAVIGATE: When token metadata is validated, immediately navigate to the token's asset page
          console.log('🚀 [Asset] Received token added callback, navigating to:', caip);

          // Close the dialog
          setIsCustomTokenDialogOpen(false);

          // Navigate to the new token's asset page
          const encodedCaip = btoa(caip);
          console.log('🔄 [Asset] Navigating to asset page:', encodedCaip);
          router.push(`/asset/${encodedCaip}`);
        }}
      />
    </Box>
  );
};

export default Asset; 