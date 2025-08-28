'use client'

import React from 'react';
import { Box, HStack, Text, Image, Button } from '@chakra-ui/react';
import { FaChevronDown } from 'react-icons/fa';

interface AssetSelectorProps {
  asset: any;
  balance?: string;
  balanceUsd?: string;
  label: string;
  onClick: () => void;
  onMaxClick?: () => void;
  showMaxButton?: boolean;
}

export const AssetSelector = ({ 
  asset, 
  balance, 
  balanceUsd,
  label, 
  onClick,
  onMaxClick,
  showMaxButton = false
}: AssetSelectorProps) => {
  if (!asset) {
    return (
      <Box>
        <Text fontSize="xs" color="gray.500" mb={1}>{label}</Text>
        <Button
          onClick={onClick}
          variant="ghost"
          bg="gray.800"
          borderRadius="xl"
          p={2}
          height="auto"
          justify="space-between"
          width="full"
          _hover={{ bg: 'gray.700' }}
        >
          <Text color="gray.400" fontSize="sm">Select token</Text>
          <FaChevronDown color="gray" size={12} />
        </Button>
      </Box>
    );
  }

  // Format balance to reasonable precision
  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    if (num === 0) return '0';
    if (num < 0.00001) return '< 0.00001';
    if (num < 1) return num.toFixed(6);
    if (num < 100) return num.toFixed(4);
    if (num < 10000) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatUsdBalance = (bal: string) => {
    const num = parseFloat(bal);
    if (num < 0.01) return '< $0.01';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="xs" color="gray.500">{label}</Text>
        {balance && (
          <HStack gap={2}>
            <HStack gap={1}>
              <Text fontSize="xs" color="gray.400">
                Balance: {formatBalance(balance)} {asset.symbol}
              </Text>
              {balanceUsd && (
                <Text fontSize="xs" color="gray.500">
                  ({formatUsdBalance(balanceUsd)})
                </Text>
              )}
            </HStack>
            {showMaxButton && onMaxClick && (
              <Button
                size="xs"
                variant="solid"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('🟢 MAX BUTTON CLICKED IN ASSETSELECTOR');
                  onMaxClick();
                }}
                bg="blue.500"
                color="white"
                _hover={{ bg: 'blue.600' }}
                height="18px"
                px={1.5}
                fontSize="xs"
                borderRadius="md"
                minW="unset"
              >
                MAX
              </Button>
            )}
          </HStack>
        )}
      </HStack>
      <Button
        onClick={onClick}
        variant="ghost"
        bg="gray.800"
        borderRadius="xl"
        p={2}
        height="auto"
        width="full"
        justify="flex-start"
        _hover={{ bg: 'gray.700' }}
      >
        <HStack justify="space-between" width="full">
          <HStack gap={2}>
            <Image src={asset.icon} alt={asset.name} boxSize="20px" />
            <Text fontWeight="medium" color="white" fontSize="sm">{asset.symbol}</Text>
          </HStack>
          <FaChevronDown color="gray" size={12} />
        </HStack>
      </Button>
    </Box>
  );
};