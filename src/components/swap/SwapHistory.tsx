'use client'

import React, { useState, useMemo } from 'react';
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
  Input,
  InputGroup,
} from '@chakra-ui/react';
import { 
  FaExternalLinkAlt, 
  FaChevronDown, 
  FaChevronUp, 
  FaSync, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaClock,
  FaSearch,
  FaFilter,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import { usePendingSwaps, PendingSwap } from '@/hooks/usePendingSwaps';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getAssetIconUrl } from '@/lib/utils/assetIcons';

interface SwapHistoryProps {
  onBackClick?: () => void;
}

// Theme colors matching swap dialog
const theme = {
  bg: '#000000',           // Black background
  cardBg: '#111111',       // Dark card background
  teal: '#00dc82',         // THORChain teal (primary)
  tealHover: '#00f094',    // Lighter teal (hover)
  tealBright: '#33e9a6',   // Bright teal (accents)
  border: '#222222',       // Dark border
};

// Pagination constants
const ITEMS_PER_PAGE = 10;

const StatusBadge = ({ status }: { status: PendingSwap['status'] }) => {
  const statusConfig = {
    signing: { color: 'purple', icon: FaClock, label: 'Signing' },
    pending: { color: 'yellow', icon: FaClock, label: 'Pending' },
    confirming: { color: 'blue', icon: FaClock, label: 'Confirming' },
    completed: { color: 'green', icon: FaCheckCircle, label: 'Completed' },
    failed: { color: 'red', icon: FaExclamationTriangle, label: 'Failed' },
    refunded: { color: 'orange', icon: FaExclamationTriangle, label: 'Refunded' },
    output_detected: { color: 'teal', icon: FaClock, label: 'Output Detected' },
    output_confirming: { color: 'cyan', icon: FaClock, label: 'Output Confirming' },
    output_confirmed: { color: 'green', icon: FaCheckCircle, label: 'Output Confirmed' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      colorPalette={config.color}
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

  // Get display amount with fallback to quote data for pending swaps
  const getOutputAmount = (swap: PendingSwap): string => {
    let amount = swap.buyAsset.amount;

    // If amount is 0 or empty, try to get from quote (for pending swaps)
    if (!amount || amount === '0' || parseFloat(amount) === 0) {
      amount = (swap.quote as any)?.raw?.buyAmount ||
               (swap.quote as any)?.raw?.amountOut ||
               (swap.quote as any)?.expectedAmountOut ||
               '~';
    }

    return amount;
  };

  return (
    <Card.Root
      bg={theme.cardBg}
      borderColor={theme.border}
      borderWidth="1px"
      mb={3}
      _hover={{ 
        borderColor: theme.teal,
        transform: 'translateY(-1px)',
        boxShadow: `0 4px 12px rgba(0, 220, 130, 0.1)`
      }}
      transition="all 0.2s"
    >
      <Card.Body p={4}>
        {/* Header - Always visible */}
        <Flex justify="space-between" align="center" mb={3}>
          <HStack>
            <HStack gap={2}>
              {/* From Asset */}
              <Box position="relative" width="32px" height="32px">
                <AssetIcon
                  caip={swap.sellAsset.caip}
                  src={getAssetIconUrl(swap.sellAsset.caip)}
                  boxSize="32px"
                  alt={swap.sellAsset.symbol}
                />
              </Box>
              <Text fontWeight="medium" color="white">
                {swap.sellAsset.symbol}
              </Text>
            </HStack>

            <Text color="gray.500" px={2}>→</Text>

            <HStack gap={2}>
              {/* To Asset */}
              <Box position="relative" width="32px" height="32px">
                <AssetIcon
                  caip={swap.buyAsset.caip}
                  src={getAssetIconUrl(swap.buyAsset.caip)}
                  boxSize="32px"
                  alt={swap.buyAsset.symbol}
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
        <VStack align="start" gap={1} mb={2}>
          <HStack justify="space-between" width="100%">
            <Text fontSize="sm" color="gray.400">Selling:</Text>
            <Text fontSize="sm" color="white" fontWeight="medium">
              {swap.sellAsset.amount} {swap.sellAsset.symbol}
            </Text>
          </HStack>
          <HStack justify="space-between" width="100%">
            <Text fontSize="sm" color="gray.400">Receiving:</Text>
            <Text
              fontSize="sm"
              color={swap.status === 'completed' || swap.status === 'output_confirmed' ? 'green.400' : 'white'}
              fontWeight="medium"
            >
              {getOutputAmount(swap)} {swap.buyAsset.symbol}
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
              borderColor={theme.border}
            >
              <VStack align="start" gap={3}>
              {/* Transaction Hash */}
              <Box width="100%">
                <Text fontSize="sm" color="gray.400" mb={1}>
                  Transaction Hash:
                </Text>
                <HStack>
                  <Code
                    fontSize="xs"
                    bg={theme.cardBg}
                    color={theme.teal}
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
                <Badge colorPalette="teal">{swap.integration}</Badge>
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
                      bg={theme.cardBg}
                      color="green.400"
                      p={2}
                      borderRadius="md"
                      flex={1}
                      wordBreak="break-all"
                    >
                      {swap.thorchainData?.outboundTxHash}
                    </Code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(
                        getExplorerUrl(swap.thorchainData?.outboundTxHash!, swap.integration),
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
                bg={theme.cardBg}
                p={3}
                borderRadius="md"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text fontSize="xs" color="gray.500" fontWeight="semibold" mb={2}>
                  AUDIT TRAIL
                </Text>
                <VStack align="start" gap={1} fontSize="xs">
                  <HStack justify="space-between" width="100%">
                    <Text color="gray.400">Sell Asset CAIP:</Text>
                    <Code fontSize="xs" bg={theme.bg}>{swap.sellAsset.caip}</Code>
                  </HStack>
                  <HStack justify="space-between" width="100%">
                    <Text color="gray.400">Buy Asset CAIP:</Text>
                    <Code fontSize="xs" bg={theme.bg}>{swap.buyAsset.caip}</Code>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPendingSwaps();
    setIsRefreshing(false);
  };

  // Filter and search swaps
  const filteredSwaps = useMemo(() => {
    let filtered = [...pendingSwaps];

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(s => s.status === 'pending' || s.status === 'confirming' || s.status === 'signing');
      } else if (statusFilter === 'completed') {
        filtered = filtered.filter(s => s.status === 'completed' || s.status === 'output_confirmed');
      } else if (statusFilter === 'failed') {
        filtered = filtered.filter(s => s.status === 'failed' || s.status === 'refunded');
      } else {
        filtered = filtered.filter(s => s.status === statusFilter);
      }
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(swap => 
        swap.sellAsset.symbol.toLowerCase().includes(term) ||
        swap.buyAsset.symbol.toLowerCase().includes(term) ||
        swap.txHash.toLowerCase().includes(term) ||
        swap.integration.toLowerCase().includes(term)
      );
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [pendingSwaps, searchTerm, statusFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredSwaps.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSwaps = filteredSwaps.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Group swaps by status for the grouped display (when no search/filter)
  const groupedSwaps = useMemo(() => ({
    active: pendingSwaps.filter(s => s.status === 'pending' || s.status === 'confirming' || s.status === 'signing'),
    completed: pendingSwaps.filter(s => s.status === 'completed' || s.status === 'output_confirmed'),
    failed: pendingSwaps.filter(s => s.status === 'failed' || s.status === 'refunded'),
  }), [pendingSwaps]);

  const showGroupedView = !searchTerm && statusFilter === 'all';

  return (
    <Box 
      minH="100%"
      bg={theme.bg}
      color="white"
      position="relative"
      backgroundImage="url(/images/backgrounds/splash-bg.png)"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
    >
      {/* Overlay for better readability */}
      <Box
        position="absolute"
        inset={0}
        bg="rgba(0, 0, 0, 0.8)"
        zIndex={1}
      />
      
      <Box position="relative" zIndex={2} p={6} minH="100%">
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
            loading={isRefreshing}
            loadingText="Refreshing"
            bg={theme.teal}
            color="black"
            _hover={{ bg: theme.tealHover }}
          >
            Refresh
          </Button>
        </Flex>

        {/* Search and Filters */}
        <Box mb={6}>
          <Flex gap={4} align="center" flexWrap="wrap">
            {/* Search Input */}
            <InputGroup maxW="300px" flex={1}>
              <Input
                placeholder="Search swaps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg={theme.cardBg}
                borderColor={theme.border}
                _placeholder={{ color: 'gray.400' }}
                _focus={{ 
                  borderColor: theme.teal,
                  boxShadow: `0 0 0 1px ${theme.teal}`
                }}
              />
            </InputGroup>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                maxWidth: '200px',
                background: '#111111',
                border: '1px solid #222',
                borderRadius: '6px',
                padding: '8px',
                color: 'white'
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="confirming">Confirming</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Results Count */}
            <Text fontSize="sm" color="gray.400" ml="auto">
              {filteredSwaps.length} swap{filteredSwaps.length !== 1 ? 's' : ''} found
            </Text>
          </Flex>
        </Box>

        {/* Scrollable Content Area */}
        <Box
          flex={1}
          minH="400px"
          maxH="500px"
          overflowY="auto"
          pr={2}
          css={{
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: theme.border,
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.teal,
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.tealHover,
            },
          }}
        >
          {/* Loading State */}
          {isLoading && !pendingSwaps.length && (
            <Flex justify="center" align="center" minH="300px">
              <VStack>
                <Spinner size="xl" color={theme.teal} />
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
          {!isLoading && !error && filteredSwaps.length === 0 && (
            <Card.Root bg={theme.cardBg} borderColor={theme.border}>
              <Card.Body p={8}>
                <VStack gap={4}>
                  <Text fontSize="4xl">📊</Text>
                  <Text fontSize="lg" color="gray.400">
                    {pendingSwaps.length === 0 ? 'No swap history found' : 'No swaps match your search'}
                  </Text>
                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    {pendingSwaps.length === 0 
                      ? 'Your swap transactions will appear here'
                      : 'Try adjusting your search terms or filters'
                    }
                  </Text>
                  {searchTerm || statusFilter !== 'all' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      color={theme.teal}
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}

          {/* Swap History Content */}
          {!isLoading && !error && filteredSwaps.length > 0 && (
            <>
              {showGroupedView ? (
                /* Grouped View - When no filters applied */
                <VStack align="stretch" gap={6}>
                  {/* Active Swaps */}
                  {groupedSwaps.active.length > 0 && (
                    <Box>
                      <Text fontSize="lg" fontWeight="semibold" mb={3} color={theme.teal}>
                        Active Swaps ({groupedSwaps.active.length})
                      </Text>
                      <VStack align="stretch" gap={3}>
                        {groupedSwaps.active.map((swap) => (
                          <SwapHistoryItem key={swap.txHash} swap={swap} />
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {/* Completed Swaps */}
                  {groupedSwaps.completed.length > 0 && (
                    <Box>
                      <Text fontSize="lg" fontWeight="semibold" mb={3} color="green.400">
                        Completed Swaps ({groupedSwaps.completed.length})
                      </Text>
                      <VStack align="stretch" gap={3}>
                        {groupedSwaps.completed.map((swap) => (
                          <SwapHistoryItem key={swap.txHash} swap={swap} />
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {/* Failed Swaps */}
                  {groupedSwaps.failed.length > 0 && (
                    <Box>
                      <Text fontSize="lg" fontWeight="semibold" mb={3} color="red.400">
                        Failed/Refunded Swaps ({groupedSwaps.failed.length})
                      </Text>
                      <VStack align="stretch" gap={3}>
                        {groupedSwaps.failed.map((swap) => (
                          <SwapHistoryItem key={swap.txHash} swap={swap} />
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              ) : (
                /* List View - When filters/search applied */
                <VStack align="stretch" gap={3}>
                  {paginatedSwaps.map((swap) => (
                    <SwapHistoryItem key={swap.txHash} swap={swap} />
                  ))}
                </VStack>
              )}
            </>
          )}
        </Box>

        {/* Pagination */}
        {!showGroupedView && filteredSwaps.length > ITEMS_PER_PAGE && (
          <Flex justify="center" align="center" mt={6} gap={4}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              color={theme.teal}
              _disabled={{ opacity: 0.5 }}
            >
              <FaChevronLeft />
            </Button>
            
            <HStack gap={2}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    size="sm"
                    variant={currentPage === pageNum ? "solid" : "ghost"}
                    bg={currentPage === pageNum ? theme.teal : "transparent"}
                    color={currentPage === pageNum ? "black" : theme.teal}
                    onClick={() => setCurrentPage(pageNum)}
                    minW="40px"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </HStack>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              color={theme.teal}
              _disabled={{ opacity: 0.5 }}
            >
              <FaChevronRight />
            </Button>

            <Text fontSize="sm" color="gray.400" ml={4}>
              Page {currentPage} of {totalPages}
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

