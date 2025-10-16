'use client'

import React from 'react';
import {
  Box,
  VStack,
  Text,
  Input,
} from '@chakra-ui/react';

// Theme colors - matching the project theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  border: '#222222',
};

interface PathFormInputsProps {
  note: string;
  accountIndex: string;
  addressIndex: string;
  derivationPath: string;
  assetContext: any;
  error?: string;
  accentColor?: string;
  onNoteChange: (value: string) => void;
  onAccountIndexChange: (value: string) => void;
  onAddressIndexChange: (value: string) => void;
  compact?: boolean;
}

export const PathFormInputs: React.FC<PathFormInputsProps> = ({
  note,
  accountIndex,
  addressIndex,
  derivationPath,
  assetContext,
  error,
  accentColor = theme.gold,
  onNoteChange,
  onAccountIndexChange,
  onAddressIndexChange,
  compact = false,
}) => {
  return (
    <VStack gap={compact ? 3 : 6} align="stretch">
      {/* Asset Information - Only show if not compact */}
      {!compact && (
        <Box
          p={4}
          bg={theme.bg}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={theme.border}
        >
          <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
            Asset
          </Text>
          <Text color="white" fontSize="lg" fontWeight="bold">
            {assetContext?.symbol || 'Unknown'} ({assetContext?.name || 'Unknown Asset'})
          </Text>
          <Text color="gray.500" fontSize="xs" mt={1}>
            Network: {assetContext?.networkId || 'Unknown'}
          </Text>
        </Box>
      )}

      {/* Note Input */}
      <Box>
        <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
          Note *
        </Text>
        <Input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g., Account 1, Trading wallet, etc."
          bg={theme.bg}
          borderColor={theme.border}
          color="white"
          _hover={{ borderColor: accentColor }}
          _focus={{ borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` }}
        />
      </Box>

      {/* Account Index */}
      <Box>
        <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
          Account Index
        </Text>
        <Input
          type="number"
          min="0"
          max="999"
          value={accountIndex}
          onChange={(e) => onAccountIndexChange(e.target.value)}
          bg={theme.bg}
          borderColor={theme.border}
          color="white"
          _hover={{ borderColor: accentColor }}
          _focus={{ borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` }}
        />
      </Box>

      {/* Address Index */}
      <Box>
        <Text color="gray.400" fontSize="sm" mb={2} fontWeight="medium">
          Address Index
        </Text>
        <Input
          type="number"
          min="0"
          max="999"
          value={addressIndex}
          onChange={(e) => onAddressIndexChange(e.target.value)}
          bg={theme.bg}
          borderColor={theme.border}
          color="white"
          _hover={{ borderColor: accentColor }}
          _focus={{ borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` }}
        />
      </Box>

      {/* Derivation Path Preview */}
      <Box
        p={4}
        bg={`${accentColor}05`}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={`${accentColor}33`}
      >
        <Text color={accentColor} fontSize="xs" fontWeight="medium" mb={2}>
          Derivation Path
        </Text>
        <Text color="white" fontSize="sm" fontFamily="mono">
          {derivationPath}
        </Text>
      </Box>

      {/* Error Message */}
      {error && (
        <Box
          p={4}
          bg="rgba(255, 0, 0, 0.1)"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="red.500"
        >
          <Text color="red.400" fontSize="sm">
            ⚠️ {error}
          </Text>
        </Box>
      )}

      {/* Info Box - Only show if not compact */}
      {!compact && (
        <Box
          p={4}
          bg={`${accentColor}05`}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={`${accentColor}33`}
        >
          <Text color={accentColor} fontSize="xs" fontWeight="medium" mb={2}>
            ℹ️ Important Information
          </Text>
          <Text color="gray.400" fontSize="xs" mb={2}>
            This will add a new derivation path to your wallet. The new path will be used to generate addresses and fetch balances.
          </Text>
          <Text color="gray.400" fontSize="xs">
            <strong>Note:</strong> Custom paths are stored in your browser's local cache only. KeepKey does not track or store this data across platforms, so you may need to add custom paths again on other devices or browsers.
          </Text>
        </Box>
      )}
    </VStack>
  );
};
