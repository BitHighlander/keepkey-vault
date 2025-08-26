import React, { useState } from 'react';
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  Input,
  Spinner,
  Alert,
} from '@chakra-ui/react';
import { AlertTriangle } from 'lucide-react';
import { useFeeRates, type FeeRatesData } from '@/hooks/useFeeRates';

export type FeeLevel = 'slow' | 'average' | 'fastest';

export interface FeeSelectionProps {
  networkId: string;
  assetId?: string;
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

const UTXO_NETWORKS = [
  'bip122:000000000019d6689c085ae165831e93', // Bitcoin
  'bip122:12a765e31ffd4059bada1e25190f6e98', // Litecoin
  'bip122:000000000933ea01ad0ee984209779ba', // Dogecoin
  'bip122:000000000000000000651ef99cb9fcbe', // Bitcoin Cash
];

const EVM_NETWORKS = [
  'eip155:1',    // Ethereum
  'eip155:56',   // BSC
  'eip155:137',  // Polygon
  'eip155:43114', // Avalanche
  'eip155:8453', // Base
  'eip155:10',   // Optimism
];

export const FeeSelection: React.FC<FeeSelectionProps> = ({
  networkId,
  assetId,
  selectedFeeLevel,
  onFeeSelectionChange,
  customFeeOption = false,
  onCustomFeeToggle,
  customFeeAmount = '',
  onCustomFeeChange,
  theme = defaultTheme,
}) => {
  const { feeOptions, feeRates, loading, error, refetch } = useFeeRates(networkId, assetId);

  const getNetworkType = (networkId: string): 'UTXO' | 'EVM' | 'TENDERMINT' | 'OTHER' => {
    if (UTXO_NETWORKS.some(id => networkId.startsWith(id)) || networkId.startsWith('bip122:')) {
      return 'UTXO';
    }
    if (EVM_NETWORKS.some(id => networkId.startsWith(id)) || networkId.startsWith('eip155:')) {
      return 'EVM';
    }
    if (networkId.startsWith('cosmos:')) {
      return 'TENDERMINT';
    }
    return 'OTHER';
  };

  const getFeeUnit = (): string => {
    // Always use API-provided unit if available - this is the source of truth
    if (feeRates?.data?.unit) {
      return feeRates.data.unit;
    }
    
    // Otherwise, determine based on network type
    const networkType = getNetworkType(networkId);
    switch (networkType) {
      case 'UTXO':
        return 'sat/vB';
      case 'EVM':
        return 'gwei';
      case 'TENDERMINT':
        return 'μatom';
      default:
        return 'sat/vB';
    }
  };

  const getDisplayFeeValue = (feeValue: string): string => {
    // If API provides unit metadata, trust the values completely
    if (feeRates?.data?.unit) {
      const value = parseFloat(feeValue);
      return value.toFixed(1);
    }
    
    // Otherwise, just format the value nicely
    const value = parseFloat(feeValue);
    return value.toFixed(8).replace(/\.?0+$/, ''); // Remove trailing zeros
  };

  const getFeeLabel = (level: FeeLevel): string => {
    switch (level) {
      case 'slow': return 'Low';
      case 'average': return 'Medium';
      case 'fastest': return 'High';
      default: return level;
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" py={4}>
        <Spinner size="sm" color={theme.gold} />
        <Text fontSize="sm" mt={2} opacity={0.7}>
          Loading fee rates...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="warning" size="sm">
        <AlertTriangle size={16} />
        <Box flex="1" ml={2}>
          <Text fontSize="sm">Failed to load fee rates</Text>
          <Button size="xs" variant="ghost" onClick={refetch} mt={1}>
            Retry
          </Button>
        </Box>
      </Alert>
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
            height="60px"
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
            <Stack gap={1} align="center">
              <Text fontSize="sm" fontWeight="bold">
                {getFeeLabel(level)}
              </Text>
              <Text fontSize="xs" opacity={0.8}>
                {getDisplayFeeValue(feeOptions[level])} {getFeeUnit()}
              </Text>
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