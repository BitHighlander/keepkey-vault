'use client'

import React from 'react';
import { Box, HStack, Text, Image, Button } from '@chakra-ui/react';
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

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="xs" color="gray.500">{label}</Text>
        {balance && (
          <Text fontSize="xs" color="gray.500">
            Balance: {middleEllipsis(balance, 8)}
          </Text>
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