'use client'

import React, { useState } from 'react';
import { Box, Stack, HStack, VStack, Text, Button, Image } from '@chakra-ui/react';
import { FaArrowDown, FaShieldAlt } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';

interface SwapConfirmProps {
  fromAsset: any;
  toAsset: any;
  inputAmount: string;
  outputAmount: string;
  quote: any;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  fromAddress?: string;
  outboundAssetContext?: any;
  inputUsdValue?: string;
  outputUsdValue?: string;
}

export const SwapConfirm = ({
  fromAsset,
  toAsset,
  inputAmount,
  outputAmount,
  quote,
  onConfirm,
  onCancel,
  isLoading = false,
  fromAddress,
  outboundAssetContext,
  inputUsdValue,
  outputUsdValue
}: SwapConfirmProps) => {
  const { state } = usePioneerContext();
  const app = state?.app;
  const [isVerifying, setIsVerifying] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleVerifyAddress = async () => {
    if (!app || !outboundAssetContext) {
      setVerificationError('No address context available');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      console.log('🔐 Verifying address on device...');
      
      // Get the address and show it on device for verification
      await app.getAddress({
        networkId: outboundAssetContext.networkId,
        showDevice: true
      });
      
      setAddressVerified(true);
      console.log('✅ Address verified on device');
    } catch (error: any) {
      console.error('❌ Address verification failed:', error);
      setVerificationError(error?.message || 'Failed to verify address on device');
    } finally {
      setIsVerifying(false);
    }
  };
  return (
    <VStack gap={8} width="full" align="stretch">
      {/* Title */}
      <Text fontSize="lg" fontWeight="medium" color="gray.400" textAlign="center">
        Confirm your swap
      </Text>

      {/* One-line swap summary */}
      <HStack justify="center" align="center" gap={4} py={4}>
        {/* From */}
        <HStack gap={2}>
          <Image src={fromAsset?.icon} alt={fromAsset?.name} boxSize="28px" />
          <Text fontSize="2xl" fontWeight="bold" color="white">
            {inputAmount}
          </Text>
          <Text fontSize="xl" color="gray.400">
            {fromAsset?.symbol}
          </Text>
        </HStack>

        {/* Arrow */}
        <Box color="gray.500" px={2}>
          →
        </Box>

        {/* To */}
        <HStack gap={2}>
          <Image src={toAsset?.icon} alt={toAsset?.name} boxSize="28px" />
          <Text fontSize="2xl" fontWeight="bold" color="green.400">
            {outputAmount}
          </Text>
          <Text fontSize="xl" color="gray.400">
            {toAsset?.symbol}
          </Text>
        </HStack>
      </HStack>



      {/* Destination Address */}
      {outboundAssetContext && (
        <VStack gap={3} align="center">
          <HStack justify="center">
            <Text fontSize="sm" color="gray.500">
              To: {outboundAssetContext.address || outboundAssetContext.master}
            </Text>
          </HStack>
          
          {/* Address Verification Section */}
          <VStack gap={2} align="center">
            {verificationError && (
              <Text fontSize="sm" color="red.400">
                {verificationError}
              </Text>
            )}
            
            {addressVerified ? (
              <HStack gap={2} color="green.400">
                <FaShieldAlt />
                <Text fontSize="sm" fontWeight="medium">
                  Address verified on device
                </Text>
              </HStack>
            ) : (
              <Button
                size="sm"
                variant="outline"
                colorScheme="blue"
                leftIcon={<FaShieldAlt />}
                onClick={handleVerifyAddress}
                isLoading={isVerifying}
                loadingText="Verifying..."
                isDisabled={!outboundAssetContext?.address && !outboundAssetContext?.master}
              >
                Verify Address on Device
              </Button>
            )}
          </VStack>
        </VStack>
      )}

      {/* Action Buttons */}
      <VStack gap={3} pt={4}>
        <Button
          size="lg"
          bg="blue.500"
          color="white"
          _hover={{ bg: 'blue.600' }}
          _active={{ bg: 'blue.700' }}
          onClick={onConfirm}
          width="full"
          height="56px"
          borderRadius="xl"
          fontSize="lg"
          fontWeight="semibold"
          isLoading={isLoading}
          loadingText="Confirming..."
          isDisabled={isLoading || (outboundAssetContext && !addressVerified)}
        >
          {outboundAssetContext && !addressVerified ? 'Verify Address First' : 'Confirm Swap'}
        </Button>
        
        <Button
          variant="ghost"
          color="gray.500"
          _hover={{ bg: 'gray.800' }}
          onClick={onCancel}
          width="full"
          height="48px"
          fontSize="md"
          isDisabled={isLoading}
        >
          Cancel
        </Button>
      </VStack>
    </VStack>
  );
};