'use client'

import React from 'react';
import { Box, VStack, HStack, Text, Spinner } from '@chakra-ui/react';

interface SwapQuoteProps {
  quote: any;
  isLoading?: boolean;
  error?: string;
  formatTime?: (seconds: number) => string;
}

export const SwapQuote = ({ quote, isLoading, error, formatTime }: SwapQuoteProps) => {
  if (error) {
    return (
      <Box bg="red.900" p={4} borderRadius="lg" mt={4}>
        <Text color="red.300" fontSize="sm">{error}</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box bg="gray.700" p={4} borderRadius="lg" mt={4}>
        <HStack justify="center">
          <Spinner size="sm" color="blue.400" />
          <Text color="gray.400">Fetching quote...</Text>
        </HStack>
      </Box>
    );
  }

  if (!quote) {
    return null;
  }

  const defaultFormatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const timeFormatter = formatTime || defaultFormatTime;

  return (
    <Box bg="gray.700" p={4} borderRadius="lg" mt={4}>
      <Text fontWeight="bold" mb={3} color="white">Quote Details</Text>
      <VStack align="stretch" gap={2}>
        {quote.expectedAmountOut && (
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.400">Expected Output</Text>
            <Text fontSize="sm" color="white">{quote.expectedAmountOut}</Text>
          </HStack>
        )}
        {quote.slippagePercent && (
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.400">Slippage</Text>
            <Text fontSize="sm" color="white">{quote.slippagePercent}%</Text>
          </HStack>
        )}
        {quote.fees && (
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.400">Network Fees</Text>
            <Text fontSize="sm" color="white">{quote.fees.network || 'Calculating...'}</Text>
          </HStack>
        )}
        {quote.estimatedTime && (
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.400">Estimated Time</Text>
            <Text fontSize="sm" color="white">{timeFormatter(quote.estimatedTime)}</Text>
          </HStack>
        )}
        {quote.router && (
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.400">Router</Text>
            <Text fontSize="sm" color="white">{quote.router}</Text>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};