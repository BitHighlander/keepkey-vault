'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { usePioneerContext } from '@/components/providers/pioneer';
import {
  Box,
  Stack,
  HStack,
  Text,
  Button,
  Input,
  Image,
  Heading,
} from '@chakra-ui/react';
import { 
  Spinner,
  Card,
  Flex,
  Switch,
} from '@chakra-ui/react';
import { FaExchangeAlt, FaCog, FaChevronDown, FaArrowRight, FaBolt } from 'react-icons/fa';
// @ts-ignore
import { caipToNetworkId, caipToThorchain } from '@pioneer-platform/pioneer-caip';

// CJS interop-friendly dynamic import helpers
async function getThorchainClient(): Promise<any> {
  // @ts-ignore
  const mod: any = await import('@pioneer-platform/thorchain-client');
  return mod?.default || mod;
}

async function getMayachainClient(): Promise<any> {
  // @ts-ignore
  const mod: any = await import('@pioneer-platform/mayachain-client');
  return mod?.default || mod;
}

interface SwapProps {
  onBackClick?: () => void;
}

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
  
  // Dropdown states
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [enableStreaming, setEnableStreaming] = useState(false);
  const [streamingInterval, setStreamingInterval] = useState('1');
  const [streamingQuantity, setStreamingQuantity] = useState('0');
  const [recipientAddress, setRecipientAddress] = useState('');
  
  // Asset prices for USD display
  const [assetPrices, setAssetPrices] = useState<{ [key: string]: number }>({});
  const [estimatedValueUSD, setEstimatedValueUSD] = useState('');
  const [outputValueUSD, setOutputValueUSD] = useState('');

  // Build assets from dashboard (match dashboard UI)
  const fromAssets = useMemo(() => {
    const networks = app?.dashboard?.networks || [];
    const items = networks.map((network: any) => ({
      caip: network.gasAssetCaip,
      networkId: network.networkId,
      symbol: network.gasAssetSymbol,
      name: network.networkName || network.gasAssetSymbol,
      icon: network.icon,
      color: network.color,
      balance: String(network.totalNativeBalance || '0'),
      valueUsd: Number(network.totalValueUsd || 0),
    }));
    return items.sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0));
  }, [app?.dashboard]);
  const toAssets = fromAssets;

  // middle ellipsis like dashboard
  const middleEllipsis = (text: string, visibleChars = 16) => {
    if (!text) return '';
    if (text.length <= visibleChars) return text;
    const charsToShow = Math.floor(visibleChars / 2);
    return `${text.substring(0, charsToShow)}...${text.substring(text.length - charsToShow)}`;
  };

  // Ensure distinct initial contexts
  useEffect(() => {
    if (!app?.setAssetContext || !app?.setOutboundAssetContext) return;
    if (!fromAssets || fromAssets.length === 0) return;
    const currentIn = app?.assetContext?.caip;
    const currentOut = app?.outboundAssetContext?.caip;
    const first = fromAssets[0];
    const second = fromAssets.find((a: any) => a.caip !== first.caip) || first;
    (async () => {
      try {
        if (!currentIn) {
          await app.setAssetContext({
            caip: first.caip,
            networkId: first.networkId || caipToNetworkId(first.caip),
            symbol: first.symbol,
            name: first.name,
            icon: first.icon,
          });
        }
        const inAfter = currentIn || first.caip;
        if (!currentOut || currentOut === inAfter) {
          const outChoice = fromAssets.find((a: any) => a.caip !== inAfter) || second;
          await app.setOutboundAssetContext({
            caip: outChoice.caip,
            networkId: outChoice.networkId || caipToNetworkId(outChoice.caip),
            symbol: outChoice.symbol,
            name: outChoice.name,
            icon: outChoice.icon,
          });
        }
      } catch (_) {
        // ignore
      }
    })();
  }, [fromAssets, app?.assetContext?.caip, app?.outboundAssetContext?.caip, app?.setAssetContext, app?.setOutboundAssetContext]);

  // Get user's balance for selected input asset
  const getUserBalance = (): string => {
    try {
      const caip = app?.assetContext?.caip;
      if (!caip || !app?.balances) return '0';
      const b = app.balances.find((x: any) => x.caip === caip);
      if (!b) return '0';
      return String(b.balance || b.value || '0');
    } catch {
      return '0';
    }
  };

  // Pick first asset different from a given CAIP
  const pickAlternate = (currentCaip?: string) => {
    if (!currentCaip) return fromAssets[0] || null;
    return fromAssets.find((a: any) => a.caip !== currentCaip) || null;
  };
  
  // Get user's address for the selected asset
  const getUserAddress = (assetSymbol: string): string => {
    if (!app?.pubkeys) return '';
    
    // Map asset to chain
    const chainMap: { [key: string]: string } = {
      'BTC.BTC': 'bitcoin',
      'ETH.ETH': 'ethereum',
      'ETH.USDC': 'ethereum',
      'ETH.USDT': 'ethereum',
      'BSC.BNB': 'binancecoin',
      'THOR.RUNE': 'thorchain',
      'AVAX.AVAX': 'avalanche',
      'GAIA.ATOM': 'cosmos',
      'BCH.BCH': 'bitcoincash',
      'DOGE.DOGE': 'dogecoin',
      'LTC.LTC': 'litecoin',
      'MAYA.CACAO': 'mayachain',
    };
    
    const baseSymbol = assetSymbol.split('-')[0]; // Handle tokens like ETH.USDC-0X...
    const chain = chainMap[baseSymbol] || chainMap[assetSymbol];
    
    if (!chain) {
      console.warn(`No chain mapping for asset: ${assetSymbol}`);
      return '';
    }
    
    // Find pubkey for this chain
    const pubkey = app.pubkeys.find((pk: any) => 
      pk.networks?.includes(chain) || 
      pk.blockchain === chain ||
      pk.symbol === chain.toUpperCase()
    );
    
    if (!pubkey) {
      console.warn(`No pubkey found for chain: ${chain}`);
    }
    
    return pubkey?.address || pubkey?.pubkey || '';
  };

  // Fetch asset prices from Pioneer SDK
  const fetchAssetPrices = async () => {
    try {
      if (app?.getAssetPrices) {
        console.log('📊 Fetching prices from Pioneer SDK...');
        const sdkPrices = await app.getAssetPrices();
        const priceMap: { [key: string]: number } = {};
        Object.entries(sdkPrices).forEach(([key, value]: [string, any]) => {
          priceMap[key] = (value as any).price || (value as any).usd || (value as any);
        });
        setAssetPrices(priceMap);
        console.log('✅ Got prices from Pioneer SDK');
      }
    } catch (error) {
      console.error('Error fetching asset prices:', error);
    }
  };

  // Initialize assets from balances and available assets
  useEffect(() => {
    const initializeAssets = async () => {
      if (!app) return;
      
      try {

          console.log('📊 Loading native assets from dashboard.networks:', app.dashboard.networks.length);
          

        
        // setToAssets(allNativeAssets);
        // console.log('✅ Loaded "To" assets (all native including 0 balances):', allNativeAssets.length);
        
      } catch (error) {
        console.error('Error loading assets:', error);
      }
    };
    
    initializeAssets();
    fetchAssetPrices();
  }, [app, app?.dashboard]);

  // Update USD value when amount changes
  useEffect(() => {
    const sellId = app?.assetContext?.caip ? caipToThorchain(app.assetContext.caip, app.assetContext.symbol) : undefined;
    if (inputAmount && sellId && assetPrices[sellId]) {
      const usdValue = parseFloat(inputAmount) * assetPrices[sellId];
      setEstimatedValueUSD(`≈ $${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } else {
      setEstimatedValueUSD('');
    }
  }, [inputAmount, app?.assetContext?.caip, app?.assetContext?.symbol, assetPrices]);

  // Update memoized list order when prices change (no state setter needed)
  // We rely on useMemo sorting; trigger rerender by local state if needed in future

  // Convert from base units (default 8)
  const convertFromBaseUnits = (amount: string, decimals = 8): string => {
    const value = parseFloat(amount);
    return (value / Math.pow(10, decimals)).toFixed(decimals);
  };

  // Resolve user addresses for selected assets
  const fromAddress = useMemo(() => {
    if (!app?.assetContext?.caip) return '';
    const networkId = caipToNetworkId(app.assetContext.caip);
    if (!networkId) return '';
    const prefix = networkId.split(':')[0];
    const pk = app?.pubkeys?.find((p: any) => Array.isArray(p.networks) && (p.networks.includes(networkId) || p.networks.includes(`${prefix}:*`)));
    return pk?.address || pk?.pubkey || '';
  }, [app?.pubkeys, app?.assetContext?.caip]);

  const toAddressDefault = useMemo(() => {
    if (!app?.outboundAssetContext?.caip) return '';
    const networkId = caipToNetworkId(app.outboundAssetContext.caip);
    if (!networkId) return '';
    const prefix = networkId.split(':')[0];
    const pk = app?.pubkeys?.find((p: any) => Array.isArray(p.networks) && (p.networks.includes(networkId) || p.networks.includes(`${prefix}:*`)));
    return pk?.address || pk?.pubkey || '';
  }, [app?.pubkeys, app?.outboundAssetContext?.caip]);

  // Dashboard network meta for styling and balances
  const getNetworkMeta = (caip?: string) => {
    const networks = app?.dashboard?.networks || [];
    const n = networks.find((x: any) => x.gasAssetCaip === caip);
    return {
      color: n?.color,
      balance: n?.totalNativeBalance != null ? String(n.totalNativeBalance) : '0',
      caip: n?.gasAssetCaip,
    };
  };

  // Fetch quote using integration clients (no fallbacks)
  const fetchQuote = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      setError('');
      return;
    }
    if (!app?.assetContext?.caip || !app?.outboundAssetContext?.caip) {
      setError('Select both input and output assets');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const sellCaip = app.assetContext.caip;
      const buyCaip = app.outboundAssetContext.caip;
      const sellId = caipToThorchain(sellCaip, app.assetContext.symbol);
      const buyId = caipToThorchain(buyCaip, app.outboundAssetContext.symbol);
      if (!sellId || !buyId) throw new Error('Unsupported asset mapping');

      const destination = recipientAddress || toAddressDefault;
      const sender = fromAddress;
      if (!sender) throw new Error('Missing sender address for input asset');
      if (!destination) throw new Error('Missing destination address for output asset');

      const payload: any = {
        sellAsset: sellId,
        buyAsset: buyId,
        sellAmount: String(inputAmount),
        senderAddress: sender,
        recipientAddress: destination,
        slippage: '3',
      };

      const integration = sellId.startsWith('MAYA.') || buyId.startsWith('MAYA.') ? 'MAYA' : 'THOR';
      let quoteResult: any;
      if (integration === 'THOR') {
        const thor = await getThorchainClient();
        quoteResult = await thor.getQuote(payload);
      } else {
        const maya = await getMayachainClient();
        quoteResult = await maya.getQuote(payload);
      }

      setQuote(quoteResult);

      const out = quoteResult.amountOut
        || (quoteResult.expected_amount_out && convertFromBaseUnits(String(quoteResult.expected_amount_out)));
      if (out) setOutputAmount(String(out));

      const toKey = buyId;
      if (assetPrices[toKey] && out) {
        const usdValue = parseFloat(String(out)) * assetPrices[toKey];
        setOutputValueUSD(`≈ $${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      setError(error.message || 'Unable to fetch quote');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [inputAmount, app?.assetContext?.caip, app?.outboundAssetContext?.caip, recipientAddress, enableStreaming, streamingInterval, streamingQuantity]);

  // Swap from and to assets (contexts)
  const swapAssets = async () => {
    const fromSel = app?.assetContext;
    const toSel = app?.outboundAssetContext;
    if (!fromSel || !toSel || !app?.setAssetContext || !app?.setOutboundAssetContext) return;
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
    setQuote(null);
    setError('');
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getAssetDisplay = (isFromAsset: boolean = false) => {
    const sel = isFromAsset ? app?.assetContext : app?.outboundAssetContext;
    if (!sel) return { symbol: '', name: '', ticker: '', icon: 'https://pioneers.dev/coins/coin.png' };
    const ticker = sel.symbol || sel.name || '';
    return { symbol: sel.symbol, name: sel.name, ticker, icon: sel.icon };
  };
  
  // Execute the swap using Pioneer SDK
  const executeSwap = async () => {
    if (!quote || !app) {
      setError('No quote available');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Check if Pioneer SDK has THORChain swap execution
      if (app.executeThorchainSwap) {
        console.log('🚀 Executing swap via Pioneer SDK...');
        
        const swapParams = {
          quote,
          fromAsset: app?.assetContext?.caip,
          toAsset: app?.outboundAssetContext?.caip,
          amount: inputAmount,
          recipient: recipientAddress || toAddressDefault,
        };
        
        const result = await app.executeThorchainSwap(swapParams);
        console.log('✅ Swap executed:', result);
        
        // Reset form after successful swap
        setInputAmount('');
        setOutputAmount('');
        setQuote(null);
        setError('');
        
        // Show success message
        if (result.txHash || result.hash) {
          setError(`Swap submitted! TX: ${result.txHash || result.hash}`);
        }
      } else {
        // No device connected
        console.log('⚠️ Pioneer SDK swap execution not available');
        setError('Connect your KeepKey to execute the swap. Quotes are available without a device.');
      }
    } catch (error: any) {
      console.error('Error executing swap:', error);
      setError(error.message || 'Failed to execute swap');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box bg="bg.primary" minH="100vh" p={4}>
      <Box maxW="500px" mx="auto">
        {/* Header */}
        <Flex align="center" justify="center" mb={6}>
          <Image src="https://pioneers.dev/coins/thorchain.png" alt="THORChain" boxSize="40px" mr={3} />
          <Heading size="lg" color="fg.primary">
            THORChain Quote Estimator
          </Heading>
        </Flex>

        <Card.Root>
          <Card.Body p={6}>
            <Stack gap={4}>
              {/* From/To Labels */}
              <HStack justify="space-around" mb={2}>
                <Text fontSize="sm" flex={1}>From:</Text>
                <Box width="40px" /> {/* Spacer for swap button */}
                <Text fontSize="sm" flex={1}>To:</Text>
              </HStack>

              {/* Asset Selection Row */}
              <HStack gap={2} align="center">
                 {/* From Asset */}
                <Box flex={1} position="relative">
                  <Button
                    width="full"
                    height="80px"
                    bg={getNetworkMeta(app?.assetContext?.caip).color ? `${getNetworkMeta(app?.assetContext?.caip).color}15` : 'gray.800'}
                    border="1px solid"
                    borderColor={getNetworkMeta(app?.assetContext?.caip).color ? `${getNetworkMeta(app?.assetContext?.caip).color}40` : 'gray.700'}
                    _hover={{ bg: getNetworkMeta(app?.assetContext?.caip).color ? `${getNetworkMeta(app?.assetContext?.caip).color}25` : 'gray.700' }}
                    onClick={() => setShowFromDropdown(!showFromDropdown)}
                    padding={3}
                  >
                    <HStack width="full" justify="space-between">
                      <HStack gap={2}>
                        <Image 
                          src={getAssetDisplay(true).icon}
                          alt={app?.assetContext?.symbol || ''} 
                          boxSize="32px"
                        />
                        <Box textAlign="left">
                          <Text fontSize="sm" fontWeight="bold" color="white">
                            {getAssetDisplay(true).ticker}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {getAssetDisplay(true).name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {middleEllipsis(app?.assetContext?.caip || '', 14)}
                          </Text>
                          <Text fontSize="xs" color="gray.300">
                            {getNetworkMeta(app?.assetContext?.caip).balance} {getAssetDisplay(true).ticker}
                          </Text>
                        </Box>
                      </HStack>
                      <FaChevronDown />
                    </HStack>
                  </Button>
                  
                  {/* Dropdown Menu */}
                  {showFromDropdown && (
                    <Box
                      position="absolute"
                      top="90px"
                      left={0}
                      right={0}
                      bg="gray.900"
                      border="1px solid"
                      borderColor="gray.700"
                      borderRadius="md"
                      maxH="300px"
                      overflowY="auto"
                      zIndex={20}
                      boxShadow="2xl"
                    >
                      {fromAssets.map((asset: any) => {
                        const isDisabled = asset.caip === app?.outboundAssetContext?.caip;
                        return (
                          <Button
                            key={asset.caip}
                            width="full"
                            height="80px"
                            bg={isDisabled ? "gray.950" : "gray.900"}
                            _hover={{ bg: isDisabled ? "gray.950" : "gray.800" }}
                            onClick={async () => {
                              if (isDisabled) return;
                              if (!app?.setAssetContext) return;
                              await app.setAssetContext({
                                caip: asset.caip,
                                networkId: asset.networkId || caipToNetworkId(asset.caip),
                                symbol: asset.symbol,
                                name: asset.name,
                                icon: asset.icon,
                              });
                              // Ensure output differs from input
                              try {
                                if (app?.outboundAssetContext?.caip === asset.caip && app?.setOutboundAssetContext) {
                                  const alt = pickAlternate(asset.caip);
                                  if (alt) {
                                    await app.setOutboundAssetContext({
                                      caip: alt.caip,
                                      networkId: alt.networkId || caipToNetworkId(alt.caip),
                                      symbol: alt.symbol,
                                      name: alt.name,
                                      icon: alt.icon,
                                    });
                                  }
                                }
                              } catch {}
                              setShowFromDropdown(false);
                              setQuote(null);
                              setOutputAmount('');
                              setError('');
                            }}
                            justifyContent="flex-start"
                            padding={4}
                            borderRadius={0}
                            borderBottom="1px solid"
                            borderBottomColor="gray.800"
                            cursor={isDisabled ? "not-allowed" : "pointer"}
                            opacity={isDisabled ? 0.5 : 1}
                          >
                            <HStack gap={3} width="full">
                              <Image 
                                src={asset.icon} 
                                alt={asset.symbol} 
                                boxSize="40px"
                                opacity={isDisabled ? 0.5 : 1}
                              />
                              <Box flex={1} textAlign="left">
                                <HStack>
                                  <Text fontSize="md" fontWeight="bold" color={isDisabled ? "gray.600" : "white"}>
                                    {asset.symbol}
                                  </Text>
                                  {isDisabled && (
                                    <Text fontSize="xs" color="yellow.500" fontWeight="bold">
                                      (Selected as To)
                                    </Text>
                                  )}
                                </HStack>
                                <Text fontSize="xs" color={isDisabled ? "gray.600" : "gray.400"}>
                                  {asset.caip}
                                </Text>
                    <HStack justify="space-between" mt={1}>
                                  <Text fontSize="sm" color={isDisabled ? "gray.600" : "green.400"}>
                                    {parseFloat(asset.balance || '0').toFixed(6)} {asset.symbol}
                                  </Text>
                                  {assetPrices[asset.symbol] && parseFloat(asset.balance || '0') > 0 && (
                                    <Text fontSize="sm" color={isDisabled ? "gray.600" : "blue.400"}>
                                      ${(parseFloat(asset.balance || '0') * (assetPrices[asset.symbol] || 0)).toFixed(2)}
                                    </Text>
                                  )}
                                </HStack>
                              </Box>
                            </HStack>
                          </Button>
                        );
                      })}
                    </Box>
                  )}
                </Box>

                {/* Swap Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={swapAssets}
                  minW="40px"
                  height="40px"
                  borderRadius="full"
                  _hover={{ bg: "bg.muted" }}
                  alignSelf="center"
                >
                  <FaExchangeAlt />
                </Button>

                 {/* To Asset */}
                <Box flex={1} position="relative">
                  <Button
                    width="full"
                    height="80px"
                    bg={getNetworkMeta(app?.outboundAssetContext?.caip).color ? `${getNetworkMeta(app?.outboundAssetContext?.caip).color}15` : 'gray.800'}
                    borderColor={getNetworkMeta(app?.outboundAssetContext?.caip).color ? `${getNetworkMeta(app?.outboundAssetContext?.caip).color}40` : 'gray.700'}
                    border="1px solid"
                    _hover={{ bg: getNetworkMeta(app?.outboundAssetContext?.caip).color ? `${getNetworkMeta(app?.outboundAssetContext?.caip).color}25` : 'gray.700' }}
                    onClick={() => setShowToDropdown(!showToDropdown)}
                    padding={3}
                  >
                    <HStack width="full" justify="space-between">
                      <HStack gap={2}>
                       <Image 
                          src={getAssetDisplay(false).icon}
                          alt={app?.outboundAssetContext?.symbol || ''} 
                          boxSize="32px" 
                        />
                        <Box textAlign="left">
                          <Text fontSize="sm" fontWeight="bold" color="white">
                            {getAssetDisplay(false).ticker}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {getAssetDisplay(false).name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {middleEllipsis(app?.outboundAssetContext?.caip || '', 14)}
                          </Text>
                          <Text fontSize="xs" color="gray.300">
                            {getNetworkMeta(app?.outboundAssetContext?.caip).balance} {getAssetDisplay(false).ticker}
                          </Text>
                        </Box>
                      </HStack>
                      <FaChevronDown />
                    </HStack>
                  </Button>
                  
                  {/* Dropdown Menu */}
                  {showToDropdown && (
                    <Box
                      position="absolute"
                      top="90px"
                      left={0}
                      right={0}
                      bg="gray.900"
                      border="1px solid"
                      borderColor="gray.700"
                      borderRadius="md"
                      maxH="300px"
                      overflowY="auto"
                      zIndex={20}
                      boxShadow="2xl"
                    >
                       {toAssets.map((asset: any) => {
                        const isDisabled = asset.caip === app?.assetContext?.caip;
                        return (
                          <Button
                            key={asset.caip}
                            width="full"
                            height="80px"
                            bg={isDisabled ? "gray.950" : "gray.900"}
                            _hover={{ bg: isDisabled ? "gray.950" : "gray.800" }}
                            onClick={async () => {
                              if (isDisabled) return;
                              if (!app?.setOutboundAssetContext) return;
                              await app.setOutboundAssetContext({
                                caip: asset.caip,
                                networkId: asset.networkId || caipToNetworkId(asset.caip),
                                symbol: asset.symbol,
                                name: asset.name,
                                icon: asset.icon,
                              });
                              setShowToDropdown(false);
                              setQuote(null);
                              setOutputAmount('');
                              setError('');
                            }}
                            justifyContent="flex-start"
                            padding={4}
                            borderRadius={0}
                            borderBottom="1px solid"
                            borderBottomColor="gray.800"
                            cursor={isDisabled ? "not-allowed" : "pointer"}
                            opacity={isDisabled ? 0.5 : 1}
                          >
                            <HStack gap={3} width="full">
                              <Image 
                                src={asset.icon} 
                                alt={asset.symbol} 
                                boxSize="40px"
                                opacity={isDisabled ? 0.5 : 1}
                              />
                              <Box flex={1} textAlign="left">
                                <HStack>
                                  <Text fontSize="md" fontWeight="bold" color={isDisabled ? "gray.600" : "white"}>
                                    {asset.symbol}
                                  </Text>
                                  {isDisabled && (
                                    <Text fontSize="xs" color="yellow.500" fontWeight="bold">
                                      (Selected as From)
                                    </Text>
                                  )}
                                </HStack>
                                 <Text fontSize="xs" color={isDisabled ? "gray.600" : "gray.400"}>
                                  {asset.name}
                                </Text>
                                <Text fontSize="sm" color={isDisabled ? "gray.600" : parseFloat(asset.balance || '0') > 0 ? "green.400" : "gray.500"} mt={1}>
                                  {parseFloat(asset.balance || '0').toFixed(6)} {asset.symbol}
                                </Text>
                              </Box>
                            </HStack>
                          </Button>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </HStack>

              <Box borderTop="1px solid" borderColor="border.primary" my={2} />

              {/* Amount Input */}
              <Box>
                <HStack justify="space-between" mb={3}>
                  <Text color="fg.muted" fontSize="sm" fontWeight="medium">
                    Amount
                  </Text>
                  <HStack gap={3}>
                    <Text color="fg.muted" fontSize="sm">
                      Balance: <Text as="span" color="fg.primary" fontWeight="medium">{getUserBalance()}</Text>
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="accent.solid"
                      color="accent.solid"
                      onClick={() => setInputAmount(getUserBalance())}
                      _hover={{ bg: "accent.solid", color: "white" }}
                      px={3}
                      height="24px"
                    >
                      MAX
                    </Button>
                  </HStack>
                </HStack>
                <Input
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  bg="bg.primary"
                  borderColor="border.primary"
                  color="fg.primary"
                  fontSize="xl"
                  height="50px"
                  type="number"
                  min="0"
                  step="0.000001"
                />
                {estimatedValueUSD && (
                  <Text color="fg.muted" fontSize="sm" mt={1} textAlign="right">
                    {estimatedValueUSD}
                  </Text>
                )}
              </Box>

              {/* Settings Toggle */}
               <Button
                size="sm"
                variant="ghost"
                color="fg.muted"
                onClick={() => setShowSettings(!showSettings)}
                 // @ts-ignore - leftIcon provided by Chakra button wrapper in project theme
                 leftIcon={<FaCog />}
                width="full"
                justifyContent="center"
              >
                Advanced Settings
              </Button>

              {/* Advanced Settings */}
              {showSettings && (
                <Stack gap={3} p={4} bg="bg.primary" borderRadius="md" border="1px solid" borderColor="border.primary">
                  {/* Streaming Swap Toggle */}
                  <HStack justify="space-between">
                    <HStack>
                      <FaBolt color="#FFD700" />
                      <Text color="fg.primary" fontSize="sm">Streaming Swap</Text>
                    </HStack>
                    {/* @ts-ignore project UI switch component accepts boolean setter */}
                    <Switch.Root checked={enableStreaming} onCheckedChange={setEnableStreaming}>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Root>
                  </HStack>

                  {enableStreaming && (
                    <Stack gap={2}>
                      <Box>
                        <Text color="fg.muted" fontSize="xs" mb={1}>
                          Streaming Interval (blocks):
                        </Text>
                        <Input
                          value={streamingInterval}
                          onChange={(e) => setStreamingInterval(e.target.value)}
                          bg="bg.surface"
                          borderColor="border.primary"
                          size="sm"
                          type="number"
                          min="1"
                          max="10"
                        />
                      </Box>

                      <Box>
                        <Text color="fg.muted" fontSize="xs" mb={1}>
                          Streaming Quantity:
                        </Text>
                        <Input
                          value={streamingQuantity}
                          onChange={(e) => setStreamingQuantity(e.target.value)}
                          bg="bg.surface"
                          borderColor="border.primary"
                          size="sm"
                          type="number"
                          min="0"
                          max="100"
                        />
                      </Box>
                    </Stack>
                  )}

                  {/* Recipient Address */}
                  <Box>
                    <Text color="fg.muted" fontSize="xs" mb={1}>
                      Recipient Address (Optional):
                    </Text>
                    <Input
                      placeholder={`Leave empty to use your ${getAssetDisplay(false).ticker} address`}
                      size="sm"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      bg="bg.surface"
                      borderColor="border.primary"
                      color="fg.primary"
                      fontSize="xs"
                    />
                  </Box>
                </Stack>
              )}

              {/* Get Quote Button */}
                     <Button
                size="lg"
                bg="green.500"
                color="white"
                _hover={{ bg: "green.600" }}
                onClick={fetchQuote}
                       // @ts-ignore project button supports isLoading
                       isLoading={isLoading}
                       loadingText="Fetching Quote..."
                disabled={!inputAmount || parseFloat(inputAmount) <= 0}
                width="full"
                height="50px"
              >
                Get Quote
              </Button>

              {/* Error Display */}
              {error && (
                <Text color="red.500" fontSize="sm" textAlign="center">
                  {error}
                </Text>
              )}

              {/* Quote Result */}
              {quote && outputAmount && (
                <Box p={4} bg="bg.primary" borderRadius="md" border="1px solid" borderColor="border.primary">
                  <Stack gap={3}>
                    {/* Streaming Swap Label */}
                    {enableStreaming && (
                      <Text color="fg.primary" fontWeight="bold" fontSize="sm" textAlign="center">
                        THORChain Streaming Swap
                      </Text>
                    )}

                    {/* Swap Summary */}
                    <HStack justify="center" gap={3} py={2}>
                      <HStack>
                        <Image 
                          src={getAssetDisplay(true).icon}
                          alt={app?.assetContext?.symbol || ''} 
                          boxSize="20px" 
                        />
                        <Text color="fg.primary" fontWeight="bold">
                          {inputAmount} {getAssetDisplay(true).ticker}
                        </Text>
                      </HStack>
                      <FaArrowRight />
                      <HStack>
                        <Image 
                          src={getAssetDisplay(false).icon}
                          alt={app?.outboundAssetContext?.symbol || ''} 
                          boxSize="20px" 
                        />
                        <Text color="green.400" fontWeight="bold">
                          {parseFloat(outputAmount).toFixed(8)} {getAssetDisplay(false).ticker}
                        </Text>
                      </HStack>
                    </HStack>

                    {outputValueUSD && (
                      <Text color="fg.muted" fontSize="sm" textAlign="center">
                        {outputValueUSD}
                      </Text>
                    )}

                    <Box borderTop="1px solid" borderColor="border.primary" my={2} />

                    {/* Fee Breakdown */}
                    <Stack gap={2}>
                      <Text color="fg.muted" fontSize="xs" fontWeight="bold">
                        Fee Breakdown:
                      </Text>
                      
                      <HStack justify="space-between">
                        <Text color="fg.muted" fontSize="xs">Liquidity Fee:</Text>
                        <Text color="fg.primary" fontSize="xs">
                          {convertFromBaseUnits(quote.fees?.liquidity || '0')} {quote.fees?.asset?.split('.')[1] || ''}
                        </Text>
                      </HStack>

                      <HStack justify="space-between">
                        <Text color="fg.muted" fontSize="xs">Outbound Fee:</Text>
                        <Text color="fg.primary" fontSize="xs">
                          {convertFromBaseUnits(quote.fees?.outbound || '0')} {quote.fees?.asset?.split('.')[1] || ''}
                        </Text>
                      </HStack>

                      <HStack justify="space-between">
                        <Text color="fg.muted" fontSize="xs" fontWeight="bold">Total Fee:</Text>
                        <Text color="fg.primary" fontSize="xs" fontWeight="bold">
                          {convertFromBaseUnits(quote.fees?.total || '0')} {quote.fees?.asset?.split('.')[1] || ''} 
                          {quote.fees?.total_bps && ` (${(quote.fees.total_bps / 100).toFixed(2)}%)`}
                        </Text>
                      </HStack>
                    </Stack>

                    {/* Timing Information */}
                    {quote.total_swap_seconds && (
                      <>
                        <Box borderTop="1px solid" borderColor="border.primary" my={2} />
                        <HStack justify="space-between">
                          <Text color="fg.muted" fontSize="xs">Estimated Time:</Text>
                          <Text color="fg.primary" fontSize="xs">
                            {formatTime(quote.total_swap_seconds)}
                          </Text>
                        </HStack>
                      </>
                    )}
                    
                    {/* Execute Swap Button */}
                    <Box borderTop="1px solid" borderColor="border.primary" my={2} />
                     <Button
                      size="lg"
                      bg="accent.solid"
                      color="white"
                      _hover={{ bg: "accent.muted" }}
                      onClick={executeSwap}
                       // @ts-ignore project button supports isLoading
                       isLoading={isLoading}
                       loadingText="Executing Swap..."
                      width="full"
                      height="50px"
                      mt={3}
                    >
                      Execute Swap
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>
      </Box>
    </Box>
  );
};

export default Swap;