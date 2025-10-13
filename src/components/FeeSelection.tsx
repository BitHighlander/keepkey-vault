import React, { useState } from 'react';
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  Input,
  Spinner,
} from '@chakra-ui/react';
import type { FeeRatesData } from '@/hooks/useFeeRates';

export type FeeLevel = 'slow' | 'average' | 'fastest';

export interface FeeSelectionProps {
  networkId: string;
  assetId?: string;
  feeOptions: FeeRatesData;  // Pass fees directly from parent
  feeRates?: any;  // Optional normalized fee data
  selectedFeeLevel: FeeLevel;
  onFeeSelectionChange: (level: FeeLevel) => void;
  customFeeOption?: boolean;
  onCustomFeeToggle?: () => void;
  customFeeAmount?: string;
  onCustomFeeChange?: (amount: string) => void;
  theme?: {
    gold: string;
    goldHover: string;
    border: string;
  };
}

const defaultTheme = {
  gold: '#8B9DC3',
  goldHover: '#A0B4D4',
  border: '#3A4A5C',
};

// Network type detection is now handled by the SDK

export const FeeSelection: React.FC<FeeSelectionProps> = ({
  networkId,
  assetId,
  feeOptions,
  feeRates,
  selectedFeeLevel,
  onFeeSelectionChange,
  customFeeOption = false,
  onCustomFeeToggle,
  customFeeAmount = '',
  onCustomFeeChange,
  theme = defaultTheme,
}) => {

  // Get fee unit from the normalized data
  const getFeeUnit = (): string => {
    // Use the unit from normalized fee data
    if (feeRates?.data?.normalized?.slow?.unit) {
      return feeRates.data.normalized.slow.unit;
    }
    // Fallback to raw data unit if available
    if (feeRates?.data?.unit) {
      return feeRates.data.unit;
    }
    return '';
  };

  const getDisplayFeeValue = (feeValue: string): string => {
    const value = parseFloat(feeValue);

    // If it's 0, just return 0
    if (value === 0) return '0';

    const unit = getFeeUnit();

    // Format based on unit type
    if (unit === 'sat/byte' || unit === 'sat/vB' || unit === 'sat/vByte') {
      // For sats, show as integer if whole number
      return value % 1 === 0 ? value.toString() : value.toFixed(1).replace(/\.0$/, '');
    }

    if (unit === 'gwei' || unit === 'Gwei') {
      // For gwei, show with 1 decimal
      return value.toFixed(1).replace(/\.0$/, '');
    }

    // For other units, show with appropriate decimals
    if (value < 0.01) {
      return value.toFixed(6).replace(/\.?0+$/, '');
    }
    return value.toFixed(2).replace(/\.?0+$/, '');
  };

  const getFeeLabel = (level: FeeLevel): string => {
    // Use labels from normalized fee data if available
    if (feeRates?.data?.normalized?.[level]?.label) {
      return feeRates.data.normalized[level].label;
    }
    // Fallback to simple labels
    switch (level) {
      case 'slow': return 'Economy';
      case 'average': return 'Standard';
      case 'fastest': return 'Priority';
      default: return level;
    }
  };

  const getFeeEstimatedTime = (level: FeeLevel): string | undefined => {
    // Get estimated time from normalized fee data
    return feeRates?.data?.normalized?.[level]?.estimatedTime;
  };

  // Show nothing if no fees are provided
  if (!feeOptions || (feeOptions.slow === '0' && feeOptions.average === '0' && feeOptions.fastest === '0')) {
    return (
      <Box textAlign="center" py={4}>
        <Spinner size="sm" color={theme.gold} />
        <Text fontSize="sm" mt={2} opacity={0.7}>
          Loading fee rates...
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text fontSize="sm" fontWeight="bold" mb={3} color={theme.gold}>
        Transaction Speed
      </Text>
      
      {/* Fee Level Buttons */}
      <Flex gap={3} width="100%" mb={4}>
        {(['slow', 'average', 'fastest'] as const).map((level) => (
          <Button
            key={level}
            flex={1}
            size="md"
            height="auto"
            py={3}
            variant={selectedFeeLevel === level ? 'solid' : 'outline'}
            bg={selectedFeeLevel === level ? theme.gold : 'transparent'}
            color={selectedFeeLevel === level ? 'black' : theme.gold}
            borderColor={theme.gold}
            borderWidth="2px"
            borderRadius="8px"
            _hover={{
              bg: selectedFeeLevel === level ? theme.goldHover : 'rgba(139, 157, 195, 0.15)',
              transform: 'translateY(-1px)',
              boxShadow: 'md',
            }}
            _active={{
              transform: 'translateY(0px)',
            }}
            transition="all 0.2s ease"
            onClick={() => onFeeSelectionChange(level)}
          >
            <Stack gap={1.5} align="center" spacing={1}>
              <Text fontSize="sm" fontWeight="bold" lineHeight="1.2">
                {getFeeLabel(level)}
              </Text>
              <Text fontSize="xs" opacity={0.8} lineHeight="1.2">
                {getDisplayFeeValue(feeOptions[level])} {getFeeUnit()}
              </Text>
              {getFeeEstimatedTime(level) && (
                <Text fontSize="2xs" opacity={0.6} lineHeight="1.2">
                  {getFeeEstimatedTime(level)}
                </Text>
              )}
            </Stack>
          </Button>
        ))}
      </Flex>
      
      {/* Custom Fee Option */}
      {onCustomFeeToggle && (
        <Box mt={3} p={3} bg="rgba(139, 157, 195, 0.05)" borderRadius="6px" border="1px solid" borderColor={theme.border}>
          <Text fontSize="xs" fontWeight="bold" mb={2} color={theme.gold}>
            Custom Fee
          </Text>
          <Flex align="center" gap={3}>
            <Button
              size="sm"
              height="40px"
              px={4}
              variant={customFeeOption ? 'solid' : 'outline'}
              bg={customFeeOption ? theme.gold : 'transparent'}
              color={customFeeOption ? 'black' : theme.gold}
              borderColor={theme.gold}
              borderWidth="2px"
              borderRadius="6px"
              _hover={{
                bg: customFeeOption ? theme.goldHover : 'rgba(139, 157, 195, 0.15)',
                transform: 'translateY(-1px)',
              }}
              _active={{
                transform: 'translateY(0px)',
              }}
              transition="all 0.2s ease"
              onClick={onCustomFeeToggle}
            >
              {customFeeOption ? 'Using Custom' : 'Use Custom'}
            </Button>
            {customFeeOption && onCustomFeeChange && (
              <Input
                size="sm"
                height="40px"
                placeholder={`Enter fee (${getFeeUnit()})`}
                value={customFeeAmount}
                onChange={(e) => onCustomFeeChange(e.target.value)}
                color="white"
                bg="rgba(0,0,0,0.3)"
                borderColor={theme.border}
                borderWidth="2px"
                borderRadius="6px"
                _hover={{ borderColor: theme.goldHover }}
                _focus={{ 
                  borderColor: theme.gold,
                  boxShadow: `0 0 0 1px ${theme.gold}`,
                }}
                flex="1"
              />
            )}
          </Flex>
        </Box>
      )}

      {/* Fee Information */}
      {feeRates?.data?.description && (
        <Text fontSize="xs" mt={2} opacity={0.6}>
          {feeRates.data.description}
        </Text>
      )}
    </Box>
  );
};