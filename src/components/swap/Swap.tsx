'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  HStack,
  Text,
  Button,
  Input,
  Image,
} from '@chakra-ui/react';
import { 
  Spinner,
  Alert,
  Card,
  Flex,
  MenuContent,
  MenuRoot,
  MenuTrigger,
  MenuItem,
} from '@chakra-ui/react';
import { FaExchangeAlt, FaArrowLeft, FaCog, FaChevronDown, FaExclamationCircle } from 'react-icons/fa';

interface SwapProps {
  onBackClick?: () => void;
  walletConnected?: boolean;
  thorchainClient?: any; // Replace with actual THORChain client type
  pioneerClient?: any; // Replace with actual Pioneer SDK client type
}

// Supported assets for swapping - these should come from THORChain pools
const supportedAssets = [
  { symbol: 'BTC', name: 'Bitcoin', chain: 'BTC', icon: 'https://pioneers.dev/coins/bitcoin.png' },
  { symbol: 'ETH', name: 'Ethereum', chain: 'ETH', icon: 'https://pioneers.dev/coins/ethereum.png' },
  { symbol: 'RUNE', name: 'THORChain', chain: 'THOR', icon: 'https://pioneers.dev/coins/thorchain.png' },
  { symbol: 'USDC', name: 'USD Coin', chain: 'ETH', icon: 'https://pioneers.dev/coins/usd-coin.png' },
  { symbol: 'USDT', name: 'Tether', chain: 'ETH', icon: 'https://pioneers.dev/coins/tether.png' },
];

interface THORChainQuote {
  expected_amount_out: string;
  fees: {
    total: string;
    affiliate: string;
    outbound: string;
  };
  slippage_bps: number;
  router: string;
  expiry: number;
  warning?: string;
  notes?: string;
  dust_threshold?: string;
  recommended_min_amount_in?: string;
  memo?: string;
}

export const Swap = ({ 
  onBackClick, 
  walletConnected = false,
  thorchainClient,
  pioneerClient 
}: SwapProps) => {
  const [fromAsset, setFromAsset] = useState('BTC');
  const [toAsset, setToAsset] = useState('ETH');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<THORChainQuote | null>(null);
  const [error, setError] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState('3');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [fromBalance, setFromBalance] = useState<string>('0.00');
  const [toBalance, setToBalance] = useState<string>('0.00');

  // Fetch real quote from THORChain
  const fetchQuote = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      return;
    }

    if (!thorchainClient) {
      setError('THORChain client not initialized. Please ensure wallet is connected.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Convert amount to base units (sats for BTC, wei for ETH, etc)
      const amountInBaseUnits = convertToBaseUnits(inputAmount, fromAsset);
      
      // Build the THORChain quote request URL
      // This should use the actual THORChain Midgard API
      const quoteUrl = `https://midgard.thorchain.info/v2/thorchain/quote/swap`;
      const params = new URLSearchParams({
        from_asset: getAssetString(fromAsset),
        to_asset: getAssetString(toAsset),
        amount: amountInBaseUnits,
        destination: recipientAddress || '', // Optional destination address
        tolerance_bps: (parseFloat(slippage) * 100).toString(), // Convert percentage to basis points
      });

      const response = await fetch(`${quoteUrl}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch quote from THORChain');
      }

      const quoteData: THORChainQuote = await response.json();
      
      setQuote(quoteData);
      // Convert the output amount from base units to display units
      const outputInDisplayUnits = convertFromBaseUnits(quoteData.expected_amount_out, toAsset);
      setOutputAmount(outputInDisplayUnits);
      
    } catch (error: any) {
      console.error('Error fetching THORChain quote:', error);
      setError(error.message || 'Failed to get quote from THORChain. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get THORChain asset string format
  const getAssetString = (symbol: string): string => {
    const asset = supportedAssets.find(a => a.symbol === symbol);
    if (!asset) return '';
    
    // THORChain format: CHAIN.SYMBOL (e.g., BTC.BTC, ETH.ETH, ETH.USDC)
    if (asset.chain === 'THOR') {
      return 'THOR.RUNE';
    }
    return `${asset.chain}.${symbol}`;
  };

  // Convert display units to base units (e.g., BTC to sats)
  const convertToBaseUnits = (amount: string, asset: string): string => {
    const value = parseFloat(amount);
    switch (asset) {
      case 'BTC':
        return Math.floor(value * 1e8).toString(); // Convert to satoshis
      case 'ETH':
      case 'USDC':
      case 'USDT':
        return Math.floor(value * 1e18).toString(); // Convert to wei
      case 'RUNE':
        return Math.floor(value * 1e8).toString(); // RUNE uses 8 decimals
      default:
        return Math.floor(value * 1e8).toString();
    }
  };

  // Convert base units to display units
  const convertFromBaseUnits = (amount: string, asset: string): string => {
    const value = parseFloat(amount);
    switch (asset) {
      case 'BTC':
        return (value / 1e8).toFixed(8);
      case 'ETH':
      case 'USDC':
      case 'USDT':
        return (value / 1e18).toFixed(6);
      case 'RUNE':
        return (value / 1e8).toFixed(6);
      default:
        return (value / 1e8).toFixed(6);
    }
  };

  // Fetch wallet balances
  const fetchBalances = async () => {
    if (!walletConnected || !pioneerClient) {
      return;
    }

    try {
      // Fetch actual balances from the connected wallet
      // This should use the Pioneer SDK or wallet provider
      const balances = await pioneerClient.getBalances();
      
      const fromAssetBalance = balances.find((b: any) => b.symbol === fromAsset);
      const toAssetBalance = balances.find((b: any) => b.symbol === toAsset);
      
      setFromBalance(fromAssetBalance?.balance || '0.00');
      setToBalance(toAssetBalance?.balance || '0.00');
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Fetch balances when wallet connects or assets change
  useEffect(() => {
    fetchBalances();
  }, [walletConnected, fromAsset, toAsset, pioneerClient]);

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [inputAmount, fromAsset, toAsset, slippage, recipientAddress]);

  // Swap from and to assets
  const swapAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
    setInputAmount(outputAmount);
    setOutputAmount('');
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!quote || !walletConnected) {
      setError('Please connect your wallet to perform swap');
      return;
    }

    if (!thorchainClient || !pioneerClient) {
      setError('Wallet clients not initialized');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Build the swap transaction using the quote memo
      if (!quote.memo) {
        throw new Error('No swap memo provided in quote');
      }

      // Prepare the transaction based on the source chain
      const fromChain = supportedAssets.find(a => a.symbol === fromAsset)?.chain;
      
      let txHash: string;
      
      switch (fromChain) {
        case 'BTC':
          // Build and sign Bitcoin transaction
          txHash = await pioneerClient.sendBitcoinTransaction({
            to: quote.router,
            amount: inputAmount,
            memo: quote.memo,
          });
          break;
          
        case 'ETH':
          // Build and sign Ethereum transaction
          txHash = await pioneerClient.sendEthereumTransaction({
            to: quote.router,
            amount: inputAmount,
            memo: quote.memo,
            token: fromAsset === 'ETH' ? null : fromAsset,
          });
          break;
          
        case 'THOR':
          // Build and sign THORChain transaction
          txHash = await thorchainClient.deposit({
            amount: inputAmount,
            memo: quote.memo,
          });
          break;
          
        default:
          throw new Error(`Unsupported chain: ${fromChain}`);
      }
      
      // Monitor the swap status
      // This would typically poll THORChain for swap status
      console.log('Swap transaction submitted:', txHash);
      
      // Clear form after successful submission
      setInputAmount('');
      setOutputAmount('');
      setQuote(null);
      
      // Refresh balances after swap
      await fetchBalances();
      
    } catch (error: any) {
      console.error('Swap execution error:', error);
      setError(error.message || 'Swap failed. Please check your wallet and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    }
  };

  return (
    <Box height="100%" bg="bg.primary" overflow="hidden">
      {/* Header */}
      <Box 
        borderBottom="1px solid"
        borderColor="border.primary"
        p={4}
        bg="bg.surface"
      >
        <HStack justify="space-between" align="center">
          <Button
            size="sm"
            variant="ghost"
            color="accent.solid"
            onClick={handleBack}
            _hover={{ color: "accent.emphasized" }}
          >
            <FaArrowLeft style={{ marginRight: '8px' }} />
            <Text>Back</Text>
          </Button>
          <Text fontSize="lg" fontWeight="bold" color="fg.primary">
            THORChain Swap
          </Text>
          <Button
            size="sm"
            variant="ghost"
            color="accent.solid"
            onClick={() => setShowSettings(!showSettings)}
            _hover={{ color: "accent.emphasized" }}
          >
            <FaCog />
          </Button>
        </HStack>
      </Box>

      <Box p={6} height="calc(100% - 80px)" overflowY="auto">
        <Stack gap={6} align="stretch" maxW="400px" mx="auto">
          {/* Wallet Connection Warning */}
          {!walletConnected && (
            <Alert.Root status="warning" bg="yellow.solid/10" borderColor="yellow.solid/20">
              <Alert.Indicator>
                <FaExclamationCircle />
              </Alert.Indicator>
              <Alert.Title color="fg.primary">
                Please connect your wallet to perform swaps
              </Alert.Title>
            </Alert.Root>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <Card.Root bg="bg.surface" borderColor="border.primary">
              <Card.Body>
                <Stack align="stretch" gap={4}>
                  <Text color="fg.primary" fontWeight="bold">Settings</Text>
                  <Box>
                    <Text color="fg.muted" fontSize="sm" mb={2}>
                      Slippage Tolerance
                    </Text>
                    <HStack gap={2}>
                      {['1', '3', '5'].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={slippage === value ? 'solid' : 'outline'}
                          colorPalette={slippage === value ? 'purple' : 'gray'}
                          onClick={() => setSlippage(value)}
                        >
                          {value}%
                        </Button>
                      ))}
                      <Input
                        placeholder="Custom"
                        size="sm"
                        value={slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        bg="bg.primary"
                        borderColor="border.primary"
                        color="fg.primary"
                        width="80px"
                        type="number"
                        min="0.1"
                        max="10"
                      />
                    </HStack>
                  </Box>
                  <Box>
                    <Text color="fg.muted" fontSize="sm" mb={2}>
                      Recipient Address (Optional)
                    </Text>
                    <Input
                      placeholder="Leave empty to send to connected wallet"
                      size="sm"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      bg="bg.primary"
                      borderColor="border.primary"
                      color="fg.primary"
                    />
                  </Box>
                </Stack>
              </Card.Body>
            </Card.Root>
          )}

          {/* From Asset */}
          <Card.Root bg="bg.surface" borderColor="border.primary">
            <Card.Body>
              <Stack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <Text color="fg.muted" fontSize="sm">From</Text>
                  <Text color="fg.muted" fontSize="sm">Balance: {fromBalance}</Text>
                </HStack>
                <HStack gap={3}>
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <Button
                        variant="outline"
                        bg="bg.primary"
                        borderColor="border.primary"
                        color="fg.primary"
                        width="120px"
                        _hover={{ bg: "bg.muted" }}
                      >
                        <HStack gap={2}>
                          <Image src={supportedAssets.find(a => a.symbol === fromAsset)?.icon} alt={fromAsset} boxSize="20px" />
                          <Text>{fromAsset}</Text>
                          <FaChevronDown />
                        </HStack>
                      </Button>
                    </MenuTrigger>
                    <MenuContent bg="bg.surface" borderColor="border.primary">
                      {supportedAssets.map((asset) => (
                        <MenuItem
                          key={asset.symbol}
                          value={asset.symbol}
                          bg="bg.surface"
                          color="fg.primary"
                          _hover={{ bg: "bg.muted" }}
                          onClick={() => setFromAsset(asset.symbol)}
                        >
                          <HStack gap={2}>
                            <Image src={asset.icon} alt={asset.symbol} boxSize="20px" />
                            <Text>{asset.symbol}</Text>
                            <Text color="fg.muted" fontSize="sm">
                              {asset.name}
                            </Text>
                          </HStack>
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </MenuRoot>
                  <Input
                    placeholder="0.0"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    bg="bg.primary"
                    borderColor="border.primary"
                    color="fg.primary"
                    fontSize="lg"
                    textAlign="right"
                    type="number"
                    min="0"
                    step="0.000001"
                  />
                </HStack>
                {parseFloat(inputAmount) > parseFloat(fromBalance) && (
                  <Text color="red.solid" fontSize="xs">
                    Insufficient balance
                  </Text>
                )}
              </Stack>
            </Card.Body>
          </Card.Root>

          {/* Swap Button */}
          <Flex justify="center">
            <Button
              size="sm"
              variant="outline"
              borderColor="border.primary"
              color="accent.solid"
              bg="bg.surface"
              _hover={{
                bg: "accent.solid",
                color: "bg.primary",
                borderColor: "accent.solid",
              }}
              onClick={swapAssets}
              disabled={isLoading}
            >
              <FaExchangeAlt />
            </Button>
          </Flex>

          {/* To Asset */}
          <Card.Root bg="bg.surface" borderColor="border.primary">
            <Card.Body>
              <Stack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <Text color="fg.muted" fontSize="sm">To</Text>
                  <Text color="fg.muted" fontSize="sm">Balance: {toBalance}</Text>
                </HStack>
                <HStack gap={3}>
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <Button
                        variant="outline"
                        bg="bg.primary"
                        borderColor="border.primary"
                        color="fg.primary"
                        width="120px"
                        _hover={{ bg: "bg.muted" }}
                      >
                        <HStack gap={2}>
                          <Image src={supportedAssets.find(a => a.symbol === toAsset)?.icon} alt={toAsset} boxSize="20px" />
                          <Text>{toAsset}</Text>
                          <FaChevronDown />
                        </HStack>
                      </Button>
                    </MenuTrigger>
                    <MenuContent bg="bg.surface" borderColor="border.primary">
                      {supportedAssets.map((asset) => (
                        <MenuItem
                          key={asset.symbol}
                          value={asset.symbol}
                          bg="bg.surface"
                          color="fg.primary"
                          _hover={{ bg: "bg.muted" }}
                          onClick={() => setToAsset(asset.symbol)}
                        >
                          <HStack gap={2}>
                            <Image src={asset.icon} alt={asset.symbol} boxSize="20px" />
                            <Text>{asset.symbol}</Text>
                            <Text color="fg.muted" fontSize="sm">
                              {asset.name}
                            </Text>
                          </HStack>
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </MenuRoot>
                  <Input
                    placeholder="0.0"
                    value={outputAmount}
                    readOnly
                    bg="bg.primary"
                    borderColor="border.primary"
                    color="fg.primary"
                    fontSize="lg"
                    textAlign="right"
                  />
                </HStack>
              </Stack>
            </Card.Body>
          </Card.Root>

          {/* Quote Details */}
          {quote && (
            <Card.Root bg="bg.surface" borderColor="border.primary">
              <Card.Body>
                <Stack align="stretch" gap={2}>
                  <Text color="fg.primary" fontWeight="bold" fontSize="sm">
                    Quote Details
                  </Text>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="sm">Expected Output</Text>
                    <Text color="fg.primary" fontSize="sm">
                      {convertFromBaseUnits(quote.expected_amount_out, toAsset)} {toAsset}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="sm">Total Fees</Text>
                    <Text color="fg.primary" fontSize="sm">
                      {convertFromBaseUnits(quote.fees.total, 'RUNE')} RUNE
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="sm">Slippage</Text>
                    <Text color="fg.primary" fontSize="sm">
                      {(quote.slippage_bps / 100).toFixed(2)}%
                    </Text>
                  </HStack>
                  {quote.warning && (
                    <Alert.Root status="warning" bg="yellow.solid/10">
                      <Alert.Indicator>
                        <FaExclamationCircle />
                      </Alert.Indicator>
                      <Alert.Title fontSize="xs">{quote.warning}</Alert.Title>
                    </Alert.Root>
                  )}
                  {quote.recommended_min_amount_in && (
                    <Text color="fg.muted" fontSize="xs">
                      Recommended minimum: {convertFromBaseUnits(quote.recommended_min_amount_in, fromAsset)} {fromAsset}
                    </Text>
                  )}
                </Stack>
              </Card.Body>
            </Card.Root>
          )}

          {/* Error Alert */}
          {error && (
            <Alert.Root status="error" bg="red.solid/10" borderColor="red.solid/20">
              <Alert.Indicator>
                <FaExclamationCircle />
              </Alert.Indicator>
              <Alert.Title color="fg.primary">{error}</Alert.Title>
            </Alert.Root>
          )}

          {/* Swap Button */}
          <Button
            size="lg"
            bg="accent.solid"
            color="bg.primary"
            _hover={{ bg: "accent.emphasized" }}
            disabled={
              !quote || 
              isLoading || 
              !inputAmount || 
              !walletConnected ||
              parseFloat(inputAmount) > parseFloat(fromBalance)
            }
            loading={isLoading}
            loadingText="Processing Swap..."
            onClick={handleSwap}
          >
            {!walletConnected 
              ? 'Connect Wallet to Swap'
              : !quote 
                ? 'Enter amount to get quote'
                : parseFloat(inputAmount) > parseFloat(fromBalance)
                  ? 'Insufficient Balance'
                  : `Swap ${fromAsset} for ${toAsset}`
            }
          </Button>

          {/* Loading Spinner */}
          {isLoading && (
            <Flex justify="center">
              <Spinner color="accent.solid" />
            </Flex>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default Swap;