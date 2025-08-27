'use client'

import React from 'react';
import { Box, HStack, Input, Button, Text, VStack } from '@chakra-ui/react';

interface SwapInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  onMaxClick?: () => void;
  showMaxButton?: boolean;
  nativeAmount?: string;
  usdAmount?: string;
  symbol?: string;
}

export const SwapInput = ({
  value,
  onChange,
  label,
  placeholder = '0',
  disabled = false,
  onMaxClick,
  showMaxButton = false,
  nativeAmount,
  usdAmount,
  symbol
}: SwapInputProps) => {
  return (
    <Box 
      bg="gray.800" 
      borderRadius="xl" 
      p={3}
      borderWidth="1px"
      borderColor="gray.700"
      _hover={{ borderColor: disabled ? 'gray.700' : 'gray.600' }}
    >
      {label && (
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.500">{label}</Text>
          {showMaxButton && !disabled && (
            <Button
              size="xs"
              variant="ghost"
              onClick={onMaxClick}
              color="blue.400"
              _hover={{ bg: 'gray.700' }}
              height="20px"
              px={2}
              fontSize="xs"
            >
              MAX
            </Button>
          )}
        </HStack>
      )}
      
      <HStack justify="space-between" align="flex-start">
        <VStack align="flex-start" gap={0} flex={1}>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            fontSize="2xl"
            fontWeight="medium"
            variant="unstyled"
            type="number"
            disabled={disabled}
            px={2}
            height="36px"
            _placeholder={{ color: 'gray.500' }}
          />
          {usdAmount && (
            <Text fontSize="sm" color="gray.500" px={2}>
              ${usdAmount}
            </Text>
          )}
        </VStack>
        
        {symbol && (
          <Text fontSize="lg" color="gray.400" pr={2}>
            {symbol}
          </Text>
        )}
      </HStack>
    </Box>
  );
};