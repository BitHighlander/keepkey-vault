'use client'

import React, { useMemo } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
} from '@chakra-ui/react';
import { 
  BalanceDetail, 
  getAddressTypeIcon, 
  formatAddress 
} from '@/types/balance';

interface BalanceBreakdownContentProps {
  balances: BalanceDetail[];
  totalValue: number;
  symbol: string;
}

const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  tooltipBg: '#1a1a1a',
};

export const BalanceBreakdownContent: React.FC<BalanceBreakdownContentProps> = ({
  balances,
  totalValue,
  symbol,
}) => {
  // Format USD value
  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format balance with appropriate decimals
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.00001) return num.toExponential(4);
    if (num < 1) return num.toFixed(8);
    return num.toFixed(6);
  };

  // Sort balances by value (highest first)
  const sortedBalances = useMemo(() => {
    return [...balances].sort((a, b) => b.valueUsd - a.valueUsd);
  }, [balances]);

  return (
    <VStack align="stretch" spacing={2}>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" fontWeight="bold" color={theme.gold}>
          Balance Breakdown
        </Text>
        <Text fontSize="xs" color="gray.400">
          {balances.length} addresses
        </Text>
      </HStack>
      
      <Box borderBottom="1px solid" borderColor={theme.border} my={1} />
      
      {sortedBalances.map((balance, index) => (
        <Box
          key={`${balance.address}-${index}`}
          p={2}
          bg={index % 2 === 0 ? 'transparent' : 'whiteAlpha.50'}
          borderRadius="sm"
        >
          <VStack align="stretch" spacing={1}>
            <HStack justify="space-between">
              <HStack spacing={1}>
                <Text fontSize="xs">
                  {getAddressTypeIcon(balance.addressType)}
                </Text>
                <Text fontSize="xs" fontWeight="medium" color="white">
                  {balance.label || 'Address'}
                </Text>
              </HStack>
              {balance.percentage && (
                <Text fontSize="xs" color={theme.gold}>
                  {balance.percentage.toFixed(1)}%
                </Text>
              )}
            </HStack>
            
            <Text fontSize="xs" color="gray.400" fontFamily="mono">
              {formatAddress(balance.address, 20)}
            </Text>
            
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.200">
                {formatBalance(balance.balance)} {symbol}
              </Text>
              <Text fontSize="xs" color="gray.300">
                ${formatUsd(balance.valueUsd)}
              </Text>
            </HStack>
          </VStack>
        </Box>
      ))}
      
      <Box borderBottom="1px solid" borderColor={theme.border} my={1} />
      
      <HStack justify="space-between" pt={1}>
        <Text fontSize="sm" fontWeight="bold" color="white">
          Total
        </Text>
        <Text fontSize="sm" fontWeight="bold" color={theme.gold}>
          ${formatUsd(totalValue)}
        </Text>
      </HStack>
    </VStack>
  );
};