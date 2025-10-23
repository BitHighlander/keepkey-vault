'use client'

import React, { useState, useMemo } from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Image,
  Grid,
  Input,
  Button,
  Badge,
  Spinner,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { InputGroup } from '@/components/ui/input-group';
import { FaSearch, FaPlus, FaTimes, FaCheck, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { assetData } from '@pioneer-platform/pioneer-discovery';
import { usePioneerContext } from '@/components/providers/pioneer';
import { CustomToken } from '@/hooks/useCustomTokens';

interface CustomTokenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToken: (token: CustomToken) => Promise<{ success: boolean; hasBalance: boolean; balance?: string }>;
  onRemoveToken: (networkId: string, tokenAddress: string) => void;
  customTokens: CustomToken[];
  defaultNetwork?: string; // Default network to filter by
}

const ITEMS_PER_PAGE = 50;

// EVM networks that support custom tokens
const SUPPORTED_NETWORKS = [
  { id: 'eip155:1', name: 'Ethereum' },
  { id: 'eip155:137', name: 'Polygon' },
  { id: 'eip155:56', name: 'BSC' },
  { id: 'eip155:8453', name: 'Base' },
  { id: 'eip155:10', name: 'Optimism' },
  { id: 'eip155:42161', name: 'Arbitrum' },
  { id: 'eip155:43114', name: 'Avalanche' },
];

export const CustomTokenDialog = ({
  isOpen,
  onClose,
  onAddToken,
  onRemoveToken,
  customTokens,
  defaultNetwork,
}: CustomTokenDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Determine initial network: use defaultNetwork if it's supported, otherwise fallback to Ethereum
  const getInitialNetwork = () => {
    if (defaultNetwork && SUPPORTED_NETWORKS.some(net => net.id === defaultNetwork)) {
      return defaultNetwork;
    }
    return 'eip155:1'; // Default to Ethereum
  };

  const [selectedNetwork, setSelectedNetwork] = useState(getInitialNetwork());
  const [currentPage, setCurrentPage] = useState(0);
  const [processingToken, setProcessingToken] = useState<CustomToken | null>(null);
  const [processingResult, setProcessingResult] = useState<{
    type: 'success' | 'warning';
    message: string;
    hasBalance: boolean;
    balance?: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { state } = usePioneerContext();
  const pioneer = usePioneerContext();

  // Get user's primary address for custom token management
  const userAddress = useMemo(() => {
    if (state?.assetContext?.pubkey) {
      return state.assetContext.pubkey;
    }
    // Fallback to first EVM pubkey
    const evmPubkey = state?.pubkeys?.find((p: any) =>
      p.networks && p.networks.includes('eip155:*')
    );
    return evmPubkey?.address || evmPubkey?.master || '';
  }, [state]);

  // Filter tokens from pioneer-discovery for selected network
  const networkTokens = useMemo(() => {
    const tokens: CustomToken[] = [];

    // Filter assetData for tokens on selected network
    Object.entries(assetData).forEach(([caip, asset]: [string, any]) => {
      // Only include tokens for the selected network
      // Support different token standards: erc20, bep20, etc.
      if (caip.startsWith(selectedNetwork)) {
        // Check if this is a token (not the native asset)
        // Look for common token patterns: /erc20:, /bep20:, etc.
        const tokenMatch = caip.match(/\/(erc20|bep20|spl):(.+)$/);
        if (tokenMatch) {
          const tokenAddress = tokenMatch[2];
          tokens.push({
            symbol: asset.symbol,
            name: asset.name,
            address: tokenAddress,
            networkId: selectedNetwork,
            caip: caip,
            decimals: asset.decimal || 18,
            icon: asset.icon,
            coingeckoId: asset.coingeckoId,
          });
        }
      }
    });

    return tokens;
  }, [selectedNetwork]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    let filtered = networkTokens;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(token =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [networkTokens, searchQuery]);

  // Paginate tokens
  const totalPages = Math.ceil(filteredTokens.length / ITEMS_PER_PAGE);
  const paginatedTokens = filteredTokens.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  // Check if token is already added
  const isTokenAdded = (token: CustomToken) => {
    return customTokens.some(ct =>
      ct.networkId === token.networkId &&
      ct.address.toLowerCase() === token.address.toLowerCase()
    );
  };

  const handleToggleToken = async (token: CustomToken) => {
    console.log('🎯 Token clicked:', token.symbol, token.address, 'on', token.networkId);
    const isAdded = isTokenAdded(token);
    console.log('Token is already added:', isAdded);

    if (isAdded) {
      console.log('Removing token...');
      onRemoveToken(token.networkId, token.address);
    } else {
      console.log('Adding token...');
      setProcessingToken(token);
      setProcessingResult(null);
      setIsScanning(true);

      try {
        const result = await onAddToken(token);

        if (result.success) {
          setProcessingResult({
            type: result.hasBalance ? 'success' : 'warning',
            message: result.hasBalance
              ? `✅ Token found! Balance: ${result.balance || 'checking...'}`
              : `⚠️ Token added, but your account appears empty for this token`,
            hasBalance: result.hasBalance,
            balance: result.balance,
          });
        }
      } catch (error) {
        console.error('Error toggling token:', error);
        setProcessingResult({
          type: 'warning',
          message: `❌ Error adding token: ${error instanceof Error ? error.message : 'Unknown error'}`,
          hasBalance: false,
        });
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleRescan = async () => {
    if (!processingToken || !pioneer.state?.app) return;

    setIsScanning(true);
    try {
      console.log('🔄 Rescanning balance for:', processingToken.symbol);

      // Call getCharts to refresh all balances including custom tokens
      if (pioneer.state.app.getCharts) {
        await pioneer.state.app.getCharts();
      }

      // Check balance again
      const balanceResult = await pioneer.state.app.getBalance(processingToken.networkId);
      const tokenBalance = balanceResult?.find((b: any) =>
        b.caip?.toLowerCase() === processingToken.caip?.toLowerCase() ||
        b.address?.toLowerCase() === processingToken.address?.toLowerCase()
      );

      if (tokenBalance && parseFloat(tokenBalance.balance || '0') > 0) {
        setProcessingResult({
          type: 'success',
          message: `✅ Token found! Balance: ${tokenBalance.balance}`,
          hasBalance: true,
          balance: tokenBalance.balance,
        });
      } else {
        setProcessingResult({
          type: 'warning',
          message: `⚠️ Still no balance found for this token`,
          hasBalance: false,
        });
      }
    } catch (error) {
      console.error('Error rescanning:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCloseProcessing = () => {
    setProcessingToken(null);
    setProcessingResult(null);
  };

  // Reset page when network or search changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [selectedNetwork, searchQuery]);

  // Update selected network when dialog opens or defaultNetwork changes
  React.useEffect(() => {
    if (isOpen && defaultNetwork && SUPPORTED_NETWORKS.some(net => net.id === defaultNetwork)) {
      setSelectedNetwork(defaultNetwork);
    }
  }, [isOpen, defaultNetwork]);

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
      size="xl"
    >
      <DialogContent
        maxWidth="800px"
        bg="rgba(17, 17, 17, 0.98)"
        borderColor="#23DCC8"
        borderWidth="2px"
      >
        <DialogHeader borderBottom="1px solid rgba(255, 255, 255, 0.1)" pb={3}>
          <DialogTitle color="white" fontSize="lg">
            Custom Token Manager
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb={6} pt={6} px={6}>
          {/* Processing View - Show when adding a token */}
          {processingToken ? (
            <VStack align="stretch" gap={6}>
              {/* Token Detail Card */}
              <Box
                bg="rgba(30, 30, 30, 0.6)"
                borderRadius="xl"
                borderWidth="2px"
                borderColor={processingResult?.type === 'success' ? '#23DCC8' : 'rgba(255, 255, 255, 0.1)'}
                p={6}
              >
                <HStack gap={4} mb={4}>
                  <Image
                    src={processingToken.icon || 'https://pioneers.dev/coins/coin.png'}
                    alt={processingToken.name}
                    boxSize="64px"
                    borderRadius="full"
                    fallbackSrc="https://pioneers.dev/coins/coin.png"
                  />
                  <VStack align="start" gap={1} flex={1}>
                    <HStack>
                      <Text fontSize="2xl" fontWeight="bold" color="white">
                        {processingToken.symbol}
                      </Text>
                      {isScanning && <Spinner size="sm" color="#23DCC8" />}
                    </HStack>
                    <Text fontSize="md" color="gray.400">
                      {processingToken.name}
                    </Text>
                  </VStack>
                </HStack>

                {/* Token Details */}
                <VStack align="stretch" gap={3} mt={4}>
                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>CAIP</Text>
                    <Text
                      fontSize="sm"
                      color="gray.300"
                      fontFamily="monospace"
                      bg="rgba(0, 0, 0, 0.3)"
                      p={2}
                      borderRadius="md"
                    >
                      {processingToken.caip}
                    </Text>
                  </Box>

                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>Contract Address</Text>
                    <Text
                      fontSize="sm"
                      color="gray.300"
                      fontFamily="monospace"
                      bg="rgba(0, 0, 0, 0.3)"
                      p={2}
                      borderRadius="md"
                    >
                      {processingToken.address}
                    </Text>
                  </Box>

                  <HStack>
                    <Box flex={1}>
                      <Text fontSize="xs" color="gray.500" mb={1}>Network</Text>
                      <Text fontSize="sm" color="gray.300">
                        {SUPPORTED_NETWORKS.find(n => n.id === processingToken.networkId)?.name || processingToken.networkId}
                      </Text>
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="xs" color="gray.500" mb={1}>Decimals</Text>
                      <Text fontSize="sm" color="gray.300">
                        {processingToken.decimals}
                      </Text>
                    </Box>
                  </HStack>
                </VStack>
              </Box>

              {/* Status Message */}
              {processingResult && (
                <Box
                  borderRadius="lg"
                  bg={processingResult.type === 'success' ? 'rgba(35, 220, 200, 0.15)' : 'rgba(255, 170, 0, 0.15)'}
                  borderColor={processingResult.type === 'success' ? '#23DCC8' : '#ffaa00'}
                  borderWidth="2px"
                  p={4}
                >
                  <HStack gap={3} width="full">
                    {processingResult.type === 'success' ? (
                      <FaCheckCircle color="#23DCC8" size={20} />
                    ) : (
                      <FaExclamationTriangle color="#ffaa00" size={20} />
                    )}
                    <Text
                      color={processingResult.type === 'success' ? '#23DCC8' : '#ffaa00'}
                      fontSize="md"
                      fontWeight="500"
                    >
                      {processingResult.message}
                    </Text>
                  </HStack>
                </Box>
              )}

              {/* Action Buttons */}
              <HStack gap={3}>
                <Button
                  onClick={handleRescan}
                  isDisabled={isScanning}
                  flex={1}
                  bg="rgba(35, 220, 200, 0.1)"
                  color="#23DCC8"
                  borderWidth="1px"
                  borderColor="#23DCC8"
                  _hover={{ bg: 'rgba(35, 220, 200, 0.2)' }}
                  size="lg"
                >
                  {isScanning ? <Spinner size="sm" /> : '🔄 Rescan from Node'}
                </Button>
                <Button
                  onClick={handleCloseProcessing}
                  flex={1}
                  bg="rgba(255, 255, 255, 0.05)"
                  color="white"
                  borderWidth="1px"
                  borderColor="rgba(255, 255, 255, 0.1)"
                  _hover={{ bg: 'rgba(255, 255, 255, 0.1)' }}
                  size="lg"
                >
                  Done
                </Button>
              </HStack>
            </VStack>
          ) : (
            /* Token Selection View */
            <VStack align="stretch" gap={4}>
            {/* Network Selector */}
            <HStack>
              <Text color="gray.400" fontSize="sm" minW="80px">Network:</Text>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(30, 30, 30, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(35, 220, 200, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#23DCC8';
                  e.currentTarget.style.boxShadow = '0 0 0 1px #23DCC8';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {SUPPORTED_NETWORKS.map(network => (
                  <option key={network.id} value={network.id} style={{ background: '#1a1a1a', color: 'white' }}>
                    {network.name}
                  </option>
                ))}
              </select>
            </HStack>

            {/* Search Input */}
            <InputGroup
              startElement={<FaSearch color="gray" size={14} />}
            >
              <Input
                placeholder="Search by name, symbol, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                bg="rgba(30, 30, 30, 0.6)"
                borderColor="rgba(255, 255, 255, 0.1)"
                _hover={{ borderColor: 'rgba(35, 220, 200, 0.3)' }}
                _focus={{ borderColor: '#23DCC8', boxShadow: '0 0 0 1px #23DCC8' }}
                color="white"
                size="md"
              />
            </InputGroup>

            {/* Token Count */}
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">
                {filteredTokens.length.toLocaleString()} tokens available
              </Text>
              <Text fontSize="xs" color="#23DCC8">
                {customTokens.filter(t => t.networkId === selectedNetwork).length} custom tokens added
              </Text>
            </HStack>

            {/* Token Grid */}
            <Grid
              templateColumns="repeat(auto-fill, minmax(100px, 1fr))"
              gap={2}
              maxH="450px"
              overflowY="auto"
              pr={2}
              css={{
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(35, 220, 200, 0.3)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(35, 220, 200, 0.5)',
                },
              }}
            >
              {paginatedTokens.map((token) => {
                const isAdded = isTokenAdded(token);

                return (
                  <Box
                    key={token.caip}
                    onClick={() => handleToggleToken(token)}
                    cursor="pointer"
                    position="relative"
                    transition="all 0.2s"
                  >
                    {/* Square Tile */}
                    <Box
                      aspectRatio={1}
                      bg={isAdded ? 'rgba(35, 220, 200, 0.15)' : 'rgba(30, 30, 30, 0.6)'}
                      borderRadius="lg"
                      borderWidth="2px"
                      borderColor={isAdded ? '#23DCC8' : 'rgba(255, 255, 255, 0.1)'}
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      gap={1.5}
                      p={2}
                      _hover={{
                        bg: isAdded ? 'rgba(35, 220, 200, 0.2)' : 'rgba(35, 220, 200, 0.1)',
                        borderColor: '#23DCC8',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(35, 220, 200, 0.2)',
                      }}
                    >
                      {/* Token Icon */}
                      <Image
                        src={token.icon || 'https://pioneers.dev/coins/coin.png'}
                        alt={token.name}
                        boxSize="36px"
                        borderRadius="full"
                        fallbackSrc="https://pioneers.dev/coins/coin.png"
                      />

                      {/* Token Symbol */}
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        color={isAdded ? '#23DCC8' : 'white'}
                        textAlign="center"
                        noOfLines={1}
                        width="full"
                      >
                        {token.symbol}
                      </Text>

                      {/* Add/Remove Badge */}
                      <Box
                        position="absolute"
                        top={1}
                        right={1}
                        bg={isAdded ? 'rgba(35, 220, 200, 0.9)' : 'rgba(100, 100, 100, 0.9)'}
                        borderRadius="full"
                        p={1}
                      >
                        {isAdded ? (
                          <FaCheck size={10} color="black" />
                        ) : (
                          <FaPlus size={10} color="white" />
                        )}
                      </Box>
                    </Box>

                    {/* Token Name (below tile) */}
                    <Text
                      fontSize="9px"
                      color="gray.500"
                      textAlign="center"
                      mt={1}
                      noOfLines={1}
                      width="full"
                    >
                      {token.name}
                    </Text>
                  </Box>
                );
              })}
            </Grid>

            {/* No results message */}
            {filteredTokens.length === 0 && (
              <Box py={8} textAlign="center">
                <Text color="gray.500" fontSize="sm">
                  {searchQuery ? `No tokens found matching "${searchQuery}"` : 'No tokens available for this network'}
                </Text>
              </Box>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <HStack justify="center" gap={2}>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  isDisabled={currentPage === 0}
                  bg="rgba(30, 30, 30, 0.6)"
                  color="white"
                  _hover={{ bg: 'rgba(35, 220, 200, 0.1)', borderColor: '#23DCC8' }}
                  borderWidth="1px"
                  borderColor="rgba(255, 255, 255, 0.1)"
                >
                  Previous
                </Button>
                <Text fontSize="sm" color="gray.400">
                  Page {currentPage + 1} of {totalPages}
                </Text>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  isDisabled={currentPage === totalPages - 1}
                  bg="rgba(30, 30, 30, 0.6)"
                  color="white"
                  _hover={{ bg: 'rgba(35, 220, 200, 0.1)', borderColor: '#23DCC8' }}
                  borderWidth="1px"
                  borderColor="rgba(255, 255, 255, 0.1)"
                >
                  Next
                </Button>
              </HStack>
            )}
          </VStack>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
