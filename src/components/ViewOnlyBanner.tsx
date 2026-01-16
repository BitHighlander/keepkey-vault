'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { FaEye, FaPlug, FaTimes, FaMobileAlt, FaShieldAlt } from 'react-icons/fa';
import { isMobileApp } from '@/lib/platformDetection';

// Theme colors
const theme = {
  bg: '#1a1a1a',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#333333',
  warningBg: 'rgba(255, 107, 0, 0.15)',
  warningBorder: '#ff6b00',
  warningText: '#ff9944',
};

interface ViewOnlyBannerProps {
  deviceLabel?: string;
  onConnectDevice?: () => void;
  onDismiss?: () => void;
}

export const ViewOnlyBanner: React.FC<ViewOnlyBannerProps> = ({
  deviceLabel = 'KeepKey',
  onConnectDevice,
  onDismiss,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileApp());
  }, []);

  // Mobile app banner - show security warning
  if (isMobile) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={9999}
        bg={theme.warningBg}
        borderBottom="2px solid"
        borderColor={theme.warningBorder}
        boxShadow="0 4px 6px rgba(0, 0, 0, 0.3)"
      >
        <Flex
          maxW="1400px"
          mx="auto"
          px={4}
          py={2}
          align="center"
          justify="space-between"
          gap={4}
        >
          {/* Left side - Mobile Warning */}
          <HStack gap={3} flex={1}>
            <Flex
              align="center"
              justify="center"
              w="32px"
              h="32px"
              borderRadius="full"
              bg="rgba(255, 107, 0, 0.2)"
              color={theme.warningText}
            >
              <FaMobileAlt size={16} />
            </Flex>

            <VStack align="start" gap={0}>
              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="bold" color={theme.warningText}>
                  Mobile App • Watch-Only
                </Text>
                <FaShieldAlt size={12} color={theme.warningText} />
              </HStack>
              <Text fontSize="xs" color="gray.300">
                Never enter your recovery seed • Private keys stay on your hardware device
              </Text>
            </VStack>
          </HStack>

          {/* Right side - Dismiss */}
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              color="gray.400"
              _hover={{ bg: 'rgba(255, 255, 255, 0.05)' }}
              onClick={onDismiss}
            >
              <FaTimes />
            </Button>
          )}
        </Flex>
      </Box>
    );
  }

  // Web browser banner - show connect device option
  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={9999}
      bg={theme.bg}
      borderBottom="1px solid"
      borderColor={theme.border}
      boxShadow="0 4px 6px rgba(0, 0, 0, 0.3)"
    >
      <Flex
        maxW="1400px"
        mx="auto"
        px={4}
        py={2}
        align="center"
        justify="space-between"
        gap={4}
      >
        {/* Left side - Info */}
        <HStack gap={3} flex={1}>
          <Flex
            align="center"
            justify="center"
            w="32px"
            h="32px"
            borderRadius="full"
            bg="rgba(255, 215, 0, 0.1)"
            color={theme.gold}
          >
            <FaEye size={16} />
          </Flex>

          <VStack align="start" gap={0}>
            <Text fontSize="sm" fontWeight="bold" color={theme.gold}>
              View-Only Mode
            </Text>
            <Text fontSize="xs" color="gray.400">
              {deviceLabel} • Showing balances without device access
            </Text>
          </VStack>
        </HStack>

        {/* Right side - Actions */}
        <HStack gap={2}>
          {onConnectDevice && (
            <Button
              size="sm"
              variant="solid"
              color="black"
              bg={theme.gold}
              _hover={{ bg: theme.goldHover }}
              onClick={onConnectDevice}
            >
              <FaPlug style={{ marginRight: '8px' }} />
              Connect Device
            </Button>
          )}

          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              color="gray.400"
              _hover={{ bg: 'rgba(255, 255, 255, 0.05)' }}
              onClick={onDismiss}
            >
              <FaTimes />
            </Button>
          )}
        </HStack>
      </Flex>
    </Box>
  );
};

export default ViewOnlyBanner;
