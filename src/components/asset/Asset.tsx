'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Stack,
  Button,
  Image,
  VStack,
  HStack,
  IconButton,
} from '@chakra-ui/react';
import { usePioneerContext } from '@/components/providers/pioneer';
import { FaTimes } from 'react-icons/fa';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

export const Asset = () => {
  const [activeTab, setActiveTab] = useState<'send' | 'receive' | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const { app, handleViewTransition } = usePioneerContext();
  const assetContext = app?.assetContext;

  // Add component mount/unmount logging
  useEffect(() => {
    console.log('🎯 [Asset] Component mounted with context:', assetContext);
    return () => {
      console.log('👋 [Asset] Component unmounting');
    };
  }, [assetContext]);

  const handleTransition = async () => {
    if (isClearing) return; // Prevent multiple transitions
    
    try {
      console.log('🔄 [Asset] Starting view transition to dashboard');
      setIsClearing(true);
      await handleViewTransition('dashboard');
      console.log('✅ [Asset] View transition complete');
    } catch (error) {
      console.error('❌ [Asset] Error during transition:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleBack = () => {
    console.log('🔙 [Asset] Back button clicked');
    handleTransition();
  };

  const handleClose = () => {
    console.log('❌ [Asset] Close button clicked');
    handleTransition();
  };

  if (!assetContext) {
    console.log('❌ [Asset] AssetContext is null or undefined');
    return null;
  }

  const formatBalance = (balance: string | number) => {
    const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
    return numBalance.toFixed(8);
  };

  return (
    <Box height="600px" bg={theme.bg}>
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
      >
        <HStack justify="space-between" align="center">
          <Button
            size="sm"
            variant="ghost"
            color={theme.gold}
            onClick={handleBack}
            _hover={{ color: theme.goldHover }}
          >
            ← Back
          </Button>
          <Text fontSize="lg" fontWeight="bold" color={theme.gold}>
            {assetContext.name}
          </Text>
          <IconButton
            aria-label="Close"
            size="sm"
            variant="ghost"
            color={theme.gold}
            onClick={handleClose}
            _hover={{ color: theme.goldHover }}
          >
            <FaTimes />
          </IconButton>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box 
        height="calc(100% - 60px)" 
        overflowY="auto" 
        overflowX="hidden"
        p={4}
      >
        <VStack gap={6} align="stretch">
          {/* Asset Info Card */}
          <Box 
            bg={theme.cardBg} 
            p={6} 
            borderRadius="2xl" 
            boxShadow="lg"
            border="1px solid"
            borderColor={theme.border}
          >
            <VStack align="center" gap={4}>
              <Box 
                borderRadius="full" 
                overflow="hidden" 
                boxSize="80px"
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
                <Text fontSize="2xl" fontWeight="bold" color="white">
                  {assetContext.name}
                </Text>
                <Text fontSize="md" color="gray.400">
                  {assetContext.symbol}
                </Text>
                <Text fontSize="3xl" fontWeight="bold" color={theme.gold}>
                  ${assetContext.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text fontSize="md" color="white">
                  {formatBalance(assetContext.balance)} {assetContext.symbol}
                </Text>
              </Stack>
            </VStack>
          </Box>

          {/* Action Buttons */}
          <VStack gap={3}>
            <Button
              width="100%"
              size="lg"
              bg={theme.cardBg}
              color={theme.gold}
              borderColor={theme.border}
              borderWidth="1px"
              _hover={{
                bg: 'rgba(255, 215, 0, 0.1)',
                borderColor: theme.gold,
              }}
              onClick={() => setActiveTab('send')}
            >
              Send
            </Button>
            <Button
              width="100%"
              size="lg"
              bg={theme.cardBg}
              color={theme.gold}
              borderColor={theme.border}
              borderWidth="1px"
              _hover={{
                bg: 'rgba(255, 215, 0, 0.1)',
                borderColor: theme.gold,
              }}
              onClick={() => setActiveTab('receive')}
            >
              Receive
            </Button>
          </VStack>

          {/* Asset Details Section */}
          <Box 
            bg={theme.cardBg}
            borderRadius="2xl"
            overflow="hidden"
            borderColor={theme.border}
            borderWidth="1px"
          >
            <Box p={4} borderBottom="1px" borderColor={theme.border}>
              <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                Asset Details
              </Text>
            </Box>
            
            <VStack align="stretch" p={4} gap={4}>
              {/* Network Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Network Information
                </Text>
                <HStack justify="space-between">
                  <Text color="gray.400">Network</Text>
                  <Text color="white">{assetContext.networkName || assetContext.networkId?.split(':').pop()}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Chain ID</Text>
                  <Text color="white" fontSize="sm" fontFamily="mono">
                    {assetContext.chainId}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Asset ID</Text>
                  <Text color="white" fontSize="sm" fontFamily="mono">
                    {assetContext.assetId}
                  </Text>
                </HStack>
              </VStack>

              {/* Asset Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Asset Information
                </Text>
                <HStack justify="space-between">
                  <Text color="gray.400">Type</Text>
                  <Text color="white">
                    {assetContext.networkId?.includes('eip155') ? 'Token' : 'Native Asset'}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Precision</Text>
                  <Text color="white">{assetContext.precision}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Price</Text>
                  <Text color="white">
                    ${assetContext.priceUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </HStack>
              </VStack>

              {/* Address Info */}
              {assetContext.pubkeys?.[0] && (
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Wallet Information
                  </Text>
                  <VStack align="stretch" gap={2}>
                    <Text color="gray.400" fontSize="sm">Address</Text>
                    <Box 
                      p={3}
                      bg={theme.bg}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                        {assetContext.pubkeys[0].address}
                      </Text>
                    </Box>
                    <HStack justify="space-between" mt={1}>
                      <Text color="gray.400" fontSize="xs">Path</Text>
                      <Text color="white" fontSize="xs" fontFamily="mono">
                        {assetContext.pubkeys[0].path}
                      </Text>
                    </HStack>
                  </VStack>
                </VStack>
              )}

              {/* Explorer Links */}
              {assetContext.explorer && (
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Explorer Links
                  </Text>
                  <HStack gap={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      color={theme.gold}
                      borderColor={theme.border}
                      _hover={{
                        bg: 'rgba(255, 215, 0, 0.1)',
                        borderColor: theme.gold,
                      }}
                      onClick={() => window.open(assetContext.explorer, '_blank')}
                      flex="1"
                    >
                      View Explorer
                    </Button>
                    {assetContext.pubkeys?.[0] && (
                      <Button
                        size="sm"
                        variant="outline"
                        color={theme.gold}
                        borderColor={theme.border}
                        _hover={{
                          bg: 'rgba(255, 215, 0, 0.1)',
                          borderColor: theme.gold,
                        }}
                        onClick={() => window.open(`${assetContext.explorerAddressLink}${assetContext.pubkeys[0].address}`, '_blank')}
                        flex="1"
                      >
                        View Address
                      </Button>
                    )}
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
};

export default Asset; 