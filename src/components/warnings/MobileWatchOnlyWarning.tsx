'use client';

import React from 'react';
import { Box, Text, VStack, HStack } from '@chakra-ui/react';
import { FaMobileAlt, FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';

interface MobileWatchOnlyWarningProps {
  showIcon?: boolean;
  compact?: boolean;
  variant?: 'full' | 'banner' | 'inline';
}

const theme = {
  bg: '#1a0d00',
  cardBg: '#2d1a00',
  border: '#ff6b00',
  warning: '#ff6b00',
  warningBg: 'rgba(255, 107, 0, 0.1)',
  text: '#ffffff',
  textSecondary: '#cccccc',
};

/**
 * Warning component for mobile app users
 *
 * Displays critical security information:
 * 1. Mobile app is watch-only
 * 2. Never enter seeds into any wallet
 * 3. Scam warning about fake KeepKey wallets
 */
export function MobileWatchOnlyWarning({
  showIcon = true,
  compact = false,
  variant = 'full',
}: MobileWatchOnlyWarningProps) {
  if (variant === 'banner') {
    return (
      <Box
        bg={theme.warningBg}
        borderWidth="2px"
        borderColor={theme.warning}
        borderRadius="8px"
        p={3}
      >
        <HStack gap={3} align="start">
          {showIcon && (
            <Box color={theme.warning} flexShrink={0} mt={0.5}>
              <FaShieldAlt size={20} />
            </Box>
          )}
          <VStack align="start" gap={1} flex={1}>
            <Text fontSize="sm" fontWeight="bold" color={theme.warning}>
              Watch-Only Mode
            </Text>
            <Text fontSize="xs" color={theme.textSecondary}>
              Mobile app is watch-only. Never enter your recovery seed into any wallet.
            </Text>
          </VStack>
        </HStack>
      </Box>
    );
  }

  if (variant === 'inline') {
    return (
      <HStack
        gap={2}
        bg={theme.warningBg}
        p={2}
        borderRadius="6px"
        borderWidth="1px"
        borderColor={theme.warning}
      >
        {showIcon && <FaShieldAlt color={theme.warning} size={16} />}
        <Text fontSize="xs" color={theme.textSecondary}>
          Watch-only mode • Never enter seeds
        </Text>
      </HStack>
    );
  }

  // Full variant
  return (
    <VStack gap={4} align="stretch">
      {/* Header */}
      <HStack gap={3}>
        {showIcon && (
          <Box color={theme.warning}>
            <FaMobileAlt size={24} />
          </Box>
        )}
        <VStack align="start" gap={0} flex={1}>
          <Text fontSize="lg" fontWeight="bold" color={theme.text}>
            KeepKey Mobile App
          </Text>
          <Text fontSize="sm" color={theme.textSecondary}>
            Watch-Only Mode
          </Text>
        </VStack>
      </HStack>

      {/* Security Warning Box */}
      <Box
        bg={theme.warningBg}
        borderWidth="2px"
        borderColor={theme.warning}
        borderRadius="8px"
        p={4}
      >
        <VStack align="start" gap={3}>
          <HStack gap={2}>
            <FaShieldAlt color={theme.warning} size={18} />
            <Text fontWeight="bold" color={theme.warning} fontSize="md">
              Important Security Information
            </Text>
          </HStack>

          {!compact && (
            <VStack align="start" gap={2} fontSize="sm" color={theme.textSecondary}>
              <HStack align="start" gap={2}>
                <Text color={theme.warning}>•</Text>
                <Text>
                  <Text as="span" fontWeight="bold">
                    Watch-Only:
                  </Text>{' '}
                  This mobile app provides a read-only view of your portfolio
                </Text>
              </HStack>

              <HStack align="start" gap={2}>
                <Text color={theme.warning}>•</Text>
                <Text>
                  <Text as="span" fontWeight="bold">
                    No Seeds Required:
                  </Text>{' '}
                  You should NEVER enter your recovery seed into this or any wallet app
                </Text>
              </HStack>

              <HStack align="start" gap={2}>
                <Text color={theme.warning}>•</Text>
                <Text>
                  <Text as="span" fontWeight="bold">
                    Hardware Only:
                  </Text>{' '}
                  Your private keys remain safely stored on your KeepKey hardware device
                </Text>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Box>

      {/* Scam Warning */}
      <Box
        bg="#2d0a0a"
        borderWidth="2px"
        borderColor="#ff4444"
        borderRadius="8px"
        p={4}
      >
        <VStack align="start" gap={2}>
          <HStack gap={2}>
            <FaExclamationTriangle color="#ff4444" size={18} />
            <Text fontWeight="bold" color="#ff4444" fontSize="md">
              Scam Warning
            </Text>
          </HStack>

          <Text fontSize="sm" color={theme.textSecondary}>
            <Text as="span" fontWeight="bold" color="#ff4444">
              Any wallet claiming to be KeepKey and asking for your recovery seed is a SCAM.
            </Text>{' '}
            KeepKey never asks for your seed phrase except during initial device setup directly on the hardware device itself.
          </Text>
        </VStack>
      </Box>

      {/* Additional Info */}
      {!compact && (
        <Box fontSize="xs" color={theme.textSecondary}>
          <Text fontWeight="bold" color={theme.text} mb={1}>
            How to use Mobile App:
          </Text>
          <Text>
            1. Connect KeepKey to your desktop computer
            <br />
            2. Open KeepKey Vault in browser
            <br />
            3. Generate pairing code
            <br />
            4. Scan QR code with mobile app to sync portfolio
          </Text>
        </Box>
      )}
    </VStack>
  );
}
