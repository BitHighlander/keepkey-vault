'use client'

import { Box, HStack, VStack, Text, Badge } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { keyframes } from '@emotion/react';
import { FC } from 'react';
import { PendingBalance } from '@/types/balance';

interface Props {
  pending: PendingBalance;
  symbol: string;
  mode: 'inline' | 'badge' | 'tooltip';
  size?: 'sm' | 'md' | 'lg';
}

const spinAnimation = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const PendingBalanceIndicator: FC<Props> = ({ pending, symbol, mode, size = 'md' }) => {
  const formatAmount = (amount: string) => parseFloat(amount).toFixed(8);
  const estimatedMinutes = pending.estimatedCompletionTime
    ? Math.ceil((pending.estimatedCompletionTime - Date.now()) / 60000)
    : null;

  if (mode === 'badge') {
    return (
      <Badge colorScheme="teal" fontSize={size === 'sm' ? 'xs' : 'sm'} px={2} py={1}>
        <Box as="span" display="inline-block" animation={`${spinAnimation} 2s linear infinite`}>
          🔄
        </Box>{' '}
        Swapping
      </Badge>
    );
  }

  if (mode === 'inline') {
    return (
      <Box
        bg="teal.900"
        borderColor="teal.500"
        borderWidth="2px"
        borderRadius="lg"
        p={4}
        w="full"
      >
        <VStack align="start" gap={2}>
          <HStack>
            <Box as="span" animation={`${spinAnimation} 2s linear infinite`}>
              🔄
            </Box>
            <Text fontWeight="bold" color="teal.300">
              Swap in Progress
            </Text>
          </HStack>

          <Box fontSize="sm" w="full">
            <HStack justify="space-between">
              <Text color="gray.400">Original:</Text>
              <Text color="white">{formatAmount(pending.originalAmount)} {symbol}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="gray.400">Reserved:</Text>
              <Text color="orange.300">{formatAmount(pending.debitedAmount)} {symbol} 🔒</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="gray.400">Expected:</Text>
              <Text color="green.300">
                {formatAmount((parseFloat(pending.originalAmount) - parseFloat(pending.debitedAmount)).toString())} {symbol}
              </Text>
            </HStack>
          </Box>

          {estimatedMinutes && estimatedMinutes > 0 && (
            <Text fontSize="xs" color="gray.500">
              Est. completion: {estimatedMinutes} min
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  // mode === 'tooltip'
  return (
    <Tooltip
      content={
        <VStack align="start" gap={1}>
          <Text fontWeight="bold">Swap in Progress</Text>
          <Text fontSize="xs">Original: {formatAmount(pending.originalAmount)} {symbol}</Text>
          <Text fontSize="xs">Reserved: {formatAmount(pending.debitedAmount)} {symbol}</Text>
          {estimatedMinutes && <Text fontSize="xs">Est: {estimatedMinutes} min</Text>}
        </VStack>
      }
      positioning={{ placement: "right" }}
      contentProps={{ bg: "teal.900", color: "white" }}
    >
      <Box as="span" display="inline-block" animation={`${spinAnimation} 2s linear infinite`}>
        🔄
      </Box>
    </Tooltip>
  );
};
