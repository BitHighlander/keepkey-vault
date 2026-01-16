'use client'

import React, { useState } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Textarea,
  IconButton,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger
} from '@/components/ui/dialog';
import { FaPen, FaCopy, FaCheck } from 'react-icons/fa';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

// Theme colors matching Receive component
const theme = {
  bg: '#000000',
  cardBg: 'rgba(17, 17, 17, 0.8)',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  glassGradient: 'linear(to-br, rgba(255,215,0,0.05), transparent)',
};

interface SignMessageDialogProps {
  onSignMessage: (message: string, selectedAddress?: string) => Promise<{ address: string; signature: string }>;
  isLoading?: boolean;
  addresses?: Array<{ address: string; path: string; scriptType?: string }>;
  showAddressSelector?: boolean;
}

export function SignMessageDialog({
  onSignMessage,
  isLoading = false,
  addresses = [],
  showAddressSelector = false
}: SignMessageDialogProps) {
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState<{ address: string; signature: string } | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'address' | 'signature' | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  const handleSign = async () => {
    if (!message.trim()) {
      setError('Please enter a message to sign');
      return;
    }

    if (showAddressSelector && !selectedAddress) {
      setError('Please select an address to sign with');
      return;
    }

    try {
      setSigning(true);
      setError(null);
      const result = await onSignMessage(message, selectedAddress);
      setSignature(result);
    } catch (err: any) {
      console.error('Error signing message:', err);
      setError(err?.message || 'Failed to sign message');
    } finally {
      setSigning(false);
    }
  };

  const handleCopy = async (text: string, field: 'address' | 'signature') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleReset = () => {
    setMessage('');
    setSignature(null);
    setError(null);
    setSelectedAddress('');
  };

  const handleOpenChange = (details: { open: boolean }) => {
    setOpen(details.open);
    if (!details.open) {
      // Reset state when closing
      handleReset();
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
    >
      <DialogTrigger asChild>
        <Button
          leftIcon={<FaPen />}
          variant="outline"
          borderColor={theme.gold}
          color={theme.gold}
          _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
          size="sm"
        >
          Sign Message
        </Button>
      </DialogTrigger>

      <DialogContent
        bg={theme.cardBg}
        borderRadius="xl"
        borderWidth="1px"
        borderColor="rgba(255, 215, 0, 0.3)"
        backdropFilter="blur(20px)"
        maxW="600px"
      >
        <DialogHeader>
          <DialogTitle color={theme.gold} fontSize="24px" fontWeight="bold">
            Sign Message
          </DialogTitle>
          <DialogCloseTrigger color="gray.400" _hover={{ color: theme.gold }} />
        </DialogHeader>

        <DialogBody>
          <VStack gap={6} align="stretch">
            {!signature ? (
              <>
                {/* Address Selector - Only show if addresses provided */}
                {showAddressSelector && addresses.length > 0 && (
                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Select address to sign with:
                    </Text>
                    <Box
                      as="select"
                      value={selectedAddress}
                      onChange={(e: any) => setSelectedAddress(e.target.value)}
                      bg="rgba(0, 0, 0, 0.3)"
                      borderColor={theme.border}
                      borderWidth="1px"
                      borderRadius="md"
                      color="white"
                      p={2}
                      fontSize="sm"
                      fontFamily="mono"
                      width="100%"
                      cursor="pointer"
                      _hover={{
                        borderColor: theme.gold
                      }}
                    >
                      <option value="" style={{ background: '#000000' }}>
                        -- Select Address --
                      </option>
                      {addresses.map((addr, index) => (
                        <option
                          key={`addr-${index}-${addr.address}`}
                          value={addr.address}
                          style={{ background: '#000000' }}
                        >
                          {addr.address} ({addr.path})
                        </option>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Message Input */}
                <Box>
                  <Text color="gray.400" fontSize="sm" mb={2}>
                    Enter message to sign:
                  </Text>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={6}
                    bg="rgba(0, 0, 0, 0.3)"
                    borderColor={theme.border}
                    color="white"
                    _focus={{ borderColor: theme.gold }}
                    fontSize="sm"
                    fontFamily="mono"
                  />
                  <Text color="gray.500" fontSize="xs" mt={1}>
                    This message will be signed with your Bitcoin address
                  </Text>
                </Box>

                {/* Error Message */}
                {error && (
                  <MotionBox
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    bg="rgba(255, 69, 0, 0.1)"
                    borderRadius="md"
                    p={3}
                    borderWidth="1px"
                    borderColor="rgba(255, 69, 0, 0.3)"
                  >
                    <Text color="orange.300" fontSize="sm">
                      ⚠️ {error}
                    </Text>
                  </MotionBox>
                )}

                {/* Warning */}
                <Box
                  bg="rgba(255, 215, 0, 0.05)"
                  borderRadius="md"
                  p={3}
                  borderWidth="1px"
                  borderColor="rgba(255, 215, 0, 0.2)"
                >
                  <HStack spacing={3} align="flex-start">
                    <Text fontSize="20px" flexShrink={0}>🔐</Text>
                    <Text color="gray.300" fontSize="xs" lineHeight="1.5">
                      You will need to confirm this action on your KeepKey device. The message will be signed using the currently selected address.
                    </Text>
                  </HStack>
                </Box>
              </>
            ) : (
              <>
                {/* Success Message */}
                <MotionBox
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  bg="rgba(0, 255, 0, 0.05)"
                  borderRadius="md"
                  p={3}
                  borderWidth="1px"
                  borderColor="rgba(0, 255, 0, 0.2)"
                  textAlign="center"
                >
                  <Text color="green.300" fontSize="sm" fontWeight="bold">
                    ✅ Message Signed Successfully!
                  </Text>
                </MotionBox>

                {/* Original Message */}
                <Box>
                  <Text color="gray.400" fontSize="sm" mb={2}>
                    Original Message:
                  </Text>
                  <Box
                    bg="rgba(0, 0, 0, 0.3)"
                    p={3}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={theme.border}
                  >
                    <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                      {message}
                    </Text>
                  </Box>
                </Box>

                {/* Address */}
                <Box>
                  <Text color="gray.400" fontSize="sm" mb={2}>
                    Signed with Address:
                  </Text>
                  <Box
                    bg="rgba(0, 0, 0, 0.3)"
                    p={3}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={theme.border}
                    position="relative"
                  >
                    <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all" pr={10}>
                      {signature.address}
                    </Text>
                    <Box position="absolute" top={2} right={2}>
                      <IconButton
                        aria-label="Copy address"
                        onClick={() => handleCopy(signature.address, 'address')}
                        size="sm"
                        colorScheme={copiedField === 'address' ? "green" : "gray"}
                        variant="ghost"
                      >
                        {copiedField === 'address' ? <FaCheck /> : <FaCopy />}
                      </IconButton>
                    </Box>
                  </Box>
                </Box>

                {/* Signature */}
                <Box>
                  <Text color="gray.400" fontSize="sm" mb={2}>
                    Signature:
                  </Text>
                  <Box
                    bg="rgba(0, 0, 0, 0.3)"
                    p={3}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={theme.border}
                    position="relative"
                  >
                    <Text color="white" fontSize="xs" fontFamily="mono" wordBreak="break-all" pr={10}>
                      {signature.signature}
                    </Text>
                    <Box position="absolute" top={2} right={2}>
                      <IconButton
                        aria-label="Copy signature"
                        onClick={() => handleCopy(signature.signature, 'signature')}
                        size="sm"
                        colorScheme={copiedField === 'signature' ? "green" : "gray"}
                        variant="ghost"
                      >
                        {copiedField === 'signature' ? <FaCheck /> : <FaCopy />}
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter>
          {!signature ? (
            <HStack width="100%" gap={3}>
              <Button
                onClick={() => setOpen(false)}
                variant="outline"
                borderColor={theme.border}
                color="gray.400"
                _hover={{ bg: 'rgba(255, 255, 255, 0.05)' }}
                flex={1}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSign}
                isLoading={signing}
                loadingText="Signing..."
                bg={theme.gold}
                color="black"
                _hover={{ bg: theme.goldHover }}
                fontWeight="bold"
                isDisabled={
                  !message.trim() ||
                  signing ||
                  isLoading ||
                  (showAddressSelector && !selectedAddress)
                }
                flex={1}
              >
                Sign with KeepKey
              </Button>
            </HStack>
          ) : (
            <HStack width="100%" gap={3}>
              <Button
                onClick={handleReset}
                variant="outline"
                borderColor={theme.border}
                color="gray.400"
                _hover={{ bg: 'rgba(255, 255, 255, 0.05)' }}
                flex={1}
              >
                Sign Another
              </Button>
              <Button
                onClick={() => setOpen(false)}
                bg={theme.gold}
                color="black"
                _hover={{ bg: theme.goldHover }}
                fontWeight="bold"
                flex={1}
              >
                Done
              </Button>
            </HStack>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

export default SignMessageDialog;
