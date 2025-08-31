'use client'

import React, { useState } from 'react';
import { Box, HStack, Input, Button, Text, VStack, IconButton } from '@chakra-ui/react';
import { FaExchangeAlt } from 'react-icons/fa';

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
  priceUsd?: number;
  onToggleMode?: () => void;
  isUsdMode?: boolean;
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
  symbol,
  priceUsd,
  onToggleMode,
  isUsdMode = false
}: SwapInputProps) => {
  const [localIsUsdMode, setLocalIsUsdMode] = useState(isUsdMode);
  
  const handleToggle = () => {
    setLocalIsUsdMode(!localIsUsdMode);
    if (onToggleMode) {
      onToggleMode();
    }
  };
  
  const displayValue = localIsUsdMode ? usdAmount || '' : value;
  const secondaryValue = localIsUsdMode ? value : usdAmount;
  return (
    <Box 
      bg="gray.800" 
      borderRadius="xl" 
      p={3}
      borderWidth="1px"
      borderColor="gray.700"
      _hover={{ borderColor: disabled ? 'gray.700' : 'gray.600' }}
    >
      {(label || (!disabled && priceUsd)) && (
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.500">{label || ''}</Text>
          <HStack gap={1}>
            {!disabled && priceUsd && (
              <IconButton
                size="xs"
                variant="ghost"
                onClick={handleToggle}
                aria-label="Toggle USD/Native"
                icon={<FaExchangeAlt size={10} />}
                color="gray.400"
                _hover={{ bg: 'gray.700', color: 'blue.400' }}
                height="20px"
                width="20px"
                minW="20px"
                fontSize="xs"
              />
            )}
          </HStack>
        </HStack>
      )}
      
      <HStack justify="space-between" align="flex-start">
        <VStack align="flex-start" gap={0} flex={1}>
          <HStack width="full">
            {localIsUsdMode && (
              <Text fontSize="2xl" fontWeight="medium" color={disabled ? 'gray.500' : 'white'} pl={2}>
                $
              </Text>
            )}
            <Input
              value={displayValue}
              onChange={(e) => {
                if (!disabled) {
                  const val = e.target.value;
                  // Allow empty string, numbers, and decimal point
                  // Prevent invalid characters
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    if (localIsUsdMode && priceUsd) {
                      const nativeVal = val ? (parseFloat(val) / priceUsd).toFixed(8) : '';
                      onChange(nativeVal);
                    } else {
                      onChange(val);
                    }
                  }
                }
              }}
              onKeyDown={(e) => {
                // Allow: backspace, delete, tab, escape, enter, decimal point
                if (
                  [8, 9, 27, 13, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
                  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                  (e.keyCode === 65 && e.ctrlKey === true) ||
                  (e.keyCode === 67 && e.ctrlKey === true) ||
                  (e.keyCode === 86 && e.ctrlKey === true) ||
                  (e.keyCode === 88 && e.ctrlKey === true) ||
                  // Allow: home, end, left, right
                  (e.keyCode >= 35 && e.keyCode <= 39)
                ) {
                  // let it happen, don't do anything
                  return;
                }
                // Ensure that it is a number and stop the keypress
                if (
                  (e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) &&
                  (e.keyCode < 96 || e.keyCode > 105)
                ) {
                  e.preventDefault();
                }
              }}
              placeholder={localIsUsdMode ? '0.00' : placeholder}
              fontSize="2xl"
              fontWeight="medium"
              variant="unstyled"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              disabled={disabled}
              px={localIsUsdMode ? 0 : 2}
              height="36px"
              _placeholder={{ color: 'gray.500' }}
              sx={{
                userSelect: 'text',
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text'
              }}
            />
          </HStack>
          {secondaryValue && (
            <Text fontSize="sm" color="gray.500" px={2}>
              {localIsUsdMode ? 
                `${secondaryValue} ${symbol}` : 
                `$${secondaryValue}`
              }
            </Text>
          )}
        </VStack>
        
        {!localIsUsdMode && symbol && (
          <Text fontSize="lg" color="gray.400" pr={2}>
            {symbol}
          </Text>
        )}
        {localIsUsdMode && (
          <Text fontSize="lg" color="gray.400" pr={2}>
            USD
          </Text>
        )}
      </HStack>
    </Box>
  );
};