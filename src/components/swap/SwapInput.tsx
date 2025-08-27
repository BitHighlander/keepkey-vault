'use client'

import React from 'react';
import { Box, HStack, Input, Button, Text } from '@chakra-ui/react';

interface SwapInputProps {
  value: string;
  onChange: (value: string) => void;
  isUSD: boolean;
  onToggleUSD: () => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export const SwapInput = ({
  value,
  onChange,
  isUSD,
  onToggleUSD,
  label,
  placeholder = '0.00',
  disabled = false
}: SwapInputProps) => {
  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" color="gray.500">{label}</Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={onToggleUSD}
          color={isUSD ? 'blue.400' : 'gray.400'}
        >
          {isUSD ? 'USD' : 'Native'}
        </Button>
      </HStack>
      <HStack>
        {isUSD && <Text color="gray.400" fontSize="lg">$</Text>}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          size="lg"
          variant="filled"
          bg="gray.700"
          _hover={{ bg: 'gray.600' }}
          _focus={{ bg: 'gray.600' }}
          type="number"
          disabled={disabled}
        />
      </HStack>
    </Box>
  );
};