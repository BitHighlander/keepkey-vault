/**
 * SwapHeader Component
 *
 * Compact header showing swap asset details with close button
 */

import { HStack, VStack, Text, IconButton } from '@chakra-ui/react';
import { FaArrowRight, FaTimes } from 'react-icons/fa';
import { AssetIcon } from '@/components/ui/AssetIcon';

interface Asset {
  caip: string;
  symbol: string;
  amount?: string;
}

interface SwapHeaderProps {
  fromAsset: Asset;
  toAsset: Asset;
  onClose: () => void;
}

export function SwapHeader({ fromAsset, toAsset, onClose }: SwapHeaderProps) {
  return (
    <HStack justify="center" mb={8} position="relative" width="full">
      <HStack gap={8}>
        <VStack gap={2}>
          <AssetIcon caip={fromAsset.caip} boxSize="160px" alt={fromAsset.symbol} />
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
      <IconButton
        aria-label="Close swap progress"
        size="sm"
        variant="ghost"
        onClick={onClose}
        position="absolute"
        right={0}
        top={0}
      >
        <FaTimes />
      </IconButton>
    </HStack>
  );
}
