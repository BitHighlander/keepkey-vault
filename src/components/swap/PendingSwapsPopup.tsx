'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Button,
  Badge,
  Spinner,
  Link,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { keyframes } from '@emotion/react';
import { usePendingSwaps, PendingSwap } from '@/hooks/usePendingSwaps';
import { AssetIcon } from '@/components/ui/AssetIcon';

// Theme colors - Purple theme for swaps
const theme = {
  bg: '#000000',           // Black background
  cardBg: '#111111',       // Dark card background
  purple: '#9333EA',       // Purple-600 (primary)
  purpleHover: '#A855F7', // Purple-500 (hover)
  purpleBright: '#C084FC', // Purple-400 (accents)
  border: '#222222',       // Dark border
};

// Pulse animation - only when new swaps detected
const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(147, 51, 234, 0);
  }
`;

// Utility Functions

// Format elapsed time (e.g., "5 min ago", "2 hours ago")
const getElapsedTime = (timestamp: string): string => {
  const now = Date.now();
  const created = new Date(timestamp).getTime();
  const elapsed = now - created;

  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(elapsed / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

// Format amount with precision
const formatAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Format timestamp
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

// Truncate hash
const truncateHash = (hash: string): string => {
  if (hash.length <= 16) return hash;
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
};

// Get explorer link (basic implementation, can be enhanced with assetsMap)
const getExplorerLink = (txHash: string, caip: string): string => {
  // Extract chain from CAIP
  const [namespace, reference] = caip.split(':');

  // Basic explorer mapping
  if (namespace === 'eip155') {
    // Ethereum and EVM chains
    if (reference === '1') return `https://etherscan.io/tx/${txHash}`;
    if (reference === '8453') return `https://basescan.org/tx/${txHash}`;
    if (reference === '56') return `https://bscscan.com/tx/${txHash}`;
    return `https://etherscan.io/tx/${txHash}`; // Fallback to Etherscan
  }

  if (namespace === 'bip122') {
    // Bitcoin
    return `https://mempool.space/tx/${txHash}`;
  }

  // Fallback to ViewBlock
  return `https://viewblock.io/tx/${txHash}`;
};

// Enhanced Status Badge Component with Event System States
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; label: string; emoji: string }> = {
    pending: { color: 'yellow', label: 'Pending', emoji: '⏳' },
    confirming: { color: 'blue', label: 'Confirming', emoji: '⏳' },
    output_detected: { color: 'cyan', label: 'Output Detected', emoji: '🎯' },
    output_confirming: { color: 'blue', label: 'Confirming Output', emoji: '⏳' },
    output_confirmed: { color: 'green', label: 'Confirmed', emoji: '✅' },
    completed: { color: 'green', label: 'Completed', emoji: '✅' },
    failed: { color: 'red', label: 'Failed', emoji: '❌' },
    refunded: { color: 'orange', label: 'Refunded', emoji: '🔄' },
  };

  const { color, label, emoji } = config[status] || config.pending;

  return (
    <Badge colorScheme={color} fontSize="xs">
      {emoji} {label}
    </Badge>
  );
};

// Enhanced Swap Details Modal Component with Event System Integration
const SwapDetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  swap: PendingSwap | null;
}> = ({ isOpen, onClose, swap }) => {
  if (!swap) return null;

  // Enhanced status badge configuration
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; label: string; emoji: string }> = {
      pending: { color: 'yellow', label: 'Pending', emoji: '⏳' },
      confirming: { color: 'blue', label: 'Confirming Input', emoji: '⏳' },
      output_detected: { color: 'cyan', label: 'Output Detected', emoji: '🎯' },
      output_confirming: { color: 'blue', label: 'Confirming Output', emoji: '⏳' },
      output_confirmed: { color: 'green', label: 'Output Confirmed', emoji: '✅' },
      completed: { color: 'green', label: 'Completed', emoji: '✅' },
      failed: { color: 'red', label: 'Failed', emoji: '❌' },
      refunded: { color: 'orange', label: 'Refunded', emoji: '🔄' },
    };
    return configs[status] || configs.pending;
  };

  const statusConfig = getStatusConfig(swap.status);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl" placement="center">
      <DialogContent
        bg={theme.cardBg}
        borderColor={theme.purple}
        borderWidth="2px"
        maxW="800px"
        my="auto"
      >
        <DialogHeader
          borderBottom="2px solid"
          borderColor={theme.border}
          pb={5}
          pt={6}
          px={6}
          bg={`linear-gradient(135deg, ${theme.purple}11 0%, ${theme.cardBg} 100%)`}
        >
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" align="center">
              <Text fontSize="2xl" fontWeight="bold" color="white">
                Swap Transaction
              </Text>
              <DialogCloseTrigger />
            </HStack>
            <HStack>
              <Box
                px={4}
                py={2}
                bg={`${statusConfig.color === 'yellow' ? 'yellow.900' :
                      statusConfig.color === 'blue' ? 'blue.900' :
                      statusConfig.color === 'cyan' ? 'cyan.900' :
                      statusConfig.color === 'green' ? 'green.900' :
                      statusConfig.color === 'red' ? 'red.900' :
                      statusConfig.color === 'orange' ? 'orange.900' :
                      'gray.900'}`}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={`${statusConfig.color === 'yellow' ? 'yellow.500' :
                              statusConfig.color === 'blue' ? 'blue.500' :
                              statusConfig.color === 'cyan' ? 'cyan.500' :
                              statusConfig.color === 'green' ? 'green.500' :
                              statusConfig.color === 'red' ? 'red.500' :
                              statusConfig.color === 'orange' ? 'orange.500' :
                              'gray.500'}`}
              >
                <HStack spacing={2}>
                  <Text fontSize="lg">{statusConfig.emoji}</Text>
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color={`${statusConfig.color === 'yellow' ? 'yellow.300' :
                            statusConfig.color === 'blue' ? 'blue.300' :
                            statusConfig.color === 'cyan' ? 'cyan.300' :
                            statusConfig.color === 'green' ? 'green.300' :
                            statusConfig.color === 'red' ? 'red.300' :
                            statusConfig.color === 'orange' ? 'orange.300' :
                            'gray.300'}`}
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    {statusConfig.label}
                  </Text>
                </HStack>
              </Box>
            </HStack>
          </VStack>
        </DialogHeader>

        <DialogBody py={6} px={6}>
          <VStack spacing={6} align="stretch">
            {/* Asset Pair with Amounts */}
            <Box
              bg={`${theme.purple}08`}
              borderRadius="lg"
              borderWidth="2px"
              borderColor={`${theme.purple}44`}
              p={5}
            >
              <Text fontSize="sm" color="gray.400" mb={4} fontWeight="medium">Asset Pair</Text>
              <HStack spacing={4} justify="space-between">
                <HStack spacing={3} flex={1}>
                  <AssetIcon
                    src={swap.sellAsset.icon}
                    caip={swap.sellAsset.caip}
                    symbol={swap.sellAsset.symbol}
                    alt={swap.sellAsset.name || swap.sellAsset.symbol}
                    boxSize="48px"
                  />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold" fontSize="md" color="white">{swap.sellAsset.symbol}</Text>
                    <Text color={theme.purple} fontSize="lg" fontWeight="semibold">{formatAmount(swap.sellAsset.amount)}</Text>
                  </VStack>
                </HStack>

                <Text color={theme.purple} fontSize="3xl" fontWeight="bold">→</Text>

                <HStack spacing={3} flex={1}>
                  <AssetIcon
                    src={swap.buyAsset.icon}
                    caip={swap.buyAsset.caip}
                    symbol={swap.buyAsset.symbol}
                    alt={swap.buyAsset.name || swap.buyAsset.symbol}
                    boxSize="48px"
                  />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold" fontSize="md" color="white">{swap.buyAsset.symbol}</Text>
                    <Text color={theme.purpleBright} fontSize="lg" fontWeight="semibold">{formatAmount(swap.buyAsset.amount)}</Text>
                  </VStack>
                </HStack>
              </HStack>
            </Box>

            {/* Integration Info */}
            <Box
              bg={`${theme.purple}05`}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={theme.border}
              p={4}
            >
              <Text fontSize="sm" color="gray.400" mb={2} fontWeight="medium">Integration Protocol</Text>
              <Text fontSize="md" fontWeight="semibold" color="white">
                {swap.integration === 'thorchain' ? 'THORChain' :
                 swap.integration === 'mayachain' ? 'Maya Protocol' :
                 swap.integration}
              </Text>
            </Box>

            {/* Input Transaction Confirmations */}
            {swap.confirmations !== undefined && (
              <Box
                bg={`${theme.purple}05`}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
                p={4}
              >
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="medium">Input Transaction Confirmations</Text>
                <Text fontSize="lg" fontWeight="bold" color={theme.purple}>{swap.confirmations} confirmations</Text>
              </Box>
            )}

            {/* Output Transaction Confirmations Progress */}
            {swap.outboundConfirmations !== undefined && (
              <Box
                bg={`${theme.purple}05`}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
                p={4}
              >
                <Text fontSize="sm" color="gray.400" mb={2}>Output Transaction Confirmations</Text>
                <HStack mb={2}>
                  <Text color={theme.purple} fontSize="2xl" fontWeight="bold">
                    {swap.outboundConfirmations}
                  </Text>
                  {swap.outboundRequiredConfirmations && (
                    <Text color="gray.400" fontSize="lg">
                      / {swap.outboundRequiredConfirmations} required
                    </Text>
                  )}
                </HStack>
                {swap.outboundRequiredConfirmations && (
                  <Box
                    h="8px"
                    bg="gray.700"
                    borderRadius="full"
                    overflow="hidden"
                  >
                    <Box
                      h="100%"
                      bg={theme.purple}
                      w={`${Math.min(100, (swap.outboundConfirmations / swap.outboundRequiredConfirmations) * 100)}%`}
                      transition="width 0.3s"
                    />
                  </Box>
                )}
              </Box>
            )}

            {/* Timing Information */}
            <Box
              bg={`${theme.purple}05`}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={theme.border}
              p={4}
            >
              <Text fontSize="sm" color="gray.400" mb={3} fontWeight="medium">Timeline</Text>
              <VStack align="start" spacing={2}>
                <HStack>
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">Created:</Text>
                  <Text fontSize="sm" color="white">{formatTimestamp(swap.createdAt)}</Text>
                  <Badge colorScheme="gray" fontSize="xs">{getElapsedTime(swap.createdAt)}</Badge>
                </HStack>
                {swap.outputDetectedAt && (
                  <HStack>
                    <Text fontSize="sm" color="gray.500" fontWeight="medium">🎯 Output Detected:</Text>
                    <Text fontSize="sm" color="white">{formatTimestamp(swap.outputDetectedAt)}</Text>
                  </HStack>
                )}
              </VStack>
            </Box>

            {/* Inbound Transaction Hash */}
            <Box
              bg={`${theme.purple}05`}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={theme.border}
              p={4}
            >
              <Text fontSize="sm" color="gray.400" mb={2} fontWeight="medium">Inbound Transaction</Text>
              <Link
                href={getExplorerLink(swap.txHash, swap.sellAsset.caip)}
                target="_blank"
                rel="noopener noreferrer"
                color={theme.purple}
                fontSize="xs"
                fontFamily="mono"
                _hover={{ color: theme.purpleHover, textDecoration: 'underline' }}
                display="block"
                wordBreak="break-all"
              >
                {swap.txHash}
              </Link>
            </Box>

            {/* Outbound Transaction Hash */}
            {swap.thorchainData?.outboundTxHash && (
              <Box
                bg={`${theme.purple}05`}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
                p={4}
              >
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="medium">Outbound Transaction</Text>
                <Link
                  href={
                    swap.integration === 'thorchain'
                      ? `https://viewblock.io/thorchain/tx/${swap.thorchainData.outboundTxHash}`
                      : swap.integration === 'mayachain'
                      ? `https://www.mayascan.org/tx/${swap.thorchainData.outboundTxHash}`
                      : getExplorerLink(swap.thorchainData.outboundTxHash, swap.buyAsset.caip)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  color={theme.purple}
                  fontSize="xs"
                  fontFamily="mono"
                  _hover={{ color: theme.purpleHover, textDecoration: 'underline' }}
                  display="block"
                  wordBreak="break-all"
                >
                  {swap.thorchainData.outboundTxHash}
                </Link>
              </Box>
            )}

            {/* THORChain/Maya Swap Status */}
            {swap.thorchainData?.swapStatus && (
              <Box
                bg={`${theme.purple}05`}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
                p={4}
              >
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="medium">Protocol Status</Text>
                <Text fontSize="md" color="white" fontWeight="medium">{swap.thorchainData.swapStatus}</Text>
              </Box>
            )}

            {/* Error Information */}
            {swap.error && (
              <Box
                bg="red.900"
                borderWidth="2px"
                borderColor="red.500"
                p={4}
                borderRadius="lg"
              >
                <HStack mb={3}>
                  <Text fontSize="xl">⚠️</Text>
                  <Text color="red.300" fontSize="md" fontWeight="bold">
                    {swap.error.type || 'Error'}
                  </Text>
                  {swap.error.severity && (
                    <Badge
                      colorScheme={swap.error.severity === 'ERROR' ? 'red' : 'yellow'}
                      fontSize="xs"
                    >
                      {swap.error.severity}
                    </Badge>
                  )}
                </HStack>
                {swap.error.userMessage && (
                  <Text color="red.200" fontSize="sm" mb={3}>
                    {swap.error.userMessage}
                  </Text>
                )}
                {swap.error.actionable && (
                  <Box
                    bg="orange.900"
                    borderWidth="1px"
                    borderColor="orange.500"
                    p={3}
                    borderRadius="md"
                    mb={2}
                  >
                    <Text color="orange.300" fontSize="sm">
                      <Text as="span" fontWeight="bold">💡 Action Required:</Text>
                      <br />
                      {swap.error.actionable}
                    </Text>
                  </Box>
                )}
                {swap.error.message && (
                  <Text color="gray.500" fontSize="xs" fontFamily="mono" mt={2}>
                    Technical Details: {swap.error.message}
                  </Text>
                )}
              </Box>
            )}

            {/* Swap Memo */}
            {swap.quote?.memo && (
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2} fontWeight="medium">Swap Memo</Text>
                <Box
                  bg={`${theme.purple}11`}
                  p={4}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={`${theme.purple}33`}
                >
                  <Text fontSize="xs" fontFamily="mono" color={theme.purple} wordBreak="break-all">
                    {swap.quote.memo}
                  </Text>
                </Box>
              </Box>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter borderTop="2px solid" borderColor={theme.border} pt={4} px={6}>
          <Button
            variant="ghost"
            onClick={onClose}
            _hover={{ bg: `${theme.purple}22`, color: theme.purple }}
            size="md"
            px={6}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

// Enhanced Compact Swap Card Component with Confirmation Progress
const SwapCardCompact: React.FC<{ swap: PendingSwap; onClick: () => void }> = ({ swap, onClick }) => {
  // Determine if showing output confirmation progress
  const showOutputProgress = swap.outboundConfirmations !== undefined &&
                             swap.outboundRequiredConfirmations !== undefined;

  return (
    <Box
      bg="gray.900"
      borderColor="gray.700"
      borderWidth="1px"
      borderRadius="lg"
      p={3}
      cursor="pointer"
      onClick={onClick}
      _hover={{ borderColor: theme.purple, transform: 'translateY(-2px)' }}
      transition="all 0.2s"
    >
      {/* Asset Pair Header */}
      <HStack justify="space-between" mb={2}>
        <HStack spacing={2}>
          <AssetIcon
            src={swap.sellAsset.icon}
            caip={swap.sellAsset.caip}
            symbol={swap.sellAsset.symbol}
            alt={swap.sellAsset.name || swap.sellAsset.symbol}
            boxSize="28px"
          />
          <Text fontSize="sm" fontWeight="medium">{swap.sellAsset.symbol}</Text>
          <Text color="gray.500" fontSize="sm">→</Text>
          <AssetIcon
            src={swap.buyAsset.icon}
            caip={swap.buyAsset.caip}
            symbol={swap.buyAsset.symbol}
            alt={swap.buyAsset.name || swap.buyAsset.symbol}
            boxSize="28px"
          />
          <Text fontSize="sm" fontWeight="medium">{swap.buyAsset.symbol}</Text>
        </HStack>
        <StatusBadge status={swap.status} />
      </HStack>

      {/* Amounts and Time */}
      <VStack align="start" spacing={1} fontSize="xs" color="gray.400">
        <Text>
          {formatAmount(swap.sellAsset.amount)} {swap.sellAsset.symbol} →{' '}
          {formatAmount(swap.buyAsset.amount)} {swap.buyAsset.symbol}
        </Text>
        <Text color="gray.500">
          {getElapsedTime(swap.createdAt)} • {swap.integration}
        </Text>
      </VStack>

      {/* Confirmation Progress */}
      {showOutputProgress ? (
        <Box mt={2}>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs" color="gray.400">
              Output Confirmations
            </Text>
            <Text fontSize="xs" color={theme.purple} fontWeight="bold">
              {swap.outboundConfirmations} / {swap.outboundRequiredConfirmations}
            </Text>
          </HStack>
          <Box
            h="4px"
            bg="gray.800"
            borderRadius="full"
            overflow="hidden"
          >
            <Box
              h="100%"
              bg={theme.purple}
              w={`${Math.min(100, (swap.outboundConfirmations / swap.outboundRequiredConfirmations) * 100)}%`}
              transition="width 0.3s"
            />
          </Box>
        </Box>
      ) : swap.status === 'confirming' && swap.confirmations !== undefined ? (
        <Text fontSize="xs" color={theme.purple} mt={1}>
          ⏳ {swap.confirmations} confirmations
        </Text>
      ) : null}

      {/* Output Detected Indicator */}
      {swap.status === 'output_detected' && !showOutputProgress && (
        <Text fontSize="xs" color={theme.purpleBright} mt={1}>
          🎯 Output transaction detected!
        </Text>
      )}
    </Box>
  );
};

// Main Component
interface PendingSwapsPopupProps {
  app: any; // Pioneer SDK app instance
}

export const PendingSwapsPopup: React.FC<PendingSwapsPopupProps> = ({ app }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewSwaps, setHasNewSwaps] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<PendingSwap | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { pendingSwaps, isLoading, refreshPendingSwaps } = usePendingSwaps();

  // Filter active swaps only
  const activeSwaps = pendingSwaps.filter(
    s => s.status === 'pending' || s.status === 'confirming'
  );

  // Auto-refresh logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOpen) {
        refreshPendingSwaps(); // Every 30 seconds when open
      } else if (activeSwaps.length > 0) {
        refreshPendingSwaps(); // Every 60 seconds when closed
      }
    }, isOpen ? 30000 : 60000);

    return () => clearInterval(interval);
  }, [isOpen, activeSwaps.length, refreshPendingSwaps]);

  // New swap detection
  useEffect(() => {
    const lastCount = parseInt(localStorage.getItem('lastViewedSwapsCount') || '0');
    if (activeSwaps.length > lastCount && !isOpen) {
      setHasNewSwaps(true);
    }
  }, [activeSwaps.length, isOpen]);

  // Clear new swap badge when opened
  const handleOpen = () => {
    setIsOpen(true);
    setHasNewSwaps(false);
    localStorage.setItem('lastViewedSwapsCount', activeSwaps.length.toString());
    localStorage.setItem('lastViewedSwapsTimestamp', Date.now().toString());
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPendingSwaps();
    setIsRefreshing(false);
  };

  // Handle swap card click - open details modal
  const handleSwapClick = (swap: PendingSwap) => {
    setSelectedSwap(swap);
    setIsDetailsModalOpen(true);
  };

  // Don't render if no active swaps
  if (activeSwaps.length === 0) return null;

  return (
    <>
      {/* Floating Button - Bottom Left */}
      {!isOpen && (
        <Box position="fixed" bottom="24px" left="24px" zIndex={1000}>
          <Box position="relative">
            <Button
              onClick={handleOpen}
              bg={theme.purple}
              color="white"
              size="lg"
              borderRadius="full"
              boxSize="60px"
              p={0}
              _hover={{ bg: theme.purpleHover, transform: 'scale(1.05)' }}
              _active={{ transform: 'scale(0.95)' }}
              animation={hasNewSwaps ? `${pulseAnimation} 2s ease-in-out infinite` : undefined}
              boxShadow="0 4px 20px rgba(147, 51, 234, 0.4)"
              transition="all 0.2s"
            >
              <Spinner size="md" color="white" thickness="3px" />
            </Button>

            {/* Badge with count */}
            <Badge
              position="absolute"
              top="-8px"
              right="-8px"
              bg={theme.purpleBright}
              color="white"
              borderRadius="full"
              fontSize="xs"
              px={2}
              py={1}
              fontWeight="bold"
              boxShadow="0 2px 8px rgba(192, 132, 252, 0.6)"
            >
              {activeSwaps.length}
            </Badge>
          </Box>
        </Box>
      )}

      {/* Popup Dialog */}
      {isOpen && (
        <Box
          position="fixed"
          bottom="24px"
          left="24px"
          width="400px"
          height="500px"
          bg={theme.cardBg}
          borderRadius="2xl"
          border="1px solid"
          borderColor={theme.purple}
          boxShadow={`0 8px 32px ${theme.purple}40`}
          zIndex={1000}
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          {/* Header */}
          <Flex
            p={4}
            borderBottom="1px solid"
            borderColor={theme.border}
            justify="space-between"
            align="center"
            bg={theme.bg}
          >
            <HStack>
              <Text fontSize="lg" fontWeight="bold" color={theme.purple}>
                Pending Swaps
              </Text>
              <Badge colorScheme="purple">{activeSwaps.length}</Badge>
            </HStack>
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                isLoading={isRefreshing}
                _hover={{ color: theme.purple }}
              >
                🔄
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                _hover={{ color: theme.purple }}
              >
                ✕
              </Button>
            </HStack>
          </Flex>

          {/* Content - Active Swaps */}
          <VStack
            flex={1}
            overflowY="auto"
            p={4}
            gap={3}
            align="stretch"
            sx={{
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: theme.bg,
              },
              '&::-webkit-scrollbar-thumb': {
                background: theme.purple,
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: theme.purpleHover,
              },
            }}
          >
            {isLoading ? (
              <Flex justify="center" align="center" py={8}>
                <Spinner color={theme.purple} />
              </Flex>
            ) : activeSwaps.length > 0 ? (
              activeSwaps.map(swap => (
                <SwapCardCompact
                  key={swap.txHash}
                  swap={swap}
                  onClick={() => handleSwapClick(swap)}
                />
              ))
            ) : (
              <Flex direction="column" align="center" justify="center" py={8} gap={2}>
                <Text fontSize="2xl">✨</Text>
                <Text color="gray.400">No active swaps</Text>
              </Flex>
            )}
          </VStack>

          {/* Footer - Link to full history */}
          <Flex p={3} borderTop="1px solid" borderColor={theme.border} justify="center">
            <Button
              size="sm"
              variant="link"
              color={theme.purple}
              onClick={() => {
                // TODO: Navigate to full SwapHistory view
                // This would use router.push('/swap-history') or similar
                console.log('Navigate to full swap history');
              }}
              _hover={{ color: theme.purpleHover }}
            >
              View Full History →
            </Button>
          </Flex>
        </Box>
      )}

      {/* Swap Details Modal */}
      <SwapDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        swap={selectedSwap}
      />
    </>
  );
};
