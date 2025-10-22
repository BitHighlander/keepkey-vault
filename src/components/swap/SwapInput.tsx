'use client'

import React, { useState, useRef } from 'react';
import { Box, HStack, Input, Button, Text, VStack, IconButton } from '@chakra-ui/react';
import { FaExchangeAlt, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import CountUp from 'react-countup';

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
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleToggle = () => {
    setLocalIsUsdMode(!localIsUsdMode);
    if (onToggleMode) {
      onToggleMode();
    }
  };
  
  const handleIncrement = () => {
    if (disabled) return;
    const currentValue = parseFloat(displayValue || '0');
    const step = localIsUsdMode ? 1 : 0.0001;
    const newValue = (currentValue + step).toFixed(localIsUsdMode ? 2 : 8);
    
    if (localIsUsdMode && priceUsd) {
      const nativeVal = (parseFloat(newValue) / priceUsd).toFixed(8);
      onChange(nativeVal);
    } else {
      onChange(newValue);
    }
  };
  
  const handleDecrement = () => {
    if (disabled) return;
    const currentValue = parseFloat(displayValue || '0');
    if (currentValue <= 0) return;
    
    const step = localIsUsdMode ? 1 : 0.0001;
    const newValue = Math.max(0, currentValue - step).toFixed(localIsUsdMode ? 2 : 8);
    
    if (localIsUsdMode && priceUsd) {
      const nativeVal = (parseFloat(newValue) / priceUsd).toFixed(8);
      onChange(nativeVal);
    } else {
      onChange(newValue);
    }
  };
  
  const displayValue = localIsUsdMode ? usdAmount || '' : value;
  const secondaryValue = localIsUsdMode ? value : usdAmount;
  return (
    <Box
      bg="rgba(30, 30, 30, 0.6)"
      borderRadius="xl"
      p={3}
      borderWidth="1px"
      borderColor="rgba(255, 255, 255, 0.1)"
      _hover={{ borderColor: disabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(35, 220, 200, 0.3)' }}
    >
      {(label || (!disabled && priceUsd)) && (
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.400" fontWeight="medium">{label || ''}</Text>
          <HStack gap={1}>
            {!disabled && priceUsd && (
              <IconButton
                size="xs"
                variant="ghost"
                onClick={handleToggle}
                aria-label="Toggle USD/Native"
                icon={<FaExchangeAlt size={10} />}
                color="gray.400"
                _hover={{ bg: 'rgba(35, 220, 200, 0.2)', color: '#23DCC8' }}
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
          <HStack width="full" position="relative">
            {localIsUsdMode && (
              <Text fontSize="2xl" fontWeight="medium" color={disabled ? 'gray.500' : 'white'} pl={2}>
                $
              </Text>
            )}
            {disabled && displayValue && parseFloat(displayValue) > 0 ? (
              <Box px={localIsUsdMode ? 0 : 2} pr={!disabled ? 10 : 2}>
                <Text fontSize="2xl" fontWeight="medium" color="#23DCC8">
                  <CountUp
                    end={parseFloat(displayValue)}
                    decimals={parseFloat(displayValue) < 1 ? 8 : (parseFloat(displayValue) < 100 ? 4 : 2)}
                    duration={1.5}
                    separator=","
                    preserveValue={true}
                  />
                </Text>
              </Box>
            ) : (
            <Input
              ref={inputRef}
              value={displayValue}
              onChange={(e) => {
                if (!disabled) {
                  const val = e.target.value;
                  // Allow empty string, numbers, and decimal point
                  // Prevent invalid characters and multiple decimal points
                  if (val === '' || (/^\d*\.?\d*$/.test(val) && val.split('.').length <= 2)) {
                    if (localIsUsdMode && priceUsd) {
                      const nativeVal = val ? (parseFloat(val) / priceUsd).toFixed(8) : '';
                      onChange(nativeVal);
                    } else {
                      onChange(val);
                    }
                  }
                }
              }}
              onFocus={(e) => {
                // Select all text on focus for easy editing
                e.target.select();
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
              pr={!disabled ? 10 : 2}
              height="36px"
              _placeholder={{ color: 'gray.500' }}
              _focus={{
                outline: 'none',
                boxShadow: 'none',
                borderColor: 'transparent'
              }}
              _selection={{
                background: 'blue.600',
                color: 'white'
              }}
              sx={{
                cursor: 'text',
                caretColor: 'white',
                '::selection': {
                  background: 'rgba(56, 178, 172, 0.4)',
                  color: 'white'
                },
                '::-moz-selection': {
                  background: 'rgba(56, 178, 172, 0.4)',
                  color: 'white'
                },
                '&::-webkit-inner-spin-button': {
                  display: 'none'
                },
                '&::-webkit-outer-spin-button': {
                  display: 'none'
                }
              }}
            />
            )}
            
            {/* Arrow buttons for increment/decrement */}
            {!disabled && (
              <VStack 
                gap={0} 
                position="absolute" 
                right={2} 
                top="50%" 
                transform="translateY(-50%)"
                zIndex={2}
              >
                <IconButton
                  size="xs"
                  variant="solid"
                  onClick={handleIncrement}
                  aria-label="Increase value"
                  icon={<FaChevronUp size={12} />}
                  bg="gray.700"
                  color="white"
                  _hover={{ bg: 'gray.600' }}
                  _active={{ bg: 'gray.500' }}
                  height="18px"
                  width="24px"
                  minW="24px"
                  fontSize="xs"
                  borderRadius="md"
                />
                <IconButton
                  size="xs"
                  variant="solid"
                  onClick={handleDecrement}
                  aria-label="Decrease value"
                  icon={<FaChevronDown size={12} />}
                  bg="gray.700"
                  color="white"
                  _hover={{ bg: 'gray.600' }}
                  _active={{ bg: 'gray.500' }}
                  height="18px"
                  width="24px"
                  minW="24px"
                  fontSize="xs"
                  borderRadius="md"
                  isDisabled={!displayValue || parseFloat(displayValue) <= 0}
                />
              </VStack>
            )}
          </HStack>
          {secondaryValue && (
            <Text fontSize="sm" color="gray.400" px={2}>
              {localIsUsdMode ? (
                <>
                  {disabled && parseFloat(secondaryValue) > 0 ? (
                    <Text as="span" color="#23DCC8">
                      <CountUp
                        end={parseFloat(secondaryValue)}
                        decimals={parseFloat(secondaryValue) < 1 ? 8 : (parseFloat(secondaryValue) < 100 ? 4 : 2)}
                        duration={1.5}
                        separator=","
                        preserveValue={true}
                      />
                    </Text>
                  ) : secondaryValue} {symbol}
                </>
              ) : (
                <>
                  ${disabled && parseFloat(secondaryValue) > 0 ? (
                    <Text as="span" color="#23DCC8">
                      <CountUp
                        end={parseFloat(secondaryValue)}
                        decimals={2}
                        duration={1.5}
                        separator=","
                        preserveValue={true}
                      />
                    </Text>
                  ) : secondaryValue}
                </>
              )}
            </Text>
          )}
        </VStack>

        {!localIsUsdMode && symbol && (
          <Text fontSize="lg" color="gray.300" pr={2} fontWeight="medium">
            {symbol}
          </Text>
        )}
        {localIsUsdMode && (
          <Text fontSize="lg" color="gray.300" pr={2} fontWeight="medium">
            USD
          </Text>
        )}
      </HStack>
    </Box>
  );
};