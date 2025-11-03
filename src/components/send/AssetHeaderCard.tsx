'use client'

import React from 'react'
import {
  Box,
  Text,
  Stack,
  Flex,
  VStack,
  Image,
  IconButton,
  Button,
} from '@chakra-ui/react'
import { FaCopy, FaChevronDown, FaChevronUp, FaPlus } from 'react-icons/fa'
import { AssetIcon } from '@/components/ui/AssetIcon'

interface Pubkey {
  address?: string
  master?: string
  pubkey?: string
  note: string
  pathMaster: string
  networks: string[]
  scriptType?: string
  // UTXO address usage info
  receiveIndex?: number
  changeIndex?: number
  usedReceiveAddresses?: number
  usedChangeAddresses?: number
}

interface AssetHeaderCardProps {
  assetContext: {
    icon: string
    name: string
    symbol: string
    color?: string
    caip?: string
    pubkeys?: Pubkey[]
  }
  balance: string
  totalBalanceUsd: number
  selectedPubkey: Pubkey | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onPubkeyChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  onAddPathClick: () => void
  assetColor: string
  assetColorLight: string
  formatUsd: (value: number) => string
  theme: {
    cardBg: string
    borderRadius: string
    border: string
  }
}

export const AssetHeaderCard: React.FC<AssetHeaderCardProps> = ({
  assetContext,
  balance,
  totalBalanceUsd,
  selectedPubkey,
  showAdvanced,
  onToggleAdvanced,
  onPubkeyChange,
  onAddPathClick,
  assetColor,
  assetColorLight,
  formatUsd,
  theme,
}) => {
  const pubkeys = assetContext.pubkeys || []
  const hasPubkeys = pubkeys.length >= 1

  return (
    <Box
      bg={theme.cardBg}
      p={5}
      borderRadius={theme.borderRadius}
      boxShadow="lg"
      border="1px solid"
      borderColor={theme.border}
      width="100%"
    >
      <VStack align="center" gap={4}>
        {/* Asset Icon */}
        <Box
          borderRadius="full"
          overflow="hidden"
          boxSize="70px"
          bg={theme.cardBg}
          boxShadow="lg"
          p={2}
          borderWidth="1px"
          borderColor={assetContext.color || theme.border}
        >
          <AssetIcon
            src={assetContext.icon}
            caip={assetContext.caip}
            symbol={assetContext.symbol}
            alt={`${assetContext.name} Icon`}
            boxSize="100%"
            color={assetContext.color || '#FFD700'}
          />
        </Box>

        {/* Asset Info */}
        <Stack align="center" gap={1} width="100%">
          <Text fontSize="xl" fontWeight="bold" color="white">
            {assetContext.name}
          </Text>
          <Stack gap={1} width="100%">
            <Text color="gray.400" fontSize="sm" textAlign="center">
              Balance: {balance} {assetContext.symbol}
            </Text>
            <Text color={assetColor} fontSize="md" textAlign="center" fontWeight="medium">
              {formatUsd(totalBalanceUsd)}
            </Text>
          </Stack>
        </Stack>

        {/* Address Type Selector - integrated into the card */}
        {hasPubkeys && (
          <Box width="100%" mt={2}>
            {/* Header with Advanced button */}
            <Flex justify="space-between" align="center" mb={2}>
              <Button
                size="sm"
                height="28px"
                px={3}
                bg="transparent"
                color="gray.400"
                borderWidth="1px"
                borderColor={theme.border}
                _hover={{ bg: theme.border, color: "white" }}
                onClick={onToggleAdvanced}
              >
                Advanced
                <Box as="span" ml={2}>
                  {showAdvanced ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                </Box>
              </Button>
            </Flex>

            {/* Advanced Options - Collapsible */}
            {showAdvanced && (
              <>
                {/* Address Type Label - Only shown in advanced mode */}
                <Text color="gray.400" fontSize="sm" mb={2}>Address Type</Text>

                {/* Add Custom Path Button */}
                <Box
                  mb={3}
                  p={3}
                  bg={theme.border}
                  borderRadius="8px"
                  borderWidth="1px"
                  borderColor={theme.border}
                >
                  <Button
                    width="100%"
                    size="sm"
                    height="36px"
                    bg="transparent"
                    color={assetColor}
                    borderWidth="1px"
                    borderColor={assetColor}
                    _hover={{ bg: assetColorLight }}
                    onClick={onAddPathClick}
                  >
                    <Box as="span" mr={2}>
                      <FaPlus />
                    </Box>
                    Add Custom Path
                  </Button>
                </Box>

                {/* Address Type Dropdown - Only shown in advanced mode */}
                <select
                  value={selectedPubkey?.pathMaster || ''}
                  onChange={onPubkeyChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    borderWidth: '1px',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = assetColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                >
                  {(() => {
                    // Sort pubkeys - prioritize Native Segwit for Bitcoin
                    const sortedPubkeys = [...pubkeys].sort((a: Pubkey, b: Pubkey) => {
                      // Bitcoin - Native Segwit (bc1...) should come first
                      if (a.note?.includes('Native Segwit') && !b.note?.includes('Native Segwit')) return -1;
                      if (!a.note?.includes('Native Segwit') && b.note?.includes('Native Segwit')) return 1;

                      // Otherwise maintain order
                      return 0;
                    });

                    return sortedPubkeys.map((pubkey: Pubkey) => {
                      let label = pubkey.note || pubkey.pathMaster;

                      // For Bitcoin addresses, add "(Recommended)" tag to Native Segwit
                      if (pubkey.note?.includes('Native Segwit')) {
                        label = `${pubkey.note} (Recommended) - ${pubkey.pathMaster}`;
                      } else if (pubkey.note) {
                        label = `${pubkey.note} - ${pubkey.pathMaster}`;
                      }

                      // Add UTXO address usage info if available
                      const hasUsageInfo = typeof pubkey.changeIndex === 'number' ||
                                          typeof pubkey.receiveIndex === 'number';

                      if (hasUsageInfo) {
                        const receiveInfo = typeof pubkey.receiveIndex === 'number'
                          ? ` | Receive: ${pubkey.usedReceiveAddresses || 0} used (next: ${pubkey.receiveIndex})`
                          : '';

                        const changeInfo = typeof pubkey.changeIndex === 'number'
                          ? ` | Change: ${pubkey.usedChangeAddresses || 0} used (next: ${pubkey.changeIndex})`
                          : '';

                        label = `${label}${receiveInfo}${changeInfo}`;
                      }

                      return (
                        <option
                          key={pubkey.pathMaster}
                          value={pubkey.pathMaster}
                          style={{
                            backgroundColor: theme.cardBg,
                            color: 'white',
                            padding: '8px'
                          }}
                        >
                          {label}
                        </option>
                      );
                    });
                  })()}
                </select>
              </>
            )}

            {/* Selected Address Display - Only shown in advanced mode */}
            {showAdvanced && selectedPubkey?.address && (
              <Flex
                align="center"
                justify="center"
                gap={2}
                mt={3}
                px={3}
                py={2}
                bg={`${assetColor}11`}
                borderRadius="md"
                borderWidth="1px"
                borderColor={`${assetColor}33`}
              >
                <Text
                  color="gray.400"
                  fontSize="xs"
                  fontFamily="mono"
                  wordBreak="break-all"
                  textAlign="center"
                >
                  {selectedPubkey.address}
                </Text>
                <IconButton
                  aria-label="Copy address"
                  size="xs"
                  variant="ghost"
                  color={assetColor}
                  flexShrink={0}
                  onClick={() => {
                    if (selectedPubkey.address) {
                      navigator.clipboard.writeText(selectedPubkey.address)
                        .then(() => {
                          console.log('📋 Address copied to clipboard');
                        })
                        .catch(err => {
                          console.error('Error copying address:', err);
                        });
                    }
                  }}
                >
                  <FaCopy size={10} />
                </IconButton>
              </Flex>
            )}
          </Box>
        )}
      </VStack>
    </Box>
  )
}
