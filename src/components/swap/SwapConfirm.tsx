'use client'

import React from 'react';
import { Box, Stack, HStack, VStack, Text, Button, Image } from '@chakra-ui/react';
import { FaArrowDown } from 'react-icons/fa';

interface SwapConfirmProps {
  fromAsset: any;
  toAsset: any;
  inputAmount: string;
  outputAmount: string;
  quote: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  fromAddress?: string;
  outboundAssetContext?: any;
  inputUsdValue?: string;
  outputUsdValue?: string;
}

export const SwapConfirm = ({
  fromAsset,
  toAsset,
  inputAmount,
  outputAmount,
  quote,
  onConfirm,
  onCancel,
  isLoading = false,
  fromAddress,
  outboundAssetContext,
  inputUsdValue,
  outputUsdValue
}: SwapConfirmProps) => {
  return (
    <VStack gap={8} width="full" align="stretch">
      {/* Title */}
      <Text fontSize="lg" fontWeight="medium" color="gray.400" textAlign="center">
        Confirm your swap
      </Text>

      {/* One-line swap summary */}
      <HStack justify="center" align="center" gap={4} py={4}>
        {/* From */}
        <HStack gap={2}>
          <Image src={fromAsset?.icon} alt={fromAsset?.name} boxSize="28px" />
          <Text fontSize="2xl" fontWeight="bold" color="white">
            {inputAmount}
          </Text>
          <Text fontSize="xl" color="gray.400">
            {fromAsset?.symbol}
          </Text>
        </HStack>

        {/* Arrow */}
        <Box color="gray.500" px={2}>
          →
        </Box>

        {/* To */}
        <HStack gap={2}>
          <Image src={toAsset?.icon} alt={toAsset?.name} boxSize="28px" />
          <Text fontSize="2xl" fontWeight="bold" color="green.400">
            {outputAmount}
          </Text>
          <Text fontSize="xl" color="gray.400">
            {toAsset?.symbol}
          </Text>
        </HStack>
      </HStack>



      {/* Destination Address */}
      {outboundAssetContext && (
        <HStack justify="center">
          <Text fontSize="sm" color="gray.500">
            To: {JSON.stringify(outboundAssetContext)}
          </Text>
        </HStack>
      )}

      {/* Action Buttons */}
      <VStack gap={3} pt={4}>
        <Button
          size="lg"
          bg="blue.500"
          color="white"
          _hover={{ bg: 'blue.600' }}
          _active={{ bg: 'blue.700' }}
          onClick={onConfirm}
          width="full"
          height="56px"
          borderRadius="xl"
          fontSize="lg"
          fontWeight="semibold"
          isLoading={isLoading}
          loadingText="Confirming..."
        >
          Confirm Swap
        </Button>
        
        <Button
          variant="ghost"
          color="gray.500"
          _hover={{ bg: 'gray.800' }}
          onClick={onCancel}
          width="full"
          height="48px"
          fontSize="md"
          isDisabled={isLoading}
        >
          Cancel
        </Button>
      </VStack>
    </VStack>
  );
};