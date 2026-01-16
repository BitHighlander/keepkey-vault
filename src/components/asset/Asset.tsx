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
import { toaster } from '@/components/ui/toaster';
import { usePioneerContext } from '@/components/providers/pioneer';
import { theme } from '@/lib/theme';
import { chachingSound, playSound } from '@/lib/audio';

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
import { FaTimes, FaChevronDown, FaChevronUp, FaPaperPlane, FaQrcode, FaExchangeAlt, FaFileExport, FaPlus, FaCopy, FaCheck, FaSync, FaCoins, FaList, FaPen } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';
import { CosmosStaking } from './CosmosStaking';
import { SignMessageDialog } from '@/components/receive/SignMessageDialog';
import { bip32ToAddressNList } from '@pioneer-platform/pioneer-coins';
import { BalanceDistribution } from '../balance/BalanceDistribution';
import { aggregateBalances, AggregatedBalance } from '@/types/balance';
import { ReportDialog } from './ReportDialog';
import { AddPathDialog } from './AddPathDialog';
import { CustomTokenDialog } from './CustomTokenDialog';
import { useCustomTokens } from '@/hooks/useCustomTokens';
// @ts-expect-error - Pioneer CAIP utilities
import { networkIdToCaip } from '@pioneer-platform/pioneer-caip';
import { TransactionHistory } from './TransactionHistory';
import { getPoolByCAIP } from '@/config/thorchain-pools';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { isFeatureEnabled } from '@/config/features';

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

  // Helper: Get native asset info for a network
  const getNativeAssetInfo = (networkId: string, balances?: any[]) => {
    try {
      // Get the native CAIP using Pioneer's utility
      const nativeCaip = networkIdToCaip(networkId);

      // Find the native asset balance (if available)
      const nativeBalance = balances?.find((b: any) => b.caip === nativeCaip);

      return {
        caip: nativeCaip,
        symbol: nativeBalance?.symbol || nativeBalance?.ticker || 'GAS',
        priceUsd: nativeBalance?.priceUsd || nativeBalance?.price || '0',
        balance: nativeBalance?.balance || '0'
      };
    } catch (error) {
      console.error('[getNativeAssetInfo] Error getting native asset info:', { networkId, error });
      return {
        caip: networkId,
        symbol: 'GAS',
        priceUsd: '0',
        balance: '0'
      };
    }
  };
  // Add state for refreshing charts
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Track which networks have been scanned to avoid duplicate token discovery
  const [scannedNetworks, setScannedNetworks] = useState<Set<string>>(new Set());
  // Sign Message state
  const [selectedSigningPubkey, setSelectedSigningPubkey] = useState<any>(null);

  // Access pioneer context in the same way as the Dashboard component
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  const router = useRouter();
  // Using toaster from Chakra UI v3

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

      // Find native asset by looking for balances that start with the network ID
      // Native assets don't have contract addresses, just networkId/slip44:*
      let nativeBalance = '0';
      let nativeSymbol = 'GAS';

      console.log('🔍 [Asset] Looking for native gas balance:', {
        tokenNetworkId,
        tokenCaip: caip,
        allBalances: app.balances?.map((b: any) => ({ caip: b.caip, symbol: b.symbol, balance: b.balance }))
      });

      // Debug: Find ALL ETH balances in the array
      const allEthBalances = app.balances?.filter((b: any) =>
        b.caip === 'eip155:1/slip44:60' || b.symbol === 'ETH'
      );
      console.log('🔍 [Asset] ALL ETH balances found:', allEthBalances);

      // CRITICAL FIX: Match native gas balance to the SAME address/pubkey as the token
      const tokenAddress = tokenBalance.address || tokenBalance.pubkey;
      console.log('🔍 [Asset] Token address/pubkey:', tokenAddress);

      // Find native asset balance - it's the one with CAIP starting with tokenNetworkId and no contract
      // AND matches the same address/pubkey as the token
      const nativeAssetBalance = app.balances?.find((balance: any) => {
        // Must be on the same network
        if (!balance.caip?.startsWith(tokenNetworkId)) {
          console.log('❌ [Asset] Balance does not start with tokenNetworkId:', { balanceCaip: balance.caip, tokenNetworkId });
          return false;
        }

        // Native assets have format: networkId/slip44:* (no contract address after)
        // Tokens have format: networkId/slip44:*/erc20:0x... or networkId/erc20:0x...
        const parts = balance.caip.split('/');

        // For EVM: native is "eip155:X/slip44:60", token is "eip155:X/erc20:0x..." or "eip155:X/slip44:60/erc20:0x..."
        // For Cosmos: native is "cosmos:X/slip44:Y", token is "cosmos:X/slip44:Y/ibc:..." or similar
        if (balance.caip.includes('/erc20:') || balance.caip.includes('/ibc:') || balance.caip.includes('/factory:')) {
          console.log('❌ [Asset] Balance is a token, not native:', balance.caip);
          return false; // This is a token, not native
        }

        // Should have exactly 2 parts (networkId/slip44:*)
        const isNative = parts.length === 2 && parts[1].startsWith('slip44:');
        console.log('🔍 [Asset] Checking if native:', {
          caip: balance.caip,
          parts,
          partsLength: parts.length,
          isNative,
          symbol: balance.symbol,
          balance: balance.balance
        });
        return isNative;
      });

      if (nativeAssetBalance) {
        nativeBalance = nativeAssetBalance.balance || '0';
        nativeSymbol = nativeAssetBalance.symbol || 'GAS';
        console.log('✅ [Asset] Found native gas balance:', {
          nativeBalance,
          nativeSymbol,
          nativeCaip: nativeAssetBalance.caip
        });
      } else {
        console.warn('⚠️ [Asset] No native gas balance found for token:', {
          tokenNetworkId,
          tokenCaip: caip,
          availableBalances: app.balances?.filter((b: any) => b.caip?.startsWith(tokenNetworkId)).map((b: any) => b.caip)
        });
      }

      // Get explorer info from assetsMap or fallback to network-specific defaults
      const assetInfo = app.assetsMap?.get(caip);
      const networkAssetInfo = app.assetsMap?.get(tokenNetworkId);

      // Get native asset info for fees
      const nativeAsset = getNativeAssetInfo(tokenNetworkId, app.balances);

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
        // CRITICAL: Native asset info for fee calculations
        nativeAsset: nativeAsset,
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
      // CRITICAL FIX: Only call setAssetContext if pubkeys are loaded to prevent Pioneer SDK validation error
      if (app?.setAssetContext && tokenAssetContextData.pubkeys && tokenAssetContextData.pubkeys.length > 0) {
        const { nativeBalance: _nb, nativeSymbol: _ns, ...sdkContext } = tokenAssetContextData;
        app.setAssetContext(sdkContext).then(() => {
          console.log('✅ [Asset] Token asset context set in Pioneer SDK');
        }).catch((error: any) => {
          console.error('❌ [Asset] Error setting token asset context:', error);
        });
      } else if (app?.setAssetContext) {
        console.warn('⏳ [Asset] Skipping setAssetContext (token) - wallet not paired or no pubkeys loaded yet');
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

    // DEBUG: Check all app.pubkeys to see which ones match Ethereum
    console.log('🔍 [DEBUG] All app.pubkeys:', app.pubkeys);
    console.log('🔍 [DEBUG] Filtering for networkId:', networkId);
    const filteredPubkeys = (app.pubkeys || []).filter((p: any) => {
      if (!p.networks || !Array.isArray(p.networks)) {
        return false;
      }

      // Exact match
      if (p.networks.includes(networkId)) {
        return true;
      }

      // For EVM chains, check if pubkey has eip155:* wildcard
      if (networkId.startsWith('eip155:') && p.networks.includes('eip155:*')) {
        return true;
      }

      // For Bitcoin chains, check if pubkey has bip122:* wildcard
      if (networkId.startsWith('bip122:') && p.networks.includes('bip122:*')) {
        return true;
      }

      return false;
    });

    // Get native asset info (for native assets, it's itself!)
    const nativeAsset = getNativeAssetInfo(networkId, app.balances);

    const assetContextData = {
      ...nativeAssetBalance,
      caip: caip,
      // Add color from balance, assetsMap, or fallback to gold
      color: nativeAssetBalance.color || app.assetsMap?.get(caip)?.color || app.assetsMap?.get(caip.toLowerCase())?.color || '#FFD700',
      ...(isCacao && { symbol: 'CACAO' }),
      // CRITICAL FIX: Add pubkeys for balance aggregation across all addresses
      pubkeys: filteredPubkeys,
      // CRITICAL: Native asset info for fee calculations (itself for native assets)
      nativeAsset: nativeAsset
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
    // CRITICAL FIX: Only call setAssetContext if pubkeys are loaded to prevent Pioneer SDK validation error
    if (app?.setAssetContext && assetContextData.pubkeys && assetContextData.pubkeys.length > 0) {
      const { nativeBalance: _nb, nativeSymbol: _ns, ...sdkContext } = assetContextData;
      app.setAssetContext(sdkContext).then(() => {
        console.log('✅ [Asset] Native asset context set in Pioneer SDK');
      }).catch((error: any) => {
        console.error('❌ [Asset] Error setting native asset context:', error);
      });
    } else if (app?.setAssetContext) {
      console.warn('⏳ [Asset] Skipping setAssetContext (native) - wallet not paired or no pubkeys loaded yet');
    }

    setLoading(false);
  }, [caip, app?.balances, app?.pubkeys, app?.assetsMap]);

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

  // Handle Bitcoin message signing
  const handleSignMessage = async (message: string, selectedAddress?: string): Promise<{ address: string; signature: string }> => {
    if (!app) {
      throw new Error('App not initialized');
    }

    if (!assetContext?.pubkeys || assetContext.pubkeys.length === 0) {
      throw new Error('No addresses available');
    }

    // Find the pubkey to sign with - either from the parameter or the state
    const pubkeyToUse = selectedAddress
      ? assetContext.pubkeys.find((p: any) => p.address === selectedAddress)
      : selectedSigningPubkey;

    if (!pubkeyToUse) {
      throw new Error('No address selected for signing');
    }

    console.log('🔐 [Asset SignMessage] Signing message with pubkey:', pubkeyToUse);

    // Get the KeepKey wallet from the wallets array (same as Receive component)
    const keepKeyWallet = app.wallets?.find((w: any) => w.wallet?.getVendor?.() === 'KeepKey')?.wallet;

    if (!keepKeyWallet) {
      throw new Error('KeepKey wallet not found in app.wallets');
    }

    console.log('✅ [Asset SignMessage] Found KeepKey wallet');

    // Check if wallet supports Bitcoin message signing
    if (typeof keepKeyWallet.btcSignMessage !== 'function') {
      throw new Error('Wallet does not support Bitcoin message signing');
    }

    try {
      // Convert BIP32 path to addressNList
      const addressNList = bip32ToAddressNList(pubkeyToUse.path);

      // Determine coin name based on networkId
      const coinMap: Record<string, string> = {
        'bip122:000000000019d6689c085ae165831e93': 'Bitcoin',
        'bip122:000000000000000000651ef99cb9fcbe': 'BitcoinCash',
        'bip122:12a765e31ffd4059bada1e25190f6e98': 'Litecoin',
        'bip122:00000000001a91e3dace36e2be3bf030': 'Dogecoin',
        'bip122:000007d91d1254d60e2dd1ae58038307': 'Dash',
      };

      const coin = coinMap[assetContext.networkId] || 'Bitcoin';

      // Call btcSignMessage on the hdwallet instance
      const signMessageParams = {
        addressNList: addressNList,
        coin: coin,
        scriptType: pubkeyToUse.scriptType || 'p2pkh',
        message: message
      };

      console.log('🔑 [Asset SignMessage] Calling btcSignMessage with params:', signMessageParams);

      const result = await keepKeyWallet.btcSignMessage(signMessageParams);

      console.log('✅ [Asset SignMessage] Message signed successfully:', result);

      if (!result || !result.address || !result.signature) {
        throw new Error('Invalid response from device');
      }

      return {
        address: result.address,
        signature: result.signature
      };
    } catch (error: any) {
      console.error('❌ [Asset SignMessage] Failed to sign message:', error);
      throw new Error(error?.message || 'Failed to sign message');
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
    <>
      <Box
        width="100%"
        position="relative"
        p={6}
      >
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
                  console.log('🔄 [Asset] Force refresh clicked - using networkId pattern from integration test');
                  setIsRefreshing(true);

                  const startBalance = app?.balances?.find((b: any) =>
                    b.networkId === assetContext.networkId && b.isNative
                  )?.balance || '0';

                  try {
                    if (app && typeof app.getBalances === 'function' && assetContext?.networkId) {
                      console.log(`🔄 [Asset] Calling app.getBalances({ networkId: "${assetContext.networkId}", forceRefresh: true })`);
                      await app.getBalances({ networkId: assetContext.networkId, forceRefresh: true });
                      console.log('✅ [Asset] Balance refresh completed');

                      // Verify balance was updated
                      const assetBalance = app.balances?.find((b: any) =>
                        b.networkId === assetContext.networkId && b.isNative
                      );
                      const newBalance = assetBalance?.balance || '0';
                      console.log(`✅ [Asset] Updated balance for ${assetContext.networkId}:`, newBalance);

                      // Show success notification with balance info
                      if (newBalance !== startBalance) {
                        toaster.create({
                          title: 'Balance Synced',
                          description: `Updated ${assetContext.ticker || 'asset'} balance: ${newBalance}`,
                          type: 'success',
                          duration: 3000,
                        });
                      } else if (parseFloat(newBalance) === 0) {
                        toaster.create({
                          title: 'Balance Synced',
                          description: `No ${assetContext.ticker || 'asset'} balance found on-chain`,
                          type: 'info',
                          duration: 3000,
                        });
                      } else {
                        toaster.create({
                          title: 'Balance Synced',
                          description: 'Balance is up to date',
                          type: 'success',
                          duration: 2000,
                        });
                      }
                    }
                    // Only refresh charts for tokens on non-UTXO networks (EVM/Cosmos)
                    // Native coins like BTC don't need chart/token discovery
                    const isUtxoNetwork = assetContext?.networkId?.startsWith('bip122:');
                    const shouldRefreshCharts = !isUtxoNetwork && assetContext?.isToken !== true && app && typeof app.getCharts === 'function';

                    if (shouldRefreshCharts && assetContext?.networkId) {
                      console.log('🔄 [Asset] Also refreshing charts for token discovery (EVM/Cosmos only)...');
                      app.getCharts([assetContext.networkId]).catch((err: any) => {
                        console.warn('⚠️ [Asset] Token discovery failed (non-critical):', err?.message);
                      });
                    } else if (isUtxoNetwork) {
                      console.log('⏭️  [Asset] Skipping chart refresh - UTXO networks don\'t have tokens');
                    }
                  } catch (error: any) {
                    console.error('❌ [Asset] Force refresh failed:', error);
                    toaster.create({
                      title: 'Sync Failed',
                      description: error?.message || 'Failed to refresh balance. Please check your connection and try again.',
                      type: 'error',
                      duration: 5000,
                    });
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
                        showNetworkBadge={true}
                        networkId={assetContext.networkId}
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
                    {assetContext.pubkeys && assetContext.pubkeys.length > 1 && (
                      <Badge
                        colorScheme="cyan"
                        variant="subtle"
                        fontSize="xs"
                      >
                        {assetContext.pubkeys.length} accounts
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
                                  <Button
                                    aria-label="Copy to clipboard"
                                    size="sm"
                                    minW="auto"
                                    p={2}
                                    bg={copiedItems[`pubkey-${index}-main`] ? "green.500" : "rgba(255, 215, 0, 0.2)"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(isUtxo ? pubkey.pubkey : pubkey.address, `pubkey-${index}-main`);
                                    }}
                                    _hover={{
                                      bg: copiedItems[`pubkey-${index}-main`] ? "green.600" : "rgba(255, 215, 0, 0.3)"
                                    }}
                                  >
                                    {copiedItems[`pubkey-${index}-main`] ? (
                                      <FaCheck color="white" size={14} />
                                    ) : (
                                      <FaCopy color="white" size={14} />
                                    )}
                                  </Button>
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
                                    <Button
                                      aria-label="Copy address to clipboard"
                                      size="sm"
                                      minW="auto"
                                      p={2}
                                      bg={copiedItems[`pubkey-${index}-address`] ? "green.500" : "rgba(255, 215, 0, 0.2)"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(pubkey.address, `pubkey-${index}-address`);
                                      }}
                                      _hover={{
                                        bg: copiedItems[`pubkey-${index}-address`] ? "green.600" : "rgba(255, 215, 0, 0.3)"
                                      }}
                                    >
                                      {copiedItems[`pubkey-${index}-address`] ? (
                                        <FaCheck color="white" size={14} />
                                      ) : (
                                        <FaCopy color="white" size={14} />
                                      )}
                                    </Button>
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

                {/* Sign Message Section - Only for UTXO chains (Bitcoin, etc.) */}
                {assetContext.networkId?.startsWith('bip122:') && assetContext.pubkeys && assetContext.pubkeys.length > 0 && (
                  <Box>
                    <Text color="gray.400" fontSize="sm" fontWeight="medium" mb={2}>
                      Message Signing
                    </Text>
                    <SignMessageDialog
                      onSignMessage={handleSignMessage}
                      addresses={assetContext.pubkeys}
                      showAddressSelector={true}
                    />
                  </Box>
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
                                <Button
                                  aria-label="Copy to clipboard"
                                  size="sm"
                                  minW="auto"
                                  p={2}
                                  bg={copiedItems[`pubkey-mobile-${index}-main`] ? "green.500" : "rgba(255, 215, 0, 0.2)"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(isUtxo ? pubkey.pubkey : pubkey.address, `pubkey-mobile-${index}-main`);
                                  }}
                                  _hover={{
                                    bg: copiedItems[`pubkey-mobile-${index}-main`] ? "green.600" : "rgba(255, 215, 0, 0.3)"
                                  }}
                                >
                                  {copiedItems[`pubkey-mobile-${index}-main`] ? (
                                    <FaCheck color="white" size={14} />
                                  ) : (
                                    <FaCopy color="white" size={14} />
                                  )}
                                </Button>
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
                                  <Button
                                    aria-label="Copy address to clipboard"
                                    size="sm"
                                    minW="auto"
                                    p={2}
                                    bg={copiedItems[`pubkey-mobile-${index}-address`] ? "green.500" : "rgba(255, 215, 0, 0.2)"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(pubkey.address, `pubkey-mobile-${index}-address`);
                                    }}
                                    _hover={{
                                      bg: copiedItems[`pubkey-mobile-${index}-address`] ? "green.600" : "rgba(255, 215, 0, 0.3)"
                                    }}
                                  >
                                    {copiedItems[`pubkey-mobile-${index}-address`] ? (
                                      <FaCheck color="white" size={14} />
                                    ) : (
                                      <FaCopy color="white" size={14} />
                                    )}
                                  </Button>
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

              {/* Sign Message Section - Mobile/Collapsed Version - Only for UTXO chains */}
              {assetContext.networkId?.startsWith('bip122:') && assetContext.pubkeys && assetContext.pubkeys.length > 0 && (
                <Box>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium" mb={2}>
                    Message Signing
                  </Text>
                  <SignMessageDialog
                    onSignMessage={handleSignMessage}
                    addresses={assetContext.pubkeys}
                    showAddressSelector={true}
                  />
                </Box>
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

          // DEBUG: Log all balances for current network
          console.log('🔍 [Asset] DEBUG - Current networkId:', assetContext.networkId);
          console.log('🔍 [Asset] DEBUG - Total balances:', app?.balances?.length || 0);
          const networkBalances = app?.balances?.filter((b: any) => b.networkId === assetContext.networkId) || [];
          console.log('🔍 [Asset] DEBUG - Balances for network:', networkBalances.length);
          console.log('🔍 [Asset] DEBUG - Sample balances:', networkBalances.slice(0, 5).map((b: any) => ({
            symbol: b.symbol,
            type: b.type,
            token: b.token,
            isToken: b.isToken,
            contract: b.contract,
            balance: b.balance,
            caip: b.caip
          })));

          // Filter tokens for the current network from app.balances
          const networkTokens = app?.balances?.filter((balance: any) =>
            balance.networkId === assetContext.networkId &&
            isTokenBalance(balance) &&
            parseFloat(balance.balance || '0') > 0
          ) || [];

          console.log('🔍 [Asset] DEBUG - Filtered tokens:', networkTokens.length);
          console.log('🔍 [Asset] DEBUG - First 3 tokens:', networkTokens.slice(0, 3).map((t: any) => ({
            symbol: t.symbol,
            balance: t.balance,
            valueUsd: t.valueUsd
          })));

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

        {/* Transaction History Section */}
        {assetContext.caip && (
          <TransactionHistory
            caip={assetContext.caip}
            networkId={assetContext.networkId}
            assetContext={assetContext}
          />
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
    </>
  );
};

export default Asset; 