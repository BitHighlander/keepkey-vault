'use client'

import React, { useState, useEffect } from 'react';
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

interface SwapProps {
  onBackClick?: () => void;
}

export const Swap = ({ onBackClick }: SwapProps) => {
  // Get app context from Pioneer
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // State for swap form
  const [fromAsset, setFromAsset] = useState('ETH.ETH');
  const [toAsset, setToAsset] = useState('BTC.BTC');
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

  // Get supported assets from Pioneer SDK
  const [fromAssets, setFromAssets] = useState<any[]>([]);
  const [toAssets, setToAssets] = useState<any[]>([]);

  // Get user's balance for a specific asset
  const getUserBalance = (assetSymbol: string): string => {
    // First check in fromAssets which has the actual balances
    const assetWithBalance = fromAssets.find((a: any) => a.symbol === assetSymbol);
    if (assetWithBalance && assetWithBalance.balance) {
      return assetWithBalance.balance;
    }
    
    // Fallback to app.balances if available
    if (!app?.balances) return '0';
    
    // Map THORChain symbol to balance lookup
    const balance = app.balances.find((b: any) => {
      // Check various symbol formats
      return b.symbol === assetSymbol || 
             b.ticker === assetSymbol.split('.')[1] ||
             b.thorchainSymbol === assetSymbol ||
             (b.symbol === assetSymbol.split('.')[1] && b.networkId?.includes(assetSymbol.split('.')[0].toLowerCase()));
    });
    
    return balance ? balance.balance || balance.value || '0' : '0';
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

  // Fetch asset prices from Pioneer SDK or Midgard
  const fetchAssetPrices = async () => {
    try {
      // Try to get prices from Pioneer SDK first
      if (app?.getAssetPrices) {
        try {
          console.log('📊 Fetching prices from Pioneer SDK...');
          const sdkPrices = await app.getAssetPrices();
          
          // Convert SDK prices to THORChain asset format
          const priceMap: { [key: string]: number } = {};
          Object.entries(sdkPrices).forEach(([key, value]: [string, any]) => {
            // Map different price formats
            priceMap[key] = value.price || value.usd || value;
          });
          
          setAssetPrices(priceMap);
          console.log('✅ Got prices from Pioneer SDK');
          return;
        } catch (sdkError) {
          console.warn('⚠️ Pioneer SDK price fetch failed, using Midgard:', sdkError);
        }
      }
      
      // Fallback to Midgard API
      const response = await fetch('https://midgard.ninerealms.com/v2/pools');
      const pools = await response.json();
      
      const prices = pools.reduce((acc: any, pool: any) => {
        acc[pool.asset] = parseFloat(pool.assetPriceUSD);
        return acc;
      }, {});
      
      // Special case for RUNE
      const usdcPool = pools.find((p: any) => p.asset === 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48');
      if (usdcPool) {
        prices['THOR.RUNE'] = parseFloat(usdcPool.assetDepth) / parseFloat(usdcPool.runeDepth);
      }
      
      setAssetPrices(prices);
    } catch (error) {
      console.error('Error fetching asset prices:', error);
    }
  };

  // Initialize assets from balances and available assets
  useEffect(() => {
    const initializeAssets = async () => {
      if (!app) return;
      
      try {
        // Get native assets from dashboard.networks (matching the portfolio display)
        if (app.dashboard && app.dashboard.networks && app.dashboard.networks.length > 0) {
          console.log('📊 Loading native assets from dashboard.networks:', app.dashboard.networks.length);
          
          // Map dashboard networks to THORChain format - these are all NATIVE assets
          const assetsWithBalance = app.dashboard.networks
            .filter((network: any) => {
              // Only include networks with non-zero balance
              const hasBalance = parseFloat(network.totalNativeBalance || '0') > 0;
              return hasBalance;
            })
            .map((network: any) => {
              // Map network IDs to THORChain chain prefixes
              const chainMap: { [key: string]: string } = {
                'bitcoin': 'BTC',
                'ethereum': 'ETH',
                'binancecoin': 'BSC',
                'thorchain': 'THOR',
                'avalanche': 'AVAX',
                'cosmos': 'GAIA',
                'bitcoincash': 'BCH',
                'dogecoin': 'DOGE',
                'litecoin': 'LTC',
                'mayachain': 'MAYA',
              };
              
              const chain = chainMap[network.networkId?.toLowerCase()];
              const thorSymbol = chain ? `${chain}.${network.gasAssetSymbol}` : `${network.gasAssetSymbol}.${network.gasAssetSymbol}`;
              
              return {
                symbol: thorSymbol,
                name: network.gasAssetSymbol,
                ticker: network.gasAssetSymbol,
                icon: network.icon,
                balance: network.totalNativeBalance,
                networkId: network.networkId,
                caip: network.gasAssetCaip,
                address: null // Will be fetched from pubkeys when needed
              };
            })
            .filter((asset: any) => asset.symbol); // Only keep assets with valid symbols
          
          // Sort by USD value (highest first)
          const sortedAssets = assetsWithBalance.sort((a: any, b: any) => {
            // Calculate USD values
            const aBalance = parseFloat(a.balance || '0');
            const bBalance = parseFloat(b.balance || '0');
            const aPrice = assetPrices[a.symbol] || 0;
            const bPrice = assetPrices[b.symbol] || 0;
            const aValue = aBalance * aPrice;
            const bValue = bBalance * bPrice;
            return bValue - aValue; // Sort descending (highest first)
          });
          
          setFromAssets(sortedAssets);
          console.log('✅ Loaded "From" assets (native only) from balances:', sortedAssets.length);
        }
        
        // Get all native assets for "To" dropdown (including 0 balances)
        // Map all supported chains to THORChain format
        const supportedChains = [
          { networkId: 'bitcoin', chain: 'BTC', symbol: 'BTC', name: 'Bitcoin' },
          { networkId: 'ethereum', chain: 'ETH', symbol: 'ETH', name: 'Ethereum' },
          { networkId: 'binancecoin', chain: 'BSC', symbol: 'BNB', name: 'BNB Smart Chain' },
          { networkId: 'thorchain', chain: 'THOR', symbol: 'RUNE', name: 'THORChain' },
          { networkId: 'avalanche', chain: 'AVAX', symbol: 'AVAX', name: 'Avalanche' },
          { networkId: 'cosmos', chain: 'GAIA', symbol: 'ATOM', name: 'Cosmos' },
          { networkId: 'bitcoincash', chain: 'BCH', symbol: 'BCH', name: 'Bitcoin Cash' },
          { networkId: 'dogecoin', chain: 'DOGE', symbol: 'DOGE', name: 'Dogecoin' },
          { networkId: 'litecoin', chain: 'LTC', symbol: 'LTC', name: 'Litecoin' },
          { networkId: 'mayachain', chain: 'MAYA', symbol: 'CACAO', name: 'Maya Protocol' },
        ];
        
        // Create native assets list with all chains (including 0 balances)
        const allNativeAssets = supportedChains.map(chain => {
          const thorSymbol = `${chain.chain}.${chain.symbol}`;
          
          // Check if we have a balance for this asset
          const assetWithBalance = fromAssets.find((a: any) => a.symbol === thorSymbol);
          const balance = assetWithBalance ? assetWithBalance.balance : '0';
          
          return {
            symbol: thorSymbol,
            name: chain.name,
            ticker: chain.symbol,
            icon: `https://pioneers.dev/coins/${chain.networkId}.png`,
            balance: balance,
            networkId: chain.networkId,
          };
        });
        
        setToAssets(allNativeAssets);
        console.log('✅ Loaded "To" assets (all native including 0 balances):', allNativeAssets.length);
        
      } catch (error) {
        console.error('Error loading assets:', error);
      }
    };
    
    initializeAssets();
    fetchAssetPrices();
  }, [app, app?.dashboard]);

  // Update USD value when amount changes
  useEffect(() => {
    if (inputAmount && assetPrices[fromAsset]) {
      const usdValue = parseFloat(inputAmount) * assetPrices[fromAsset];
      setEstimatedValueUSD(`≈ $${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } else {
      setEstimatedValueUSD('');
    }
  }, [inputAmount, fromAsset, assetPrices]);

  // Re-sort fromAssets when prices change
  useEffect(() => {
    if (fromAssets.length > 0 && Object.keys(assetPrices).length > 0) {
      const sortedAssets = [...fromAssets].sort((a: any, b: any) => {
        const aBalance = parseFloat(a.balance || '0');
        const bBalance = parseFloat(b.balance || '0');
        const aPrice = assetPrices[a.symbol] || 0;
        const bPrice = assetPrices[b.symbol] || 0;
        const aValue = aBalance * aPrice;
        const bValue = bBalance * bPrice;
        return bValue - aValue; // Sort descending (highest USD value first)
      });
      setFromAssets(sortedAssets);
    }
  }, [assetPrices]);

  // Convert to base units
  const convertToBaseUnits = (amount: string): string => {
    const value = parseFloat(amount);
    return Math.floor(value * 1e8).toString();
  };

  // Convert from base units
  const convertFromBaseUnits = (amount: string): string => {
    const value = parseFloat(amount);
    return (value / 1e8).toFixed(8);
  };

  // Fetch quote using Pioneer SDK or THORNode
  const fetchQuote = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      setError('');
      return;
    }

    if (fromAsset === toAsset) {
      setError('Cannot swap to the same asset. Please select different assets.');
      setOutputAmount('');
      setQuote(null);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const amountInBaseUnits = convertToBaseUnits(inputAmount);
      const destination = recipientAddress || getUserAddress(toAsset);

      if (!destination) {
        setError(`Please provide a destination address for ${toAsset}`);
        setIsLoading(false);
        return;
      }

      // Try to use Pioneer SDK's THORChain integration first
      if (app?.getThorchainQuote) {
        try {
          console.log('🚀 Using Pioneer SDK for THORChain quote...');
          const quoteParams = {
            sellAsset: fromAsset,
            buyAsset: toAsset,
            sellAmount: amountInBaseUnits,
            senderAddress: getUserAddress(fromAsset),
            recipientAddress: destination,
            slippage: '3', // 3% slippage tolerance
            streamingInterval: enableStreaming ? streamingInterval : undefined,
            streamingQuantity: enableStreaming ? streamingQuantity : undefined,
          };
          
          const sdkQuote = await app.getThorchainQuote(quoteParams);
          console.log('✅ Got quote from Pioneer SDK:', sdkQuote);
          
          // Map SDK quote to our format
          setQuote(sdkQuote);
          const output = convertFromBaseUnits(sdkQuote.expected_amount_out || sdkQuote.expectedAmountOut);
          setOutputAmount(output);
          
          // Calculate output USD value
          if (assetPrices[toAsset]) {
            const usdValue = parseFloat(output) * assetPrices[toAsset];
            setOutputValueUSD(`≈ $${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          }
          
          return; // Success with SDK
        } catch (sdkError) {
          console.warn('⚠️ Pioneer SDK quote failed, falling back to direct API:', sdkError);
          // Fall through to direct API call
        }
      }

      // Fallback to direct THORNode API
      let quoteUrl = 'https://thornode.ninerealms.com/thorchain/quote/swap?';
      quoteUrl += `amount=${amountInBaseUnits}`;
      quoteUrl += `&from_asset=${fromAsset}`;
      quoteUrl += `&to_asset=${toAsset}`;
      quoteUrl += `&destination=${destination}`;
      
      // Add streaming parameters if enabled
      if (enableStreaming) {
        quoteUrl += `&streaming_interval=${streamingInterval}`;
        quoteUrl += `&streaming_quantity=${streamingQuantity}`;
      }

      console.log('Fetching quote from THORNode:', quoteUrl);
      const response = await fetch(quoteUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch quote');
      }

      const quoteData = await response.json();
      setQuote(quoteData);
      
      // Set output amount
      const output = convertFromBaseUnits(quoteData.expected_amount_out);
      setOutputAmount(output);
      
      // Calculate output USD value
      if (assetPrices[toAsset]) {
        const usdValue = parseFloat(output) * assetPrices[toAsset];
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
  }, [inputAmount, fromAsset, toAsset, recipientAddress, enableStreaming, streamingInterval, streamingQuantity]);

  // Swap from and to assets
  const swapAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
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

  const getAssetDisplay = (symbol: string, isFromAsset: boolean = false) => {
    const assets = isFromAsset ? fromAssets : toAssets;
    const asset = assets.find(a => a.symbol === symbol);
    return asset || { symbol, name: symbol, ticker: symbol.split('.')[1] || symbol, icon: 'https://pioneers.dev/coins/coin.png' };
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
          fromAsset,
          toAsset,
          amount: inputAmount,
          recipient: recipientAddress || getUserAddress(toAsset),
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
        // Fallback: Build and sign transaction manually
        console.log('⚠️ Pioneer SDK swap execution not available');
        setError('Swap execution requires KeepKey device connection');
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
                    bg="gray.800"
                    border="1px solid"
                    borderColor="gray.700"
                    _hover={{ bg: "gray.700" }}
                    onClick={() => setShowFromDropdown(!showFromDropdown)}
                    padding={3}
                  >
                    <HStack width="full" justify="space-between">
                      <HStack gap={2}>
                        <Image 
                          src={getAssetDisplay(fromAsset, true).icon}
                          alt={fromAsset} 
                          boxSize="32px"
                        />
                        <Box textAlign="left">
                          <Text fontSize="sm" fontWeight="bold" color="white">
                            {getAssetDisplay(fromAsset, true).ticker}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {getAssetDisplay(fromAsset, true).name}
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
                      {fromAssets.map((asset) => {
                        const isDisabled = asset.symbol === toAsset;
                        return (
                          <Button
                            key={asset.symbol}
                            width="full"
                            height="80px"
                            bg={isDisabled ? "gray.950" : "gray.900"}
                            _hover={{ bg: isDisabled ? "gray.950" : "gray.800" }}
                            onClick={() => {
                              if (!isDisabled) {
                                setFromAsset(asset.symbol);
                                setShowFromDropdown(false);
                              }
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
                                alt={asset.ticker} 
                                boxSize="40px"
                                opacity={isDisabled ? 0.5 : 1}
                              />
                              <Box flex={1} textAlign="left">
                                <HStack>
                                  <Text fontSize="md" fontWeight="bold" color={isDisabled ? "gray.600" : "white"}>
                                    {asset.ticker}
                                  </Text>
                                  {isDisabled && (
                                    <Text fontSize="xs" color="yellow.500" fontWeight="bold">
                                      (Selected as To)
                                    </Text>
                                  )}
                                </HStack>
                                <Text fontSize="xs" color={isDisabled ? "gray.600" : "gray.400"} noOfLines={1}>
                                  {asset.caip || asset.address || asset.symbol}
                                </Text>
                                <HStack justify="space-between" mt={1}>
                                  <Text fontSize="sm" color={isDisabled ? "gray.600" : "green.400"}>
                                    {parseFloat(asset.balance).toFixed(6)} {asset.ticker}
                                  </Text>
                                  {assetPrices[asset.symbol] && parseFloat(asset.balance) > 0 && (
                                    <Text fontSize="sm" color={isDisabled ? "gray.600" : "blue.400"}>
                                      ${(parseFloat(asset.balance) * assetPrices[asset.symbol]).toFixed(2)}
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
                    bg="gray.800"
                    borderColor="gray.700"
                    border="1px solid"
                    _hover={{ bg: "gray.700" }}
                    onClick={() => setShowToDropdown(!showToDropdown)}
                    padding={3}
                  >
                    <HStack width="full" justify="space-between">
                      <HStack gap={2}>
                        <Image 
                          src={getAssetDisplay(toAsset).icon}
                          alt={toAsset} 
                          boxSize="32px" 
                          fallbackSrc="https://pioneers.dev/coins/coin.png"
                        />
                        <Box textAlign="left">
                          <Text fontSize="sm" fontWeight="bold" color="white">
                            {getAssetDisplay(toAsset).ticker}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {getAssetDisplay(toAsset).name}
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
                      {toAssets.map((asset) => {
                        const isDisabled = asset.symbol === fromAsset;
                        return (
                          <Button
                            key={asset.symbol}
                            width="full"
                            height="80px"
                            bg={isDisabled ? "gray.950" : "gray.900"}
                            _hover={{ bg: isDisabled ? "gray.950" : "gray.800" }}
                            onClick={() => {
                              if (!isDisabled) {
                                setToAsset(asset.symbol);
                                setShowToDropdown(false);
                              }
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
                                alt={asset.ticker} 
                                boxSize="40px"
                                fallbackSrc="https://pioneers.dev/coins/coin.png"
                                opacity={isDisabled ? 0.5 : 1}
                              />
                              <Box flex={1} textAlign="left">
                                <HStack>
                                  <Text fontSize="md" fontWeight="bold" color={isDisabled ? "gray.600" : "white"}>
                                    {asset.ticker}
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
                                  {parseFloat(asset.balance || '0').toFixed(6)} {asset.ticker}
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
                      Balance: <Text as="span" color="fg.primary" fontWeight="medium">{getUserBalance(fromAsset)}</Text>
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="accent.solid"
                      color="accent.solid"
                      onClick={() => setInputAmount(getUserBalance(fromAsset))}
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
                      placeholder={`Leave empty to use your ${getAssetDisplay(toAsset).ticker} address`}
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
                          src={getAssetDisplay(fromAsset, true).icon}
                          alt={fromAsset} 
                          boxSize="20px" 
                        />
                        <Text color="fg.primary" fontWeight="bold">
                          {inputAmount} {getAssetDisplay(fromAsset, true).ticker}
                        </Text>
                      </HStack>
                      <FaArrowRight />
                      <HStack>
                        <Image 
                          src={getAssetDisplay(toAsset).icon}
                          alt={toAsset} 
                          boxSize="20px" 
                        />
                        <Text color="green.400" fontWeight="bold">
                          {parseFloat(outputAmount).toFixed(8)} {getAssetDisplay(toAsset).ticker}
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