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
  // Show error messages
  if (error) {
    return (
      <Box bg="red.900" p={3} borderRadius="lg">
        <Text color="red.300" fontSize="sm">{error}</Text>
      </Box>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Box bg="rgba(35, 220, 200, 0.05)" p={3} borderRadius="lg" borderWidth="1px" borderColor="rgba(35, 220, 200, 0.2)">
        <HStack justify="center" gap={2}>
          <Spinner size="sm" color="#23DCC8" />
          <Text fontSize="sm" color="gray.400">Getting quote...</Text>
        </HStack>
      </Box>
    );
  }

  // Show quote details if available
  if (quote) {
    const networkFee = quote.fees?.network ? parseFloat(quote.fees.network) : 0;
    const protocolFee = quote.fees?.protocol ? parseFloat(quote.fees.protocol) : 0;
    const affiliateFee = quote.fees?.affiliate ? parseFloat(quote.fees.affiliate) : 0;
    const totalFees = networkFee + protocolFee + affiliateFee;

    return (
      <Box
        bg="rgba(35, 220, 200, 0.05)"
        p={3}
        borderRadius="lg"
        borderWidth="1px"
        borderColor="rgba(35, 220, 200, 0.2)"
      >
        <VStack spacing={2} align="stretch">
          {/* Network Gas Fee */}
          {networkFee > 0 && (
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.400">Network Fee</Text>
              <Text fontSize="sm" color="#23DCC8" fontWeight="medium">
                {networkFee.toFixed(8)}
              </Text>
            </HStack>
          )}

          {/* Protocol Fee (THORChain) */}
          {protocolFee > 0 && (
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.400">Protocol Fee</Text>
              <Text fontSize="sm" color="#23DCC8" fontWeight="medium">
                {protocolFee.toFixed(8)}
              </Text>
            </HStack>
          )}

          {/* Affiliate Fee */}
          {affiliateFee > 0 && (
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.400">Affiliate Fee</Text>
              <Text fontSize="sm" color="#23DCC8" fontWeight="medium">
                {affiliateFee.toFixed(8)}
              </Text>
            </HStack>
          )}

          {/* Total Fees */}
          {totalFees > 0 && (
            <HStack justify="space-between" pt={1} borderTopWidth="1px" borderColor="rgba(35, 220, 200, 0.2)">
              <Text fontSize="sm" color="gray.300" fontWeight="medium">Total Fees</Text>
              <Text fontSize="sm" color="#23DCC8" fontWeight="bold">
                {totalFees.toFixed(8)}
              </Text>
            </HStack>
          )}

          {/* Expected Output */}
          {quote.amountOut && (
            <HStack justify="space-between" pt={1}>
              <Text fontSize="sm" color="gray.400">Expected Output</Text>
              <Text fontSize="sm" color="#23DCC8" fontWeight="medium">
                {parseFloat(quote.amountOut).toFixed(8)}
              </Text>
            </HStack>
          )}

          {/* Minimum Received (with slippage) */}
          {quote.amountOutMin && (
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.400">Minimum Received</Text>
              <Text fontSize="sm" color="orange.400" fontWeight="medium">
                {parseFloat(quote.amountOutMin).toFixed(8)}
              </Text>
            </HStack>
          )}
        </VStack>
      </Box>
    );
  }

  // No quote yet
  return null;
};