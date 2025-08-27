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
  // Only show error messages, no quote details
  if (error) {
    return (
      <Box bg="red.900" p={3} borderRadius="lg">
        <Text color="red.300" fontSize="sm">{error}</Text>
      </Box>
    );
  }

  // Don't show anything else - no loading state, no quote details
  return null;
};