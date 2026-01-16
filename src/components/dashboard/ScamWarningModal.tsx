'use client'

import React from 'react';
import {
  Button,
  Text,
  VStack,
  Box,
  HStack,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';

interface ScamWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tokenSymbol: string;
  scamType: 'possible' | 'confirmed';
  reason: string;
}

export const ScamWarningModal: React.FC<ScamWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tokenSymbol,
  scamType,
  reason,
}) => {
  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg" placement="center">
      <DialogContent
        bg="gray.900"
        border="2px solid"
        borderColor={scamType === 'confirmed' ? 'red.500' : 'orange.500'}
        boxShadow={`0 0 20px ${scamType === 'confirmed' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 165, 0, 0.5)'}`}
        backdrop={true}
      >
        <DialogHeader>
          <Text fontSize="xl" fontWeight="bold" color={scamType === 'confirmed' ? 'red.400' : 'orange.400'}>
            {scamType === 'confirmed' ? '⚠️ SCAM TOKEN WARNING' : '⚠️ POSSIBLE SCAM TOKEN'}
          </Text>
        </DialogHeader>
        <DialogCloseTrigger color="gray.400" />

        <DialogBody>
          <VStack gap={4} align="stretch">
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              borderRadius="lg"
              bg={scamType === 'confirmed' ? 'red.900' : 'orange.900'}
              border="2px solid"
              borderColor={scamType === 'confirmed' ? 'red.600' : 'orange.600'}
              py={4}
              px={4}
            >
              <Text fontSize="5xl" mb={2}>
                ⚠️
              </Text>
              <Text mt={4} mb={2} fontSize="lg" fontWeight="bold" color={scamType === 'confirmed' ? 'red.300' : 'orange.300'}>
                Suspicious Token Detected
              </Text>
              <VStack gap={2} color="gray.300" fontSize="md">
                <Text fontWeight="bold">
                  Token: {tokenSymbol}
                </Text>
                <Text>{reason}</Text>
              </VStack>
            </Box>

            <Box
              bg="red.950"
              p={4}
              borderRadius="lg"
              border="2px solid"
              borderColor="red.700"
            >
              <VStack gap={2} align="start">
                <Text fontSize="sm" fontWeight="bold" color="red.300">
                  🚨 CRITICAL SECURITY WARNING
                </Text>
                <Text fontSize="sm" color="gray.300">
                  • Scam tokens can drain your wallet if you interact with them
                </Text>
                <Text fontSize="sm" color="gray.300">
                  • Fake tokens often impersonate legitimate assets
                </Text>
                <Text fontSize="sm" color="gray.300">
                  • Zero-value tokens are commonly used for phishing attacks
                </Text>
                <Text fontSize="sm" color="gray.300">
                  • Never approve transactions from unknown token contracts
                </Text>
              </VStack>
            </Box>

            <Text fontSize="sm" color="gray.400" textAlign="center" fontStyle="italic">
              Only proceed if you are absolutely certain this token is legitimate and you understand the risks.
            </Text>
          </VStack>
        </DialogBody>

        <DialogFooter gap={3}>
          <Button
            variant="solid"
            bg="gray.700"
            color="white"
            _hover={{ bg: 'gray.600' }}
            onClick={onClose}
            size="lg"
            flex={1}
          >
            Cancel (Safe)
          </Button>
          <Button
            variant="solid"
            bg={scamType === 'confirmed' ? 'red.600' : 'orange.600'}
            color="white"
            _hover={{ bg: scamType === 'confirmed' ? 'red.500' : 'orange.500' }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            size="lg"
            flex={1}
          >
            I Understand the Risk
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
