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
  Heading,
  Flex,
  Card,
  Spinner
} from '@chakra-ui/react';
import { FaExchangeAlt } from 'react-icons/fa';
import { middleEllipsis } from '@/utils/strings';
// @ts-ignore
import { caipToNetworkId, caipToThorchain } from '@pioneer-platform/pioneer-caip';

// Import sub-components
import { AssetSelector } from './AssetSelector';
import { SwapInput } from './SwapInput';
import { SwapQuote } from './SwapQuote';
import { SwapConfirm } from './SwapConfirm';

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
  const [confirmMode, setConfirmMode] = useState<boolean>(false);
  
  // USD input mode states
  const [inputIsUSD, setInputIsUSD] = useState(false);
  const [outputIsUSD, setOutputIsUSD] = useState(false);
  const [inputUSDValue, setInputUSDValue] = useState('');
  const [outputUSDValue, setOutputUSDValue] = useState('');

  // Recipient address state
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState<'from' | 'to' | null>(null);

  // Available networks and assets
  const networks = [
    { caip: 'eip155:1', name: 'Ethereum', symbol: 'ETH', icon: 'https://pioneers.dev/coins/ethereum.png', networkId: 'eip155:1' },
    { caip: 'bip122:000000000019d6689c085ae165831e93', name: 'Bitcoin', symbol: 'BTC', icon: 'https://pioneers.dev/coins/bitcoin.png', networkId: 'bitcoin' },
    { caip: 'cosmos:thorchain-mainnet-v1', name: 'THORChain', symbol: 'RUNE', icon: 'https://pioneers.dev/coins/thorchain.png', networkId: 'thorchain' },
    { caip: 'cosmos:mayachain-mainnet-v1', name: 'Maya Protocol', symbol: 'CACAO', icon: 'https://pioneers.dev/coins/mayaprotocol.png', networkId: 'maya' },
  ];

  const fromAssets = useMemo(() => {
    const items = networks.map((network: any) => ({
      ...network,
      balance: getUserBalance(network.caip),
      networkId: network.networkId || caipToNetworkId(network.caip),
    }));
    
    if (!app?.assetContext?.caip) {
      const first = items[0];
      const second = items.find((a: any) => a.caip !== first.caip) || first;
      
      if (app?.setAssetContext && app?.setOutboundAssetContext) {
        app.setAssetContext(first);
        app.setOutboundAssetContext(second);
      }
    }
    
    return items;
  }, [app?.balances]);

  // Helper functions
  const getUserBalance = (caip: string): string => {
    if (!app?.balances || !caip) return '0';
    try {
      const b = app.balances.find((x: any) => x.caip === caip);
      return b?.balance || '0';
    } catch (e) {
      return '0';
    }
  };

  const fetchAssetPrices = async () => {
    if (!app?.assetContext?.caip || !app?.outboundAssetContext?.caip) return;
    
    try {
      const [fromPrice, toPrice] = await Promise.all([
        app.searchByNetworkId?.(app.assetContext.networkId || caipToNetworkId(app.assetContext.caip)),
        app.searchByNetworkId?.(app.outboundAssetContext.networkId || caipToNetworkId(app.outboundAssetContext.caip))
      ]);
      
      if (fromPrice?.[0]?.priceUsd) {
        app.assetContext.priceUsd = fromPrice[0].priceUsd;
      }
      if (toPrice?.[0]?.priceUsd) {
        app.outboundAssetContext.priceUsd = toPrice[0].priceUsd;
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

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

  const convertFromBaseUnits = (amount: string, decimals = 8): string => {
    if (!amount) return '0';
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(decimals).replace(/\.?0+$/, '');
  };

  const fromAddress = useMemo(() => {
    if (!app?.assetContext?.caip) return '';
    const networkId = app.assetContext.networkId || caipToNetworkId(app.assetContext.caip);
    const prefix = networkId?.split(':')[0];
    const pk = app?.pubkeys?.find((p: any) => Array.isArray(p.networks) && (p.networks.includes(networkId) || p.networks.includes(`${prefix}:*`)));
    return pk?.address || pk?.master || '';
  }, [app?.assetContext?.caip, app?.pubkeys]);

  const toAddressDefault = useMemo(() => {
    if (!app?.outboundAssetContext?.caip) return '';
    const networkId = app.outboundAssetContext.networkId || caipToNetworkId(app.outboundAssetContext.caip);
    const prefix = networkId?.split(':')[0];
    const pk = app?.pubkeys?.find((p: any) => Array.isArray(p.networks) && (p.networks.includes(networkId) || p.networks.includes(`${prefix}:*`)));
    return pk?.address || pk?.master || '';
  }, [app?.outboundAssetContext?.caip, app?.pubkeys]);

  // Fetch quote when input changes
  useEffect(() => {
    if (!inputAmount || !app?.assetContext?.caip || !app?.outboundAssetContext?.caip) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError('');

        const sellAsset = caipToThorchain(app.assetContext);
        const buyAsset = caipToThorchain(app.outboundAssetContext);
        const sellAmount = Math.floor(parseFloat(inputAmount) * 100000000);

        const ThorchainClient = await getThorchainClient();
        const thorchain = new ThorchainClient({
          network: 'mainnet',
          rpcUrl: 'https://rpc.thorchain.info',
          apiUrl: 'https://thornode.thorchain.info'
        });

        const quoteResult = await thorchain.quote.getQuote({
          sellAsset,
          buyAsset,
          sellAmount,
          recipientAddress: recipientAddress || toAddressDefault,
        });

        if (quoteResult?.data) {
          const data = quoteResult.data;
          setQuote({
            expectedAmountOut: convertFromBaseUnits(data.expected_amount_out || '0'),
            fees: {
              network: convertFromBaseUnits(data.fees?.total || '0'),
            },
            slippagePercent: parseFloat(data.slippage_bps || '0') / 100,
            estimatedTime: data.total_seconds || 600,
            router: data.router || 'THORChain',
            memo: data.memo,
            inboundAddress: data.inbound_address,
            rawData: data
          });

          if (data.expected_amount_out) {
            const outAmount = convertFromBaseUnits(data.expected_amount_out);
            setOutputAmount(outAmount);
            
            if (app.outboundAssetContext.priceUsd && outAmount) {
              const usdValue = (parseFloat(outAmount) * parseFloat(app.outboundAssetContext.priceUsd)).toFixed(2);
              setOutputUSDValue(usdValue);
            }
          }
        }
      } catch (error: any) {
        console.error('Quote error:', error);
        setError('Failed to fetch quote: ' + (error?.message || 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [inputAmount, app?.assetContext?.caip, app?.outboundAssetContext?.caip, recipientAddress]);

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
    setInputUSDValue('');
    setOutputUSDValue('');
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
    if (!sel) return null;
    return { 
      symbol: sel.symbol, 
      name: sel.name, 
      icon: sel.icon || 'https://pioneers.dev/coins/coin.png' 
    };
  };
  
  // Execute the swap using Pioneer SDK
  const executeSwap = async () => {
    if (!quote || !app) {
      setError('No quote available');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Ensure SDK is available
      if (app?.swap) {
        const result = await app.swap({
          route: quote.rawData,
          amount: inputAmount,
        });

        // Handle success
        if (result) {
          setInputAmount('');
          setOutputAmount('');
          setInputUSDValue('');
          setOutputUSDValue('');
          setQuote(null);
          setError('');
          setConfirmMode(false);
          const txid = result?.txHash || result?.hash || result?.txid || result;
          if (txid) setError(`Swap submitted! TX: ${String(txid)}`);
          return;
        }
      }
      
      throw new Error('Swap operation not available in SDK.');
    } catch (error: any) {
      console.error('Error executing swap:', error);
      const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch prices on mount and asset change
  useEffect(() => {
    fetchAssetPrices();
  }, [app?.assetContext?.caip, app?.outboundAssetContext?.caip]);

  return (
    <Box bg="bg.primary" minH="100vh" p={4}>
      <Box maxW="500px" mx="auto">
        {/* Header */}
        <Flex align="center" justify="center" mb={6}>
          <Image src="https://pioneers.dev/coins/thorchain.png" alt="THORChain" boxSize="40px" mr={3} />
          <Heading size="lg" color="fg.primary">
            THORChain Swapper
          </Heading>
        </Flex>

        <Card.Root>
          <Card.Body p={6}>
            <Stack gap={4}>
              {!confirmMode ? (
                <>
                  {/* Asset Selectors */}
                  <AssetSelector
                    asset={getAssetDisplay(true)}
                    balance={getUserBalance(app?.assetContext?.caip)}
                    label="From"
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
                    formatTime={formatTime}
                  />

                  {/* Swap Button */}
                  {quote && (
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
                      isDisabled={!quote || isLoading}
                    >
                      Review Swap
                    </Button>
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
    </Box>
  );
};

export default Swap;