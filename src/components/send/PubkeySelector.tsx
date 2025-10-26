'use client'

import React from 'react'
import {
  Box,
  Button,
  Text,
  Flex,
} from '@chakra-ui/react'
import { FaChevronDown, FaChevronUp, FaPlus } from 'react-icons/fa'

interface Pubkey {
  address?: string
  master?: string
  pubkey?: string
  note: string
  pathMaster: string
  networks: string[]
  scriptType?: string
}

interface PubkeySelectorProps {
  pubkeys: Pubkey[]
  selectedPubkey: Pubkey | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onPubkeyChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  onAddPathClick: () => void
  assetColor: string
  assetColorLight: string
  theme: {
    border: string
    cardBg: string
  }
}

export const PubkeySelector: React.FC<PubkeySelectorProps> = ({
  pubkeys,
  selectedPubkey,
  showAdvanced,
  onToggleAdvanced,
  onPubkeyChange,
  onAddPathClick,
  assetColor,
  assetColorLight,
  theme,
}) => {
  return (
    <Box width="100%" maxW="sm" mx="auto">
      <Flex justify="space-between" align="center" mb={2}>
        <Text color="gray.400" fontSize="sm">Select Address Type</Text>
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
          rightIcon={showAdvanced ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
        >
          Advanced
        </Button>
      </Flex>

      {/* Advanced Options - Collapsible */}
      {showAdvanced && (
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
            leftIcon={<FaPlus />}
          >
            Add Custom Path
          </Button>
        </Box>
      )}

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
    </Box>
  )
}
