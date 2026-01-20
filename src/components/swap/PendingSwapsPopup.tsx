'use client'

import React, { useState, useEffect, useRef } from 'react';
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
  Grid,
  Code,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { SwapHistory } from './SwapHistory';
import { keyframes } from '@emotion/react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import { usePendingSwaps, PendingSwap } from '@/hooks/usePendingSwaps';
import { AssetIcon } from '@/components/ui/AssetIcon';

// Theme colors - THORChain teal theme for swaps
const theme = {
  bg: '#000000',           // Black background
  cardBg: '#111111',       // Dark card background
  teal: '#00dc82',         // THORChain teal (primary)
  tealHover: '#00f094',    // Lighter teal (hover)
  tealBright: '#33e9a6',   // Bright teal (accents)
  border: '#222222',       // Dark border
};

// Pulse animation - only when new swaps detected
const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 220, 130, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(0, 220, 130, 0);
  }
`;

// Utility Functions

/**
 * Copy text to clipboard
 */
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

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
    signing: { color: 'purple', label: 'Signing...', emoji: '✍️' },
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
      _hover={{ borderColor: theme.teal, transform: 'translateY(-2px)' }}
      transition="all 0.2s"
    >
      {/* Asset Pair Header */}
      <HStack justify="space-between" mb={2}>
        <HStack gap={2}>
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
      <VStack align="start" gap={1} fontSize="xs" color="gray.400">
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
            <Text fontSize="xs" color={theme.teal} fontWeight="bold">
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
              bg={theme.teal}
              w={`${Math.min(100, ((swap.outboundConfirmations ?? 0) / (swap.outboundRequiredConfirmations ?? 1)) * 100)}%`}
              transition="width 0.3s"
            />
          </Box>
        </Box>
      ) : swap.status === 'confirming' && swap.confirmations !== undefined ? (
        <Text fontSize="xs" color={theme.teal} mt={1}>
          ⏳ {swap.confirmations} confirmations
        </Text>
      ) : null}

      {/* Output Detected Indicator */}
      {swap.status === 'output_detected' && !showOutputProgress && (
        <Text fontSize="xs" color={theme.tealBright} mt={1}>
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [signingSwaps, setSigningSwaps] = useState<PendingSwap[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completedSwaps, setCompletedSwaps] = useState<Map<string, number>>(new Map());
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);

  const { pendingSwaps, isLoading, refreshPendingSwaps } = usePendingSwaps();

  // Filter active swaps (including signing state and recent completed swaps)
  const now = Date.now();
  const activeSwaps = [
    ...signingSwaps,
    ...pendingSwaps.filter(s => {
      // Always show pending/confirming
      if (s.status === 'pending' || s.status === 'confirming') return true;

      // Show completed swaps for 60 seconds
      if (s.status === 'completed') {
        const completedAt = completedSwaps.get(s.txHash);
        if (completedAt && (now - completedAt) < 60000) return true;
      }

      return false;
    })
  ];

  // Check if there are any swaps actively in progress (not completed/failed)
  const hasActiveSwaps = activeSwaps.some(s =>
    s.status !== 'completed' &&
    s.status !== 'failed' &&
    s.status !== 'refunded'
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

  // Detect completed swaps (confetti disabled temporarily to prevent repeated triggers)
  useEffect(() => {
    pendingSwaps.forEach(swap => {
      if (swap.status === 'completed' && !completedSwaps.has(swap.txHash)) {
        console.log('🎉 Swap completed:', swap.txHash);

        // Record completion time
        setCompletedSwaps(prev => new Map(prev).set(swap.txHash, Date.now()));

        // Confetti disabled - was triggering on already completed swaps
        // setShowConfetti(true);
        // setTimeout(() => setShowConfetti(false), 5000);

        // Don't auto-open - only open when user clicks
        // setIsOpen(true);
        setHasNewSwaps(true);
      }
    });
  }, [pendingSwaps, completedSwaps]);

  // Auto-dismiss completed swaps after 60s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const updatedMap = new Map(completedSwaps);
      let changed = false;

      updatedMap.forEach((completedAt, txHash) => {
        if (now - completedAt >= 60000) {
          updatedMap.delete(txHash);
          changed = true;
        }
      });

      if (changed) {
        setCompletedSwaps(updatedMap);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [completedSwaps]);

  // Clear new swap badge when opened
  const handleOpen = () => {
    setIsOpen(true);
    setHasNewSwaps(false);
    localStorage.setItem('lastViewedSwapsCount', activeSwaps.length.toString());
    localStorage.setItem('lastViewedSwapsTimestamp', Date.now().toString());
  };

  // Listen for swap signing events (show bubble immediately)
  useEffect(() => {
    const handleSwapSigning = (event: CustomEvent) => {
      console.log('✍️ Swap signing started:', event.detail);

      const signingData = event.detail;

      // Create temporary swap entry with signing status
      const tempSwap: PendingSwap = {
        txHash: `signing-${Date.now()}`, // Temporary ID
        sellAsset: {
          caip: signingData.fromAsset.caip,
          symbol: signingData.fromAsset.symbol,
          amount: signingData.fromAmount,
          icon: signingData.fromAsset.icon,
          name: signingData.fromAsset.name,
        },
        buyAsset: {
          caip: signingData.toAsset.caip,
          symbol: signingData.toAsset.symbol,
          amount: signingData.toAmount,
          icon: signingData.toAsset.icon,
          name: signingData.toAsset.name,
        },
        status: 'signing',
        confirmations: 0,
        createdAt: signingData.createdAt || new Date().toISOString(),
        integration: 'thorchain', // Default, will be updated
      };

      // Add to signing swaps
      setSigningSwaps([tempSwap]);

      // Don't auto-open - only open when user clicks
      // setIsOpen(true);

      // Trigger pulse animation
      setHasNewSwaps(true);
    };

    window.addEventListener('swap:signing', handleSwapSigning as EventListener);
    return () => window.removeEventListener('swap:signing', handleSwapSigning as EventListener);
  }, []);

  // Listen for swap broadcast events
  useEffect(() => {
    const handleSwapBroadcast = (event: CustomEvent) => {
      console.log('🎯 New swap broadcast detected:', event.detail);

      // Clear signing swaps (transition to real pending swap)
      setSigningSwaps([]);

      // Auto-reopen dialog after broadcast (bridge event gap)
      setTimeout(() => {
        console.log('🔄 Auto-reopening swap dialog after broadcast');
        window.dispatchEvent(new CustomEvent('swap:reopen', {
          detail: event.detail
        }));
      }, 500);

      // Trigger pulse animation
      setHasNewSwaps(true);

      // Refresh pending swaps after 1s delay
      setTimeout(() => {
        refreshPendingSwaps();
      }, 1000);
    };

    window.addEventListener('swap:broadcast', handleSwapBroadcast as EventListener);
    return () => window.removeEventListener('swap:broadcast', handleSwapBroadcast as EventListener);
  }, [refreshPendingSwaps]);

  // Listen for swap cancel events (user closed signing dialog)
  useEffect(() => {
    const handleSwapCancel = () => {
      console.log('🚫 Swap signing cancelled - clearing signing swaps');

      // Clear signing swaps
      setSigningSwaps([]);
    };

    window.addEventListener('swap:cancel', handleSwapCancel as EventListener);
    return () => window.removeEventListener('swap:cancel', handleSwapCancel as EventListener);
  }, []);

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPendingSwaps();
    setIsRefreshing(false);
  };

  // Handle swap card click - reopen global SwapProgress dialog
  const handleSwapClick = (swap: PendingSwap) => {
    console.log('🔄 Reopening SwapProgress for swap:', swap.txHash);

    // Skip opening SwapProgress for signing swaps (no txid yet)
    if (swap.status === 'signing') {
      console.log('⏭️ Skipping - swap is still signing (no txid yet)');
      return;
    }

    // FIX: buyAsset.amount is "0" for pending swaps - use quote.raw.buyAmount as fallback
    let outputAmount = swap.buyAsset.amount;
    if (!outputAmount || outputAmount === '0' || parseFloat(outputAmount) === 0) {
      // Try to get expected amount from quote
      outputAmount = (swap.quote as any)?.raw?.buyAmount ||
                    (swap.quote as any)?.raw?.amountOut ||
                    (swap.quote as any)?.expectedAmountOut ||
                    '0';
      console.log('💡 [PendingSwapsPopup] buyAsset.amount is 0, using quote amount:', outputAmount);
    }

    // Dispatch event to reopen global SwapProgress dialog
    window.dispatchEvent(new CustomEvent('swap:reopen', {
      detail: {
        txHash: swap.txHash,
        fromAsset: {
          caip: swap.sellAsset.caip,
          symbol: swap.sellAsset.symbol,
          name: swap.sellAsset.name,
          icon: swap.sellAsset.icon
        },
        toAsset: {
          caip: swap.buyAsset.caip,
          symbol: swap.buyAsset.symbol,
          name: swap.buyAsset.name,
          icon: swap.buyAsset.icon
        },
        inputAmount: swap.sellAsset.amount,
        outputAmount: outputAmount,
        memo: swap.quote?.memo
      }
    }));

    // Don't open detail modal - let Dashboard handle showing SwapProgress
  };

  // Button should ALWAYS be visible, even when no active swaps
  // This allows users to access swap history at any time

  return (
    <>
      {/* Confetti Effect - Disabled temporarily to prevent repeated triggers */}
      {/* {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          colors={[theme.teal, theme.tealBright, theme.tealHover, '#00ff00', '#ffff00']}
        />
      )} */}

      {/* Floating Button - Bottom Left - ALWAYS visible */}
      {!isOpen && (
        <Box position="fixed" bottom="24px" left="24px" zIndex={1000}>
          <Box position="relative">
            <Button
              onClick={handleOpen}
              bg={theme.teal}
              color="white"
              size="lg"
              borderRadius="full"
              boxSize="60px"
              p={0}
              _hover={{ bg: theme.tealHover, transform: 'scale(1.05)' }}
              _active={{ transform: 'scale(0.95)' }}
              animation={hasNewSwaps ? `${pulseAnimation} 2s ease-in-out infinite` : undefined}
              boxShadow="0 4px 20px rgba(147, 51, 234, 0.4)"
              transition="all 0.2s"
            >
              {hasActiveSwaps ? (
                <Spinner size="md" color="white" />
              ) : (
                <Text fontSize="2xl" fontWeight="bold">⚡</Text>
              )}
            </Button>

            {/* Badge with count */}
            <Badge
              position="absolute"
              top="-8px"
              right="-8px"
              bg={theme.tealBright}
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
          borderColor={theme.teal}
          boxShadow={`0 8px 32px ${theme.teal}40`}
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
              <Text fontSize="lg" fontWeight="bold" color={theme.teal}>
                Swaps
              </Text>
              <Badge colorScheme="teal">{activeSwaps.length}</Badge>
            </HStack>
            <HStack gap={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                loading={isRefreshing}
                _hover={{ color: theme.teal }}
              >
                🔄
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                _hover={{ color: theme.teal }}
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
            css={{
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: theme.bg,
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
            {isLoading ? (
              <Flex justify="center" align="center" py={8}>
                <Spinner color={theme.teal} />
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
              variant="plain"
              color={theme.teal}
              onClick={() => {
                setShowHistoryDialog(true);
              }}
              _hover={{ color: theme.tealHover }}
            >
              View Full History →
            </Button>
          </Flex>
        </Box>
      )}

      {/* Full Swap History Dialog */}
      <DialogRoot
        open={showHistoryDialog}
        onOpenChange={(e) => setShowHistoryDialog(e.open)}
        size="xl"
      >
        <DialogContent
          maxW="900px"
          maxH="90vh"
          bg={theme.bg}
          borderColor={theme.teal}
          borderWidth="1px"
        >
          <DialogHeader
            borderBottom="1px solid"
            borderColor={theme.border}
            pb={4}
          >
            <Text fontSize="xl" fontWeight="bold" color={theme.teal}>
              Swap History
            </Text>
          </DialogHeader>
          <DialogCloseTrigger color={theme.teal} />
          <DialogBody p={0} overflow="hidden">
            <SwapHistory />
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
