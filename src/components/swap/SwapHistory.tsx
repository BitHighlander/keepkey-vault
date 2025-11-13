'use client'

import React, { useState } from 'react';
import {
  Box,
  Card,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  Button,
  Flex,
  IconButton,
  Code,
  Stack,
  Collapsible,
  Container,
} from '@chakra-ui/react';
import { FaExternalLinkAlt, FaChevronDown, FaChevronUp, FaSync, FaExclamationTriangle, FaCheckCircle, FaClock } from 'react-icons/fa';
import { usePendingSwaps, PendingSwap } from '@/hooks/usePendingSwaps';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getAssetIconUrl } from '@/lib/utils/assetIcons';

interface SwapHistoryProps {
  onBackClick?: () => void;
}

const StatusBadge = ({ status }: { status: PendingSwap['status'] }) => {
  const statusConfig = {
    pending: { color: 'yellow', icon: FaClock, label: 'Pending' },
    confirming: { color: 'blue', icon: FaClock, label: 'Confirming' },
    completed: { color: 'green', icon: FaCheckCircle, label: 'Completed' },
    failed: { color: 'red', icon: FaExclamationTriangle, label: 'Failed' },
    refunded: { color: 'orange', icon: FaExclamationTriangle, label: 'Refunded' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      colorScheme={config.color}
      display="flex"
      alignItems="center"
      gap={1}
      px={2}
      py={1}
      borderRadius="md"
    >
      <Icon size={12} />
      {config.label}
    </Badge>
  );
};

const SwapHistoryItem = ({ swap }: { swap: PendingSwap }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash) return 'N/A';
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const getExplorerUrl = (txHash: string, integration: string) => {
    // Default to THORChain explorer
    if (integration?.toLowerCase().includes('thorchain') || integration?.toLowerCase().includes('thor')) {
      return `https://viewblock.io/thorchain/tx/${txHash}`;
    }
    // Can be extended for other integrations
    return `https://viewblock.io/thorchain/tx/${txHash}`;
  };

  return (
    <Card.Root
      bg="gray.900"
      borderColor="gray.700"
      borderWidth="1px"
      mb={3}
      _hover={{ borderColor: 'gray.600' }}
      transition="all 0.2s"
    >
      <Card.Body p={4}>
        {/* Header - Always visible */}
        <Flex justify="space-between" align="center" mb={3}>
          <HStack>
            <HStack spacing={2}>
              {/* From Asset */}
              <Box position="relative" width="32px" height="32px">
                <AssetIcon
                  assetCaip={swap.sellAsset.caip}
                  src={getAssetIconUrl(swap.sellAsset.caip)}
                  size="32px"
                />
              </Box>
              <Text fontWeight="medium" color="white">
                {swap.sellAsset.symbol}
              </Text>
            </HStack>

            <Text color="gray.500" px={2}>→</Text>

            <HStack spacing={2}>
              {/* To Asset */}
              <Box position="relative" width="32px" height="32px">
                <AssetIcon
                  assetCaip={swap.buyAsset.caip}
                  src={getAssetIconUrl(swap.buyAsset.caip)}
                  size="32px"
                />
              </Box>
              <Text fontWeight="medium" color="white">
                {swap.buyAsset.symbol}
              </Text>
            </HStack>
          </HStack>

          <HStack>
            <StatusBadge status={swap.status} />
            <IconButton
              aria-label="Expand details"
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </IconButton>
          </HStack>
        </Flex>

        {/* Summary - Always visible */}
        <VStack align="start" spacing={1} mb={2}>
          <HStack justify="space-between" width="100%">
            <Text fontSize="sm" color="gray.400">Selling:</Text>
            <Text fontSize="sm" color="white" fontWeight="medium">
              {swap.sellAsset.amount} {swap.sellAsset.symbol}
            </Text>
          </HStack>
          <HStack justify="space-between" width="100%">
            <Text fontSize="sm" color="gray.400">Receiving:</Text>
            <Text fontSize="sm" color="white" fontWeight="medium">
              {swap.buyAsset.amount} {swap.buyAsset.symbol}
            </Text>
          </HStack>
        </VStack>

        {/* Expanded Details */}
        <Collapsible.Root open={isExpanded}>
          <Collapsible.Content>
            <Box
              mt={4}
              pt={4}
              borderTopWidth="1px"
              borderColor="gray.700"
            >
              <VStack align="start" spacing={3}>
              {/* Transaction Hash */}
              <Box width="100%">
                <Text fontSize="sm" color="gray.400" mb={1}>
                  Transaction Hash:
                </Text>
                <HStack>
                  <Code
                    fontSize="xs"
                    bg="gray.800"
                    color="cyan.400"
                    p={2}
                    borderRadius="md"
                    flex={1}
                    wordBreak="break-all"
                  >
                    {swap.txHash}
                  </Code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(getExplorerUrl(swap.txHash, swap.integration), '_blank')}
                  >
                    <FaExternalLinkAlt />
                  </Button>
                </HStack>
              </Box>

              {/* Integration */}
              <HStack justify="space-between" width="100%">
                <Text fontSize="sm" color="gray.400">Integration:</Text>
                <Badge colorScheme="purple">{swap.integration}</Badge>
              </HStack>

              {/* Confirmations */}
              {swap.status === 'confirming' && (
                <HStack justify="space-between" width="100%">
                  <Text fontSize="sm" color="gray.400">Confirmations:</Text>
                  <Text fontSize="sm" color="blue.400" fontWeight="medium">
                    {swap.confirmations}
                  </Text>
                </HStack>
              )}

              {/* THORChain Outbound TX */}
              {swap.thorchainData?.outboundTxHash && (
                <Box width="100%">
                  <Text fontSize="sm" color="gray.400" mb={1}>
                    Outbound Transaction:
                  </Text>
                  <HStack>
                    <Code
                      fontSize="xs"
                      bg="gray.800"
                      color="green.400"
                      p={2}
                      borderRadius="md"
                      flex={1}
                      wordBreak="break-all"
                    >
                      {swap.thorchainData.outboundTxHash}
                    </Code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(
                        getExplorerUrl(swap.thorchainData.outboundTxHash!, swap.integration),
                        '_blank'
                      )}
                    >
                      <FaExternalLinkAlt />
                    </Button>
                  </HStack>
                </Box>
              )}

              {/* Timestamp */}
              <HStack justify="space-between" width="100%">
                <Text fontSize="sm" color="gray.400">Created:</Text>
                <Text fontSize="sm" color="gray.300">
                  {formatDate(swap.createdAt)}
                </Text>
              </HStack>

              {/* Audit Information */}
              <Box
                width="100%"
                bg="gray.800"
                p={3}
                borderRadius="md"
                borderWidth="1px"
                borderColor="gray.700"
              >
                <Text fontSize="xs" color="gray.500" fontWeight="semibold" mb={2}>
                  AUDIT TRAIL
                </Text>
                <VStack align="start" spacing={1} fontSize="xs">
                  <HStack justify="space-between" width="100%">
                    <Text color="gray.400">Sell Asset CAIP:</Text>
                    <Code fontSize="xs" bg="gray.900">{swap.sellAsset.caip}</Code>
                  </HStack>
                  <HStack justify="space-between" width="100%">
                    <Text color="gray.400">Buy Asset CAIP:</Text>
                    <Code fontSize="xs" bg="gray.900">{swap.buyAsset.caip}</Code>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </Box>
          </Collapsible.Content>
        </Collapsible.Root>
      </Card.Body>
    </Card.Root>
  );
};

export const SwapHistory = ({ onBackClick }: SwapHistoryProps) => {
  const {
    pendingSwaps,
    isLoading,
    error,
    refreshPendingSwaps,
  } = usePendingSwaps();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPendingSwaps();
    setIsRefreshing(false);
  };

  // Group swaps by status
  const groupedSwaps = {
    active: pendingSwaps.filter(s => s.status === 'pending' || s.status === 'confirming'),
    completed: pendingSwaps.filter(s => s.status === 'completed'),
    failed: pendingSwaps.filter(s => s.status === 'failed' || s.status === 'refunded'),
  };

  return (
    <Box 
      minH="100vh" 
      bg="black" 
      color="white"
      px={4}
      py={8}
    >
      <Container maxW="container.lg">
        {/* Header */}
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Text fontSize="2xl" fontWeight="bold" color="white" mb={1}>
              Swap History
            </Text>
            <Text fontSize="sm" color="gray.400">
              Track and audit your swaps
            </Text>
          </Box>
          <Button
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing"
            leftIcon={<FaSync />}
            bg="#23DCC8"
            color="black"
            _hover={{ bg: '#1FC4B3' }}
          >
            Refresh
          </Button>
        </Flex>

        {/* Loading State */}
        {isLoading && !pendingSwaps.length && (
          <Flex justify="center" align="center" minH="200px">
            <VStack>
              <Spinner size="xl" color="blue.500" />
              <Text color="gray.400">Loading swap history...</Text>
            </VStack>
          </Flex>
        )}

        {/* Error State */}
        {error && (
          <Card.Root bg="red.900" borderColor="red.700" mb={4}>
            <Card.Body>
              <HStack>
                <FaExclamationTriangle color="red.300" />
                <Text color="red.200">{error}</Text>
              </HStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* Empty State */}
        {!isLoading && !error && pendingSwaps.length === 0 && (
          <Card.Root bg="gray.900" borderColor="gray.700">
            <Card.Body p={8}>
              <VStack spacing={3}>
                <Text fontSize="lg" color="gray.400">
                  No swap history found
                </Text>
                <Text fontSize="sm" color="gray.500">
                  Your swap transactions will appear here
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* Active Swaps */}
        {groupedSwaps.active.length > 0 && (
          <Box mb={6}>
            <Text fontSize="lg" fontWeight="semibold" mb={3} color="blue.400">
              Active Swaps ({groupedSwaps.active.length})
            </Text>
            {groupedSwaps.active.map((swap) => (
              <SwapHistoryItem key={swap.txHash} swap={swap} />
            ))}
          </Box>
        )}

        {/* Completed Swaps */}
        {groupedSwaps.completed.length > 0 && (
          <Box mb={6}>
            <Text fontSize="lg" fontWeight="semibold" mb={3} color="green.400">
              Completed Swaps ({groupedSwaps.completed.length})
            </Text>
            {groupedSwaps.completed.map((swap) => (
              <SwapHistoryItem key={swap.txHash} swap={swap} />
            ))}
          </Box>
        )}

        {/* Failed Swaps */}
        {groupedSwaps.failed.length > 0 && (
          <Box mb={6}>
            <Text fontSize="lg" fontWeight="semibold" mb={3} color="red.400">
              Failed/Refunded Swaps ({groupedSwaps.failed.length})
            </Text>
            {groupedSwaps.failed.map((swap) => (
              <SwapHistoryItem key={swap.txHash} swap={swap} />
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
};

