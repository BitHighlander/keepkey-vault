'use client'

import React from 'react';
import { Box, Stack, HStack, VStack, Text, Button } from '@chakra-ui/react';
import { FaArrowDown, FaShieldAlt } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';
import { AssetIcon } from '@/components/ui/AssetIcon';
const { createMemo, parseMemo, normalizeSwapMemo, validateThorchainSwapMemo } = require('@pioneer-platform/pioneer-coins');

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
  const { state } = usePioneerContext();
  const app = state?.app;
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
          <AssetIcon src={fromAsset?.icon} caip={fromAsset?.caip} symbol={fromAsset?.symbol} alt={fromAsset?.name} boxSize="28px" color="#FFD700" />
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
          <AssetIcon src={toAsset?.icon} caip={toAsset?.caip} symbol={toAsset?.symbol} alt={toAsset?.name} boxSize="28px" color="#FFD700" />
          <Text fontSize="2xl" fontWeight="bold" color="#23DCC8">
            {outputAmount}
          </Text>
          <Text fontSize="xl" color="gray.400">
            {toAsset?.symbol}
          </Text>
        </HStack>
      </HStack>



      {/* Destination Address */}
      {outboundAssetContext && (
        <VStack gap={3} align="center">
          <HStack justify="center">
            <Text fontSize="sm" color="gray.500">
              To: {outboundAssetContext.address || outboundAssetContext.master}
            </Text>
          </HStack>
          
          {/* Security Notice */}
          <HStack gap={2} color="#23DCC8">
            <FaShieldAlt size="14" />
            <Text fontSize="xs" fontWeight="medium">
              Address will be verified on device before swap
            </Text>
          </HStack>
        </VStack>
      )}

      {/* Action Buttons */}
      <VStack gap={3} pt={4}>
        <Button
          size="lg"
          bg="#23DCC8"
          color="black"
          _hover={{ bg: '#1FC4B3' }}
          _active={{ bg: '#1AAB9B' }}
          onClick={() => {
            console.log('🔴 CONFIRM BUTTON CLICKED!');
            onConfirm();
          }}
          width="full"
          height="56px"
          borderRadius="xl"
          fontSize="lg"
          fontWeight="bold"
          isLoading={isLoading}
          loadingText="Check your KeepKey device..."
          isDisabled={isLoading}
          spinnerPlacement="start"
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