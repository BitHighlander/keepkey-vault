'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  useDisclosure,
  IconButton,
  Switch,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FaCog } from 'react-icons/fa';
import { getFeatureFlags, setFeatureFlag } from '@/config/features';

/**
 * Feature Flag Toggle Component
 * Provides a UI for toggling feature flags at runtime
 * Only visible in development mode or when explicitly enabled
 */
export const FeatureFlagToggle = () => {
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const [flags, setFlags] = useState(getFeatureFlags());
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Show the button in development mode or if explicitly enabled
    const isDev = process.env.NODE_ENV === 'development';
    const isEnabled = localStorage.getItem('show_feature_toggle') === 'true';
    setShowButton(isDev || isEnabled);
  }, []);

  const handleToggle = (flag: keyof typeof flags, value: boolean) => {
    setFeatureFlag(flag, value);
    setFlags(getFeatureFlags());
    // Reload the page to apply changes
    window.location.reload();
  };

  if (!showButton) {
    return null;
  }

  return (
    <>
      <Tooltip content="Feature Flags" positioning={{ placement: "left" }}>
        <IconButton
          aria-label="Feature Flags"
          position="fixed"
          bottom="20px"
          right="20px"
          size="md"
          colorScheme="gray"
          onClick={onOpen}
          zIndex={1000}
        >
          <FaCog />
        </IconButton>
      </Tooltip>

      <DialogRoot open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
        <DialogContent bg="#111111" borderColor="#222222" borderWidth="1px">
          <DialogHeader color="white">Feature Flags</DialogHeader>
          <DialogCloseTrigger />
          <DialogBody pb={6}>
            <VStack gap={4} align="stretch">
              {/* Swaps Feature Toggle */}
              <HStack justify="space-between" p={3} bg="#1a1a1a" borderRadius="md">
                <VStack align="start" gap={0}>
                  <Text color="white" fontWeight="medium">
                    Swaps
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    Enable swap functionality
                  </Text>
                </VStack>
                <Switch.Root
                  checked={flags.enableSwaps}
                  onCheckedChange={(e) => handleToggle('enableSwaps', !!e.checked)}
                  colorPalette="green"
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
              </HStack>

              {/* ZCash Feature Toggle */}
              <HStack justify="space-between" p={3} bg="#1a1a1a" borderRadius="md">
                <VStack align="start" gap={0}>
                  <Text color="white" fontWeight="medium">
                    ZCash (ZEC)
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    Enable ZCash support (experimental)
                  </Text>
                </VStack>
                <Switch.Root
                  checked={flags.enableZcash}
                  onCheckedChange={(e) => handleToggle('enableZcash', !!e.checked)}
                  colorPalette="green"
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
              </HStack>

              <Box pt={4} borderTop="1px solid" borderColor="#222222">
                <Text color="gray.500" fontSize="xs">
                  Changes require a page reload to take effect.
                </Text>
              </Box>
            </VStack>
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default FeatureFlagToggle;