'use client'

import React from 'react';
import { Box, Stack, HStack, Text, Button, Image } from '@chakra-ui/react';
import { FaArrowRight } from 'react-icons/fa';

interface SwapConfirmProps {
  fromAsset: any;
  toAsset: any;
  inputAmount: string;
  outputAmount: string;
  quote: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const SwapConfirm = ({
  fromAsset,
  toAsset,
  inputAmount,
  outputAmount,
  quote,
  onConfirm,
  onCancel,
  isLoading = false
}: SwapConfirmProps) => {
  return (
    <Box bg="gray.700" p={6} borderRadius="lg">
      <Text fontSize="lg" fontWeight="bold" mb={4} color="white">Confirm Swap</Text>
      
      <Stack gap={4}>
        {/* Swap Summary */}
        <Box bg="gray.800" p={4} borderRadius="lg">
          <HStack justify="space-between" align="center">
            <HStack>
              <Image src={fromAsset?.icon} alt={fromAsset?.name} boxSize="32px" />
              <Box>
                <Text fontWeight="medium" color="white">{inputAmount}</Text>
                <Text fontSize="sm" color="gray.400">{fromAsset?.symbol}</Text>
              </Box>
            </HStack>
            
            <FaArrowRight color="gray" />
            
            <HStack>
              <Image src={toAsset?.icon} alt={toAsset?.name} boxSize="32px" />
              <Box>
                <Text fontWeight="medium" color="white">{outputAmount || quote?.expectedAmountOut || '...'}</Text>
                <Text fontSize="sm" color="gray.400">{toAsset?.symbol}</Text>
              </Box>
            </HStack>
          </HStack>
        </Box>

        {/* Quote Details */}
        {quote && (
          <Box bg="gray.800" p={4} borderRadius="lg">
            <Stack gap={2}>
              {quote.slippagePercent && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.400">Max Slippage</Text>
                  <Text fontSize="sm" color="white">{quote.slippagePercent}%</Text>
                </HStack>
              )}
              {quote.fees?.network && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.400">Network Fee</Text>
                  <Text fontSize="sm" color="white">{quote.fees.network}</Text>
                </HStack>
              )}
              {quote.router && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.400">Route</Text>
                  <Text fontSize="sm" color="white">{quote.router}</Text>
                </HStack>
              )}
            </Stack>
          </Box>
        )}

        {/* Action Buttons */}
        <HStack gap={3}>
          <Button
            variant="outline"
            colorScheme="gray"
            onClick={onCancel}
            width="full"
            isDisabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            bg="green.500"
            color="black"
            _hover={{ bg: 'green.400' }}
            _active={{ bg: 'green.600' }}
            onClick={onConfirm}
            width="full"
            isLoading={isLoading}
            loadingText="Swapping..."
          >
            Confirm Swap
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
};