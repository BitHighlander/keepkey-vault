'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Box, HStack, Input, Text, VStack, IconButton } from '@chakra-ui/react';
import { FaExchangeAlt } from 'react-icons/fa';
import { CountUpValue } from './CountUpValue';
import { NumberControls } from './NumberControls';
import {
  COLORS,
  convertToNative,
  convertToUsd,
  isValidNumberInput,
  isAllowedKey,
  incrementValue,
  decrementValue,
} from './swap-utils';

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
  maxBalance?: string;
  maxBalanceUsd?: string;
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
  isUsdMode = false,
  maxBalance,
  maxBalanceUsd
}: SwapInputProps) => {
  const [localIsUsdMode, setLocalIsUsdMode] = useState(isUsdMode);
  const [localUsdInput, setLocalUsdInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync isUsdMode prop with local state
  useEffect(() => {
    setLocalIsUsdMode(isUsdMode);
  }, [isUsdMode]);

  // Sync local USD input with incoming value when disabled (for output field pre-fill)
  useEffect(() => {
    if (disabled && value && priceUsd && localIsUsdMode) {
      setLocalUsdInput(convertToUsd(value, priceUsd));
    } else if (disabled && (!localIsUsdMode || !value)) {
      setLocalUsdInput('');
    }
  }, [disabled, value, priceUsd, localIsUsdMode]);

  // Check if entered amount exceeds balance
  const exceedsBalance = !disabled && maxBalance && value && parseFloat(value) > parseFloat(maxBalance);

  const handleToggle = () => {
    const newMode = !localIsUsdMode;
    setLocalIsUsdMode(newMode);

    if (newMode && value && priceUsd) {
      setLocalUsdInput(convertToUsd(value, priceUsd));
    } else {
      setLocalUsdInput('');
    }

    if (onToggleMode) {
      onToggleMode();
    }
  };

  const handleIncrement = () => {
    if (disabled) return;
    const newValue = incrementValue(displayValue, localIsUsdMode);

    if (localIsUsdMode && priceUsd) {
      setLocalUsdInput(newValue);
      onChange(convertToNative(newValue, priceUsd));
    } else {
      onChange(newValue);
    }
  };

  const handleDecrement = () => {
    if (disabled) return;
    const newValue = decrementValue(displayValue, localIsUsdMode);
    if (newValue === displayValue) return;

    if (localIsUsdMode && priceUsd) {
      setLocalUsdInput(newValue);
      onChange(convertToNative(newValue, priceUsd));
    } else {
      onChange(newValue);
    }
  };
  
  const displayValue = localIsUsdMode ? localUsdInput : value;
  const secondaryValue = localIsUsdMode
    ? (value && parseFloat(value) > 0 ? parseFloat(value).toFixed(8) : '')
    : (usdAmount || '');

  return (
    <Box
      bg={COLORS.bg}
      borderRadius="xl"
      p={3}
      borderWidth="2px"
      borderColor={exceedsBalance ? COLORS.errorBorder : COLORS.border}
      _hover={{
        borderColor: exceedsBalance ? COLORS.error : (disabled ? COLORS.border : COLORS.accentHover)
      }}
      transition="border-color 0.2s"
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
                color={COLORS.gray[400]}
                _hover={{ bg: COLORS.accentHover, color: COLORS.accent }}
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
              <Text fontSize="2xl" fontWeight="medium" color={exceedsBalance ? COLORS.error : (disabled ? COLORS.gray[500] : 'white')} pl={2}>
                $
              </Text>
            )}
            {disabled && displayValue && parseFloat(displayValue) > 0 ? (
              <Box px={localIsUsdMode ? 0 : 2} pr={!disabled ? 10 : 2}>
                <Text fontSize="2xl" fontWeight="medium">
                  <CountUpValue value={displayValue} isUsd={localIsUsdMode} />
                </Text>
              </Box>
            ) : (
            <Input
              ref={inputRef}
              value={displayValue}
              onChange={(e) => {
                if (!disabled) {
                  const val = e.target.value;
                  if (isValidNumberInput(val)) {
                    if (localIsUsdMode && priceUsd) {
                      setLocalUsdInput(val);
                      onChange(val ? convertToNative(val, priceUsd) : '');
                    } else {
                      onChange(val);
                    }
                  }
                }
              }}
              color={exceedsBalance ? COLORS.error : 'white'}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (!isAllowedKey(e)) {
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
              _placeholder={{ color: COLORS.gray[500] }}
              _focus={{ outline: 'none', boxShadow: 'none', borderColor: 'transparent' }}
              _selection={{ background: 'blue.600', color: 'white' }}
              sx={{
                cursor: 'text',
                caretColor: 'white',
                '::selection': { background: COLORS.accentSelection, color: 'white' },
                '::-moz-selection': { background: COLORS.accentSelection, color: 'white' },
                '&::-webkit-inner-spin-button': { display: 'none' },
                '&::-webkit-outer-spin-button': { display: 'none' }
              }}
            />
            )}

            {!disabled && (
              <NumberControls
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                canDecrement={!!displayValue && parseFloat(displayValue) > 0}
              />
            )}
          </HStack>
          {secondaryValue && (
            <Text
              fontSize="sm"
              color={COLORS.gray[400]}
              px={2}
              cursor={!disabled && priceUsd ? "pointer" : "default"}
              onClick={!disabled && priceUsd ? handleToggle : undefined}
              _hover={!disabled && priceUsd ? { color: COLORS.accent, textDecoration: "underline" } : undefined}
              transition="color 0.2s"
            >
              {localIsUsdMode ? (
                <>
                  {disabled && parseFloat(secondaryValue) > 0 ? (
                    <CountUpValue value={secondaryValue} isUsd={false} />
                  ) : secondaryValue} {symbol}
                </>
              ) : (
                <>
                  ${disabled && parseFloat(secondaryValue) > 0 ? (
                    <CountUpValue value={secondaryValue} isUsd={true} />
                  ) : secondaryValue}
                </>
              )}
            </Text>
          )}
        </VStack>

        <Text fontSize="lg" color={COLORS.gray[300]} pr={2} fontWeight="medium">
          {localIsUsdMode ? 'USD' : symbol}
        </Text>
      </HStack>

      {exceedsBalance && maxBalance && (
        <Text fontSize="xs" color={COLORS.error} mt={2} px={2} fontWeight="medium">
          Insufficient balance. Maximum: {parseFloat(maxBalance).toFixed(8)} {symbol}
          {maxBalanceUsd && ` ($${parseFloat(maxBalanceUsd).toFixed(2)})`}
        </Text>
      )}
    </Box>
  );
};