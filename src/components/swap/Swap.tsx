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

  // Helper function to get balance
  const getUserBalance = (caip: string): string => {
    if (!app?.balances || !caip) return '0';
    try {
      const balance = app.balances.find((x: any) => x.caip === caip);
      return balance?.balance || '0';
    } catch (e) {
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

  // Get available assets with balances and filter by native + balance > $10
  const availableAssets = useMemo(() => {
    if (!app?.balances || app.balances.length === 0) {
      return NATIVE_ASSETS.map(asset => ({
        ...asset,
        balance: '0',
        balanceUsd: 0,
        networkId: caipToNetworkId(asset.caip)
      }));
    }

    // Map balances to native assets only
    return NATIVE_ASSETS.map(nativeAsset => {
      const balance = app.balances.find((b: any) => 
        b.caip === nativeAsset.caip || 
        b.symbol === nativeAsset.symbol
      );
      
      const balanceAmount = balance?.balance || '0';
      const priceUsd = parseFloat(balance?.priceUsd || '0');
      const balanceUsd = parseFloat(balanceAmount) * priceUsd;
      
      return {
        ...nativeAsset,
        balance: balanceAmount,
        balanceUsd,
        priceUsd,
        networkId: balance?.networkId || caipToNetworkId(nativeAsset.caip)
      };
    });
  }, [app?.balances]);

  // Filter assets for "from" selection (only assets with > $10 balance)
  const fromAssets = useMemo(() => {
    return availableAssets.filter(asset => asset.balanceUsd > 10);
  }, [availableAssets]);

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

  const handleInputChange = (value: string, isUSD: boolean) => {
    if (isUSD) {
      setInputUSDValue(value);
      if (app?.assetContext?.priceUsd && value) {
        const nativeAmount = (parseFloat(value) / parseFloat(app.assetContext.priceUsd)).toFixed(8);
        setInputAmount(nativeAmount);
      } else {
        setInputAmount('');
      }
    } else {
      setInputAmount(value);
      if (app?.assetContext?.priceUsd && value) {
        const usdValue = (parseFloat(value) * parseFloat(app.assetContext.priceUsd)).toFixed(2);
        setInputUSDValue(usdValue);
      } else {
        setInputUSDValue('');
      }
    }
    setOutputAmount('');
    setOutputUSDValue('');
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
    
    // Check if the "to" asset has enough balance to become the "from" asset
    const toAssetBalance = getUSDValue(toSel.caip, getUserBalance(toSel.caip));
    if (toAssetBalance <= 10) {
      setError('Selected asset does not have sufficient balance (minimum $10)');
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
            bg="rgba(17, 17, 17, 0.9)" 
            backdropFilter="blur(20px)"
            borderColor="gray.800"
            borderWidth="1px"
            boxShadow="0 8px 32px 0 rgba(0, 0, 0, 0.37)"
          >
            <Card.Body p={6}>
              <Stack gap={4}>
                {!confirmMode ? (
                  <>
                    {/* From Asset (only assets with > $10 balance) */}
                    <AssetSelector
                      asset={getAssetDisplay(true)}
                      balance={getUserBalance(app?.assetContext?.caip)}
                      label="From (min. $10 balance)"
                      onClick={() => setShowAssetPicker('from')}
                    />
                    
                    <SwapInput
                      value={inputIsUSD ? inputUSDValue : inputAmount}
                      onChange={(value) => handleInputChange(value, inputIsUSD)}
                      isUSD={inputIsUSD}
                      onToggleUSD={() => setInputIsUSD(!inputIsUSD)}
                      label="Amount"
                    />

                    {/* Swap Button */}
                    <HStack justify="center">
                      <Button
                        variant="ghost"
                        onClick={swapAssets}
                        aria-label="Swap assets"
                        _hover={{ bg: 'gray.700' }}
                      >
                        <FaExchangeAlt size={20} />
                      </Button>
                    </HStack>

                    {/* To Asset (any native asset) */}
                    <AssetSelector
                      asset={getAssetDisplay(false)}
                      balance={getUserBalance(app?.outboundAssetContext?.caip)}
                      label="To"
                      onClick={() => setShowAssetPicker('to')}
                    />
                    
                    <SwapInput
                      value={outputIsUSD ? outputUSDValue : outputAmount}
                      onChange={(value) => handleOutputChange(value, outputIsUSD)}
                      isUSD={outputIsUSD}
                      onToggleUSD={() => setOutputIsUSD(!outputIsUSD)}
                      label="Receive (estimated)"
                      disabled={true}
                    />

                    {/* Quote Display */}
                    <SwapQuote
                      quote={quote}
                      isLoading={isLoading}
                      error={error}
                    />

                    {/* Swap Button */}
                    <Button
                      size="lg"
                      bg="green.500"
                      color="black"
                      _hover={{ bg: 'green.400' }}
                      _active={{ bg: 'green.600' }}
                      onClick={() => setConfirmMode(true)}
                      width="full"
                      height="50px"
                      mt={3}
                      isDisabled={!inputAmount || parseFloat(inputAmount) <= 0}
                    >
                      Preview Swap
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