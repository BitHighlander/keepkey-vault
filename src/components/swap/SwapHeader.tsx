/**
 * SwapHeader Component
 *
 * Compact header showing swap asset details with close button
 * Shows confirmations badge on input asset during confirmation stage
 */

import { HStack, VStack, Text, IconButton, Box } from '@chakra-ui/react';
import { FaArrowRight, FaTimes, FaSync } from 'react-icons/fa';
import { AssetIcon } from '@/components/ui/AssetIcon';

interface Asset {
  caip: string;
  symbol: string;
  amount?: string;
}

interface SwapHeaderProps {
  fromAsset: Asset;
  toAsset: Asset;
  confirmations?: number;
  requiredConfirmations?: number;
  onClose: () => void;
  onForceRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  isComplete?: boolean;
}

export function SwapHeader({
  fromAsset,
  toAsset,
  confirmations,
  requiredConfirmations,
  onClose,
  onForceRefresh,
  isRefreshing,
  isComplete
}: SwapHeaderProps) {
  return (
    <HStack justify="center" mb={8} position="relative" width="full">
      <HStack gap={8}>
        <VStack gap={2}>
          <Box position="relative">
            <AssetIcon caip={fromAsset.caip} boxSize="160px" alt={fromAsset.symbol} />
            {/* Confirmations Badge - Top Right */}
            {confirmations !== undefined && requiredConfirmations !== undefined && (
              <Box
                position="absolute"
                top="0"
                right="0"
                bg="teal.500"
                borderRadius="full"
                minW="40px"
                px={2}
                py={1}
                display="flex"
                alignItems="center"
                justifyContent="center"
                border="2px solid rgba(255, 255, 255, 0.3)"
                boxShadow="0 2px 8px rgba(0, 0, 0, 0.3)"
                zIndex={10}
              >
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color="white"
                  whiteSpace="nowrap"
                >
                  {confirmations}/{requiredConfirmations}
                </Text>
              </Box>
            )}
          </Box>
          <Text fontWeight="bold" fontSize="2xl">
            {fromAsset.amount} {fromAsset.symbol}
          </Text>
        </VStack>
        <FaArrowRight size={32} color="gray" />
        <VStack gap={2}>
          <AssetIcon caip={toAsset.caip} boxSize="160px" alt={toAsset.symbol} />
          <Text fontWeight="bold" fontSize="2xl">
            {toAsset.amount} {toAsset.symbol}
          </Text>
        </VStack>
      </HStack>
      <HStack position="absolute" right={0} top={0} gap={1}>
        {onForceRefresh && !isComplete && (
          <IconButton
            aria-label="Refresh swap status"
            title="Refresh Status"
            size="sm"
            variant="ghost"
            onClick={onForceRefresh}
            isLoading={isRefreshing}
            colorScheme="teal"
            _hover={{ bg: 'teal.900' }}
          >
            <FaSync />
          </IconButton>
        )}
        <IconButton
          aria-label="Close swap progress"
          title="Close"
          size="sm"
          variant="ghost"
          onClick={onClose}
        >
          <FaTimes />
        </IconButton>
      </HStack>
    </HStack>
  );
}
