'use client'

import React, { useEffect, useState } from 'react';
import { Box, Stack, HStack, VStack, Text, Button, Image, Link } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FaCheckCircle, FaExternalLinkAlt } from 'react-icons/fa';
import Confetti from 'react-confetti';

interface SwapSuccessProps {
  txid: string;
  fromAsset: any;
  toAsset: any;
  inputAmount: string;
  outputAmount: string;
  outboundAssetContext?: any;
  onClose: () => void;
}

export const SwapSuccess = ({
  txid,
  fromAsset,
  toAsset,
  inputAmount,
  outputAmount,
  outboundAssetContext,
  onClose
}: SwapSuccessProps) => {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Build explorer link
  const explorerLink = outboundAssetContext?.explorerTxLink 
    ? `${outboundAssetContext.explorerTxLink}${txid}`
    : null;

  // Format transaction ID for display (show first and last characters)
  const formatTxid = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const pulseAnimation = keyframes`
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
    100% { transform: scale(1); opacity: 1; }
  `;

  return (
    <Box position="relative" width="full" minH="100vh">
      {/* Confetti animation - centered in viewport */}
      {showConfetti && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          pointerEvents="none"
          zIndex={9999}
        >
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={200}
            gravity={0.1}
            colors={['#10B981', '#059669', '#047857', '#065F46', '#064E3B']}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
        </Box>
      )}

      <VStack gap={8} width="full" align="center" py={8} position="relative">
        {/* Success Icon */}
        <Box position="relative">
          <Box
            as={FaCheckCircle}
            color="green.400"
            fontSize="80px"
            animation={`${pulseAnimation} 2s infinite`}
          />
        </Box>

        {/* Success Title */}
        <VStack gap={2}>
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Swap Successful!
          </Text>
          <Text fontSize="md" color="gray.400">
            Your transaction has been broadcasted
          </Text>
        </VStack>

        {/* Swap Summary */}
        <Box 
          bg="gray.800" 
          borderRadius="xl" 
          p={6} 
          width="full"
          borderWidth="1px"
          borderColor="gray.700"
        >
          <HStack justify="center" align="center" gap={4}>
            {/* From */}
            <HStack gap={2}>
              <Image src={fromAsset?.icon} alt={fromAsset?.name} boxSize="24px" />
              <Text fontSize="lg" fontWeight="semibold" color="gray.400">
                {inputAmount} {fromAsset?.symbol}
              </Text>
            </HStack>

            {/* Arrow */}
            <Box color="green.400" fontSize="xl">
              →
            </Box>

            {/* To */}
            <HStack gap={2}>
              <Image src={toAsset?.icon} alt={toAsset?.name} boxSize="24px" />
              <Text fontSize="lg" fontWeight="semibold" color="green.400">
                {outputAmount} {toAsset?.symbol}
              </Text>
            </HStack>
          </HStack>
        </Box>

        {/* Transaction ID */}
        <VStack gap={3} width="full">
          <Text fontSize="sm" color="gray.500">
            Transaction ID
          </Text>
          <Box 
            bg="gray.900" 
            borderRadius="lg" 
            p={3} 
            width="full"
            borderWidth="1px"
            borderColor="gray.700"
          >
            <HStack justify="center" gap={2}>
              <Text fontSize="sm" fontFamily="mono" color="white">
                {formatTxid(txid)}
              </Text>
              {explorerLink && (
                <Link
                  href={explorerLink}
                  isExternal
                  color="blue.400"
                  _hover={{ color: 'blue.300' }}
                >
                  <FaExternalLinkAlt size="14" />
                </Link>
              )}
            </HStack>
          </Box>
        </VStack>

        {/* View on Explorer Button */}
        {explorerLink && (
          <Link href={explorerLink} isExternal width="full">
            <Button
              variant="outline"
              colorScheme="blue"
              width="full"
              height="48px"
              borderRadius="xl"
              rightIcon={<FaExternalLinkAlt />}
            >
              View on {outboundAssetContext?.explorer?.replace('https://', '').split('.')[0] || 'Explorer'}
            </Button>
          </Link>
        )}

        {/* Done Button */}
        <Button
          size="lg"
          bg="gray.700"
          color="white"
          _hover={{ bg: 'gray.600' }}
          onClick={onClose}
          width="full"
          height="48px"
          borderRadius="xl"
          fontWeight="semibold"
        >
          Done
        </Button>

        {/* Additional Info */}
        <Text fontSize="xs" color="gray.500" textAlign="center" px={4}>
          It may take a few minutes for your transaction to be confirmed on the blockchain
        </Text>
      </VStack>
    </Box>
  );
};