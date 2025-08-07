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
import { FaExchangeAlt, FaArrowLeft, FaCog, FaChevronDown } from 'react-icons/fa';
import { LuAlertCircle } from 'react-icons/lu';

interface SwapProps {
  onBackClick?: () => void;
}

// Supported assets for swapping
const supportedAssets = [
  { symbol: 'BTC', name: 'Bitcoin', icon: 'https://pioneers.dev/coins/bitcoin.png' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'https://pioneers.dev/coins/ethereum.png' },
  { symbol: 'RUNE', name: 'THORChain', icon: 'https://pioneers.dev/coins/thorchain.png' },
  { symbol: 'USDC', name: 'USD Coin', icon: 'https://pioneers.dev/coins/usd-coin.png' },
  { symbol: 'USDT', name: 'Tether', icon: 'https://pioneers.dev/coins/tether.png' },
];

export const Swap = ({ onBackClick }: SwapProps) => {
  const [fromAsset, setFromAsset] = useState('BTC');
  const [toAsset, setToAsset] = useState('ETH');
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState('3');

  // Fetch quote when inputs change
  const fetchQuote = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Convert amount to the right units (for demo purposes, using a simple conversion)
      const amountToSend = parseFloat(inputAmount);
      
      // This is a mock quote for demonstration
      // In a real implementation, you would call THORChain's quote API
      const mockQuote = {
        input: `${amountToSend} ${fromAsset}`,
        output: `${(amountToSend * 0.95).toFixed(6)} ${toAsset}`, // Mock 5% slippage
        expectedOutputAmount: (amountToSend * 0.95).toFixed(6),
        fees: {
          total: `${(amountToSend * 0.05).toFixed(6)} ${fromAsset}`,
        },
        slippage: `${slippage}%`,
        route: `${fromAsset} → ${toAsset}`,
      };

      setQuote(mockQuote);
      setOutputAmount(mockQuote.expectedOutputAmount);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setError('Failed to get quote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [inputAmount, fromAsset, toAsset, slippage]);

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
    if (!quote) return;
    
    setIsLoading(true);
    try {
      // Mock swap execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Swap completed successfully! (Demo)');
    } catch (error) {
      setError('Swap failed. Please try again.');
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
            Swap
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
                      />
                    </HStack>
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
                  <Text color="fg.muted" fontSize="sm">Balance: 0.00</Text>
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
                  />
                </HStack>
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
                  <Text color="fg.muted" fontSize="sm">Balance: 0.00</Text>
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
                    <Text color="fg.muted" fontSize="sm">Route</Text>
                    <Text color="fg.primary" fontSize="sm">{quote.route}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="sm">Est. Fees</Text>
                    <Text color="fg.primary" fontSize="sm">{quote.fees.total}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="sm">Slippage</Text>
                    <Text color="fg.primary" fontSize="sm">{quote.slippage}</Text>
                  </HStack>
                </Stack>
              </Card.Body>
            </Card.Root>
          )}

          {/* Error Alert */}
          {error && (
            <Alert.Root status="error" bg="red.solid/10" borderColor="red.solid/20">
              <Alert.Indicator>
                <LuAlertCircle />
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
            disabled={!quote || isLoading || !inputAmount}
            loading={isLoading}
            loadingText="Swapping..."
            onClick={handleSwap}
          >
            {quote ? `Swap ${fromAsset} for ${toAsset}` : 'Enter amount to swap'}
          </Button>

          {/* Loading Spinner */}
          {isLoading && (
            <Flex justify="center">
              <Spinner color="accent.solid" />
            </Flex>
          )}

          {/* Disclaimer */}
          <Text color="fg.subtle" fontSize="xs" textAlign="center">
            ⚠️ This is a demo interface. Real swaps require proper integration with THORChain protocol and wallet signatures.
          </Text>
        </Stack>
      </Box>
    </Box>
  );
};

export default Swap;