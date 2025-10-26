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
} from '@chakra-ui/react'
import { FaCopy } from 'react-icons/fa'

interface AssetInfoCardProps {
  assetContext: {
    icon: string
    name: string
    symbol: string
    color?: string
  }
  balance: string
  totalBalanceUsd: number
  selectedPubkey?: {
    address?: string
  }
  assetColor: string
  formatUsd: (value: number) => string
  theme: {
    cardBg: string
    borderRadius: string
    border: string
  }
}

export const AssetInfoCard: React.FC<AssetInfoCardProps> = ({
  assetContext,
  balance,
  totalBalanceUsd,
  selectedPubkey,
  assetColor,
  formatUsd,
  theme,
}) => {
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
          <Image
            src={assetContext.icon}
            alt={`${assetContext.name} Icon`}
            boxSize="100%"
            objectFit="contain"
          />
        </Box>
        <Stack align="center" gap={1}>
          <Text fontSize="xl" fontWeight="bold" color="white">
            {assetContext.name}
          </Text>
          <Stack gap={1}>
            <Text color="gray.400" fontSize="sm" textAlign="center">
              Balance: {balance} {assetContext.symbol}
            </Text>
            <Text color={assetColor} fontSize="md" textAlign="center" fontWeight="medium">
              {formatUsd(totalBalanceUsd)}
            </Text>
            {/* Display selected address */}
            {selectedPubkey?.address && (
              <Flex
                align="center"
                justify="center"
                gap={2}
                mt={1}
                px={3}
                py={1}
                bg={`${assetColor}11`}
                borderRadius="md"
                borderWidth="1px"
                borderColor={`${assetColor}33`}
                maxW="100%"
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
          </Stack>
        </Stack>
      </VStack>
    </Box>
  )
}
