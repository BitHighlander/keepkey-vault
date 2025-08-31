'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { usePioneerContext } from '@/components/providers/pioneer';
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
  DialogRoot
} from '@chakra-ui/react';
import { FaExchangeAlt, FaArrowLeft, FaEye, FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';
import { bip32ToAddressNList, COIN_MAP_KEEPKEY_LONG } from '@pioneer-platform/pioneer-coins'
import { NetworkIdToChain } from '@coinmasters/types'
// @ts-ignore
import { caipToNetworkId } from '@pioneer-platform/pioneer-caip';

// Import sub-components
import { AssetSelector } from './AssetSelector';
import { SwapInput } from './SwapInput';
import { SwapQuote } from './SwapQuote';
import { SwapConfirm } from './SwapConfirm';
import { AssetPicker } from './AssetPicker';
import { SwapSuccess } from './SwapSuccess';

// Import THORChain services
import { 
  getThorchainQuote, 
  getExchangeRate, 
  toBaseUnit, 
  fromBaseUnit,
  getThorchainInboundAddress
} from '@/services/thorchain';

// THORChain asset mapping for API URLs
const THORCHAIN_ASSETS: Record<string, string> = {
  'BTC': 'BTC.BTC',
  'ETH': 'ETH.ETH',
  'BCH': 'BCH.BCH',
  'LTC': 'LTC.LTC',
  'DOGE': 'DOGE.DOGE',
  'RUNE': 'THOR.RUNE',
  'ATOM': 'GAIA.ATOM',
  'AVAX': 'AVAX.AVAX',
  'BNB': 'BNB.BNB',
  'CACAO': 'MAYA.CACAO',
};

interface SwapProps {
  onBackClick?: () => void;
}

// Define native assets only (no tokens)
const NATIVE_ASSETS = [
  { 
    caip: 'eip155:1/slip44:60', 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: 'https://pioneers.dev/coins/ethereum.png',
    isNative: true 
  },
  { 
    caip: 'bip122:000000000019d6689c085ae165831e93/slip44:0', 
    name: 'Bitcoin', 
    symbol: 'BTC', 
    icon: 'https://pioneers.dev/coins/bitcoin.png',
    isNative: true 
  },
  { 
    caip: 'cosmos:thorchain-mainnet-v1/slip44:931', 
    name: 'THORChain', 
    symbol: 'RUNE', 
    icon: 'https://pioneers.dev/coins/thorchain.png',
    isNative: true 
  },
  { 
    caip: 'cosmos:cosmoshub-4/slip44:118', 
    name: 'Cosmos', 
    symbol: 'ATOM', 
    icon: 'https://pioneers.dev/coins/cosmos.png',
    isNative: true 
  },
  { 
    caip: 'cosmos:mayachain-mainnet-v1/slip44:931', 
    name: 'Maya Protocol', 
    symbol: 'CACAO', 
    icon: 'https://pioneers.dev/coins/mayaprotocol.png',
    isNative: true 
  },
  {
    caip: 'cosmos:osmosis-1/slip44:118',
    name: 'Osmosis',
    symbol: 'OSMO',
    icon: 'https://pioneers.dev/coins/osmosis.png',
    isNative: true
  },
  {
    caip: 'bip122:00000000000000000000000000000000/slip44:2', 
    name: 'Litecoin',
    symbol: 'LTC',
    icon: 'https://pioneers.dev/coins/litecoin.png',
    isNative: true
  },
  {
    caip: 'bip122:000000000000000000000000000000001/slip44:3',
    name: 'Dogecoin', 
    symbol: 'DOGE',
    icon: 'https://pioneers.dev/coins/dogecoin.png',
    isNative: true
  },
  {
    caip: 'bip122:00000000040e4f9e4f9e4f9e4f9e4f9e/slip44:145',
    name: 'Bitcoin Cash',
    symbol: 'BCH',
    icon: 'https://pioneers.dev/coins/bitcoincash.png',
    isNative: true
  },
  {
    caip: 'eip155:56/slip44:60',
    name: 'BNB Chain',
    symbol: 'BNB',
    icon: 'https://pioneers.dev/coins/binance.png',
    isNative: true
  },
  {
    caip: 'eip155:43114/slip44:60',
    name: 'Avalanche',
    symbol: 'AVAX',
    icon: 'https://pioneers.dev/coins/avalanche.png',
    isNative: true
  }
];

export const Swap = ({ onBackClick }: SwapProps) => {
  // Get app context from Pioneer
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

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
    
    // Log dashboard networks for comparison
    if (app?.dashboard?.networks) {
      console.log('📊 [SWAP] Dashboard networks:', app.dashboard.networks);
      const btcNetwork = app.dashboard.networks.find((n: any) => n.name === 'Bitcoin' || n.symbol === 'BTC');
      if (btcNetwork) {
        console.log('🔍 [SWAP] BTC from dashboard:', btcNetwork);
      }
    }
  }, [app]);

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
  const [verificationStep, setVerificationStep] = useState<'destination' | 'swap'>('destination');

  // Asset picker state
  const [showAssetPicker, setShowAssetPicker] = useState<'from' | 'to' | null>(null);
  
  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTxid, setSuccessTxid] = useState<string>('');

  // Helper function to get aggregated balance by symbol
  const getUserBalance = (caip: string): string => {
    if (!app?.balances || !caip) {
      console.log('getUserBalance: Missing balances or caip', { balances: app?.balances?.length, caip });
      return '0';
    }
    try {
      // Find the asset in our availableAssets which has aggregated balances
      const asset = availableAssets.find((x: any) => 
        x.caip === caip || 
        x.caips?.includes(caip) || 
        x.symbol === (app.balances.find((b: any) => b.caip === caip)?.symbol)
      );
      
      console.log('getUserBalance: Found aggregated balance for', caip, asset?.balance);
      return asset?.balance?.toString() || '0';
    } catch (e) {
      console.log('getUserBalance: Error finding balance', e);
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

  // Helper function to get USD balance
  const getUserBalanceUSD = (caip: string): string => {
    if (!app?.balances || !caip) return '0';
    try {
      const asset = availableAssets.find((x: any) => 
        x.caip === caip || 
        x.caips?.includes(caip) || 
        x.symbol === (app.balances.find((b: any) => b.caip === caip)?.symbol)
      );
      return asset?.balanceUsd?.toString() || '0';
    } catch (e) {
      return '0';
    }
  };

  // Get available assets with balances - COPY FROM DASHBOARD
  const availableAssets = useMemo(() => {
    if (!app?.balances || app.balances.length === 0) {
      console.log('🔍 [SWAP] No balances available');
      return [];
    }

    console.log('🔍 [SWAP] Processing balances:', app.balances.length, 'total balances');
    console.log('🔍 [SWAP] Raw balances:', app.balances);
    console.log('🔍 [SWAP] NATIVE_ASSETS available:', NATIVE_ASSETS.map(a => a.symbol));

    // Create a map to aggregate balances by symbol (exact copy from dashboard logic)
    const balanceMap = new Map();
    
    app.balances.forEach((balance: any, index: number) => {
      const ticker = balance.ticker || balance.symbol;
      if (!ticker) {
        console.log(`⚠️ [SWAP] Balance #${index} missing ticker/symbol:`, balance);
        return;
      }
      
      // Find matching native asset
      const nativeAsset = NATIVE_ASSETS.find(asset => asset.symbol === ticker);
      if (!nativeAsset) {
        console.log(`⚠️ [SWAP] No native asset found for ticker: ${ticker} (caip: ${balance.caip})`);
        return;
      }
      
      const balanceAmount = parseFloat(balance.balance || '0');
      const valueUsd = parseFloat(balance.valueUsd || '0');
      
      console.log(`💰 [SWAP] Processing ${ticker}: balance=${balanceAmount}, valueUsd=${valueUsd}, priceUsd=${balance.priceUsd}`);
      
      if (balanceMap.has(ticker)) {
        // Aggregate existing balance
        const existing = balanceMap.get(ticker);
        existing.balance += balanceAmount;
        existing.balanceUsd += valueUsd;
        console.log(`➕ [SWAP] Aggregating ${ticker}: total balance=${existing.balance}, total USD=${existing.balanceUsd}`);
      } else {
        // Create new entry
        balanceMap.set(ticker, {
          caip: balance.caip,
          symbol: ticker,
          name: nativeAsset.name,
          icon: nativeAsset.icon,
          balance: balanceAmount,
          balanceUsd: valueUsd,
          priceUsd: parseFloat(balance.priceUsd || '0')
        });
        console.log(`✅ [SWAP] Added ${ticker} to balance map`);
      }
    });

    console.log('📊 [SWAP] Balance map before filtering:', Array.from(balanceMap.values()));

    // Convert to array and sort by USD value (exact copy from dashboard)
    const assets = Array.from(balanceMap.values())
      .filter((asset: any) => {
        const passesFilter = asset.balanceUsd > 0.01;
        if (!passesFilter) {
          console.log(`❌ [SWAP] Filtered out ${asset.symbol}: USD value ${asset.balanceUsd} below $0.01 threshold`);
        }
        return passesFilter;
      })
      .sort((a: any, b: any) => b.balanceUsd - a.balanceUsd);

    console.log('✅ [SWAP] Final sorted assets:', assets);
    console.log('✅ [SWAP] Asset count:', assets.length);
    
    // If we have BTC but it's being filtered out, log why
    const btcBalance = app.balances.find((b: any) => b.symbol === 'BTC' || b.ticker === 'BTC');
    if (btcBalance) {
      console.log('🔍 [SWAP] BTC balance found in raw data:', btcBalance);
      const btcInAssets = assets.find((a: any) => a.symbol === 'BTC');
      if (!btcInAssets) {
        console.log('⚠️ [SWAP] BTC was filtered out! Check valueUsd calculation');
      }
    }
    
    return assets;
  }, [app?.balances]);

  // fromAssets are already filtered and sorted in availableAssets
  const fromAssets = availableAssets;

  // All native assets available for "to" selection (no balance requirement)
  const toAssets = useMemo(() => {
    // Get all available assets except the currently selected "from" asset
    // This ensures we can swap to any asset we have, even with 0 balance
    const allNativeAssets = NATIVE_ASSETS.map(native => {
      const balance = availableAssets.find(a => a.symbol === native.symbol);
      return {
        ...native,
        balance: balance?.balance || 0,
        balanceUsd: balance?.balanceUsd || 0,
        priceUsd: balance?.priceUsd || 0
      };
    });
    
    // Exclude the currently selected "from" asset
    return allNativeAssets.filter(asset => 
      asset.symbol !== app?.assetContext?.symbol
    );
  }, [availableAssets, app?.assetContext?.symbol]);

  // Initialize default assets if not set
  useEffect(() => {
    if (!app?.assetContext?.caip && !app?.outboundAssetContext?.caip && availableAssets.length > 0) {
      // Select the top USD value asset for "from"
      const defaultFrom = availableAssets[0];
      
      // Smart selection for output asset based on input
      let defaultTo = null;
      
      // If input is Bitcoin, default to Ethereum
      if (defaultFrom?.symbol === 'BTC') {
        defaultTo = NATIVE_ASSETS.find(a => a.symbol === 'ETH');
      } 
      // If input is anything else, default to Bitcoin
      else {
        defaultTo = NATIVE_ASSETS.find(a => a.symbol === 'BTC');
      }
      
      // If we couldn't find the preferred output, use the second highest value asset
      if (!defaultTo && availableAssets.length > 1) {
        defaultTo = availableAssets[1];
      }
      
      // If still no output asset, find any other native asset
      if (!defaultTo) {
        defaultTo = NATIVE_ASSETS.find(asset => 
          asset.symbol !== defaultFrom?.symbol
        );
      }
      
      // Ensure we have balance data for the output asset
      if (defaultTo) {
        const balanceData = availableAssets.find(a => a.symbol === defaultTo.symbol);
        defaultTo = {
          ...defaultTo,
          balance: balanceData?.balance || 0,
          balanceUsd: balanceData?.balanceUsd || 0,
          priceUsd: balanceData?.priceUsd || 0
        };
      }
      
      // Set the assets
      if (defaultFrom && defaultTo && defaultFrom.symbol !== defaultTo.symbol) {
        if (app?.setAssetContext && app?.setOutboundAssetContext) {
          app.setAssetContext(defaultFrom);
          app.setOutboundAssetContext(defaultTo);
          // The default amount will be set by the dedicated useEffect
        }
      }
    }
  }, [availableAssets, app?.assetContext?.caip, app?.outboundAssetContext?.caip]);
  
  // Auto-select output asset when input asset changes
  useEffect(() => {
    if (app?.assetContext?.symbol && !app?.outboundAssetContext?.symbol && app?.setOutboundAssetContext) {
      let defaultTo = null;
      
      // If input is Bitcoin, default to Ethereum
      if (app.assetContext.symbol === 'BTC') {
        defaultTo = NATIVE_ASSETS.find(a => a.symbol === 'ETH');
      } 
      // If input is anything else, default to Bitcoin
      else {
        defaultTo = NATIVE_ASSETS.find(a => a.symbol === 'BTC');
      }
      
      if (defaultTo) {
        const balanceData = availableAssets.find(a => a.symbol === defaultTo.symbol);
        app.setOutboundAssetContext({
          ...defaultTo,
          balance: balanceData?.balance || 0,
          balanceUsd: balanceData?.balanceUsd || 0,
          priceUsd: balanceData?.priceUsd || 0
        });
      }
    }
  }, [app?.assetContext?.symbol, app?.outboundAssetContext?.symbol, availableAssets]);
  
  // Set default input amount when both assets are selected and input is empty
  useEffect(() => {
    if (app?.assetContext?.symbol && 
        app?.outboundAssetContext?.symbol && 
        !inputAmount && 
        availableAssets.length > 0) {
      
      const fromAsset = availableAssets.find(a => a.symbol === app.assetContext.symbol);
      
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
          setIsMaxAmount(false);
          setInputUSDValue('100.00');
        }
        
        // Fetch quote for the default amount
        const amount = maxUsdValue <= 100 ? fromAsset.balance.toString() : (100 / fromAsset.priceUsd).toFixed(8);
        if (amount) {
          fetchQuote(amount, app.assetContext.symbol, app.outboundAssetContext.symbol);
        }
      }
    }
  }, [app?.assetContext?.symbol, app?.outboundAssetContext?.symbol, availableAssets.length]);

  // Validate that we never have the same asset for both from and to
  useEffect(() => {
    if (app?.assetContext?.symbol && 
        app?.outboundAssetContext?.symbol && 
        app.assetContext.symbol === app.outboundAssetContext.symbol &&
        app?.setOutboundAssetContext &&
        availableAssets.length > 0) {
      console.warn('⚠️ [Swap] Same asset detected for both from and to, fixing...');
      
      // Find an alternative asset for "to"
      const alternativeAsset = availableAssets.find(a => a.symbol !== app.assetContext.symbol) ||
                               NATIVE_ASSETS.find(a => a.symbol !== app.assetContext.symbol);
      
      if (alternativeAsset) {
        app.setOutboundAssetContext({
          caip: alternativeAsset.caip,
          networkId: alternativeAsset.networkId || caipToNetworkId(alternativeAsset.caip),
          symbol: alternativeAsset.symbol,
          name: alternativeAsset.name,
          icon: alternativeAsset.icon,
          priceUsd: alternativeAsset.priceUsd || 0
        });
      }
    }
  }, [app?.assetContext?.symbol, app?.outboundAssetContext?.symbol, availableAssets]);

  // Fetch quote from THORChain
  const fetchQuote = async (amount: string, fromSymbol: string, toSymbol: string) => {
    setIsLoadingQuote(true);
    setError('');
    
    try {
      // Convert to base units
      const baseAmount = toBaseUnit(amount, fromSymbol);
      
      console.log('🔍 [Swap] Fetching quote:', {
        fromSymbol,
        toSymbol,
        inputAmount: amount,
        baseAmount,
        destinationAddress: app?.outboundAssetContext?.address
      });
      
      // Get quote from THORChain
      // Note: THORChain requires a valid destination address for accurate quotes
      // If no address is available, we can still get an estimate
      const quoteData = await getThorchainQuote(
        fromSymbol, 
        toSymbol, 
        baseAmount
        // Omit destination address for now as it may not be available yet
        // app?.outboundAssetContext?.address
      );
      
      console.log('📊 [Swap] Quote received:', {
        quote: quoteData,
        expectedOut: quoteData?.expected_amount_out,
        fees: quoteData?.fees
      });
      
      if (quoteData && quoteData.expected_amount_out) {
        setQuote(quoteData);
        
        // Convert output from base units and set it
        // THORChain always returns amounts in 8 decimal format, not native decimals
        const outputInDisplay = fromBaseUnit(quoteData.expected_amount_out, toSymbol, true);
        console.log('💱 [Swap] Converted output:', {
          baseUnits: quoteData.expected_amount_out,
          displayUnits: outputInDisplay,
          toSymbol,
          note: 'THORChain uses 8 decimals for all assets'
        });
        
        setOutputAmount(outputInDisplay);
        
        // Calculate USD value for output
        if (app?.outboundAssetContext?.priceUsd) {
          const outputUsd = (parseFloat(outputInDisplay) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2);
          setOutputUSDValue(outputUsd);
        }
        
        // Calculate exchange rate
        const rate = parseFloat(outputInDisplay) / parseFloat(amount);
        setExchangeRate(rate);
      } else {
        console.error('❌ [Swap] Invalid quote data:', quoteData);
        setError('Unable to fetch valid quote from THORChain');
        setOutputAmount('');
        setOutputUSDValue('');
      }
    } catch (err) {
      console.error('❌ [Swap] Error fetching quote:', err);
      setError('Failed to fetch swap quote');
      setOutputAmount('');
      setOutputUSDValue('');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Fetch exchange rate when assets change
  useEffect(() => {
    const fetchRate = async () => {
      if (app?.assetContext?.symbol && app?.outboundAssetContext?.symbol) {
        const rate = await getExchangeRate(app.assetContext.symbol, app.outboundAssetContext.symbol);
        if (rate) {
          setExchangeRate(rate);
        }
      }
    };
    
    fetchRate();
  }, [app?.assetContext?.symbol, app?.outboundAssetContext?.symbol]);

  const handleInputChange = async (value: string) => {
    setInputAmount(value);
    if (isMaxAmount) {
      console.log('🔄 Clearing isMax flag - user manually changed amount from:', inputAmount, 'to:', value);
      setIsMaxAmount(false); // Clear isMax flag when user manually changes the amount
      console.log('🔴 isMaxAmount is now FALSE due to manual input change');
    }
    // Automatically calculate and update USD value
    if (app?.assetContext?.priceUsd && value) {
      const usdValue = (parseFloat(value) * parseFloat(app.assetContext.priceUsd)).toFixed(2);
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
      await fetchQuote(value, app.assetContext.symbol, app.outboundAssetContext.symbol);
    }
  };

  const handleMaxClick = async () => {
    console.log('🟡 MAX BUTTON CLICKED - BEFORE STATE CHANGE');
    const maxBalance = getUserBalance(app?.assetContext?.caip);
    if (maxBalance && parseFloat(maxBalance) > 0) {
      // Leave a small amount for gas fees if it's a native token
      const isNativeToken = app?.assetContext?.symbol && 
        ['ETH', 'BNB', 'AVAX', 'MATIC'].includes(app.assetContext.symbol);
      const adjustedMax = isNativeToken ? 
        (parseFloat(maxBalance) * 0.98).toFixed(8) : // Keep 2% for gas
        maxBalance;
      
      setInputAmount(adjustedMax);
      console.log('💰 MAX button clicked - setting isMax flag to true');
      setIsMaxAmount(true); // Set isMax flag when MAX button is clicked
      console.log('🟢 MAX BUTTON CLICKED - AFTER STATE CHANGE - isMaxAmount should now be TRUE');
      // Automatically calculate and update USD value
      if (app?.assetContext?.priceUsd) {
        const usdValue = (parseFloat(adjustedMax) * parseFloat(app.assetContext.priceUsd)).toFixed(2);
        setInputUSDValue(usdValue);
      }
      setOutputAmount('');
      setOutputUSDValue('');
      setQuote(null);
      setError('');
      
      // Fetch quote for max amount
      if (app?.assetContext?.symbol && app?.outboundAssetContext?.symbol) {
        await fetchQuote(adjustedMax, app.assetContext.symbol, app.outboundAssetContext.symbol);
      }
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
    
    // Check if selecting the same asset for both from and to
    if (isFrom) {
      if (asset.caip === app?.outboundAssetContext?.caip) {
        // If selecting the same asset as "to", swap them
        await swapAssets();
        return;
      }
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
          setIsMaxAmount(false);
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
      if (asset.caip === app?.assetContext?.caip) {
        // If selecting the same asset as "from", swap them
        await swapAssets();
        return;
      }
      await app.setOutboundAssetContext({
        caip: asset.caip,
        networkId: asset.networkId || caipToNetworkId(asset.caip),
        symbol: asset.symbol,
        name: asset.name,
        icon: asset.icon,
        priceUsd: asset.priceUsd
      });
      
      // Fetch new quote if we have input amount
      if (inputAmount && parseFloat(inputAmount) > 0 && app?.assetContext?.symbol) {
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
    
    // Prevent swapping if they're the same asset
    if (fromSel.symbol === toSel.symbol) {
      setError('Cannot swap the same asset');
      return;
    }
    
    // Check if the "to" asset has any balance to become the "from" asset
    const toAssetBalance = parseFloat(getUserBalance(toSel.caip));
    if (toAssetBalance <= 0) {
      setError('Cannot swap - target asset has no balance');
      return;
    }
    
    // Clear isMax flag when swapping assets
    setIsMaxAmount(false);
    
    // Store current values if we're swapping output to input
    const shouldFetchNewQuote = outputAmount && parseFloat(outputAmount) > 0;
    const newInputAmount = outputAmount;
    
    await app.setAssetContext({
      caip: toSel.caip,
      networkId: toSel.networkId || caipToNetworkId(toSel.caip),
      symbol: toSel.symbol,
      name: toSel.name,
      icon: toSel.icon,
      priceUsd: toSel.priceUsd
    });
    
    await app.setOutboundAssetContext({
      caip: fromSel.caip,
      networkId: fromSel.networkId || caipToNetworkId(fromSel.caip),
      symbol: fromSel.symbol,
      name: fromSel.name,
      icon: fromSel.icon,
      priceUsd: fromSel.priceUsd
    });
    
    // If we had an output amount, use it as the new input
    if (shouldFetchNewQuote) {
      setInputAmount(newInputAmount);
      setInputUSDValue(outputUSDValue);
      setOutputAmount('');
      setOutputUSDValue('');
      // Fetch quote for the swapped amounts
      await fetchQuote(newInputAmount, toSel.symbol, fromSel.symbol);
    } else {
      setInputAmount('');
      setOutputAmount('');
      setInputUSDValue('');
      setOutputUSDValue('');
      setQuote(null);
      setError('');
    }
  };

  const getAssetDisplay = (isFromAsset: boolean = false) => {
    const sel = isFromAsset ? app?.assetContext : app?.outboundAssetContext;
    if (!sel) return null;
    return { 
      symbol: sel.symbol, 
      name: sel.name, 
      icon: sel.icon || 'https://pioneers.dev/coins/coin.png' 
    };
  };

  // Reset device verification when changing assets
  useEffect(() => {
    console.log('🔄 ASSET CHANGE DETECTED - Resetting device verification');
    setHasViewedOnDevice(false);
    setDeviceVerificationError(null);
  }, [app?.assetContext?.caip, app?.outboundAssetContext?.caip]);

  // Only reset isMaxAmount when the INPUT asset changes (not output asset)
  useEffect(() => {
    console.log('🔄 INPUT ASSET CHANGED - Resetting isMax flag');
    setIsMaxAmount(false);
  }, [app?.assetContext?.caip]);

  const executeSwap = () => {
    console.log('🎯 executeSwap called');
    if (!quote || !app) {
      setError('No quote available');
      return;
    }
    
    // Just set the states - actual swap will happen in useEffect
    setIsLoading(true);
    setError('');
    setPendingSwap(true);
    setShowDeviceVerificationDialog(true);
    setIsVerifyingOnDevice(true);
    setDeviceVerificationError(null);
    console.log('✅ States set, dialog should be showing');
  };

  // Handle the actual swap in useEffect when pendingSwap is true
  useEffect(() => {
    if (!pendingSwap) return;
    
    const performSwap = async () => {
      console.log('🚀 Performing swap with device verification...');
    
    try {
      // Ensure SDK has an outbound address context
      if (app?.outboundAssetContext?.caip && app?.setOutboundAssetContext) {
        await app.setOutboundAssetContext({
          caip: app.outboundAssetContext.caip,
          networkId: app.outboundAssetContext.networkId || caipToNetworkId(app.outboundAssetContext.caip),
          symbol: app.outboundAssetContext.symbol,
          name: app.outboundAssetContext.name,
          icon: app.outboundAssetContext.icon,
          address: app.outboundAssetContext.address,
        });
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
          'zcash:main': 'UTXO',
        }
        let networkType = networkIdToType[app.outboundAssetContext.networkId]
        
        console.log('🔍 Device verification context:', {
          networkId: app.outboundAssetContext.networkId,
          networkType,
          pathMaster: app.outboundAssetContext.pathMaster,
          scriptType: app.outboundAssetContext.scriptType,
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
          address_n: bip32ToAddressNList(app.outboundAssetContext.pathMaster),
          script_type:app.outboundAssetContext.scriptType,
          // @ts-ignore
          coin:COIN_MAP_KEEPKEY_LONG[chainName],
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
        
        // Get the THORChain vault address for display (but don't verify on device)
        const thorchainVault = quote?.inbound_address;
        if (!thorchainVault) {
          // If not in quote, fetch it
          const fromChain = app?.assetContext?.symbol === 'BTC' ? 'BTC' : 
                           app?.assetContext?.symbol === 'ETH' ? 'ETH' :
                           app?.assetContext?.symbol === 'BCH' ? 'BCH' :
                           app?.assetContext?.symbol === 'LTC' ? 'LTC' :
                           app?.assetContext?.symbol === 'DOGE' ? 'DOGE' : null;
          
          if (fromChain) {
            const vaultInfo = await getThorchainInboundAddress(fromChain);
            if (vaultInfo) {
              setVaultAddress(vaultInfo.address);
            }
          }
        } else {
          setVaultAddress(thorchainVault);
        }
        
        console.log('📱 THORChain vault address:', thorchainVault || vaultAddress);
        console.log('🚀 Now building and executing swap...');
        
        // Move directly to swap execution
        setVerificationStep('swap');
        setIsVerifyingOnDevice(true);
        
        // Check for dev flag to skip actual swap
        const fakeTxid = process.env.NEXT_PUBLIC_DEV_FAKE_SWAP_TXID;
        if (fakeTxid) {
          console.log('🚧 DEVELOPMENT MODE: Using fake transaction ID:', fakeTxid);
          
          // Close verification dialog
          setHasViewedOnDevice(true);
          setIsVerifyingOnDevice(false);
          setShowDeviceVerificationDialog(false);
          
          // Show success screen with fake txid
          setSuccessTxid(fakeTxid);
          setShowSuccess(true);
          setConfirmMode(false);
          setPendingSwap(false);
          setVerificationStep('destination');
          
          return; // Skip actual swap execution
        }
        
        // Execute the actual swap
        if (typeof app.swap === 'function') {
          console.log('🚀 Executing swap transaction...');
          const swapPayload: any = {
            caipIn: app?.assetContext?.caip,
            caipOut: app?.outboundAssetContext?.caip,
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
          const result = await app.swap(swapPayload);
          console.log('✅ Swap executed:', result);
          
          // Now close everything
          setHasViewedOnDevice(true);
          setIsVerifyingOnDevice(false);
          setShowDeviceVerificationDialog(false);
          
          // Extract transaction ID
          const txid = result?.txHash || result?.hash || result?.txid || result?.data?.result || result;
          console.log('🎉 Swap successful! Transaction ID:', txid);
          
          if (txid) {
            // Show success screen
            setSuccessTxid(String(txid));
            setShowSuccess(true);
            setConfirmMode(false);
          } else {
            // If no txid, reset normally
            setInputAmount('');
            setOutputAmount('');
            setQuote(null);
            setError('');
            setConfirmMode(false);
          }
          
          setPendingSwap(false);
          setVerificationStep('destination'); // Reset for next swap
        }
      } catch (error: any) {
        console.error('❌ Device verification failed:', error);
        setDeviceVerificationError(error?.message || 'Failed to verify address on device');
        setIsVerifyingOnDevice(false);
        throw error;
      }
      } else {
        console.log('✅ Device verification completed, swap already executed');
      }
    } catch (error: any) {
      console.error('Error executing swap:', error);
      const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      setError(msg);
    } finally {
      setIsLoading(false);
      setPendingSwap(false);
    }
  };
  
  performSwap();
  }, [pendingSwap, app, quote, inputAmount]);

  // Check if we're still loading assets - only show spinner if no balances at all
  const isLoadingAssets = !app?.balances || (app.balances.length === 0 && !app?.assetContext);

  return (
    <Box bg="bg.primary" minH="100vh" position="relative">
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
                {verificationStep === 'destination' ? 'Verify Destination Address' : 
                 'Confirm Swap Transaction'}
              </Text>
            </HStack>
            
            <VStack gap={4} align="stretch">
              {/* Show different content based on verification step */}
              {verificationStep === 'swap' ? (
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
                                <Text fontSize="xs" fontWeight="medium">{outputAmount} {app?.outboundAssetContext?.symbol}</Text>
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
                      <Spinner size="lg" color="blue.500" thickness="4px" />
                      <Text fontSize="lg" fontWeight="bold" color="white">
                        Confirm on your KeepKey device!
                      </Text>
                      <Text fontSize="sm" color="gray.300" textAlign="center">
                        Please review and confirm the swap transaction on your device
                      </Text>
                      <Text fontSize="xs" color="gray.400" textAlign="center">
                        This will send {inputAmount} {app?.assetContext?.symbol} to THORChain for swapping
                      </Text>
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
                      <Image src={app?.outboundAssetContext?.icon} boxSize="16px" />
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
                    <Spinner size="lg" color="blue.500" thickness="4px" />
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

              {/* Action Buttons */}
              {!isVerifyingOnDevice && deviceVerificationError && (
                <HStack gap={3} pt={2}>
                  <Button
                    flex={1}
                    variant="ghost"
                    onClick={() => {
                      setShowDeviceVerificationDialog(false);
                      setDeviceVerificationError(null);
                      setIsLoading(false);
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
      
      {/* Top Header */}
      <Box 
        position="absolute" 
        top={0} 
        left={0} 
        right={0} 
        p={4} 
        zIndex={10}
        bg="rgba(0, 0, 0, 0.5)"
        backdropFilter="blur(10px)"
        borderBottom="1px solid"
        borderColor="gray.800"
      >
        <Container maxW="container.xl">
          <HStack justify="space-between">
            {/* Left side - Back button */}
            <Button
              leftIcon={<FaArrowLeft size={18} />}
              variant="solid"
              onClick={onBackClick}
              color="white"
              bg="gray.800"
              _hover={{ bg: 'gray.700', transform: 'translateX(-2px)' }}
              _active={{ bg: 'gray.600' }}
              size="sm"
              px={3}
            >
              Back
            </Button>
            
            {/* Center - Title */}
            <HStack gap={2}>
              <Image src="https://pioneers.dev/coins/thorchain.png" alt="THORChain" boxSize="24px" />
              <Text fontSize="lg" fontWeight="bold" color="white">
                Native Asset Swap
              </Text>
            </HStack>
            
            {/* Right side - placeholder for balance alignment */}
            <Box width="40px" />
          </HStack>
        </Container>
      </Box>

      {/* Main Content - Centered vertically */}
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
            borderColor="gray.800"
            borderWidth="1px"
            borderRadius="2xl"
            boxShadow="0 4px 24px 0 rgba(0, 0, 0, 0.5)"
          >
            <Card.Body p={4}>
              {isLoadingAssets ? (
                <VStack py={20} gap={4}>
                  <Box position="relative">
                    <Spinner 
                      size="xl" 
                      color="blue.500" 
                      thickness="3px"
                      speed="0.8s"
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
                      Loading your assets
                    </Text>
                    <Text color="gray.500" fontSize="sm">
                      Fetching balances and current prices...
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
                  onClose={() => {
                    setShowSuccess(false);
                    setSuccessTxid('');
                    setInputAmount('');
                    setOutputAmount('');
                    setQuote(null);
                    setError('');
                  }}
                />
              ) : (
              <Stack gap={2}>
                {!confirmMode ? (
                  <>
                    {/* From Section */}
                    <Box>
                      <AssetSelector
                        asset={getAssetDisplay(true)}
                        balance={(() => {
                          const balance = getUserBalance(app?.assetContext?.caip);
                          console.log('🔍 AssetSelector balance check:', {
                            caip: app?.assetContext?.caip,
                            balance,
                            balanceType: typeof balance,
                            truthyCheck: !!balance
                          });
                          return balance;
                        })()}
                        balanceUsd={getUserBalanceUSD(app?.assetContext?.caip)}
                        label="From"
                        onClick={() => setShowAssetPicker('from')}
                        onMaxClick={handleMaxClick}
                        showMaxButton={true}
                      />
                      
                      <Box mt={2}>
                        <SwapInput
                          value={inputAmount}
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
                        />
                      </Box>
                    </Box>

                    {/* Swap Button */}
                    <HStack justify="center" py={1}>
                      <IconButton
                        size="sm"
                        variant="ghost"
                        onClick={swapAssets}
                        aria-label="Swap assets"
                        icon={<FaExchangeAlt />}
                        _hover={{ bg: 'gray.700' }}
                        borderRadius="full"
                      />
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
                      
                      <Box mt={2} position="relative">
                        {isLoadingQuote && (
                          <Box 
                            position="absolute" 
                            right="12px" 
                            top="50%" 
                            transform="translateY(-50%)"
                            zIndex={2}
                          >
                            <Spinner size="sm" color="blue.500" />
                          </Box>
                        )}
                        <SwapInput
                          value={outputAmount}
                          onChange={() => {}} // Disabled, so no-op
                          disabled={true}
                          placeholder={isLoadingQuote ? "Fetching quote..." : "0"}
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
                        bg="gray.800" 
                        borderRadius="lg" 
                        p={3}
                        borderWidth="1px"
                        borderColor="gray.700"
                      >
                        <HStack justify="center" gap={2}>
                          <Text fontSize="sm" color="gray.400">
                            1 {app?.assetContext?.symbol}
                          </Text>
                          <Text fontSize="sm" color="gray.500">=</Text>
                          <Text fontSize="sm" color="white" fontWeight="medium">
                            {exchangeRate.toFixed(6)} {app?.outboundAssetContext?.symbol}
                          </Text>
                        </HStack>
                      </Box>
                    )}

                    {/* Quote Display */}
                    <SwapQuote
                      quote={quote}
                      isLoading={isLoading}
                      error={error}
                    />

                    {/* Swap Button */}
                    <Button
                      size="lg"
                      bg="blue.500"
                      color="white"
                      _hover={{ bg: 'blue.400' }}
                      _active={{ bg: 'blue.600' }}
                      onClick={() => setConfirmMode(true)}
                      width="full"
                      height="48px"
                      borderRadius="xl"
                      fontWeight="semibold"
                      mt={2}
                      isDisabled={
                        !inputAmount || 
                        parseFloat(inputAmount) <= 0 || 
                        app?.assetContext?.symbol === app?.outboundAssetContext?.symbol
                      }
                      _disabled={{
                        bg: 'gray.600',
                        color: 'gray.400',
                        cursor: 'not-allowed'
                      }}
                    >
                      {app?.assetContext?.symbol === app?.outboundAssetContext?.symbol ? 
                        'Select different assets' : 
                        (!inputAmount || parseFloat(inputAmount) <= 0 ? 'Enter an amount' : 'Swap')
                      }
                    </Button>

                    {/* Info message */}
                    {fromAssets.length === 0 && (
                      <Text fontSize="sm" color="orange.400" textAlign="center" mt={2}>
                        No assets with sufficient balance (minimum $1) for swapping
                      </Text>
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
                    isLoading={isLoading}
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
        />
        
        {/* Asset Picker for To (all native assets) */}
        <AssetPicker
          isOpen={showAssetPicker === 'to'}
          onClose={() => setShowAssetPicker(null)}
          onSelect={(asset) => handleAssetSelect(asset, false)}
          assets={toAssets}
          title="Select Asset to Receive"
          currentAsset={app?.outboundAssetContext}
        />
      </Flex>
    </Box>
  );
};

export default Swap;