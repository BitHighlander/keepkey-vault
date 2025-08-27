'use client'

import React from 'react';
import { Box, HStack, Text, Image } from '@chakra-ui/react';
import { FaChevronDown } from 'react-icons/fa';
import { middleEllipsis } from '@/utils/strings';

interface AssetSelectorProps {
  asset: any;
  balance?: string;
  label: string;
  onClick: () => void;
}

export const AssetSelector = ({ asset, balance, label, onClick }: AssetSelectorProps) => {
  if (!asset) {
    return (
      <Box>
        <Text fontSize="sm" color="gray.500" mb={1}>{label}</Text>
        <HStack
          onClick={onClick}
          cursor="pointer"
          bg="gray.700"
          p={3}
          borderRadius="lg"
          justify="space-between"
          _hover={{ bg: 'gray.600' }}
        >
          <Text color="gray.400">Select asset</Text>
          <FaChevronDown color="gray" />
        </HStack>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" color="gray.500">{label}</Text>
        {balance && (
          <Text fontSize="sm" color="gray.400">
            Balance: {middleEllipsis(balance, 10)}
          </Text>
        )}
      </HStack>
      <HStack
        onClick={onClick}
        cursor="pointer"
        bg="gray.700"
        p={3}
        borderRadius="lg"
        justify="space-between"
        _hover={{ bg: 'gray.600' }}
      >
        <HStack>
          <Image src={asset.icon} alt={asset.name} boxSize="24px" />
          <Box>
            <Text fontWeight="medium" color="white">{asset.symbol}</Text>
            <Text fontSize="xs" color="gray.400">{asset.name}</Text>
          </Box>
        </HStack>
        <FaChevronDown color="gray" />
      </HStack>
    </Box>
  );
};