'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { usePioneerContext } from '@/components/providers/pioneer';
import { useHeader } from '@/contexts/HeaderContext';
import { getAssetIconUrl } from '@/lib/utils/assetIcons';
import {
  Box,
  Stack,
  HStack,
  Text,
  Button,
  Image,
  Flex,
  Card,
  IconButton,
  Container,
  Spinner,
  VStack,
  Dialog,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogRoot,
  Code,
  Badge
} from '@chakra-ui/react';
import { FaEye, FaShieldAlt, FaExclamationTriangle, FaExternalLinkAlt, FaExchangeAlt } from 'react-icons/fa';
import { keyframes } from '@emotion/react';
import CountUp from 'react-countup';
import { bip32ToAddressNList, COIN_MAP_KEEPKEY_LONG, validateThorchainSwapMemo } from '@pioneer-platform/pioneer-coins'
import { NetworkIdToChain } from '@pioneer-platform/pioneer-caip'
// @ts-ignore
import { caipToNetworkId } from '@pioneer-platform/pioneer-caip';
import { isZcashEnabled, ZCASH_NETWORK_ID } from '@/config/features';

// Import sub-components
import { AssetSelector } from './AssetSelector';
import { SwapInput } from './SwapInput';
import { SwapQuote } from './SwapQuote';
import { SwapConfirm } from './SwapConfirm';
import { AssetPicker } from './AssetPicker';
import { SwapSuccess } from './SwapSuccess';
import { SwapProgress } from './SwapProgress';
import { usePendingSwaps } from '@/hooks/usePendingSwaps';

// Import asset utility functions
import {
  toBaseUnit,
  fromBaseUnit,
  getAssetDecimals
} from '@/lib/asset-utils';

// Import Pioneer swap service functions
import {
  getSwapQuote
} from '@/services/pioneer-swap-service';

// Import ERC20 utilities
import {
  checkERC20Allowance,
  buildERC20ApprovalTx,
  isERC20Token,
  getTokenAddressFromCAIP,
  getChainIdFromCAIP
} from '@/services/erc20';

// Import THORChain pools types and utilities
import { ThorchainPool, getNativePools, getPoolBySymbol, getPoolByCAIP } from '@/config/thorchain-pools';

interface SwapProps {
  onBackClick?: () => void;
}

/**
 * Supported swap assets - fetched dynamically from Pioneer server
 * Replaces static THORCHAIN_POOLS with API-driven configuration
 */

// Default CAIP identifiers for fallback pairs
const DEFAULT_BTC_CAIP = 'bip122:000000000019d6689c085ae165831e93/slip44:0';
const DEFAULT_ETH_CAIP = 'eip155:1/slip44:60';

/**
 * Parse asset pair from URL parameters
 * Expects CAIP format (URL encoded):
 * - ?from=bip122:000000000019d6689c085ae165831e93/slip44:0&to=eip155:1/slip44:60
 * - ?assetUrl=bip122:000000000019d6689c085ae165831e93/slip44:0
 *
 * If only 'from' or 'assetUrl' is provided, defaults to:
 * - BTC input -> ETH output
 * - Any other input -> BTC output
 *
 * Returns null if invalid or not found
 */
function parseAssetPairFromUrl(searchParams: URLSearchParams | null): { from: string; to: string } | null {
  if (!searchParams) return null;

  // Format 1: ?from=<caip>&to=<caip>
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (fromParam && toParam) {
    // Both provided - validate they're different
    if (fromParam === toParam) {
      console.warn('[Swap URL] Input and output CAIPs cannot be the same');
      return null;
    }
    return { from: fromParam, to: toParam };
  }

  // Format 2: ?assetUrl=<caip> (input only, smart default for output)
  const assetUrl = searchParams.get('assetUrl');
  if (assetUrl || fromParam) {
    const inputCaip = assetUrl || fromParam;

    // Smart default: BTC -> ETH, anything else -> BTC
    const outputCaip = inputCaip === DEFAULT_BTC_CAIP ? DEFAULT_ETH_CAIP : DEFAULT_BTC_CAIP;

    return { from: inputCaip!, to: outputCaip };
  }

  return null;
}

/**
 * Validate and get pool assets from CAIP
 * Returns the pool asset if valid, null otherwise
 */
function validateAndGetPoolAsset(caip: string) {
  const pool = getPoolByCAIP(caip);
  if (!pool) {
    console.warn(`[Swap URL] Asset CAIP not found in THORChain pools: ${caip}`);
    return null;
  }
  return pool;
}

export const Swap = ({ onBackClick }: SwapProps) => {
  // Get URL search params
  const searchParams = useSearchParams();
  const router = useRouter();
  // Get app context from Pioneer
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Use header context
  const { setActions } = useHeader();

  // Clear any custom back handlers when component mounts
  useEffect(() => {
    setActions({ onBackClick: undefined });
  }, [setActions]);
  
  // Get pending swaps for badge
  const { pendingSwaps } = usePendingSwaps();

  // Debug app state
  useEffect(() => {
    console.log('🔄 [Swap] Component mounted/updated with app state:', {
      hasApp: !!app,
      hasBalances: !!app?.balances,
      balanceCount: app?.balances?.length || 0,
      hasDashboard: !!app?.dashboard,
      dashboardNetworks: app?.dashboard?.networks?.length || 0,
      dashboardTotalValue: app?.dashboard?.totalValueUsd || 0,
      hasAssetContext: !!app?.assetContext,
      assetContext: app?.assetContext,
      hasOutboundAssetContext: !!app?.outboundAssetContext,
      outboundAssetContext: app?.outboundAssetContext
    });

    // DEBUG: Verify ERC20 methods exist on app (the SDK instance)
    if (app) {
      console.log('🔧 DEBUG [Swap] - SDK instance type:', typeof app);
      console.log('🔧 DEBUG [Swap] - CheckERC20Allowance:', typeof app.CheckERC20Allowance);
      console.log('🔧 DEBUG [Swap] - BuildERC20ApprovalTx:', typeof app.BuildERC20ApprovalTx);
      const erc20Methods = Object.keys(app).filter(k => k.includes('ERC20') || k.includes('Check') || k.includes('Build'));
      console.log('🔧 DEBUG [Swap] - ERC20/Check/Build methods:', erc20Methods);
    } else {
      console.warn('⚠️  [Swap] app (SDK instance) is not available!');
    }
    
    // Log dashboard networks for comparison
    if (app?.dashboard?.networks) {
      console.log('📊 [SWAP] Dashboard networks:', app.dashboard.networks);
      const btcNetwork = app.dashboard.networks.find((n: any) => n.name === 'Bitcoin' || n.symbol === 'BTC');
      if (btcNetwork) {
        console.log('🔍 [SWAP] BTC from dashboard:', btcNetwork);
      }
    }
  }, [app]);

  // Load swap assets from Pioneer SDK
  useEffect(() => {
    async function loadSwapAssets() {
      if (!app?.pioneer?.GetAvailableAssets) {
        console.log('[Swap] Pioneer SDK not ready yet, waiting...');
        return;
      }

      try {
        setIsLoadingSwapAssets(true);
        setSwapAssetsError('');

        console.log('[Swap] Loading swap assets from Pioneer SDK...');
        const response = await app.pioneer.GetAvailableAssets();

        console.log('[Swap] GetAvailableAssets raw response:', JSON.stringify(response, null, 2));

        // Pioneer SDK wraps backend response: { data: { success: true, data: { assets: [...] } } }
        const assets = response?.data?.data?.assets;

        if (!assets) {
          console.error('[Swap] Could not find assets at path response.data.data.assets');
          console.error('[Swap] Response structure:', {
            hasData: !!response?.data,
            dataKeys: response?.data ? Object.keys(response.data) : [],
            hasDataData: !!response?.data?.data,
            dataDataKeys: response?.data?.data ? Object.keys(response.data.data) : []
          });
          throw new Error('Invalid response structure from GetAvailableAssets');
        }

        if (!Array.isArray(assets) || assets.length === 0) {
          throw new Error('No assets returned from GetAvailableAssets');
        }

        setSupportedSwapAssets(assets);
        setSwapAssetsSource('api');

        console.log(`[Swap] Loaded ${assets.length} swap assets from Pioneer SDK`);
      } catch (error) {
        console.error('[Swap] Failed to load swap assets:', error);
        setSwapAssetsError(error instanceof Error ? error.message : 'Failed to load swap assets');

        // Fallback to empty array - component will still work with user's balances
        setSupportedSwapAssets([]);
      } finally {
        setIsLoadingSwapAssets(false);
      }
    }

    loadSwapAssets();
  }, [app?.pioneer]); // Re-run when Pioneer SDK is available

  // Market data state
  const [marketPools, setMarketPools] = useState<any[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [marketsError, setMarketsError] = useState('');

  /**
   * Calculate swap quote locally using pool math
   * Uses constant product formula: x*y = k
   * For A → B swap: A → RUNE → B
   */
  const calculateLocalQuote = (
    amountIn: string,
    caipIn: string,
    caipOut: string
  ): { amountOut: string; exchangeRate: number } | null => {
    try {
      const inputAmount = parseFloat(amountIn);
      if (isNaN(inputAmount) || inputAmount <= 0) {
        return null;
      }

      // Find pools for input and output assets
      const poolIn = marketPools.find((p: any) => p.caip === caipIn);
      const poolOut = marketPools.find((p: any) => p.caip === caipOut);

      if (!poolIn || !poolOut) {
        console.log('[Swap] Missing pools for calculation:', { caipIn, caipOut, poolIn: !!poolIn, poolOut: !!poolOut });
        return null;
      }

      // Parse pool depths (in 8-decimal THORChain format)
      const assetDepthIn = parseFloat(poolIn.assetDepth) / 1e8;
      const runeDepthIn = parseFloat(poolIn.runeDepth) / 1e8;
      const assetDepthOut = parseFloat(poolOut.assetDepth) / 1e8;
      const runeDepthOut = parseFloat(poolOut.runeDepth) / 1e8;

      console.log('[Swap] Pool depths:', {
        poolIn: { asset: assetDepthIn, rune: runeDepthIn },
        poolOut: { asset: assetDepthOut, rune: runeDepthOut }
      });

      // Step 1: Input Asset → RUNE (constant product formula)
      // runeOut = (amountIn * runeDepthIn) / (assetDepthIn + amountIn)
      const runeOut = (inputAmount * runeDepthIn) / (assetDepthIn + inputAmount);

      // Step 2: RUNE → Output Asset (constant product formula)
      // assetOut = (runeIn * assetDepthOut) / (runeDepthOut + runeIn)
      const assetOut = (runeOut * assetDepthOut) / (runeDepthOut + runeOut);

      // Calculate exchange rate
      const rate = assetOut / inputAmount;

      console.log('[Swap] Local quote calculation:', {
        input: inputAmount,
        runeIntermediate: runeOut,
        output: assetOut,
        rate
      });

      return {
        amountOut: assetOut.toFixed(8),
        exchangeRate: rate
      };

    } catch (error) {
      console.error('[Swap] Error in local quote calculation:', error);
      return null;
    }
  };

  // Load market pool data from Pioneer SDK
  useEffect(() => {
    async function loadMarketData() {
      if (!app?.pioneer?.GetMarkets) {
        console.log('[Swap] Pioneer SDK GetMarkets not ready yet, waiting...');
        return;
      }

      try {
        setIsLoadingMarkets(true);
        setMarketsError('');

        console.log('[Swap] Loading market pool data from Pioneer SDK...');

        // Use Pioneer SDK method instead of direct fetch
        const response = await app.pioneer.GetMarkets();
        console.log('[Swap] GetMarkets raw response:', response);

        // Pioneer SDK wraps backend response: { data: { success: true, data: { pools: [...] } } }
        const pools = response?.data?.data?.pools;

        if (!pools) {
          console.error('[Swap] Could not find pools at path response.data.data.pools');
          console.error('[Swap] Response structure:', {
            hasData: !!response?.data,
            dataKeys: response?.data ? Object.keys(response.data) : [],
            hasDataData: !!response?.data?.data,
            dataDataKeys: response?.data?.data ? Object.keys(response.data.data) : []
          });
          throw new Error('Invalid response structure from GetMarkets');
        }

        if (!Array.isArray(pools) || pools.length === 0) {
          throw new Error('No pools returned from GetMarkets');
        }

        setMarketPools(pools);
        console.log(`[Swap] ✅ Loaded ${pools.length} market pools from Pioneer SDK`);
        console.log('[Swap] Sample pool:', pools[0]);

      } catch (error) {
        console.error('[Swap] ❌ Failed to load market data:', error);
        setMarketsError(error instanceof Error ? error.message : 'Failed to load market data');
        setMarketPools([]);
      } finally {
        setIsLoadingMarkets(false);
      }
    }

    loadMarketData();
  }, [app?.pioneer]); // Re-run when Pioneer SDK is available

  // State for swap form
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [confirmMode, setConfirmMode] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isMaxAmount, setIsMaxAmount] = useState(false); // Track if MAX button was used
  
  // USD input mode states
  const [inputIsUSD, setInputIsUSD] = useState(false);
  const [outputIsUSD, setOutputIsUSD] = useState(false);
  const [inputUSDValue, setInputUSDValue] = useState('');
  const [outputUSDValue, setOutputUSDValue] = useState('');
  
  // Device verification states
  const [hasViewedOnDevice, setHasViewedOnDevice] = useState(false);
  const [isVerifyingOnDevice, setIsVerifyingOnDevice] = useState(false);
  const [deviceVerificationError, setDeviceVerificationError] = useState<string | null>(null);
  const [showDeviceVerificationDialog, setShowDeviceVerificationDialog] = useState(false);
  const [pendingSwap, setPendingSwap] = useState(false);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<'destination' | 'vault' | 'swap'>('destination');
  const [vaultVerified, setVaultVerified] = useState(false);
  const [memoValid, setMemoValid] = useState<boolean | null>(null);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);

  // State for dynamically loaded swap assets
  const [supportedSwapAssets, setSupportedSwapAssets] = useState<ThorchainPool[]>([]);
  const [isLoadingSwapAssets, setIsLoadingSwapAssets] = useState(true);
  const [swapAssetsError, setSwapAssetsError] = useState<string>('');
  const [swapAssetsSource, setSwapAssetsSource] = useState<'cache' | 'api' | 'stale-cache' | 'emergency-fallback' | ''>('');

  // Asset picker state
  const [showAssetPicker, setShowAssetPicker] = useState<'from' | 'to' | null>(null);
  
  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTxid, setSuccessTxid] = useState<string>('');

  // ERC20 Approval states
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);

  // Helper function to get balance by CAIP
  const getUserBalance = (caip: string | undefined): string => {
    if (!caip) {
      console.warn('getUserBalance: No CAIP provided');
      return '0';
    }
    if (!app?.balances || app.balances.length === 0) {
      console.warn('getUserBalance: No balances available');
      return '0';
    }
    if (availableAssets.length === 0) {
      console.warn('getUserBalance: No available assets yet');
      return '0';
    }

    try {
      // Find the asset by exact CAIP match
      const asset = availableAssets.find((x: any) => x.caip === caip);

      if (!asset) {
        console.warn(`getUserBalance: No asset found for CAIP ${caip}`, {
          availableAssets: availableAssets.map(a => ({ caip: a.caip, symbol: a.symbol }))
        });
        return '0';
      }

      // console.log(`getUserBalance: Found balance for ${caip}:`, asset.balance);
      return asset.balance?.toString() || '0';
    } catch (e) {
      console.error('getUserBalance: Error finding balance', e);
      return '0';
    }
  };

  // Helper function to get USD value
  const getUSDValue = (caip: string, amount: string): number => {
    if (!app?.balances || !caip || !amount) return 0;
    try {
      const balance = app.balances.find((x: any) => x.caip === caip);
      const price = parseFloat(balance?.priceUsd || '0');
      const qty = parseFloat(amount || '0');
      return price * qty;
    } catch (e) {
      return 0;
    }
  };

  // Helper function to get USD balance by CAIP
  const getUserBalanceUSD = (caip: string | undefined): string => {
    if (!caip || !app?.balances || app.balances.length === 0 || availableAssets.length === 0) {
      return '0';
    }
    try {
      // Find the asset by exact CAIP match
      const asset = availableAssets.find((x: any) => x.caip === caip);
      return asset?.balanceUsd?.toString() || '0';
    } catch (e) {
      console.error('getUserBalanceUSD: Error finding balance', e);
      return '0';
    }
  };

  // Get available assets with balances - DON'T aggregate, keep each CAIP separate
  const availableAssets = useMemo(() => {
    if (!app?.balances || app.balances.length === 0) {
      console.log('🔍 [SWAP] No balances available');
      return [];
    }

    console.log('🔍 [SWAP] Processing balances:', app.balances.length, 'total balances');
    console.log('🔍 [SWAP] Raw balances:', app.balances);
    console.log('🔍 [SWAP] Supported swap assets:', supportedSwapAssets.map(a => a.symbol));

    // Keep each balance separate by CAIP - DON'T aggregate by symbol
    const assets = app.balances
      .map((balance: any, index: number) => {
        const ticker = balance.ticker || balance.symbol;
        if (!ticker) {
          console.log(`⚠️ [SWAP] Balance #${index} missing ticker/symbol:`, balance);
          return null;
        }

        // Find matching supported asset from dynamic swap assets by CAIP (not symbol!)
        // This ensures ETH mainnet and ETH BNB Chain are kept separate
        let supportedAsset = supportedSwapAssets.find(asset => asset.caip === balance.caip);

        // Fallback: if no exact CAIP match, try by symbol but log a warning
        if (!supportedAsset) {
          console.log(`⚠️ [SWAP] No exact CAIP match for ${balance.caip}, trying symbol fallback for ${ticker}`);
          supportedAsset = supportedSwapAssets.find(asset => asset.symbol === ticker);
        }

        if (!supportedAsset) {
          console.log(`⚠️ [SWAP] No supported pool found for ticker: ${ticker} (caip: ${balance.caip})`);
          return null;
        }

        const balanceAmount = parseFloat(balance.balance || '0');
        const valueUsd = parseFloat(balance.valueUsd || '0');
        const priceUsd = parseFloat(balance.priceUsd || '0');

        console.log(`[SWAP-DEBUG] 💰 Processing ${ticker}: balance=${balanceAmount} price=$${priceUsd} usd=$${valueUsd}`);

        // Get icon from Pioneer SDK assetsMap FIRST, then fallback to balance.icon
        // DO NOT use hardcoded icons from thorchain-pools
        let icon = balance.icon; // Primary source: Pioneer balance data
        if (!icon && app?.assetsMap) {
          const assetInfo = app.assetsMap.get(balance.caip);
          if (assetInfo?.icon) {
            icon = assetInfo.icon;
            console.log(`📍 [SWAP] Using icon from assetsMap for ${ticker}:`, icon);
          }
        }
        // Final fallback: Use CDN with CAIP
        if (!icon) {
          icon = getAssetIconUrl(balance.caip);
        }

        // Get network name from balance or construct from CAIP
        const networkName = balance.networkName || '';
        const displayName = networkName ? `${supportedAsset.name} (${networkName})` : supportedAsset.name;

        const assetData = {
          caip: balance.caip,
          symbol: ticker,
          name: displayName,
          icon: icon,
          balance: balanceAmount,
          balanceUsd: valueUsd,
          priceUsd: priceUsd,
          networkId: balance.networkId,
          isNative: supportedAsset.isNative // Add isNative flag
        };

        return assetData;
      })
      .filter((asset: any) => {
        if (!asset) return false;
        const passesFilter = asset.balanceUsd > 0.01;
        if (!passesFilter) {
          console.log(`❌ [SWAP] Filtered out ${asset.symbol} on ${asset.caip}: USD value ${asset.balanceUsd} below $0.01 threshold`);
        }
        return passesFilter;
      })
      .sort((a: any, b: any) => b.balanceUsd - a.balanceUsd);

    console.log('✅ [SWAP] Final sorted assets (by CAIP, not aggregated):', assets);
    console.log('✅ [SWAP] Asset count:', assets.length);

    return assets;
  }, [app?.balances, app?.assets, supportedSwapAssets]);

  // fromAssets: Show ALL supported assets (deduplicated by CAIP)
  // Include zero-balance assets (will be greyed out in UI)
  // Aggregate balances if user has multiple addresses for same asset
  const fromAssets = useMemo(() => {
    // Start with all supported swap assets
    return supportedSwapAssets.map(poolAsset => {
      // Group user balances by CAIP and aggregate
      const userBalances = availableAssets.filter(a => a.caip === poolAsset.caip);
      const aggregatedBalance = userBalances.reduce((sum, asset) => sum + asset.balance, 0);
      const aggregatedBalanceUsd = userBalances.reduce((sum, asset) => sum + asset.balanceUsd, 0);

      // Get icon from user's balance or Pioneer SDK assetsMap
      let icon = userBalances[0]?.icon;
      if (!icon && app?.assetsMap) {
        const assetInfo = app.assetsMap.get(poolAsset.caip);
        if (assetInfo?.icon) {
          icon = assetInfo.icon;
        }
      }
      if (!icon) {
        icon = getAssetIconUrl(poolAsset.caip);
      }

      return {
        ...poolAsset,
        icon: icon,
        balance: aggregatedBalance,
        balanceUsd: aggregatedBalanceUsd,
        priceUsd: userBalances[0]?.priceUsd || 0,
        hasBalance: aggregatedBalanceUsd > 0.01, // Flag for UI to show enabled/disabled state
        isDisabled: aggregatedBalanceUsd <= 0.01 // Only disable if zero balance (allow clicking current output for auto-swap)
      };
    })
    .sort((a, b) => b.balanceUsd - a.balanceUsd); // Sort by USD value (zero balance assets last)
  }, [availableAssets, supportedSwapAssets, app?.outboundAssetContext?.caip, app?.assetsMap]);

  // All supported assets available for "to" selection (no balance requirement)
  // Show ALL 3 assets - if user clicks same asset as input, auto-swap logic will handle it
  const toAssets = useMemo(() => {
    // Get all supported swap assets (including currently selected "from" asset)
    // This ensures we can swap to any asset with an active pool, even with 0 balance
    const allSupportedAssets = supportedSwapAssets.map(poolAsset => {
      // Match by CAIP, not symbol! This keeps ETH mainnet and ETH BNB separate
      const balance = availableAssets.find(a => a.caip === poolAsset.caip);

      // Get icon from Pioneer SDK assetsMap FIRST, then fallback chain
      // DO NOT use hardcoded icons from thorchain-pools
      let icon = balance?.icon; // From user's balance if they have it
      if (!icon && app?.assetsMap) {
        const assetInfo = app.assetsMap.get(poolAsset.caip);
        if (assetInfo?.icon) {
          icon = assetInfo.icon;
        }
      }
      // Final fallback: Use CDN with CAIP
      if (!icon) {
        icon = getAssetIconUrl(poolAsset.caip);
      }

      const toAssetData = {
        ...poolAsset,
        name: poolAsset.name,
        icon: icon,
        balance: balance?.balance || 0,
        balanceUsd: balance?.balanceUsd || 0,
        priceUsd: balance?.priceUsd || 0
      };

      console.log(`[SWAP-DEBUG] 🎯 TO asset ${poolAsset.symbol}: price=$${toAssetData.priceUsd} balance=${toAssetData.balance}`);

      return toAssetData;
    });

    // Return all assets - auto-swap logic will handle clicking same asset as input
    return allSupportedAssets;
  }, [availableAssets, app?.assetContext?.symbol, app?.assets, app?.assetsMap, supportedSwapAssets]);

  // Initialize assets from URL parameters (runs once on mount)
  useEffect(() => {
    const urlPair = parseAssetPairFromUrl(searchParams);

    if (urlPair && app?.setAssetContext && app?.setOutboundAssetContext) {
      console.log('🔗 [Swap URL] Parsed asset pair from URL:', urlPair);

      // Validate both assets exist in THORChain pools
      const fromPool = validateAndGetPoolAsset(urlPair.from);
      const toPool = validateAndGetPoolAsset(urlPair.to);

      if (!fromPool || !toPool) {
        console.error('❌ [Swap URL] Invalid asset pair - one or both assets not found in THORChain pools');
        return;
      }

      console.log('✅ [Swap URL] Setting assets from URL:', {
        from: { caip: fromPool.caip, symbol: fromPool.symbol },
        to: { caip: toPool.caip, symbol: toPool.symbol }
      });

      // Try to get user balance data if available
      const fromAsset = availableAssets.find(a => a.caip === urlPair.from);
      const toAsset = availableAssets.find(a => a.caip === urlPair.to);

      // Set FROM asset - merge pool data with user balance if available
      app.setAssetContext({
        caip: fromPool.caip,
        networkId: fromPool.networkId || caipToNetworkId(fromPool.caip),
        symbol: fromPool.symbol,
        name: fromPool.name,
        icon: fromPool.icon,
        priceUsd: fromAsset?.priceUsd || 0,
        balance: fromAsset?.balance || 0,
        balanceUsd: fromAsset?.balanceUsd || 0
      });

      // Set TO asset - SDK will populate all fields from caip
      app.setOutboundAssetContext({
        caip: toPool.caip
      });
    }
  }, [searchParams, availableAssets]); // Re-run when balances load to update prices

  // Initialize default assets if not set
  useEffect(() => {
    if (!app?.assetContext?.caip && !app?.outboundAssetContext?.caip) {
      // Try to use user's highest balance asset, fallback to BTC from pools
      const defaultFrom = availableAssets[0] || supportedSwapAssets.find(a => a.symbol === 'BTC' && a.isNative);

      if (!defaultFrom) {
        console.warn('[Swap] No default FROM asset available');
        return;
      }

      // Smart selection for output asset based on input
      let defaultTo = null;

      // If input is Bitcoin, default to Ethereum (native, not wrapped)
      if (defaultFrom?.symbol === 'BTC') {
        defaultTo = supportedSwapAssets.find(a => a.symbol === 'ETH' && a.isNative);
      }
      // If input is anything else, default to Bitcoin
      else {
        defaultTo = supportedSwapAssets.find(a => a.symbol === 'BTC' && a.isNative);
      }

      // If we couldn't find the preferred output, use the second highest value asset or another pool
      if (!defaultTo && availableAssets.length > 1) {
        defaultTo = availableAssets[1];
      }

      // If still no output asset, find any other supported asset from pools
      if (!defaultTo) {
        defaultTo = supportedSwapAssets.find(asset =>
          asset.symbol !== defaultFrom?.symbol && asset.isNative
        );
      }

      if (!defaultTo) {
        console.warn('[Swap] No default TO asset available');
        return;
      }

      // Merge pool data with user balance data if available
      const fromBalanceData = availableAssets.find(a => a.caip === defaultFrom.caip);
      const toBalanceData = availableAssets.find(a => a.caip === defaultTo.caip);

      const fromAsset = {
        ...defaultFrom,
        balance: fromBalanceData?.balance || 0,
        balanceUsd: fromBalanceData?.balanceUsd || 0,
        priceUsd: fromBalanceData?.priceUsd || 0
      };

      const toAsset = {
        ...defaultTo,
        balance: toBalanceData?.balance || 0,
        balanceUsd: toBalanceData?.balanceUsd || 0,
        priceUsd: toBalanceData?.priceUsd || 0
      };

      // Set the assets
      if (fromAsset && toAsset && fromAsset.caip !== toAsset.caip) {
        if (app?.setAssetContext && app?.setOutboundAssetContext) {
          console.log('📍 [Swap] Setting default assets:', {
            from: { caip: fromAsset.caip, symbol: fromAsset.symbol },
            to: { caip: toAsset.caip, symbol: toAsset.symbol }
          });
          app.setAssetContext(fromAsset);
          app.setOutboundAssetContext(toAsset);
          // The default amount will be set by the dedicated useEffect
        }
      }
    }
  }, [availableAssets, app?.assetContext?.caip, app?.outboundAssetContext?.caip]);
  
  // Auto-select output asset when input asset changes
  useEffect(() => {
    const autoSelectOutput = async () => {
      console.log('🔍 [Swap] Auto-select output asset useEffect triggered:', {
        hasAssetContext: !!app?.assetContext?.caip,
        hasOutboundContext: !!app?.outboundAssetContext?.caip,
        canSetOutbound: !!app?.setOutboundAssetContext,
        inputSymbol: app?.assetContext?.symbol,
        supportedSwapAssetsCount: supportedSwapAssets.length
      });

      if (app?.assetContext?.caip && !app?.outboundAssetContext?.caip && app?.setOutboundAssetContext) {
        let defaultTo = null;

        // If input is Bitcoin, default to Ethereum (native, not wrapped)
        if (app.assetContext.symbol === 'BTC') {
          defaultTo = supportedSwapAssets.find(a => a.symbol === 'ETH' && a.isNative);
        }
        // If input is anything else, default to Bitcoin
        else {
          defaultTo = supportedSwapAssets.find(a => a.symbol === 'BTC' && a.isNative);
        }

        if (defaultTo) {
          console.log('✅ [Swap] Auto-selecting output asset with CAIP only:', {
            symbol: defaultTo.symbol,
            caip: defaultTo.caip
          });
          // CRITICAL: Only pass caip - SDK will populate address and other fields
          await app.setOutboundAssetContext({ caip: defaultTo.caip });
          console.log('✅ [Swap] Output asset context set, address populated:', app.outboundAssetContext?.address);
        } else {
          console.error('❌ [Swap] Could not auto-select output asset for:', app.assetContext.symbol, 'Available swap assets:', supportedSwapAssets.length);
        }
      }
    };

    autoSelectOutput();
  }, [app?.assetContext?.caip, availableAssets, app?.setOutboundAssetContext]); // Don't depend on outbound context - creates infinite loop!
  
  // Set default input amount when both assets are selected and input is empty
  useEffect(() => {
    console.log('🔍 [Swap] Default amount useEffect triggered:', {
      hasAssetContext: !!app?.assetContext?.caip,
      hasOutboundContext: !!app?.outboundAssetContext?.caip,
      hasInputAmount: !!inputAmount,
      availableAssetsCount: availableAssets.length,
      fromSymbol: app?.assetContext?.symbol,
      toSymbol: app?.outboundAssetContext?.symbol
    });

    if (app?.assetContext?.caip &&
        app?.outboundAssetContext?.caip &&
        !inputAmount &&
        availableAssets.length > 0) {

      const fromAsset = availableAssets.find(a => a.caip === app.assetContext.caip);

      if (fromAsset && fromAsset.balance > 0 && fromAsset.priceUsd > 0) {
        const maxUsdValue = fromAsset.balance * fromAsset.priceUsd;

        console.log('💰 Setting default input amount:', {
          asset: fromAsset.symbol,
          balance: fromAsset.balance,
          priceUsd: fromAsset.priceUsd,
          maxUsdValue
        });
        
        if (maxUsdValue <= 100) {
          // If MAX is less than $100, use MAX
          setInputAmount(fromAsset.balance.toString());
          setIsMaxAmount(true);
          setInputUSDValue(maxUsdValue.toFixed(2));
        } else {
          // If MAX is more than $100, use $100 worth
          const amountFor100Usd = 100 / fromAsset.priceUsd;
          setInputAmount(amountFor100Usd.toFixed(8));
          setIsMaxAmount(false); // CRITICAL FIX: isMax should only be true when MAX button clicked, not for default $100
          setInputUSDValue('100.00');
        }
        
        // Fetch quote for the default amount (only if market pools are loaded)
        const amount = maxUsdValue <= 100 ? fromAsset.balance.toString() : (100 / fromAsset.priceUsd).toFixed(8);
        if (amount && app?.assetContext?.symbol && app?.outboundAssetContext?.symbol && marketPools.length > 0) {
          console.log('🎯 [Swap] Fetching initial quote with:', {
            amount,
            fromSymbol: app.assetContext.symbol,
            toSymbol: app.outboundAssetContext.symbol,
            marketPoolsLoaded: marketPools.length
          });
          fetchQuote(amount, app.assetContext.symbol, app.outboundAssetContext.symbol);
        } else {
          console.log('⏳ [Swap] Waiting for market pools to load before fetching quote:', {
            hasAmount: !!amount,
            hasFromSymbol: !!app?.assetContext?.symbol,
            hasToSymbol: !!app?.outboundAssetContext?.symbol,
            marketPoolsCount: marketPools.length
          });
        }
      }
    }
  }, [app?.assetContext?.caip, app?.outboundAssetContext?.caip, app?.assetContext?.symbol, app?.outboundAssetContext?.symbol, availableAssets.length, inputAmount, marketPools.length]);

  // Fetch quote when market pools finish loading and we already have an input amount
  useEffect(() => {
    if (marketPools.length > 0 &&
        inputAmount &&
        parseFloat(inputAmount) > 0 &&
        app?.assetContext?.symbol &&
        app?.outboundAssetContext?.symbol &&
        !outputAmount) {
      console.log('🔄 [Swap] Market pools loaded - fetching quote for existing input:', {
        inputAmount,
        fromSymbol: app.assetContext.symbol,
        toSymbol: app.outboundAssetContext.symbol,
        marketPoolsCount: marketPools.length
      });
      fetchQuote(inputAmount, app.assetContext.symbol, app.outboundAssetContext.symbol);
    }
  }, [marketPools.length]); // Only trigger when market pools load

  // Validate that we never have the same asset (by CAIP) for both from and to
  useEffect(() => {
    if (app?.assetContext?.caip &&
        app?.outboundAssetContext?.caip &&
        app.assetContext.caip === app.outboundAssetContext.caip &&
        app?.setOutboundAssetContext &&
        availableAssets.length > 0) {
      console.log(`[SWAP-DEBUG] ⚠️ Same CAIP detected: ${app.assetContext.caip} - auto-selecting different TO asset`);

      // Find an alternative asset for "to" by CAIP (prefer native assets)
      const alternativeAsset = availableAssets.find(a => a.caip !== app.assetContext.caip) ||
                               supportedSwapAssets.find(a => a.caip !== app.assetContext.caip && a.isNative) ||
                               supportedSwapAssets.find(a => a.caip !== app.assetContext.caip);

      if (alternativeAsset) {
        console.log(`[SWAP-DEBUG] ✅ Auto-selected TO: ${alternativeAsset.symbol} (${alternativeAsset.caip})`);
        app.setOutboundAssetContext({
          caip: alternativeAsset.caip
        });
      }
    }
  }, [app?.assetContext?.caip, app?.outboundAssetContext?.caip, availableAssets, supportedSwapAssets]);

  // Fetch quote from Pioneer SDK
  const fetchQuote = async (amount: string, fromSymbol: string, toSymbol: string) => {
    // Prevent fetching quote for same asset
    if (fromSymbol === toSymbol) {
      console.log(`[SWAP-DEBUG] ⚠️ Skipping quote - same asset: ${fromSymbol}`);
      setError('Cannot swap the same asset');
      return;
    }

    setIsLoadingQuote(true);
    setError('');

    try {
      console.log(`[SWAP-DEBUG] 🔍 Fetching quote: ${amount} ${fromSymbol} → ${toSymbol}`);
      console.log(`[SWAP-DEBUG] 💰 FROM asset context:`, {
        symbol: fromSymbol,
        caip: app?.assetContext?.caip,
        networkId: app?.assetContext?.networkId,
        priceUsd: app?.assetContext?.priceUsd,
      });
      console.log(`[SWAP-DEBUG] 💰 TO asset context:`, {
        symbol: toSymbol,
        caip: app?.outboundAssetContext?.caip,
        networkId: app?.outboundAssetContext?.networkId,
        priceUsd: app?.outboundAssetContext?.priceUsd,
      });

      // CRITICAL: Check if CAIPs are the same (would cause error)
      if (app?.assetContext?.caip === app?.outboundAssetContext?.caip) {
        console.error('❌ [SWAP-DEBUG] CRITICAL ERROR: Both assets have the same CAIP!', {
          fromSymbol,
          toSymbol,
          caip: app.assetContext.caip
        });
        throw new Error(`Cannot swap - both assets have the same CAIP (${app.assetContext.caip}). This indicates USDT has wrong CAIP.`);
      }

      // Validate CAIP identifiers exist
      if (!app?.assetContext?.caip) {
        throw new Error(`Missing CAIP identifier for input asset ${fromSymbol}`);
      }
      if (!app?.outboundAssetContext?.caip) {
        throw new Error(`Missing CAIP identifier for output asset ${toSymbol}`);
      }

      // Try local calculation first if market pools are loaded
      console.log(`[SWAP-DEBUG] 💾 Market pools status: ${marketPools.length} pools loaded`);
      if (marketPools.length > 0) {
        console.log('[SWAP-DEBUG] 🧮 Using LOCAL pool math for quote calculation');
        console.log(`[SWAP-DEBUG] 📍 Looking for pools: ${app.assetContext.caip} → ${app.outboundAssetContext.caip}`);
        const localQuote = calculateLocalQuote(amount, app.assetContext.caip, app.outboundAssetContext.caip);

        if (localQuote) {
          console.log(`[SWAP-DEBUG] ✅ Local quote: ${amount} ${fromSymbol} → ${localQuote.amountOut} ${toSymbol}`);
          console.log(`[SWAP-DEBUG] 📈 Exchange rate: ${localQuote.exchangeRate}`);

          // Set output amounts
          setOutputAmount(localQuote.amountOut);
          setExchangeRate(localQuote.exchangeRate);

          // Calculate USD value if price available
          if (app?.outboundAssetContext?.priceUsd) {
            const outputUsd = (parseFloat(localQuote.amountOut) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2);
            setOutputUSDValue(outputUsd);
          }

          // Create a minimal quote object for display (no memo/vault yet - those come from real API quote)
          // Apply 3% slippage for minimum output estimate
          const minOutput = (parseFloat(localQuote.amountOut) * 0.97).toFixed(8);
          setQuote({
            amountOut: localQuote.amountOut,
            amountOutMin: minOutput,
            fees: {
              network: '0', // Estimated, will be accurate from API quote
              protocol: '0',
              affiliate: '0'
            },
            integration: 'thorchain',
            source: 'local-calculation'
          });

          setIsLoadingQuote(false);
          return;
        } else {
          console.warn('[SWAP-DEBUG] ⚠️ Local quote calculation failed - pool data missing or calculation error');
          throw new Error('Failed to calculate local quote. Market pool data may be incomplete.');
        }
      } else {
        console.warn('[SWAP-DEBUG] ⚠️ Market pools not loaded yet - cannot calculate local quote');
        throw new Error('Market pools not loaded yet. Please wait for pool data to load.');
      }

      // This code is unreachable - API quote is disabled
      // API quote is ONLY used in handlePrepareSwap() for execution details (memo, vault, etc.)

    } catch (err: any) {
      console.error(`[SWAP-DEBUG] ❌ Error fetching quote:`, {
        error: err,
        message: err?.message,
        stack: err?.stack,
        response: err?.response,
        data: err?.response?.data
      });
      // Extract the error message from the error object
      const errorMessage = err?.message || 'Failed to fetch swap quote';
      setError(errorMessage);
      setOutputAmount('');
      setOutputUSDValue('');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Exchange rate is calculated from actual quote in fetchQuote()
  // No need for separate exchange rate fetching

  const handleInputChange = async (value: string) => {
    console.log('📝 [Swap] Input changed:', {
      newValue: value,
      previousValue: inputAmount,
      fromSymbol: app?.assetContext?.symbol,
      toSymbol: app?.outboundAssetContext?.symbol
    });

    setInputAmount(value);
    if (isMaxAmount) {
      console.log('🔄 Clearing isMax flag - user manually changed amount from:', inputAmount, 'to:', value);
      setIsMaxAmount(false); // Clear isMax flag when user manually changes the amount
      console.log('🔴 isMaxAmount is now FALSE due to manual input change');
    }
    // Automatically calculate and update USD value
    if (app?.assetContext?.priceUsd && value) {
      const usdValue = (parseFloat(value) * parseFloat(app.assetContext.priceUsd)).toFixed(2);
      console.log(`[SWAP-DEBUG] 💵 Input USD: ${value} × $${app.assetContext.priceUsd} = $${usdValue}`);
      setInputUSDValue(usdValue);
    } else {
      setInputUSDValue('');
    }

    // Clear previous output
    setOutputAmount('');
    setOutputUSDValue('');
    setQuote(null);
    setError('');

    // Fetch quote if we have valid input
    if (value && parseFloat(value) > 0 && app?.assetContext?.symbol && app?.outboundAssetContext?.symbol) {
      console.log('✅ [Swap] Conditions met, fetching quote for custom amount');
      await fetchQuote(value, app.assetContext.symbol, app.outboundAssetContext.symbol);
    } else {
      console.warn('⚠️ [Swap] Cannot fetch quote - conditions not met:', {
        hasValue: !!value,
        valueGreaterThanZero: value ? parseFloat(value) > 0 : false,
        hasFromSymbol: !!app?.assetContext?.symbol,
        hasToSymbol: !!app?.outboundAssetContext?.symbol,
        fromSymbol: app?.assetContext?.symbol,
        toSymbol: app?.outboundAssetContext?.symbol
      });
    }
  };

  // Helper: Check if an asset is a native gas asset (pays for its own gas fees)
  const isNativeGasAsset = (caip: string): boolean => {
    // Native gas assets use slip44 identifiers, not token contracts
    // Format: eip155:1/slip44:60 (ETH mainnet)
    //         eip155:8453/slip44:60 (ETH on BASE)
    //         eip155:56/slip44:60 (BNB)
    // Tokens use: eip155:1/erc20:0x... (ERC20 tokens)
    return caip.includes('/slip44:') || caip.includes('/bip122:');
  };

  const handleMaxClick = async () => {
    console.log('🟡 MAX BUTTON CLICKED - BEFORE STATE CHANGE');
    const maxBalance = getUserBalance(app?.assetContext?.caip);
    const priceUsd = app?.assetContext?.priceUsd ? parseFloat(app.assetContext.priceUsd) : 0;

    if (!maxBalance || parseFloat(maxBalance) <= 0) {
      setError('No balance available');
      return;
    }

    if (!priceUsd || priceUsd <= 0) {
      setError('Price unavailable for asset');
      return;
    }

    if (!app?.assetContext?.symbol || !app?.outboundAssetContext?.symbol) {
      setError('Assets not properly selected');
      return;
    }

    try {
      setError('');
      setIsLoadingQuote(true);

      // Get proper decimal precision for this asset from SDK assetContext
      const decimals = getAssetDecimals(app?.assetContext);

      // Calculate max USD value
      const maxUsdValue = parseFloat(maxBalance) * priceUsd;
      console.log(`💰 MAX calculation: balance=${maxBalance} ${app.assetContext.symbol}, USD=$${maxUsdValue.toFixed(2)}`);

      // Apply $100 cap: use max or $100, whichever is less
      const targetUsdValue = Math.min(maxUsdValue, 100);
      const targetAmount = targetUsdValue / priceUsd;
      console.log(`🎯 Target: $${targetUsdValue.toFixed(2)} = ${targetAmount.toFixed(decimals)} ${app.assetContext.symbol}`);

      // Check if this is a native gas asset that pays its own gas fees
      const isGasAsset = isNativeGasAsset(app.assetContext.caip);
      console.log(`🔍 Asset type: ${isGasAsset ? 'Native gas asset' : 'Token'} (${app.assetContext.caip})`);

      // Get quote to determine actual gas fees needed
      console.log('🔍 Getting quote to calculate gas fees...');
      const testQuote = await getSwapQuote(app, {
        caipIn: app.assetContext.caip,
        caipOut: app.outboundAssetContext.caip,
        amount: targetAmount.toString(),
        slippagePercentage: 3,
        isMax: true, // Set isMax=true to get accurate gas estimation from SDK
      });

      // Parse network gas fees from quote
      const networkFee = testQuote.quote?.fees?.network ? parseFloat(testQuote.quote.fees.network) : 0;
      console.log(`⛽ Network gas fee from quote: ${networkFee} ${app.assetContext.symbol}`);

      // For native gas assets, use a conservative gas estimate if quote doesn't provide one
      const conservativeGasEstimate = isGasAsset ? 0.001 : 0; // ~$3-5 worth of gas at typical prices
      const finalGasReserve = Math.max(networkFee, conservativeGasEstimate);

      if (isGasAsset && finalGasReserve > 0) {
        console.log(`⛽ Using gas reserve: ${finalGasReserve} ${app.assetContext.symbol} (quote: ${networkFee}, conservative: ${conservativeGasEstimate})`);
      }

      // CRITICAL FIX: Check if this is a native token that pays its own gas
      const isNativeToken = isGasAsset;

      let finalAmount: number;

      if (isNativeToken) {
        // For native gas assets, subtract gas from the amount
        finalAmount = targetAmount - finalGasReserve;

        if (finalAmount <= 0) {
          throw new Error(
            `Insufficient balance for gas fees. ` +
            `Balance: ${targetAmount.toFixed(decimals)} ${app.assetContext.symbol}, ` +
            `Need: ${finalGasReserve.toFixed(decimals)} ${app.assetContext.symbol} for gas.`
          );
        }

        console.log(`🔧 Adjusted for gas: ${finalAmount.toFixed(decimals)} ${app.assetContext.symbol} (reserved ${finalGasReserve.toFixed(decimals)} for gas)`);
      } else {
        // For tokens (ERC20, etc.), verify there's enough native token for gas
        // Extract the chain ID from CAIP to find the native gas asset
        const chainPrefix = app.assetContext.caip.split('/')[0]; // e.g., 'eip155:1'
        const gasAssetCaip = `${chainPrefix}/slip44:60`; // Native ETH on this chain
        const gasBalance = getUserBalance(gasAssetCaip);
        const gasBalanceNum = gasBalance ? parseFloat(gasBalance) : 0;

        console.log(`🔍 Checking gas balance on chain ${chainPrefix}: ${gasBalanceNum} (need ${finalGasReserve})`);

        if (gasBalanceNum < finalGasReserve) {
          throw new Error(
            `Insufficient native token for gas on this chain. ` +
            `Need ${finalGasReserve} but only have ${gasBalanceNum}. ` +
            `Please add native tokens to cover gas fees.`
          );
        }

        // For tokens, use full target amount (gas comes from separate native balance)
        finalAmount = targetAmount;
        console.log(`✅ Sufficient gas balance: ${gasBalanceNum} available, ${finalGasReserve} needed`);
      }

      // Set the final amount
      const finalAmountStr = finalAmount.toFixed(decimals);
      setInputAmount(finalAmountStr);
      setIsMaxAmount(true); // Always true when MAX button clicked
      console.log('💰 MAX button clicked - setting isMax flag to true');

      // Calculate and set USD value
      const finalUsdValue = (finalAmount * priceUsd).toFixed(2);
      setInputUSDValue(finalUsdValue);

      // Clear output and get fresh quote with adjusted amount
      setOutputAmount('');
      setOutputUSDValue('');
      setQuote(null);

      console.log(`🟢 MAX BUTTON COMPLETE: ${finalAmountStr} ${app.assetContext.symbol} = $${finalUsdValue}`);

      // Fetch final quote with gas-adjusted amount
      await fetchQuote(finalAmountStr, app.assetContext.symbol, app.outboundAssetContext.symbol);

    } catch (err: any) {
      console.error('❌ MAX button failed:', err);
      const errorMessage = err?.message || 'Failed to calculate max amount';
      setError(errorMessage);
      setInputAmount('');
      setInputUSDValue('');
      setOutputAmount('');
      setOutputUSDValue('');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleOutputChange = (value: string, isUSD: boolean) => {
    if (isUSD) {
      setOutputUSDValue(value);
      if (app?.outboundAssetContext?.priceUsd && value) {
        const nativeAmount = (parseFloat(value) / parseFloat(app.outboundAssetContext.priceUsd)).toFixed(8);
        setOutputAmount(nativeAmount);
      } else {
        setOutputAmount('');
      }
    } else {
      setOutputAmount(value);
      if (app?.outboundAssetContext?.priceUsd && value) {
        const usdValue = (parseFloat(value) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2);
        setOutputUSDValue(usdValue);
      } else {
        setOutputUSDValue('');
      }
    }
  };

  // Handle asset selection
  const handleAssetSelect = async (asset: any, isFrom: boolean) => {
    if (!app?.setAssetContext || !app?.setOutboundAssetContext) return;

    console.log(`[SWAP-DEBUG] 🎯 Asset selected: ${isFrom ? 'FROM' : 'TO'} ${asset.symbol} balance=${asset.balance} price=$${asset.priceUsd}`);

    // Check if selecting the same asset for both from and to
    if (isFrom) {
      if (asset.caip === app?.outboundAssetContext?.caip) {
        // If selecting an asset for "from" that's already "to", auto-swap:
        // Set this as "from" and pick next available asset as "to"
        console.log('🔄 [Swap] Selected asset is current output, auto-swapping...');

        // Find next available asset (prefer assets with balance)
        const nextAsset = toAssets.find(a => a.caip !== asset.caip && a.balanceUsd && a.balanceUsd > 0) ||
                          toAssets.find(a => a.caip !== asset.caip);

        if (nextAsset) {
          console.log('✅ [Swap] Auto-selected next asset as output:', {
            symbol: nextAsset.symbol,
            priceUsd: nextAsset.priceUsd
          });
          await app.setOutboundAssetContext({
            caip: nextAsset.caip
          });
        }
        // Don't return - continue to set the selected asset as "from" below
      }

      // Validate asset has required fields before attempting to set
      if (!asset.caip) {
        console.error('❌ Cannot set input asset: missing CAIP', asset);
        setError('Invalid asset: missing CAIP identifier');
        return;
      }
      if (!asset.symbol) {
        console.error('❌ Cannot set input asset: missing symbol', asset);
        setError('Invalid asset: missing symbol');
        return;
      }

      console.log(`[SWAP-DEBUG] 📝 Setting FROM: ${asset.symbol} (${asset.caip}) price=$${asset.priceUsd} balance=${asset.balance}`);

      await app.setAssetContext({
        caip: asset.caip,
        networkId: asset.networkId || caipToNetworkId(asset.caip),
        symbol: asset.symbol,
        name: asset.name,
        icon: asset.icon,
        priceUsd: asset.priceUsd
      });
      
      // Set default input amount when changing input asset: MAX or $100, whichever is less
      if (asset.balance > 0 && asset.priceUsd > 0) {
        const maxUsdValue = asset.balance * asset.priceUsd;
        
        if (maxUsdValue <= 100) {
          // If MAX is less than $100, use MAX
          setInputAmount(asset.balance.toString());
          setIsMaxAmount(true);
          setInputUSDValue(maxUsdValue.toFixed(2));
        } else {
          // If MAX is more than $100, use $100 worth
          const amountFor100Usd = 100 / asset.priceUsd;
          setInputAmount(amountFor100Usd.toFixed(8));
          setIsMaxAmount(false); // CRITICAL FIX: isMax should only be true when MAX button clicked, not for default $100
          setInputUSDValue('100.00');
        }
        
        // Fetch quote for the new amount
        const amount = maxUsdValue <= 100 ? asset.balance.toString() : (100 / asset.priceUsd).toFixed(8);
        if (amount && app?.outboundAssetContext?.symbol) {
          await fetchQuote(amount, asset.symbol, app.outboundAssetContext.symbol);
        }
      } else if (inputAmount && parseFloat(inputAmount) > 0 && app?.outboundAssetContext?.symbol) {
        // Keep existing amount if asset has no balance
        await fetchQuote(inputAmount, asset.symbol, app.outboundAssetContext.symbol);
      }
    } else {
      // For output selection, if selecting same asset as input, auto-swap to prevent error
      if (asset.caip === app?.assetContext?.caip) {
        console.log('🔄 [Swap] Selected asset is current input, auto-swapping to prevent same-asset error...');

        // Find next available asset with balance (prefer assets with balance)
        const nextAsset = fromAssets.find(a => a.caip !== asset.caip && !a.isDisabled && a.balanceUsd && a.balanceUsd > 0) ||
                          fromAssets.find(a => a.caip !== asset.caip && !a.isDisabled);

        if (nextAsset) {
          console.log('✅ [Swap] Auto-selected next asset as input:', nextAsset.symbol);
          await app.setAssetContext({
            caip: nextAsset.caip,
            networkId: nextAsset.networkId || caipToNetworkId(nextAsset.caip),
            symbol: nextAsset.symbol,
            name: nextAsset.name,
            icon: nextAsset.icon,
            priceUsd: nextAsset.priceUsd || 0
          });

          // Set default input amount for auto-selected asset
          if (nextAsset.balance > 0 && nextAsset.priceUsd > 0) {
            const maxUsdValue = nextAsset.balance * nextAsset.priceUsd;
            if (maxUsdValue <= 100) {
              setInputAmount(nextAsset.balance.toString());
              setIsMaxAmount(true);
              setInputUSDValue(maxUsdValue.toFixed(2));
            } else {
              const amountFor100Usd = 100 / nextAsset.priceUsd;
              setInputAmount(amountFor100Usd.toFixed(8));
              setIsMaxAmount(true);
              setInputUSDValue('100.00');
            }
          }
        }
        // Continue to set the selected asset as "to" below
      }

      // Validate asset has required fields before attempting to set
      if (!asset.caip) {
        console.error('❌ Cannot set output asset: missing CAIP', asset);
        setError('Invalid asset: missing CAIP identifier');
        return;
      }
      if (!asset.symbol) {
        console.error('❌ Cannot set output asset: missing symbol', asset);
        setError('Invalid asset: missing symbol');
        return;
      }

      console.log(`[SWAP-DEBUG] 📝 Setting TO: ${asset.symbol} (${asset.caip}) price=$${asset.priceUsd} balance=${asset.balance}`);

      try {
        await app.setOutboundAssetContext({
          caip: asset.caip
        });
        console.log(`[SWAP-DEBUG] ✅ TO asset set: ${asset.symbol} price=$${asset.priceUsd}`);
      } catch (outboundError) {
        console.error('❌ Failed to set output asset:', outboundError);
        setError(`Failed to set output asset: ${asset.symbol}`);
        return;
      }

      // Fetch new quote if we have input amount
      if (inputAmount && parseFloat(inputAmount) > 0 && app?.assetContext?.symbol) {
        console.log('🔄 [Swap] Fetching quote after output asset change');
        await fetchQuote(inputAmount, app.assetContext.symbol, asset.symbol);
      }
    }
    
    // Only clear if no input amount
    if (!inputAmount) {
      setOutputAmount('');
      setOutputUSDValue('');
      setQuote(null);
      setError('');
    }
  };

  // Swap from and to assets
  const swapAssets = async () => {
    const fromSel = app?.assetContext;
    const toSel = app?.outboundAssetContext;
    if (!fromSel || !toSel || !app?.setAssetContext || !app?.setOutboundAssetContext) return;

    console.log(`[SWAP-DEBUG] 🔄 Swapping assets: ${fromSel.symbol} ↔ ${toSel.symbol}`);

    // Prevent swapping if they're the same asset (by CAIP)
    if (fromSel.caip === toSel.caip) {
      console.log(`[SWAP-DEBUG] ⚠️ Cannot swap - same asset (${fromSel.caip})`);
      setError('Cannot swap the same asset');
      return;
    }

    // Validate both assets have required fields before attempting swap
    if (!fromSel.caip || !toSel.caip) {
      console.error('❌ Cannot swap assets: missing CAIP', { fromSel, toSel });
      setError('Invalid assets: missing CAIP identifiers');
      return;
    }
    if (!fromSel.symbol || !toSel.symbol) {
      console.error('❌ Cannot swap assets: missing symbol', { fromSel, toSel });
      setError('Invalid assets: missing symbols');
      return;
    }

    // Clear isMax flag when swapping assets
    setIsMaxAmount(false);

    // Store current values if we're swapping output to input
    const shouldFetchNewQuote = inputAmount && parseFloat(inputAmount) > 0;
    const newInputAmount = inputAmount;

    try {
      // Swap the assets
      await app.setAssetContext({
        caip: toSel.caip,
        networkId: toSel.networkId || caipToNetworkId(toSel.caip),
        symbol: toSel.symbol,
        name: toSel.name,
        icon: toSel.icon,
        priceUsd: toSel.priceUsd
      });

      await app.setOutboundAssetContext({
        caip: fromSel.caip
      });
      console.log(`[SWAP-DEBUG] ✅ Swapped: ${fromSel.symbol} ↔ ${toSel.symbol}`);
    } catch (swapError) {
      console.error('❌ Failed to swap assets:', swapError);
      setError('Failed to swap assets');
      return;
    }

    // Clear amounts and fetch new quote if we had an input amount
    setInputAmount('');
    setOutputAmount('');
    setInputUSDValue('');
    setOutputUSDValue('');
    setQuote(null);
    setError('');

    // If we had an input amount, fetch quote for the swapped direction
    if (shouldFetchNewQuote) {
      console.log(`[SWAP-DEBUG] 🔄 Fetching quote after swap: ${newInputAmount} ${toSel.symbol} → ${fromSel.symbol}`);
      await fetchQuote(newInputAmount, toSel.symbol, fromSel.symbol);
    }
  };

  const getAssetDisplay = (isFromAsset: boolean = false) => {
    const sel = isFromAsset ? app?.assetContext : app?.outboundAssetContext;
    if (!sel) return null;

    console.log(`[SWAP-DEBUG] 🔍 getAssetDisplay ${isFromAsset ? 'FROM' : 'TO'}: ${sel.symbol} price=$${sel.priceUsd}`);

    // Pass through ALL relevant fields from asset context
    return {
      symbol: sel.symbol,
      name: sel.name,
      icon: sel.icon || 'https://pioneers.dev/coins/coin.png',
      caip: sel.caip,
      networkId: sel.networkId,
      explorerTxLink: sel.explorerTxLink,
      explorerAddressLink: sel.explorerAddressLink,
      // Pass through any other fields that might be needed
      ...sel
    };
  };

  // Reset device verification when changing assets
  useEffect(() => {
    console.log('🔄 ASSET CHANGE DETECTED - Resetting device verification');
    setHasViewedOnDevice(false);
    setDeviceVerificationError(null);
    setVaultVerified(false);
    setMemoValid(null);
    setIsExecutingSwap(false);
    setPendingSwap(false);
  }, [app?.assetContext?.caip, app?.outboundAssetContext?.caip]);

  // Only reset isMaxAmount when the INPUT asset changes (not output asset)
  useEffect(() => {
    console.log('🔄 INPUT ASSET CHANGED - Resetting isMax flag');
    setIsMaxAmount(false);
  }, [app?.assetContext?.caip]);

  /**
   * Prepare for swap execution by fetching real API quote with memo, vault, gas
   */
  const handlePrepareSwap = async () => {
    console.log('🎯 Preparing swap - fetching real API quote...');

    if (!app?.assetContext?.caip || !app?.outboundAssetContext?.caip) {
      setError('Missing asset context');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('Invalid amount');
      return;
    }

    try {
      setIsLoadingQuote(true);

      // Fetch real API quote with execution details (memo, vault, gas)
      console.log('[SWAP] Fetching real API quote for execution...');
      console.log('[SWAP] 📦 Request parameters:', {
        caipIn: app.assetContext.caip,
        caipOut: app.outboundAssetContext.caip,
        amount: inputAmount,
        slippagePercentage: 3,
        isMax: isMaxAmount,
      });
      console.log('[SWAP] 📊 Asset contexts:', {
        assetContext: app.assetContext,
        outboundAssetContext: app.outboundAssetContext,
      });

      const quoteResponse = await getSwapQuote(app, {
        caipIn: app.assetContext.caip,
        caipOut: app.outboundAssetContext.caip,
        amount: inputAmount,
        slippagePercentage: 3,
        isMax: isMaxAmount,
      });

      console.log('[SWAP] ✅ Real API quote received');
      console.log('[SWAP] 📦 FULL QUOTE RESPONSE:', JSON.stringify(quoteResponse, null, 2));
      console.log('[SWAP] 📊 Response type:', typeof quoteResponse);
      console.log('[SWAP] 📊 Response keys:', Object.keys(quoteResponse || {}));
      console.log('[SWAP] 📊 Quote object:', quoteResponse?.quote);

      if (!quoteResponse?.quote) {
        throw new Error('No quote received from API');
      }

      // Set the real quote for execution
      setQuote(quoteResponse.quote);

      // Enter confirm mode
      setConfirmMode(true);

    } catch (error: any) {
      console.error('[SWAP] Failed to fetch real quote:', error);
      setError(error?.message || 'Failed to get quote for swap');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const executeSwap = () => {
    console.log('🎯 executeSwap called');

    // CRITICAL: Prevent duplicate execution
    if (isExecutingSwap) {
      console.log('⏭️ Swap already in progress, ignoring duplicate call');
      return;
    }

    if (!quote || !app) {
      setError('No quote available');
      return;
    }

    // Set execution guard FIRST
    setIsExecutingSwap(true);

    // Dispatch swap:signing event to show bubble immediately
    try {
      const signingData = {
        fromAsset: {
          symbol: app.assetContext?.symbol || 'Unknown',
          caip: app.assetContext?.caip || '',
          icon: app.assetContext?.icon || '',
          name: app.assetContext?.name || '',
        },
        toAsset: {
          symbol: app.outboundAssetContext?.symbol || 'Unknown',
          caip: app.outboundAssetContext?.caip || '',
          icon: app.outboundAssetContext?.icon || '',
          name: app.outboundAssetContext?.name || '',
        },
        fromAmount: inputAmount || '0',
        toAmount: outputAmount || '0',
        status: 'signing',
        createdAt: new Date().toISOString(),
      };

      console.log('📡 Dispatching swap:signing event:', signingData);
      window.dispatchEvent(new CustomEvent('swap:signing', { detail: signingData }));
    } catch (err) {
      console.error('Failed to dispatch swap:signing event:', err);
    }

    // Just set the states - actual swap will happen in useEffect
    setIsLoading(true);
    setError('');
    setPendingSwap(true);
    setShowDeviceVerificationDialog(true);
    setIsVerifyingOnDevice(true);
    setDeviceVerificationError(null);
    console.log('✅ Execution guard active, states set, dialog should be showing');
  };

  // Handle the actual swap in useEffect when pendingSwap is true
  useEffect(() => {
    console.log('⚡ useEffect triggered!', { pendingSwap, vaultVerified, hasViewedOnDevice, isExecutingSwap });
    if (!pendingSwap) {
      console.log('⏭️ Skipping - pendingSwap is false');
      return;
    }


    const performSwap = async () => {
      console.log('🚀 Performing swap with device verification...');
      console.log('   vaultVerified:', vaultVerified);
      console.log('   hasViewedOnDevice:', hasViewedOnDevice);

      // If device verification hasn't been done yet, do it first
      // If verification is done but user hasn't confirmed vault, wait
      // Only proceed with swap if vaultVerified is true
      if (!hasViewedOnDevice) {
        console.log('📱 Starting device verification flow...');
        // Continue with device verification below
      } else if (!vaultVerified) {
        console.log('⏳ Device verification done, waiting for user to confirm vault...');
        return; // Wait for user to click "Proceed with Swap"
      } else {
        console.log('✅ Device verified and vault confirmed - proceeding with swap execution');
        // Skip to swap execution (jump to line ~1404)
      }

    try {
      // DEVICE VERIFICATION PHASE
      // Skip this entire section if already verified
      if (!hasViewedOnDevice) {
      // Ensure SDK has an outbound address context
      if (app?.outboundAssetContext?.caip && app?.setOutboundAssetContext) {
        await app.setOutboundAssetContext({
          caip: app.outboundAssetContext.caip
        });
      }

      // CRITICAL: Check if ERC20 approval is needed for THORChain swap
      const inputCaip = app?.assetContext?.caip;
      if (inputCaip && isERC20Token(inputCaip)) {
        console.log('🔍 ERC20 token detected - checking approval status...');
        console.log('   CAIP:', inputCaip);
        console.log('   assetContext:', app.assetContext);
        setIsCheckingApproval(true);

        try {
          // Get token address and THORChain router address
          const tokenAddress = getTokenAddressFromCAIP(inputCaip);
          const routerAddress = '0xD37BbE5744D730a1d98d8DC97c42F0Ca46aD7146'; // THORChain Router

          // Get user address from pubkeys array
          const userAddress = app.assetContext.pubkeys?.[0]?.master || app.assetContext.pubkeys?.[0]?.address;

          // Extract networkId in CAIP format (e.g., "eip155:1")
          const networkId = inputCaip.split('/')[0];
          const chainId = getChainIdFromCAIP(inputCaip);

          console.log('   Parsed tokenAddress:', tokenAddress);
          console.log('   Parsed userAddress:', userAddress);
          console.log('   Parsed networkId:', networkId);
          console.log('   Parsed chainId:', chainId);

          if (!tokenAddress || !userAddress) {
            throw new Error(`Failed to extract token or user address. CAIP: ${inputCaip}, tokenAddress: ${tokenAddress}, userAddress: ${userAddress}`);
          }

          // Convert input amount to base units for approval check using SDK assetContext
          const inputAmountBase = toBaseUnit(inputAmount, app.assetContext);

          // Check current allowance
          const { hasApproval, currentAllowance, requiredAmount } = await checkERC20Allowance(
            app,  // Pass the SDK instance, not app.pioneer
            tokenAddress,
            userAddress,
            routerAddress,
            inputAmountBase,
            networkId  // Pass CAIP format networkId for multi-chain support
          );

          setIsCheckingApproval(false);

          if (!hasApproval) {
            console.log('⚠️  Insufficient approval - need to approve router first');
            console.log(`   Current: ${currentAllowance}, Required: ${requiredAmount}`);

            setNeedsApproval(true);
            setVerificationStep('vault'); // Update UI to show approval step
            setIsApprovingToken(true);

            // Build approval transaction
            console.log('🔨 Building approval transaction...');
            const approvalTx = await buildERC20ApprovalTx(
              app,  // Pass the SDK instance, not app.pioneer
              tokenAddress,
              routerAddress,
              String(requiredAmount), // CRITICAL FIX: Ensure amount is a string for server validation
              userAddress,
              networkId  // CRITICAL FIX: Pass CAIP format networkId (e.g., "eip155:1"), not numeric chainId
            );

            // Debug the approval transaction format
            console.log('📝 Approval transaction from server:', approvalTx);
            console.log('📝 Transaction fields:', {
              to: approvalTx.to,
              from: approvalTx.from,
              value: approvalTx.value,
              data: approvalTx.data,
              chainId: approvalTx.chainId,
              nonce: approvalTx.nonce,
              gasLimit: approvalTx.gasLimit,
              gasPrice: approvalTx.gasPrice
            });

            // Sign and broadcast approval transaction
            console.log('📝 Please sign the approval transaction on your device...');

            // Sign the approval transaction using KeepKey
            const signedApprovalTx = await app.keepKeySdk.eth.ethSignTransaction(approvalTx);

            if (!signedApprovalTx?.serialized) {
              throw new Error('Failed to sign approval transaction');
            }

            console.log('📤 Broadcasting approval transaction...');

            // Broadcast the approval transaction
            const approvalPayload = {
              networkId: caipToNetworkId(inputCaip),
              serialized: signedApprovalTx.serialized,
            };

            console.log('📝 Approval broadcast payload:', approvalPayload);

            const approvalResult = await app.pioneer.Broadcast(approvalPayload);
            console.log('✅ Approval broadcast result:', approvalResult);
            console.log('   approvalResult.data:', approvalResult?.data);
            console.log('   approvalResult.data.txid:', approvalResult?.data?.txid);
            console.log('   approvalResult.data.results:', approvalResult?.data?.results);
            console.log('   approvalResult.data.results.txid:', approvalResult?.data?.results?.txid);

            // Extract txid from broadcast result - try multiple paths
            let approvalTxHash =
              approvalResult?.data?.txid ||
              approvalResult?.data?.results?.txid ||
              approvalResult?.data?.data?.txid ||
              approvalResult?.txid;

            console.log('   Extracted approvalTxHash:', approvalTxHash);

            if (!approvalTxHash || typeof approvalTxHash !== 'string') {
              throw new Error(`Approval broadcast failed - invalid txid: ${JSON.stringify(approvalTxHash)}. Full result: ${JSON.stringify(approvalResult)}`);
            }

            setApprovalTxHash(approvalTxHash);
            console.log(`✅ Approval transaction broadcast: ${approvalTxHash}`);
            console.log(`   View on Etherscan: https://etherscan.io/tx/${approvalTxHash}`);

            // Wait for approval confirmation (at least 1 block)
            console.log('⏳ Waiting for approval confirmation...');
            console.log(`   Approval TX: https://etherscan.io/tx/${approvalTxHash}`);
            setDeviceVerificationError('Waiting for approval transaction to confirm (15 seconds)...');

            // Poll for confirmation (simplified - production should use proper confirmation tracking)
            console.log('⏱️  Starting 15 second wait...');
            const waitStart = Date.now();
            await new Promise(resolve => {
              console.log('⏱️  setTimeout scheduled');
              setTimeout(() => {
                console.log(`⏱️  setTimeout fired after ${Date.now() - waitStart}ms`);
                resolve(true);
              }, 15000);
            });
            console.log(`⏱️  Promise resolved after ${Date.now() - waitStart}ms`);

            console.log('✅ Approval wait complete - proceeding with swap');
            console.log('   Note: Actual confirmation not verified - proceeding optimistically');
            setIsApprovingToken(false);
            setNeedsApproval(false);
            setDeviceVerificationError(null);

            console.log('🔄 Continuing swap flow after approval...');
            console.log(`   hasViewedOnDevice: ${hasViewedOnDevice}`);
          } else {
            console.log('✅ Router already approved - sufficient allowance');
            setNeedsApproval(false);
          }
        } catch (approvalError: any) {
          console.error('❌ Approval check/transaction failed:', approvalError);
          setIsCheckingApproval(false);
          setIsApprovingToken(false);
          setIsVerifyingOnDevice(false);
          setIsLoading(false);
          setIsExecutingSwap(false);  // Reset guard
          setPendingSwap(false);
          setError(`Approval failed: ${approvalError.message}`);
          setShowDeviceVerificationDialog(false);
          return; // Stop swap execution
        }
      }

      // Always verify address on device first (unless already verified)
      if (!hasViewedOnDevice) {
        console.log('🔐 Starting device verification flow...');
        
        try {
          // Prepare address verification on device
        const networkIdToType: any = {
          'bip122:000000000019d6689c085ae165831e93': 'UTXO',
          'bip122:000000000000000000651ef99cb9fcbe': 'UTXO',
          'bip122:000007d91d1254d60e2dd1ae58038307': 'UTXO',
          'bip122:00000000001a91e3dace36e2be3bf030': 'UTXO',
          'bip122:12a765e31ffd4059bada1e25190f6e98': 'UTXO',
          'cosmos:mayachain-mainnet-v1': 'MAYACHAIN',
          'cosmos:osmosis-1': 'OSMOSIS',
          'cosmos:cosmoshub-4': 'COSMOS',
          'cosmos:kaiyo-1': 'COSMOS',
          'cosmos:thorchain-mainnet-v1': 'THORCHAIN',
          'eip155:1': 'EVM',
          'eip155:137': 'EVM',
          'eip155:*': 'EVM',
          'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'XRP',
          ...(isZcashEnabled() ? { [ZCASH_NETWORK_ID]: 'UTXO' } : {}),  // ZCash mainnet (conditional)
        }
        let networkType = networkIdToType[app.outboundAssetContext.networkId]

        // Fallback: if no exact match found, check for eip155:* pattern (all EVM chains)
        if (!networkType && app.outboundAssetContext.networkId?.startsWith('eip155:')) {
          networkType = 'EVM'
          console.log('🔄 Using EVM fallback for network:', app.outboundAssetContext.networkId)
        }

        // SDK automatically populates pathMaster and scriptType in outboundAssetContext
        const pathMaster = app.outboundAssetContext.pathMaster;
        const scriptType = app.outboundAssetContext.scriptType;

        // Fail fast if SDK didn't populate path
        if (!pathMaster) {
          console.error('❌ SDK failed to populate pathMaster in outboundAssetContext');
          console.error('   outboundAssetContext:', app.outboundAssetContext);
          console.error('   This means setOutboundAssetContext may not be calling the SDK method correctly');
          throw new Error(`Cannot verify address on device: missing path for ${app.outboundAssetContext.symbol}`);
        }

        console.log('✅ [Device Verification] Path populated by SDK:', {
          path: pathMaster,
          scriptType: scriptType || 'N/A',
          address: app.outboundAssetContext.address
        });

        console.log('🔍 Device verification context:', {
          networkId: app.outboundAssetContext.networkId,
          networkType,
          pathMaster,
          scriptType,
          address: app.outboundAssetContext.address,
          NetworkIdToChain,
          chainFromNetworkId: NetworkIdToChain?.[app.outboundAssetContext.networkId]
        });

        // Get the chain name for the coin map
        const chainName = NetworkIdToChain[app.outboundAssetContext.networkId];

        if (!chainName) {
          console.error('❌ Chain name not found for network ID:', app.outboundAssetContext.networkId);
          console.error('Available network mappings:', NetworkIdToChain);
          throw new Error(`Chain mapping not found for network: ${app.outboundAssetContext.networkId}`);
        }

        let addressInfo = {
          address_n: bip32ToAddressNList(pathMaster),
          script_type: scriptType,
          // @ts-ignore
          coin: COIN_MAP_KEEPKEY_LONG[chainName],
          show_display: true  // This MUST be true to show on device
        }
        console.log('📱 DEVICE VERIFICATION - Address will be shown on KeepKey');
        console.log('addressInfo: ',addressInfo)
        console.log('⚠️ Please check your KeepKey device to verify the address!');
        
        // Verify we have keepKeySdk
        if (!app.keepKeySdk) {
          console.error('❌ KeepKey SDK not found on app object');
          console.error('Available app properties:', Object.keys(app));
          throw new Error('KeepKey SDK not initialized - check app structure');
        }
        
        console.log('🔍 KeepKey SDK verification:', {
          hasKeepKeySdk: !!app.keepKeySdk,
          hasAddress: !!app.keepKeySdk.address,
          addressMethods: app.keepKeySdk.address ? Object.keys(app.keepKeySdk.address) : [],
          networkType,
          chainName
        });
        
        // Get address from device based on network type (matching updated reference)
        console.log('📱 Calling device to show address...');
        let address
        try {
          switch (networkType) {
            case 'UTXO':
              console.log('Calling utxoGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.utxoGetAddress(addressInfo));
              break;
            case 'EVM':
              console.log('Calling ethereumGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.ethereumGetAddress(addressInfo));
              break;
            case 'OSMOSIS':
              console.log('Calling osmosisGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.osmosisGetAddress(addressInfo));
              break;
            case 'COSMOS':
              console.log('Calling cosmosGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.cosmosGetAddress(addressInfo));
              break;
            case 'MAYACHAIN':
              console.log('Calling mayachainGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.mayachainGetAddress(addressInfo));
              break;
            case 'THORCHAIN':
              console.log('Calling thorchainGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.thorchainGetAddress(addressInfo));
              break;
            case 'XRP':
              console.log('Calling xrpGetAddress with show_display=true');
              ({ address } = await app.keepKeySdk.address.xrpGetAddress(addressInfo));
              break;
            default:
              throw new Error(`Unsupported network type for networkId: ${app.outboundAssetContext.networkId}`);
          }
          console.log('✅ Device call completed, address received:', address);
        } catch (deviceError) {
          console.error('❌ Device call failed:', deviceError);
          throw deviceError;
        }

        console.log('deviceProofAddress: ', address);
        console.log('app.outboundAssetContext.address: ', app.outboundAssetContext.address);
        
        if (address !== app.outboundAssetContext.address) {
          throw new Error('Address mismatch! Device shows different address than expected.');
        }
        
        // Address verified successfully
        console.log('✅ Destination address verified successfully on device!');

        // Mark device verification as complete
        setHasViewedOnDevice(true);

        // Move to vault verification step
        setVerificationStep('vault');
        setIsVerifyingOnDevice(false);
        
        // Get the THORChain vault address from quote
        // Pioneer SDK should provide this in the quote response
        const thorchainVault = quote?.inbound_address;
        if (!thorchainVault) {
          console.error('❌ No vault address in quote response - quote structure:', quote);
          throw new Error('Missing vault address in quote response');
        }
        setVaultAddress(thorchainVault);
        
        console.log('📱 THORChain vault address:', thorchainVault || vaultAddress);
        
        // Validate the memo
        if (quote?.memo) {
          try {
            console.log('🔍 Validating THORChain memo:', quote.memo);
            const isValid = validateThorchainSwapMemo(quote.memo);
            console.log('✅ Memo validation result:', isValid);
            setMemoValid(isValid);
            
            if (!isValid) {
              throw new Error('Invalid THORChain swap memo - transaction cancelled for safety');
            }
          } catch (memoError) {
            console.error('❌ Memo validation failed:', memoError);
            setMemoValid(false);
            throw memoError;
          }
        }
        
        // Wait for user to verify vault and proceed
        console.log('⏳ Waiting for user to verify vault and proceed...');
        setIsVerifyingOnDevice(false); // Allow user to click "Proceed with Swap"

        // Check for dev flag to skip actual swap
        const fakeTxid = process.env.NEXT_PUBLIC_DEV_FAKE_SWAP_TXID;
        if (fakeTxid) {
          console.log('🚧 DEVELOPMENT MODE: Using fake transaction ID:', fakeTxid);

          // Close verification dialog
          setHasViewedOnDevice(true);
          setIsVerifyingOnDevice(false);
          setShowDeviceVerificationDialog(false);

          // Show progress dialog with fake txid
          setProgressTxid(fakeTxid);
          setProgressFromAsset(app?.assetContext);
          setProgressToAsset(app?.outboundAssetContext);
          setProgressInputAmount(inputAmount);
          setProgressOutputAmount(outputAmount);
          setShowProgress(true);
          setConfirmMode(false);
          setPendingSwap(false);
          setVerificationStep('destination');

          return; // Skip actual swap execution
        }

        // STOP HERE - wait for user to click "Proceed with Swap" button
        // The swap will only execute when vaultVerified becomes true
        console.log('🛑 Stopping execution - waiting for user confirmation');
        return;
        } catch (verificationError: any) {
          console.error('❌ Device verification failed:', verificationError);
          setDeviceVerificationError(verificationError.message || 'Device verification failed');
          setIsVerifyingOnDevice(false);
          throw verificationError;
        }
      } // End of if (app?.outboundAssetContext?.caip...)
      } // End of if (!hasViewedOnDevice)

      // SWAP EXECUTION PHASE
      // This code only runs when vaultVerified === true
      if (vaultVerified && typeof app.swap === 'function') {
        try {
          console.log('🚀 Step 1: Building unsigned swap transaction...');
          const swapPayload: any = {
            caipIn: app?.assetContext?.caip,
            caipOut: app?.outboundAssetContext?.caip,
            feeLevel: 8, // Fast fee level for swaps (SDK interprets: <=2=slow, 3-7=average, >=8=fast)
          };

          // Set isMax flag if MAX button was used
          console.log('🔍 Debug swap payload creation:', {
            isMaxAmount,
            inputAmount,
            swapPayloadBefore: { ...swapPayload }
          });
          if (isMaxAmount) {
            console.log('🔥 MAX swap detected - setting isMax: true in payload');
            swapPayload.isMax = true;
            swapPayload.amount = inputAmount;
          } else {
            console.log('📊 Regular swap - providing amount in payload');
            swapPayload.amount = inputAmount;
          }

          console.log('📦 Swap payload:', swapPayload);
          console.log('🔍 isMaxAmount state:', isMaxAmount);

          // STEP 1: Build unsigned transaction
          const unsignedTx = await app.swap(swapPayload);
          console.log('✅ Step 1 Complete: Unsigned transaction built:', unsignedTx);

          if (!unsignedTx) {
            throw new Error('Failed to build unsigned transaction');
          }

          // STEP 2: Sign transaction with device
          console.log('🔐 Step 2: Signing transaction on KeepKey device...');
          console.log('⚠️  Please confirm the transaction on your KeepKey device!');

          let signedTx: any;
          const networkId = app.assetContext.networkId;
          const caip = app.assetContext.caip;

          // Determine network type for signing
          const networkIdToType: any = {
            'bip122:000000000019d6689c085ae165831e93': 'UTXO',
            'bip122:000000000000000000651ef99cb9fcbe': 'UTXO',
            'bip122:000007d91d1254d60e2dd1ae58038307': 'UTXO',
            'bip122:00000000001a91e3dace36e2be3bf030': 'UTXO',
            'bip122:12a765e31ffd4059bada1e25190f6e98': 'UTXO',
            'cosmos:mayachain-mainnet-v1': 'TENDERMINT',
            'cosmos:osmosis-1': 'TENDERMINT',
            'cosmos:cosmoshub-4': 'TENDERMINT',
            'cosmos:kaiyo-1': 'TENDERMINT',
            'cosmos:thorchain-mainnet-v1': 'TENDERMINT',
            'eip155:1': 'EVM',
            'eip155:137': 'EVM',
            'eip155:8453': 'EVM',
            'eip155:*': 'EVM',
            'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'XRP',
            ...(isZcashEnabled() ? { [ZCASH_NETWORK_ID]: 'UTXO' } : {}),  // ZCash mainnet (conditional)
          };

          const networkType = networkIdToType[networkId];
          console.log('🔍 Network type for signing:', networkType);

          if (networkType === 'UTXO') {
            // Get the chain name for COIN_MAP
            const chainName = NetworkIdToChain[networkId];
            if (!chainName) {
              throw new Error(`Chain mapping not found for network: ${networkId}`);
            }

            const signPayload: any = {
              // @ts-ignore
              coin: COIN_MAP_KEEPKEY_LONG[chainName],
              inputs: unsignedTx.inputs,
              outputs: unsignedTx.outputs,
              version: 1,
              locktime: 0,
            };

            // Add memo as OP_RETURN if present
            if (unsignedTx.memo && unsignedTx.memo !== ' ') {
              signPayload.opReturnData = unsignedTx.memo;
            }

            console.log('📝 UTXO sign payload:', signPayload);
            const responseSign = await app.keepKeySdk.utxo.utxoSignTransaction(signPayload);
            signedTx = responseSign.serializedTx;

          } else if (networkType === 'EVM') {
            console.log('📝 EVM sign payload:', unsignedTx);
            const responseSign = await app.keepKeySdk.eth.ethSignTransaction(unsignedTx);
            signedTx = responseSign.serialized;

          } else if (networkType === 'TENDERMINT') {
            // Tendermint chains (Cosmos, Thorchain, etc.)
            console.log('📝 Tendermint sign payload:', unsignedTx);

            const msgType = unsignedTx.signDoc?.msgs?.[0]?.type;
            console.log('Tendermint message type:', msgType);

            let responseSign: any;
            switch (caip) {
              case 'cosmos:thorchain-mainnet-v1/slip44:931':
                responseSign = await app.keepKeySdk.thorchain.thorchainSignAmino(unsignedTx);
                break;
              case 'cosmos:cosmoshub-4/slip44:118':
                if (msgType === 'cosmos-sdk/MsgDelegate') {
                  responseSign = await app.keepKeySdk.cosmos.cosmosSignAminoDelegate(unsignedTx);
                } else if (msgType === 'cosmos-sdk/MsgUndelegate') {
                  responseSign = await app.keepKeySdk.cosmos.cosmosSignAminoUndelegate(unsignedTx);
                } else {
                  responseSign = await app.keepKeySdk.cosmos.cosmosSignAmino(unsignedTx);
                }
                break;
              case 'cosmos:osmosis-1/slip44:118':
                responseSign = await app.keepKeySdk.osmosis.osmosisSignAmino(unsignedTx);
                break;
              default:
                throw new Error(`Unsupported Tendermint chain: ${caip}`);
            }
            signedTx = responseSign.serialized;

          } else if (networkType === 'XRP') {
            console.log('📝 XRP sign payload:', unsignedTx);
            const responseSign = await app.keepKeySdk.ripple.rippleSignTransaction(unsignedTx);
            signedTx = responseSign.serialized;

          } else {
            throw new Error(`Unsupported network type for signing: ${networkType}`);
          }

          console.log('✅ Step 2 Complete: Transaction signed!');

          // STEP 3: Broadcast transaction
          console.log('📡 Step 3: Broadcasting transaction to network...');

          const broadcastPayload = {
            networkId: caipToNetworkId(caip),
            serialized: signedTx,
          };

          console.log('📝 Broadcast payload:', broadcastPayload);

          const broadcastResult = await app.pioneer.Broadcast(broadcastPayload);
          console.log('✅ Step 3 Complete: Broadcast result:', broadcastResult);

          // Extract txid from broadcast result
          let txid = broadcastResult?.data?.txid || broadcastResult?.data?.data?.txid || broadcastResult?.data;

          if (!txid) {
            throw new Error('Broadcast succeeded but no transaction ID returned');
          }

          // Remove 0x prefix if present (for Ethereum transactions)
          if (typeof txid === 'string' && txid.startsWith('0x')) {
            txid = txid.slice(2);
          }

          console.log('🎉 Swap successful! Transaction ID:', txid);

          // Save pending swap to database for history tracking
          try {
            console.log('💾 Saving swap to pending swaps database...');

            // Get user address - prioritize ETH address for multi-chain swaps
            const userAddress =
              app?.pubkeys?.find((p: any) => p.networks?.includes('eip155:1') || p.networks?.includes('eip155:*'))?.address ||
              app?.pubkeys?.find((p: any) => p.address)?.address ||
              app?.assetContext?.pubkey ||
              '';

            if (!userAddress) {
              console.warn('⚠️ No user address found - swap will not be saved to history');
            } else {
              // Helper to convert display amount to base units (atomic units)
              const convertToBaseUnits = (amount: string, precision: number): string => {
                const numAmount = parseFloat(amount);
                const multiplier = Math.pow(10, precision);
                const baseUnits = Math.floor(numAmount * multiplier);
                return baseUnits.toString();
              };

              // Get asset precision (decimals) from Pioneer SDK context
              const sellPrecision = app.assetContext.precision || 18; // Default to 18 for EVM
              const buyPrecision = app.outboundAssetContext.precision || 18;

              const pendingSwapData = {
                txHash: String(txid),
                addresses: [userAddress],
                sellAsset: {
                  caip: app.assetContext.caip,
                  symbol: app.assetContext.symbol || getAssetDisplay(true)?.symbol || 'UNKNOWN',
                  name: app.assetContext.name,
                  icon: app.assetContext.icon,
                  amount: inputAmount,
                  networkId: caipToNetworkId(app.assetContext.caip),
                  address: userAddress,
                  amountBaseUnits: convertToBaseUnits(inputAmount, sellPrecision)
                },
                buyAsset: {
                  caip: app.outboundAssetContext.caip,
                  symbol: app.outboundAssetContext.symbol || getAssetDisplay(false)?.symbol || 'UNKNOWN',
                  name: app.outboundAssetContext.name,
                  icon: app.outboundAssetContext.icon,
                  amount: outputAmount,
                  networkId: caipToNetworkId(app.outboundAssetContext.caip),
                  address: userAddress, // Required by API schema
                  amountBaseUnits: convertToBaseUnits(outputAmount, buyPrecision)
                },
                quote: quote ? {
                  memo: quote.memo,
                  slippage: quote.slippageBps ? quote.slippageBps / 100 : 3,
                  fees: quote.fees || {},
                  raw: quote
                } : undefined,
                integration: 'thorchain',
                status: 'pending'
              };

              console.log('💾 Pending swap data prepared:', pendingSwapData);

              // Store for async save with retry logic (done after UI update)
              // This prevents blocking the UI while waiting for backend
              (window as any).__pendingSwapToSave = pendingSwapData;
            }
          } catch (prepError: any) {
            console.error('⚠️ Failed to prepare swap data:', prepError);
          }

          // CRITICAL: Reset execution guard and pendingSwap FIRST
          // This prevents useEffect from re-triggering
          console.log('✅ Swap successful - atomic state reset');
          setIsExecutingSwap(false);  // ← FIRST
          setPendingSwap(false);       // ← SECOND

          // Then reset verification states (won't trigger useEffect now)
          setHasViewedOnDevice(false);  // Reset for next swap
          setIsVerifyingOnDevice(false);
          setShowDeviceVerificationDialog(false);
          setVaultVerified(false);      // ← Safe now
          setMemoValid(null);
          setVerificationStep('destination');

          // 1. Prepare swap data for global SwapProgress dialog
          const swapData = {
            txHash: String(txid),
            fromAsset: app.assetContext,
            toAsset: app.outboundAssetContext,
            inputAmount: inputAmount,
            outputAmount: outputAmount,
            memo: quote?.memo
          };

          console.log('🚀 SWAP BROADCAST:', {
            txHash: String(txid),
            fromAsset: app.assetContext.symbol,
            toAsset: app.outboundAssetContext.symbol,
            inputAmount,
            outputAmount
          });

          // Store in window to survive navigation (dashboard will check on mount)
          (window as any).__pendingSwapBroadcast = swapData;

          // Also dispatch event for any current listeners
          window.dispatchEvent(new CustomEvent('swap:broadcast', {
            detail: swapData
          }));

          // 2. Navigate away from Swap page immediately
          console.log('✅ Swap broadcasted - navigating to dashboard');
          router.push('/');

          // 5. Save pending swap with retry logic (async, non-blocking)
          (async () => {
            const pendingSwapData = (window as any).__pendingSwapToSave;
            if (!pendingSwapData) {
              console.warn('⚠️ No pending swap data to save');
              return;
            }

            // Retry up to 3 times with 2s delay
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                console.log(`💾 Saving swap (attempt ${attempt}/3)...`);
                const result = await app.pioneer.CreatePendingSwap(pendingSwapData);
                console.log('✅ Swap saved to database:', result);
                break; // Success - exit retry loop
              } catch (err) {
                console.error(`❌ Attempt ${attempt}/3 failed to save swap:`, err);
                if (attempt < 3) {
                  await new Promise(r => setTimeout(r, 2000)); // 2s delay before retry
                } else {
                  console.error('⚠️ All retry attempts failed - swap saved locally only');
                }
              }
            }

            // Clean up temp storage
            delete (window as any).__pendingSwapToSave;
          })();
        } catch (error: any) {
          console.error('❌ Swap execution failed:', error);

          // Parse error message for better user feedback
          let errorMessage = 'An error occurred during the swap';

          if (error?.message) {
            const msg = error.message.toLowerCase();

            // Common error types with user-friendly messages
            if (msg.includes('failed to fetch') || msg.includes('connection refused') || msg.includes('network')) {
              errorMessage = 'Unable to connect to swap service. Please check your connection and try again.';
            } else if (msg.includes('quote')) {
              errorMessage = 'Failed to get swap quote. The swap route may not be available right now.';
            } else if (msg.includes('insufficient') || msg.includes('balance')) {
              errorMessage = 'Insufficient balance to complete this swap.';
            } else if (msg.includes('user') && msg.includes('reject')) {
              errorMessage = 'Transaction rejected on device.';
            } else if (msg.includes('timeout')) {
              errorMessage = 'Request timed out. Please try again.';
            } else {
              errorMessage = error.message;
            }
          }

          setDeviceVerificationError(errorMessage);
          setIsVerifyingOnDevice(false);
          setIsLoading(false);
          setIsExecutingSwap(false);  // Reset guard
          setPendingSwap(false);

          // Don't throw - let user see error and close dialog
          return;
        } finally {
          setIsLoading(false);
          setIsExecutingSwap(false);  // Reset guard
          setPendingSwap(false);
        }
      } // End of if (vaultVerified && typeof app.swap === 'function')
    } catch (error: any) {
      console.error('❌ Outer swap error:', error);
      setError(error.message || 'An error occurred');
      setIsExecutingSwap(false);  // Reset guard
      // Only reset pendingSwap on actual error (not when waiting for user)
      setPendingSwap(false);
    } finally {
      setIsLoading(false);
      // DO NOT reset pendingSwap here - it needs to stay true while waiting for user confirmation
      // But we can safely reset the guard flag in error scenarios
      // Note: Success path already resets this explicitly
    }
  };
  
  performSwap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSwap, vaultVerified, hasViewedOnDevice, isExecutingSwap]);
  // Note: app, quote, inputAmount captured in closure - adding them causes loop

  // Check if we're still loading assets - show spinner until we have loaded balances data
  // Note: Don't check availableAssets.length here - that's filtered data (could be 0 if all below threshold)
  const isLoadingAssets = !app?.balances || app.balances.length === 0;

  return (
    <Box
      bg="black"
      minH="100vh"
      position="relative"
      backgroundImage="url(/images/backgrounds/splash-bg.png)"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
    >
      {/* Loading swap assets from Pioneer */}
      {isLoadingSwapAssets && (
        <Container maxW="container.md" py={8}>
          <Box textAlign="center" py={12}>
            <Text mt={4} color="gray.400">Loading swap assets...</Text>
          </Box>
        </Container>
      )}

      {/* Error loading swap assets */}
      {!isLoadingSwapAssets && supportedSwapAssets.length === 0 && swapAssetsError && (
        <Container maxW="container.md" py={8}>
          <Box textAlign="center" py={12}>
            <FaExclamationTriangle size={48} color="orange" />
            <Text mt={4} color="red.500" fontWeight="bold">
              {swapAssetsSource === 'emergency-fallback'
                ? 'Using fallback swap assets'
                : 'Failed to load swap assets'}
            </Text>
            <Text mt={2} fontSize="sm" color="gray.400">{swapAssetsError}</Text>
            {swapAssetsSource !== 'emergency-fallback' && (
              <Button
                mt={4}
                colorScheme="blue"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            )}
          </Box>
        </Container>
      )}

      {/* Device Verification Modal - Using simple overlay approach */}
      {showDeviceVerificationDialog && (
        <>
          {console.log('🔵 DIALOG RENDERING NOW')}
          {/* Backdrop */}
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.800"
            zIndex={1000}
            onClick={() => {
              if (!isVerifyingOnDevice) {
                setShowDeviceVerificationDialog(false);
                setDeviceVerificationError(null);
                setIsExecutingSwap(false);  // Reset guard
                setPendingSwap(false);
                setVerificationStep('destination');
                setVaultVerified(false);
                setMemoValid(null);
              }
            }}
          />
          
          {/* Modal Content */}
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            zIndex={1001}
            maxW="md"
            width="90%"
            bg="gray.900"
            borderWidth="1px"
            borderColor="gray.700"
            borderRadius="xl"
            p={6}
          >
            {/* Header - Different for each step */}
            <HStack gap={3} mb={4}>
              <FaShieldAlt color="#3182ce" size="20" />
              <Text fontSize="lg" fontWeight="bold">
                {isCheckingApproval ? 'Checking Token Approval...' :
                 isApprovingToken ? 'Approve Token for Swap' :
                 verificationStep === 'destination' ? 'Verify Destination Address' :
                 verificationStep === 'vault' ? 'Verify THORChain Router' :
                 'Confirm Swap Transaction'}
              </Text>
            </HStack>
            
            <VStack gap={4} align="stretch">
              {/* Show different content based on verification step */}
              {isCheckingApproval || isApprovingToken ? (
                <>
                  {/* APPROVAL STEP */}
                  <Box
                    bg="blue.900/30"
                    borderWidth="1px"
                    borderColor="blue.700/50"
                    borderRadius="lg"
                    p={4}
                  >
                    <Text fontSize="sm" color="gray.300" mb={3}>
                      {isCheckingApproval ?
                        'Checking if THORChain router is approved to spend your tokens...' :
                        'You need to approve the THORChain router to spend your tokens before swapping.'}
                    </Text>
                    {isApprovingToken && (
                      <>
                        <Text fontSize="xs" color="gray.400" mt={2}>
                          This is a one-time approval transaction. After approval, your swap will proceed automatically.
                        </Text>
                        {approvalTxHash && (
                          <Box mt={3}>
                            <Text fontSize="xs" color="green.400">
                              ✓ Approval transaction broadcast
                            </Text>
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              Tx: {typeof approvalTxHash === 'string' ? `${approvalTxHash.slice(0, 10)}...${approvalTxHash.slice(-8)}` : String(approvalTxHash)}
                            </Text>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>

                  {/* Loading Spinner */}
                  <HStack justify="center" py={4}>
                    <Spinner size="lg" color="blue.400" />
                    <Text color="gray.400">
                      {isCheckingApproval ? 'Checking allowance...' :
                       approvalTxHash ? 'Waiting for confirmation...' :
                       'Sign approval on device...'}
                    </Text>
                  </HStack>
                </>
              ) : verificationStep === 'vault' ? (
                <>
                  {/* VAULT VERIFICATION STEP */}
                  <Box
                    bg="teal.900/30"
                    borderWidth="1px"
                    borderColor="teal.700/50"
                    borderRadius="lg"
                    p={4}
                  >
                    <Text fontSize="sm" color="gray.300" mb={3}>
                      Your funds will be sent to the THORChain router/vault address below.
                      This is the official THORChain vault that will process your swap.
                    </Text>
                  </Box>

                  {/* Vault Address Display */}
                  {vaultAddress && (
                    <Box bg="gray.800" p={4} borderRadius="lg" width="full">
                      <VStack align="start" gap={3}>
                        <HStack justify="space-between" width="full">
                          <Text fontSize="sm" color="gray.400">THORChain Vault:</Text>
                          {vaultVerified && (
                            <HStack gap={1}>
                              <Text fontSize="xs" color="green.400">Verified</Text>
                              <Box color="green.400">✓</Box>
                            </HStack>
                          )}
                        </HStack>
                        <Code
                          fontSize="sm"
                          bg="gray.900"
                          color="cyan.400"
                          p={3}
                          borderRadius="md"
                          width="full"
                          wordBreak="break-all"
                        >
                          {vaultAddress}
                        </Code>
                        <Button
                          as="a"
                          href="https://thornode.ninerealms.com/thorchain/inbound_addresses"
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          variant="outline"
                          borderColor="#23DCC8"
                          color="#23DCC8"
                          width="full"
                          leftIcon={<FaExternalLinkAlt />}
                          _hover={{
                            bg: 'rgba(35, 220, 200, 0.1)',
                            borderColor: '#1FC4B3'
                          }}
                        >
                          Verify Vault Address (THORNode)
                        </Button>
                        <Text fontSize="xs" color="gray.400" textAlign="center" width="full">
                          Verify this vault address is official from THORChain
                        </Text>
                      </VStack>
                    </Box>
                  )}

                  {/* Memo Display and Validation */}
                  {quote?.memo && (
                    <Box bg="gray.800" p={4} borderRadius="lg" width="full">
                      <VStack align="start" gap={3}>
                        <HStack justify="space-between" width="full">
                          <Text fontSize="sm" color="gray.400">Swap Memo:</Text>
                          {memoValid !== null && (
                            <HStack gap={1}>
                              {memoValid ? (
                                <>
                                  <Text fontSize="xs" color="green.400">Valid Memo</Text>
                                  <Box color="green.400">✓</Box>
                                </>
                              ) : (
                                <>
                                  <Text fontSize="xs" color="red.400">Invalid Memo</Text>
                                  <Box color="red.400">✗</Box>
                                </>
                              )}
                            </HStack>
                          )}
                        </HStack>
                        <Code
                          fontSize="sm"
                          bg="gray.900"
                          color={memoValid === false ? 'red.400' : 'cyan.400'}
                          p={3}
                          borderRadius="md"
                          width="full"
                          wordBreak="break-all"
                        >
                          {quote.memo}
                        </Code>
                        <Text fontSize="xs" color="gray.500">
                          This memo contains your swap instructions and destination address
                        </Text>
                      </VStack>
                    </Box>
                  )}

                  {/* Warning for invalid memo */}
                  {memoValid === false && (
                    <Box
                      bg="red.900/50"
                      borderWidth="1px"
                      borderColor="red.500"
                      borderRadius="lg"
                      p={3}
                    >
                      <HStack gap={2}>
                        <FaExclamationTriangle color="#fc8181" size="16" />
                        <Text fontSize="sm" color="red.300">
                          Invalid memo detected! This transaction will be cancelled for your safety.
                        </Text>
                      </HStack>
                    </Box>
                  )}
                  
                  {/* Action Buttons */}
                  <HStack gap={3} width="full">
                    <Button
                      variant="ghost"
                      color="gray.500"
                      _hover={{ bg: 'gray.800' }}
                      onClick={() => {
                        setShowDeviceVerificationDialog(false);
                        setDeviceVerificationError(null);
                        setIsExecutingSwap(false);  // Reset guard
                        setPendingSwap(false);
                        setVerificationStep('destination');
                        setVaultVerified(false);
                        setMemoValid(null);
                      }}
                      flex={1}
                      disabled={isVerifyingOnDevice}
                    >
                      Cancel
                    </Button>
                    <Button
                      bg="blue.500"
                      color="white"
                      _hover={{ bg: 'blue.600' }}
                      _active={{ bg: 'blue.700' }}
                      onClick={() => {
                        console.log('🖱️ Proceed with Swap clicked!', { memoValid, vaultVerified });
                        if (memoValid !== false) {
                          console.log('✅ Setting vaultVerified = true');
                          setVaultVerified(true);
                          setVerificationStep('swap');
                          setIsVerifyingOnDevice(true);
                        } else {
                          console.log('❌ Blocked by memoValid === false');
                        }
                      }}
                      flex={1}
                      disabled={memoValid === false || isVerifyingOnDevice}
                    >
                      {console.log('🔘 Button rendering:', { memoValid, vaultVerified, isVerifyingOnDevice })}
                      Proceed with Swap
                    </Button>
                  </HStack>
                </>
              ) : verificationStep === 'swap' ? (
                <>
                  {/* SWAP CONFIRMATION STEP */}
                  <Box 
                    bg="green.900/30" 
                    borderWidth="1px" 
                    borderColor="green.700/50" 
                    borderRadius="lg" 
                    p={4}
                  >
                    <HStack gap={3} align="start">
                      <FaExchangeAlt color="#68d391" size="20" style={{ marginTop: '2px' }} />
                      <VStack align="start" gap={2} flex={1}>
                        <Text fontWeight="semibold" color="green.300">
                          Building Swap Transaction
                        </Text>
                        <Text fontSize="sm" color="gray.300">
                          Your swap transaction is being built and prepared for signing.
                        </Text>
                        
                        {/* Swap Summary */}
                        <Box bg="gray.800" p={3} borderRadius="md" width="full">
                          <VStack align="start" gap={2}>
                            <HStack justify="space-between" width="full">
                              <Text fontSize="xs" color="gray.400">From:</Text>
                              <HStack gap={1}>
                                <Text fontSize="xs" fontWeight="medium">{inputAmount} {app?.assetContext?.symbol}</Text>
                              </HStack>
                            </HStack>
                            <HStack justify="space-between" width="full">
                              <Text fontSize="xs" color="gray.400">To:</Text>
                              <HStack gap={1}>
                                <Text fontSize="xs" fontFamily="mono" color="gray.300" noOfLines={1}>
                                  {app?.outboundAssetContext?.address ?
                                    `${app.outboundAssetContext.address.slice(0, 8)}...${app.outboundAssetContext.address.slice(-6)}` :
                                    'N/A'}
                                </Text>
                              </HStack>
                            </HStack>
                            {vaultAddress && (
                              <HStack justify="space-between" width="full">
                                <Text fontSize="xs" color="gray.400">Via Vault:</Text>
                                <Text fontSize="xs" fontFamily="mono" color="gray.300" noOfLines={1}>
                                  {vaultAddress.slice(0, 8)}...{vaultAddress.slice(-6)}
                                </Text>
                              </HStack>
                            )}
                          </VStack>
                        </Box>
                        
                        {/* THORChain Memo Display with Validation */}
                        {quote?.memo && (
                          <Box bg="gray.800" p={3} borderRadius="md" width="full" mt={2}>
                            <VStack align="start" gap={2}>
                              <HStack justify="space-between" width="full">
                                <Text fontSize="xs" color="gray.400">THORChain Memo:</Text>
                                {memoValid && (
                                  <HStack gap={1}>
                                    <Text fontSize="xs" color="green.400">Valid</Text>
                                    <Box color="green.400">✓</Box>
                                  </HStack>
                                )}
                              </HStack>
                              <Code 
                                fontSize="xs" 
                                bg="gray.900" 
                                color="cyan.400" 
                                p={2} 
                                borderRadius="md" 
                                width="full"
                                wordBreak="break-all"
                              >
                                {quote.memo}
                              </Code>
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    </HStack>
                  </Box>
                  
                  {/* Device Confirmation Prompt */}
                  <Box 
                    bg="blue.900/50" 
                    borderWidth="2px" 
                    borderColor="blue.500" 
                    borderRadius="lg" 
                    p={6}
                    boxShadow="0 0 20px rgba(59, 130, 246, 0.5)"
                  >
                    <VStack gap={3}>
                      <Text fontSize="lg" fontWeight="bold" color="white">
                        Confirm on your KeepKey device!
                      </Text>
                      <Text fontSize="sm" color="gray.300" textAlign="center">
                        Please review and confirm the swap transaction on your device
                      </Text>
                      <Text fontSize="xs" color="gray.400" textAlign="center">
                        This will send {inputAmount} {app?.assetContext?.symbol} to THORChain for swapping
                      </Text>
                      {/* Show decoded memo if available from transaction data */}
                      {app?.unsignedTx?.data && (
                        <Box width="full" mt={2}>
                          <Text fontSize="xs" color="gray.500" mb={1}>Transaction Data (Memo):</Text>
                          <Code 
                            fontSize="xs" 
                            bg="gray.800" 
                            color="cyan.400" 
                            p={2} 
                            borderRadius="md" 
                            width="full"
                            wordBreak="break-all"
                          >
                            {(() => {
                              try {
                                const hexData = app.unsignedTx.data.startsWith('0x') 
                                  ? app.unsignedTx.data.slice(2) 
                                  : app.unsignedTx.data;
                                return Buffer.from(hexData, 'hex').toString('utf8');
                              } catch {
                                return app.unsignedTx.data;
                              }
                            })()}
                          </Code>
                        </Box>
                      )}
                    </VStack>
                  </Box>
                </>
              ) : verificationStep === 'destination' ? (
                <>
              {/* Security Notice */}
              <Box 
                bg="blue.900/30" 
                borderWidth="1px" 
                borderColor="blue.700/50" 
                borderRadius="lg" 
                p={4}
              >
                <HStack gap={3} align="start">
                  <FaEye color="#63b3ed" size="20" style={{ marginTop: '2px' }} />
                  <VStack align="start" gap={2}>
                    <Text fontWeight="semibold" color="blue.300">
                      Verify Destination Address on Device
                    </Text>
                    <Text fontSize="sm" color="gray.300">
                      For your security, please verify the destination address on your KeepKey device.
                      Check that the address shown on your device matches the expected destination.
                    </Text>
                  </VStack>
                </HStack>
              </Box>

              {/* Address Info */}
              <Box bg="gray.800" borderRadius="lg" p={4}>
                <VStack align="stretch" gap={3}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.400">Destination Network:</Text>
                    <HStack gap={2}>
                      <AssetIcon src={app?.outboundAssetContext?.icon} caip={app?.outboundAssetContext?.caip} symbol={app?.outboundAssetContext?.symbol} alt="asset" boxSize="16px" />
                      <Text fontSize="sm" fontWeight="medium">
                        {app?.outboundAssetContext?.name || app?.outboundAssetContext?.symbol}
                      </Text>
                    </HStack>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.400">Address:</Text>
                    <Text fontSize="xs" fontFamily="mono" color="gray.300" noOfLines={1}>
                      {app?.outboundAssetContext?.address?.slice(0, 8)}...{app?.outboundAssetContext?.address?.slice(-6)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Status - Make this VERY prominent */}
              {isVerifyingOnDevice && (
                <Box 
                  bg="blue.900/50" 
                  borderWidth="2px" 
                  borderColor="blue.500" 
                  borderRadius="lg" 
                  p={6}
                  boxShadow="0 0 20px rgba(59, 130, 246, 0.5)"
                >
                  <VStack gap={3}>
                    <Text fontSize="lg" fontWeight="bold" color="white">
                      Look at your KeepKey device!
                    </Text>
                    <Text fontSize="sm" color="gray.300" textAlign="center">
                      Please verify the destination address shown on your device screen
                    </Text>
                    <Text fontSize="xs" color="gray.400" textAlign="center">
                      Press the button on your device to confirm or hold to reject
                    </Text>
                  </VStack>
                </Box>
              )}

              {/* Error Message */}
              {deviceVerificationError && (
                <Box 
                  bg="red.900/30" 
                  borderWidth="1px" 
                  borderColor="red.700/50" 
                  borderRadius="lg" 
                  p={3}
                >
                  <HStack gap={2}>
                    <FaExclamationTriangle color="#fc8181" size="16" />
                    <Text fontSize="sm" color="red.400">
                      {deviceVerificationError}
                    </Text>
                  </HStack>
                </Box>
              )}

                </>
              ) : null}

              {/* Action Buttons - Show for errors ONLY when not in a step that has its own buttons */}
              {!isVerifyingOnDevice && deviceVerificationError && verificationStep !== 'vault' && verificationStep !== 'destination' && (
                <HStack gap={3} pt={2}>
                  <Button
                    flex={1}
                    variant="ghost"
                    onClick={() => {
                      // Fully reset swap state
                      setShowDeviceVerificationDialog(false);
                      setDeviceVerificationError(null);
                      setIsLoading(false);
                      setIsExecutingSwap(false);  // Reset guard
                      setPendingSwap(false);
                      setIsVerifyingOnDevice(false);
                      setVerificationStep('destination');
                      setVaultVerified(false);
                      setMemoValid(null);
                      setConfirmMode(false); // Return to quote view
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    flex={1}
                    colorScheme="blue"
                    onClick={() => {
                      setDeviceVerificationError(null);
                      executeSwap();
                    }}
                  >
                    Retry
                  </Button>
                </HStack>
              )}
            </VStack>
          </Box>
        </>
      )}

      {/* Main Swap Content - Centered vertically */}
      <Flex
        align="center"
        justify="center"
        minH="100vh"
        px={4}
        py={20}
      >
        <Box maxW="480px" width="full">
          <Card.Root
            bg="rgba(17, 17, 17, 0.95)"
            backdropFilter="blur(20px)"
            borderColor="#23DCC8"
            borderWidth="2px"
            borderRadius="2xl"
            boxShadow="0 4px 24px 0 rgba(35, 220, 200, 0.15)"
          >
            <Card.Body p={4}>
              {/* Card Title */}
              <HStack justify="center" gap={2} mb={4} pb={3} borderBottom="1px solid" borderColor="gray.700">
                <Image src="https://pioneers.dev/coins/thorchain.png" alt="THORChain" boxSize="28px" />
                <Text fontSize="xl" fontWeight="bold" color="white">
                  THORChain Swapper
                </Text>
              </HStack>

              {(isLoadingAssets || isLoadingMarkets || marketPools.length === 0) ? (
                <VStack py={20} gap={4}>
                  <Box position="relative">
                    <Spinner
                      size="xl"
                      color="blue.500"
                    />
                    <Box
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                    >
                      <Image
                        src="https://pioneers.dev/coins/thorchain.png"
                        alt="Loading"
                        boxSize="32px"
                        opacity={0.8}
                      />
                    </Box>
                  </Box>
                  <VStack gap={1}>
                    <Text color="gray.300" fontSize="lg" fontWeight="medium">
                      {isLoadingMarkets || marketPools.length === 0
                        ? 'Loading market data'
                        : 'Loading your assets'}
                    </Text>
                    <Text color="gray.500" fontSize="sm">
                      {isLoadingMarkets || marketPools.length === 0
                        ? 'Fetching THORChain pool liquidity...'
                        : 'Fetching balances and current prices...'}
                    </Text>
                  </VStack>
                </VStack>
              ) : availableAssets.length === 0 ? (
                <VStack py={20} gap={4}>
                  <Text color="orange.400" fontSize="lg" fontWeight="medium">
                    No assets available
                  </Text>
                  <Text color="gray.500" fontSize="sm" textAlign="center" px={4}>
                    You need at least $0.01 worth of assets to start swapping
                  </Text>
                </VStack>
              ) : showSuccess ? (
                <SwapSuccess
                  txid={successTxid}
                  fromAsset={getAssetDisplay(true)}
                  toAsset={getAssetDisplay(false)}
                  inputAmount={inputAmount}
                  outputAmount={outputAmount}
                  outboundAssetContext={app?.outboundAssetContext}
                  memo={quote?.memo}
                  txData={app?.unsignedTx}
                  onClose={() => {
                    setShowSuccess(false);
                    setSuccessTxid('');
                    setInputAmount('');
                    setOutputAmount('');
                    setQuote(null);
                    setError('');

                    // Refresh pending swaps to show the new swap in history
                    refreshPendingSwaps();
                  }}
                />
              ) : (
              <Stack gap={2}>
                {!confirmMode ? (
                  <>
                    {/* Building Quote Loading State */}
                    {isLoadingQuote ? (
                      <VStack py={20} gap={6}>
                        <Box position="relative">
                          <Spinner
                            emptyColor="gray.700"
                            color="#23DCC8"
                            size="xl"
                            boxSize="80px"
                          />
                          <Box
                            position="absolute"
                            top="50%"
                            left="50%"
                            transform="translate(-50%, -50%)"
                          >
                            <Image
                              src="https://pioneers.dev/coins/thorchain.png"
                              alt="Loading"
                              boxSize="40px"
                              opacity={0.8}
                            />
                          </Box>
                        </Box>
                        <VStack gap={1}>
                          <Text color="gray.300" fontSize="xl" fontWeight="medium">
                            Building quote...
                          </Text>
                          <Text color="gray.500" fontSize="sm">
                            Calculating optimal swap route
                          </Text>
                        </VStack>
                      </VStack>
                    ) : (
                      <>
                    {/* From Section */}
                    <Box>
                      <AssetSelector
                        asset={getAssetDisplay(true)}
                        balance={getUserBalance(app?.assetContext?.caip)}
                        balanceUsd={getUserBalanceUSD(app?.assetContext?.caip)}
                        label="From"
                        onClick={() => setShowAssetPicker('from')}
                        onMaxClick={handleMaxClick}
                        showMaxButton={true}
                      />
                      
                      <Box mt={2}>
                        <SwapInput
                          value={(() => {
                            const usdCalc = inputAmount && app?.assetContext?.priceUsd ?
                              (parseFloat(inputAmount) * parseFloat(app.assetContext.priceUsd)).toFixed(2) :
                              undefined;
                            console.log(`[SWAP-DEBUG] 📊 Input render: ${inputAmount} ${app?.assetContext?.symbol} = $${usdCalc}`);
                            return inputAmount;
                          })()}
                          onChange={handleInputChange}
                          showMaxButton={false} // Max button is now in AssetSelector
                          onMaxClick={handleMaxClick}
                          usdAmount={inputAmount && app?.assetContext?.priceUsd ?
                            (parseFloat(inputAmount) * parseFloat(app.assetContext.priceUsd)).toFixed(2) :
                            undefined}
                          symbol={app?.assetContext?.symbol}
                          priceUsd={app?.assetContext?.priceUsd ? parseFloat(app.assetContext.priceUsd) : undefined}
                          onToggleMode={() => setInputIsUSD(!inputIsUSD)}
                          isUsdMode={inputIsUSD}
                          maxBalance={getUserBalance(app?.assetContext?.caip)}
                          maxBalanceUsd={getUserBalanceUSD(app?.assetContext?.caip)}
                        />
                      </Box>
                    </Box>

                    {/* Swap Button */}
                    <HStack justify="center" py={1}>
                      <IconButton
                        size="sm"
                        onClick={swapAssets}
                        aria-label="Swap assets"
                        bg="rgba(30, 30, 30, 0.8)"
                        borderWidth="2px"
                        borderColor="#23DCC8"
                        borderRadius="full"
                        color="#23DCC8"
                        _hover={{
                          bg: 'rgba(35, 220, 200, 0.15)',
                          borderColor: '#23DCC8',
                          transform: 'rotate(180deg)'
                        }}
                        transition="all 0.3s"
                      >
                        <FaExchangeAlt size={16} />
                      </IconButton>
                    </HStack>

                    {/* To Section */}
                    <Box>
                      <AssetSelector
                        asset={getAssetDisplay(false)}
                        balance={getUserBalance(app?.outboundAssetContext?.caip)}
                        balanceUsd={getUserBalanceUSD(app?.outboundAssetContext?.caip)}
                        label="To"
                        onClick={() => setShowAssetPicker('to')}
                        showMaxButton={false}
                      />

                      <Box mt={2}>
                        <SwapInput
                          value={(() => {
                            const usdCalc = outputAmount && app?.outboundAssetContext?.priceUsd ?
                              (parseFloat(outputAmount) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2) :
                              undefined;
                            console.log(`[SWAP-DEBUG] 📊 Output render: ${outputAmount} ${app?.outboundAssetContext?.symbol} = $${outputUSDValue || usdCalc}`);
                            return outputAmount;
                          })()}
                          onChange={() => {}} // Disabled, so no-op
                          disabled={true}
                          placeholder="0"
                          showMaxButton={false}
                          usdAmount={outputUSDValue || (outputAmount && app?.outboundAssetContext?.priceUsd ?
                            (parseFloat(outputAmount) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2) :
                            undefined)}
                          symbol={app?.outboundAssetContext?.symbol}
                          priceUsd={app?.outboundAssetContext?.priceUsd ? parseFloat(app.outboundAssetContext.priceUsd) : undefined}
                          onToggleMode={() => setOutputIsUSD(!outputIsUSD)}
                          isUsdMode={outputIsUSD}
                        />
                      </Box>
                    </Box>

                    {/* Exchange Rate Display */}
                    {exchangeRate && inputAmount && parseFloat(inputAmount) > 0 && (
                      <Box
                        bg="rgba(35, 220, 200, 0.1)"
                        borderRadius="lg"
                        p={3}
                        borderWidth="1px"
                        borderColor="rgba(35, 220, 200, 0.3)"
                      >
                        <HStack justify="center" gap={2}>
                          <Text fontSize="sm" color="gray.300">
                            1 {app?.assetContext?.symbol}
                          </Text>
                          <Text fontSize="sm" color="#23DCC8">=</Text>
                          <Text fontSize="sm" color="#23DCC8" fontWeight="medium">
                            <CountUp
                              end={exchangeRate}
                              decimals={6}
                              duration={1.5}
                              separator=","
                              preserveValue={true}
                            />
                            {' '}{app?.outboundAssetContext?.symbol}
                          </Text>
                        </HStack>
                      </Box>
                    )}

                    {/* Quote Display */}
                    <SwapQuote
                      quote={quote}
                      loading={isLoading}
                      error={error}
                    />

                    {/* Swap Button */}
                    <Button
                      size="lg"
                      bg="#23DCC8"
                      color="black"
                      _hover={{ bg: '#1FC4B3' }}
                      _active={{ bg: '#1AAB9B' }}
                      onClick={handlePrepareSwap}
                      loading={isLoadingQuote}
                      width="full"
                      height="48px"
                      borderRadius="xl"
                      fontWeight="bold"
                      mt={2}
                      disabled={
                        !inputAmount ||
                        parseFloat(inputAmount) <= 0 ||
                        app?.assetContext?.caip === app?.outboundAssetContext?.caip ||
                        (inputAmount && getUserBalance(app?.assetContext?.caip) && parseFloat(inputAmount) > parseFloat(getUserBalance(app?.assetContext?.caip)))
                      }
                      _disabled={{
                        bg: 'gray.700',
                        color: 'gray.500',
                        cursor: 'not-allowed'
                      }}
                    >
                      {app?.assetContext?.caip === app?.outboundAssetContext?.caip ?
                        'Select different assets' :
                        (inputAmount && getUserBalance(app?.assetContext?.caip) && parseFloat(inputAmount) > parseFloat(getUserBalance(app?.assetContext?.caip)) ?
                          'Insufficient balance' :
                          (!inputAmount || parseFloat(inputAmount) <= 0 ? 'Enter an amount' : 'Swap')
                        )
                      }
                    </Button>

                    {/* THORChain Branding Footer */}
                    <HStack justify="center" gap={1} mt={2} opacity={0.6}>
                      <Text fontSize="xs" color="gray.500">Powered by</Text>
                      <Image src="https://pioneers.dev/coins/thorchain.png" boxSize="12px" />
                      <Text fontSize="xs" color="#23DCC8" fontWeight="medium">THORChain</Text>
                    </HStack>

                    {/* Info message */}
                    {fromAssets.length === 0 && (
                      <Text fontSize="sm" color="orange.400" textAlign="center" mt={2}>
                        No assets with sufficient balance (minimum $1) for swapping
                      </Text>
                    )}
                      </>
                    )}
                  </>
                ) : (
                  <SwapConfirm
                    fromAsset={getAssetDisplay(true)}
                    toAsset={getAssetDisplay(false)}
                    inputAmount={inputAmount}
                    outputAmount={outputAmount}
                    quote={quote}
                    onConfirm={executeSwap}
                    onCancel={() => setConfirmMode(false)}
                    loading={isLoading}
                    inputUsdValue={inputUSDValue || (inputAmount && app?.assetContext?.priceUsd ? 
                      (parseFloat(inputAmount) * parseFloat(app.assetContext.priceUsd)).toFixed(2) : 
                      undefined)}
                    outputUsdValue={outputUSDValue || (outputAmount && app?.outboundAssetContext?.priceUsd ? 
                      (parseFloat(outputAmount) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2) : 
                      undefined)}
                    fromAddress={app?.assetContext?.address}
                    outboundAssetContext={app?.outboundAssetContext}
                  />
                )}
              </Stack>
              )}
            </Card.Body>
          </Card.Root>
        </Box>

        {/* Asset Picker for From (filtered by balance) */}
        <AssetPicker
          isOpen={showAssetPicker === 'from'}
          onClose={() => setShowAssetPicker(null)}
          onSelect={(asset) => handleAssetSelect(asset, true)}
          assets={fromAssets}
          title="Select Asset to Swap From"
          currentAsset={app?.assetContext}
          isFromSelection={true}
        />

        {/* Asset Picker for To (all assets available) */}
        <AssetPicker
          isOpen={showAssetPicker === 'to'}
          onClose={() => setShowAssetPicker(null)}
          onSelect={(asset) => handleAssetSelect(asset, false)}
          assets={toAssets}
          title="Select Asset to Receive"
          currentAsset={app?.outboundAssetContext}
          isFromSelection={false}
        />
      </Flex>
    </Box>
  );
};

export default Swap;
