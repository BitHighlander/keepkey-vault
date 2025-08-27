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
  Container
} from '@chakra-ui/react';
import { FaExchangeAlt, FaArrowLeft } from 'react-icons/fa';
// @ts-ignore
import { caipToNetworkId } from '@pioneer-platform/pioneer-caip';

// Import sub-components
import { AssetSelector } from './AssetSelector';
import { SwapInput } from './SwapInput';
import { SwapQuote } from './SwapQuote';
import { SwapConfirm } from './SwapConfirm';
import { AssetPicker } from './AssetPicker';

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
      hasAssetContext: !!app?.assetContext,
      assetContext: app?.assetContext,
      hasOutboundAssetContext: !!app?.outboundAssetContext,
      outboundAssetContext: app?.outboundAssetContext
    });
  }, [app]);

  // State for swap form
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [confirmMode, setConfirmMode] = useState<boolean>(false);
  
  // USD input mode states
  const [inputIsUSD, setInputIsUSD] = useState(false);
  const [outputIsUSD, setOutputIsUSD] = useState(false);
  const [inputUSDValue, setInputUSDValue] = useState('');
  const [outputUSDValue, setOutputUSDValue] = useState('');

  // Asset picker state
  const [showAssetPicker, setShowAssetPicker] = useState<'from' | 'to' | null>(null);

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

  // Get available assets with balances - COPY FROM DASHBOARD
  const availableAssets = useMemo(() => {
    if (!app?.balances || app.balances.length === 0) {
      return [];
    }

    // Create a map to aggregate balances by symbol (exact copy from dashboard logic)
    const balanceMap = new Map();
    
    app.balances.forEach((balance: any) => {
      const ticker = balance.ticker || balance.symbol;
      if (!ticker) return;
      
      // Find matching native asset
      const nativeAsset = NATIVE_ASSETS.find(asset => asset.symbol === ticker);
      if (!nativeAsset) return;
      
      const balanceAmount = parseFloat(balance.balance || '0');
      const valueUsd = parseFloat(balance.valueUsd || '0');
      
      if (balanceMap.has(ticker)) {
        // Aggregate existing balance
        const existing = balanceMap.get(ticker);
        existing.balance += balanceAmount;
        existing.balanceUsd += valueUsd;
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
      }
    });

    // Convert to array and sort by USD value (exact copy from dashboard)
    const assets = Array.from(balanceMap.values())
      .filter((asset: any) => asset.balanceUsd > 1)
      .sort((a: any, b: any) => b.balanceUsd - a.balanceUsd);

    console.log('availableAssets: Final sorted assets', assets);
    return assets;
  }, [app?.balances]);

  // fromAssets are already filtered and sorted in availableAssets
  const fromAssets = availableAssets;

  // All native assets available for "to" selection (no balance requirement)
  const toAssets = useMemo(() => {
    // Exclude the currently selected "from" asset
    return availableAssets.filter(asset => 
      asset.caip !== app?.assetContext?.caip
    );
  }, [availableAssets, app?.assetContext?.caip]);

  // Initialize default assets if not set
  useEffect(() => {
    if (!app?.assetContext?.caip && fromAssets.length > 0) {
      const defaultFrom = fromAssets[0];
      const defaultTo = toAssets[0] || availableAssets[0];
      
      if (app?.setAssetContext && app?.setOutboundAssetContext) {
        app.setAssetContext(defaultFrom);
        app.setOutboundAssetContext(defaultTo);
      }
    }
  }, [fromAssets, toAssets, app?.assetContext?.caip]);

  const handleInputChange = (value: string) => {
    setInputAmount(value);
    // Automatically calculate and update USD value
    if (app?.assetContext?.priceUsd && value) {
      const usdValue = (parseFloat(value) * parseFloat(app.assetContext.priceUsd)).toFixed(2);
      setInputUSDValue(usdValue);
    } else {
      setInputUSDValue('');
    }
    setOutputAmount('');
    setOutputUSDValue('');
  };

  const handleMaxClick = () => {
    const maxBalance = getUserBalance(app?.assetContext?.caip);
    if (maxBalance && parseFloat(maxBalance) > 0) {
      setInputAmount(maxBalance);
      // Automatically calculate and update USD value
      if (app?.assetContext?.priceUsd) {
        const usdValue = (parseFloat(maxBalance) * parseFloat(app.assetContext.priceUsd)).toFixed(2);
        setInputUSDValue(usdValue);
      }
      setOutputAmount('');
      setOutputUSDValue('');
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
    
    if (isFrom) {
      await app.setAssetContext({
        caip: asset.caip,
        networkId: asset.networkId || caipToNetworkId(asset.caip),
        symbol: asset.symbol,
        name: asset.name,
        icon: asset.icon,
        priceUsd: asset.priceUsd
      });
    } else {
      await app.setOutboundAssetContext({
        caip: asset.caip,
        networkId: asset.networkId || caipToNetworkId(asset.caip),
        symbol: asset.symbol,
        name: asset.name,
        icon: asset.icon,
        priceUsd: asset.priceUsd
      });
    }
    
    // Reset amounts when changing assets
    setInputAmount('');
    setOutputAmount('');
    setInputUSDValue('');
    setOutputUSDValue('');
    setQuote(null);
    setError('');
  };

  // Swap from and to assets
  const swapAssets = async () => {
    const fromSel = app?.assetContext;
    const toSel = app?.outboundAssetContext;
    if (!fromSel || !toSel || !app?.setAssetContext || !app?.setOutboundAssetContext) return;
    
    // Check if the "to" asset has any balance to become the "from" asset
    const toAssetBalance = parseFloat(getUserBalance(toSel.caip));
    if (toAssetBalance <= 0) {
      setError('Selected asset does not have any balance');
      return;
    }
    
    await app.setAssetContext({
      caip: toSel.caip,
      networkId: toSel.networkId || caipToNetworkId(toSel.caip),
      symbol: toSel.symbol,
      name: toSel.name,
      icon: toSel.icon,
    });
    
    await app.setOutboundAssetContext({
      caip: fromSel.caip,
      networkId: fromSel.networkId || caipToNetworkId(fromSel.caip),
      symbol: fromSel.symbol,
      name: fromSel.name,
      icon: fromSel.icon,
    });
    
    setInputAmount('');
    setOutputAmount('');
    setInputUSDValue('');
    setOutputUSDValue('');
    setQuote(null);
    setError('');
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

  const executeSwap = async () => {
    console.log('Swap execution placeholder');
    setError('Swap functionality coming soon');
  };

  return (
    <Box bg="bg.primary" minH="100vh" position="relative">
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
            <IconButton
              variant="ghost"
              aria-label="Go back"
              icon={<FaArrowLeft />}
              onClick={onBackClick}
              color="gray.400"
              _hover={{ color: 'white', bg: 'gray.800' }}
            />
            
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
              <Stack gap={2}>
                {!confirmMode ? (
                  <>
                    {/* From Section */}
                    <Box>
                      <AssetSelector
                        asset={getAssetDisplay(true)}
                        balance={getUserBalance(app?.assetContext?.caip)}
                        label="From"
                        onClick={() => setShowAssetPicker('from')}
                      />
                      
                      <Box mt={2}>
                        <SwapInput
                          value={inputAmount}
                          onChange={handleInputChange}
                          showMaxButton={true}
                          onMaxClick={handleMaxClick}
                          usdAmount={inputAmount && app?.assetContext?.priceUsd ? 
                            (parseFloat(inputAmount) * parseFloat(app.assetContext.priceUsd)).toFixed(2) : 
                            undefined}
                          symbol={app?.assetContext?.symbol}
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
                        label="To"
                        onClick={() => setShowAssetPicker('to')}
                      />
                      
                      <Box mt={2}>
                        <SwapInput
                          value={outputAmount}
                          onChange={() => {}} // Disabled, so no-op
                          disabled={true}
                          placeholder="0"
                          usdAmount={outputAmount && app?.outboundAssetContext?.priceUsd ? 
                            (parseFloat(outputAmount) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2) : 
                            undefined}
                          symbol={app?.outboundAssetContext?.symbol}
                        />
                      </Box>
                    </Box>

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
                      isDisabled={!inputAmount || parseFloat(inputAmount) <= 0}
                      _disabled={{
                        bg: 'gray.600',
                        color: 'gray.400',
                        cursor: 'not-allowed'
                      }}
                    >
                      {!inputAmount || parseFloat(inputAmount) <= 0 ? 'Enter an amount' : 'Swap'}
                    </Button>

                    {/* Info message */}
                    {fromAssets.length === 0 && (
                      <Text fontSize="sm" color="orange.400" textAlign="center">
                        No assets with sufficient balance (minimum $10) for swapping
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
                  />
                )}
              </Stack>
            </Card.Body>
          </Card.Root>
        </Box>
        
        {/* Asset Picker for From (filtered by balance) */}
        <AssetPicker
          isOpen={showAssetPicker === 'from'}
          onClose={() => setShowAssetPicker(null)}
          onSelect={(asset) => handleAssetSelect(asset, true)}
          assets={fromAssets}
          title="Select Asset to Swap From (min. $10 balance)"
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