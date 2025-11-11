'use client'

import React from 'react'
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
import { FaUsb, FaSync, FaArrowLeft } from 'react-icons/fa'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import { keyframes } from '@emotion/react'

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
      >
        <DialogHeader pb={2}>
          <Flex direction="column" gap={3}>
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
              <Flex align="center" gap={2}>
                <Box color="#00C853">
                  <FaUsb size={20} />
                </Box>
                <Text>Connect Your KeepKey</Text>
              </Flex>
            </DialogTitle>
          </Flex>
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            {/* KeepKey Icon with pulse animation */}
            <Flex justify="center" py={4}>
              <Box
                animation={`${pulse} 2s ease-in-out infinite`}
                color="#00C853"
              >
                <KeepKeyUiGlyph width={80} height={80} />
              </Box>
            </Flex>

            {/* Instructions */}
            <Stack gap={3}>
              <Text fontSize="md" textAlign="center" color="gray.300">
                To send transactions, you need to connect your KeepKey device
              </Text>

              <Box
                bg="#1a1a1a"
                p={4}
                borderRadius="8px"
                border="1px solid #2a2a2a"
              >
                <Stack gap={2}>
                  <Text fontSize="sm" fontWeight="semibold" color="#00C853">
                    Steps to connect:
                  </Text>
                  <Stack gap={1} pl={2}>
                    <Text fontSize="sm" color="gray.400">
                      1. Connect your KeepKey via USB
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                      2. Launch KeepKey Desktop
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                      3. Pioneer will re-sync automatically
                    </Text>
                  </Stack>
                </Stack>
              </Box>

              <Text fontSize="xs" textAlign="center" color="gray.500" mt={2}>
                The vault will detect your device automatically once connected
              </Text>
            </Stack>

            {/* Action Buttons */}
            <Stack gap={2} pt={2}>
              <Button
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
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  )
}
