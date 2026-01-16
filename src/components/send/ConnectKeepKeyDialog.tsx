'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Text,
  Stack,
  Button,
  Flex,
} from '@chakra-ui/react'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'
import { FaUsb, FaSync, FaArrowLeft, FaExternalLinkAlt } from 'react-icons/fa'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import { keyframes } from '@emotion/react'
import { isMobileApp } from '@/lib/platformDetection'
import { MobileWatchOnlyWarning } from '@/components/warnings/MobileWatchOnlyWarning'

const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`

interface ConnectKeepKeyDialogProps {
  isOpen: boolean
  onClose?: () => void
  onBackToDashboard?: () => void
}

export const ConnectKeepKeyDialog: React.FC<ConnectKeepKeyDialogProps> = ({ isOpen, onClose, onBackToDashboard }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile mode when dialog opens
    if (isOpen) {
      setIsMobile(isMobileApp());
    }
  }, [isOpen]);

  // Function to launch KeepKey Desktop using the custom URI scheme
  const launchKeepKeyDesktop = () => {
    try {
      // This uses the custom URI protocol that KeepKey Desktop should register
      window.location.href = 'keepkey://launch';

      // Try to reconnect after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Failed to launch KeepKey Desktop:', error);
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose?.()}
      size="md"
      placement="center"
      closeOnInteractOutside={false}
      closeOnEscape={false}
    >
      <DialogContent
        bg="#111111"
        border="1px solid #3A4A5C"
        borderRadius="12px"
        maxW="520px"
      >
        <DialogHeader pb={4} pt={6} px={6}>
          <Flex direction="column" gap={4}>
            {/* Back to Dashboard Button */}
            {onBackToDashboard && (
              <Button
                size="sm"
                variant="ghost"
                color="#00C853"
                onClick={onBackToDashboard}
                _hover={{ color: '#00E563' }}
                alignSelf="flex-start"
                leftIcon={<FaArrowLeft />}
              >
                Go Back to Dashboard
              </Button>
            )}

            {/* Dialog Title */}
            <DialogTitle>
              <Flex align="center" gap={3}>
                <Box color="#00C853">
                  <FaUsb size={24} />
                </Box>
                <Text fontSize="xl">{isMobile ? 'Watch-Only Mode' : 'Connect Your KeepKey'}</Text>
              </Flex>
            </DialogTitle>
          </Flex>
        </DialogHeader>

        <DialogBody px={6} pb={6}>
          {isMobile ? (
            // Mobile App - Watch Only Mode
            <Stack gap={6}>
              {/* Mobile Watch-Only Warning */}
              <MobileWatchOnlyWarning variant="full" compact={false} />

              {/* Action Button */}
              <Stack gap={2} pt={2}>
                {onClose && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={onClose}
                    w="full"
                  >
                    Close
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : (
            // Web Browser - Normal Connection Flow
            <Stack gap={8}>
              {/* KeepKey Icon with pulse animation */}
              <Flex justify="center" py={8}>
                <Box
                  animation={`${pulse} 2s ease-in-out infinite`}
                  color="#00C853"
                >
                  <KeepKeyUiGlyph width={120} height={120} />
                </Box>
              </Flex>

              {/* Instructions */}
              <Stack gap={5}>
                <Text fontSize="md" textAlign="center" color="gray.300" px={4}>
                  To send transactions, you need to connect your KeepKey device
                </Text>

                <Box
                  bg="#1a1a1a"
                  p={6}
                  borderRadius="12px"
                  border="1px solid #2a2a2a"
                >
                  <Stack gap={4}>
                    <Text fontSize="md" fontWeight="semibold" color="#00C853">
                      Steps to connect:
                    </Text>
                    <Stack gap={3} pl={3}>
                      <Text fontSize="sm" color="gray.300">
                        1. Connect your KeepKey via USB
                      </Text>
                      <Text fontSize="sm" color="gray.300">
                        2. Launch KeepKey Desktop
                      </Text>
                      <Text fontSize="sm" color="gray.300">
                        3. Pioneer will re-sync automatically
                      </Text>
                    </Stack>
                  </Stack>
                </Box>

                <Text fontSize="sm" textAlign="center" color="gray.500" pt={2}>
                  The vault will detect your device automatically once connected
                </Text>
              </Stack>

              {/* Action Buttons */}
              <Stack gap={3} pt={4}>
                <Button
                  colorScheme="green"
                  size="lg"
                  leftIcon={<FaExternalLinkAlt />}
                  onClick={launchKeepKeyDesktop}
                  w="full"
                >
                  Launch KeepKey Desktop
                </Button>

                <Button
                  variant="outline"
                  colorScheme="green"
                  size="lg"
                  leftIcon={<FaSync />}
                  onClick={() => window.location.reload()}
                  w="full"
                >
                  Refresh Page
                </Button>

                {onClose && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={onClose}
                    w="full"
                  >
                    Cancel
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  )
}
