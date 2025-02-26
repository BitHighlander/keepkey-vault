'use client'

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Stack, 
  Flex,
} from '@chakra-ui/react';
import { Skeleton, SkeletonCircle } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { usePioneerContext } from '@/components/providers/pioneer';
import QRCode from 'qrcode';
import { FaArrowLeft, FaCopy } from 'react-icons/fa';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface ReceiveProps {
  onBackClick?: () => void;
}

interface Pubkey {
  address?: string;
  master?: string;
  note: string;
  pathMaster: string;
  networks: string[];
}

export function Receive({ onBackClick }: ReceiveProps) {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedPubkey, setSelectedPubkey] = useState<Pubkey | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Use the Pioneer context to get asset context
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const assetContext = app?.assetContext;

  // Fetch asset context and pubkeys
  useEffect(() => {
    // Skip if no asset context
    if (!assetContext) return;
    
    setLoading(true);
    
    try {
      const availablePubkeys = (assetContext.pubkeys || []) as Pubkey[];
      console.log('📊 [Receive] Available pubkeys:', availablePubkeys);
      
      // Set initial pubkey and address
      if (availablePubkeys.length > 0) {
        const initialPubkey = availablePubkeys[0];
        const initialAddress = initialPubkey.address || initialPubkey.master || '';
        setSelectedPubkey(initialPubkey);
        setSelectedAddress(initialAddress);
        generateQrCode(initialAddress);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ [Receive] Error initializing pubkeys:', error);
      setLoading(false);
    }
  }, [assetContext]);

  // Handle address change
  const handleAddressChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const address = event.target.value;
    
    // Find the pubkey that matches the selected address
    if (assetContext?.pubkeys) {
      const result = assetContext.pubkeys.find((pubkey: Pubkey) => 
        (pubkey.address || pubkey.master) === address
      );
      
      if (result) {
        setSelectedPubkey(result as Pubkey);
      }
    }
    
    setSelectedAddress(address);
    generateQrCode(address);
  };

  // Copy to clipboard function
  const copyToClipboard = () => {
    if (selectedAddress) {
      navigator.clipboard.writeText(selectedAddress)
        .then(() => {
          setHasCopied(true);
          // Create a toast notification (simplified implementation)
          console.log('📋 [Receive] Address copied to clipboard');
          
          // Reset copied state after 2 seconds
          setTimeout(() => setHasCopied(false), 2000);
        })
        .catch(err => {
          console.error('❌ [Receive] Error copying to clipboard:', err);
        });
    }
  };

  // Generate QR code 
  const generateQrCode = (text: string) => {
    QRCode.toDataURL(
      text, 
      { 
        width: 150, 
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, 
      (error, url) => {
        if (error) {
          console.error('❌ [Receive] Error generating QR code:', error);
          return;
        }
        setQrCodeDataUrl(url);
      }
    );
  };

  // Handle back button click
  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    }
  };

  // Format address with ellipsis for display
  const formatWithEllipsis = (text: string, maxLength: number = 16) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    const charsToShow = Math.floor(maxLength / 2);
    return `${text.substring(0, charsToShow)}...${text.substring(text.length - charsToShow)}`;
  };

  // Loading state
  if (loading) {
    return (
      <Box height="600px" bg={theme.bg} width="100%">
        {/* Header */}
        <Box 
          borderBottom="1px" 
          borderColor={theme.border}
          p={4}
          bg={theme.cardBg}
        >
          <Flex justify="space-between" align="center">
            <Button
              size="sm"
              variant="ghost"
              color={theme.gold}
              onClick={handleBack}
              _hover={{ color: theme.goldHover }}
            >
              <Flex align="center" gap={2}>
                <FaArrowLeft />
                Back
              </Flex>
            </Button>
            <Text color={theme.gold} fontWeight="bold">
              Receive {assetContext?.name || 'Asset'}
            </Text>
            <Box w="20px"></Box> {/* Spacer for alignment */}
          </Flex>
        </Box>
        
        <Box p={6}>
          <Stack gap={4}>
            <SkeletonCircle size="150px" mx="auto" />
            <Skeleton height="40px" width="100%" />
            <Skeleton height="60px" width="100%" />
            <Skeleton height="40px" width="80%" mx="auto" />
          </Stack>
        </Box>
      </Box>
    );
  }

  // No asset context or pubkeys
  if (!assetContext || !assetContext.pubkeys || assetContext.pubkeys.length === 0) {
    return (
      <Box height="600px" bg={theme.bg} width="100%">
        {/* Header */}
        <Box 
          borderBottom="1px" 
          borderColor={theme.border}
          p={4}
          bg={theme.cardBg}
        >
          <Flex justify="space-between" align="center">
            <Button
              size="sm"
              variant="ghost"
              color={theme.gold}
              onClick={handleBack}
              _hover={{ color: theme.goldHover }}
            >
              <Flex align="center" gap={2}>
                <FaArrowLeft />
                Back
              </Flex>
            </Button>
            <Text color={theme.gold} fontWeight="bold">
              Receive {assetContext?.name || 'Asset'}
            </Text>
            <Box w="20px"></Box> {/* Spacer for alignment */}
          </Flex>
        </Box>
        
        <Stack direction="column" justify="center" align="center" height="calc(100% - 60px)" p={6} gap={4}>
          <Text color="white" textAlign="center">
            No addresses available for this asset
          </Text>
          <Button
            mt={4}
            color={theme.gold}
            variant="outline"
            borderColor={theme.border}
            onClick={handleBack}
            _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
          >
            Go Back
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box height="600px" bg={theme.bg} width="100%">
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
      >
        <Flex justify="space-between" align="center">
          <Button
            size="sm"
            variant="ghost"
            color={theme.gold}
            onClick={handleBack}
            _hover={{ color: theme.goldHover }}
          >
            <Flex align="center" gap={2}>
              <FaArrowLeft />
              Back
            </Flex>
          </Button>
          <Text color={theme.gold} fontWeight="bold">
            Receive {assetContext?.name || 'Asset'}
          </Text>
          <Box w="20px"></Box> {/* Spacer for alignment */}
        </Flex>
      </Box>

      <Stack direction="column" gap={6} align="center" p={6}>
        {/* Avatar and Title */}
        <Avatar 
          size="xl" 
          src={assetContext.icon} 
          bg={theme.cardBg}
          p={2}
          borderWidth="1px"
          borderColor={theme.border}
          borderRadius="full"
        />
        
        <Text fontSize="xl" fontWeight="bold" color="white" textAlign="center">
          Receive {assetContext.name}
        </Text>

        {/* Network Badge - replacing with a styled Box */}
        <Box 
          bg="blue.800" 
          color="blue.200" 
          fontSize="md" 
          p={2} 
          borderRadius="md"
        >
          {formatWithEllipsis(assetContext.networkId || '', 20)}
        </Box>

        {/* Address Selection - replacing Card with Box */}
        <Box bg={theme.cardBg} borderColor={theme.border} borderWidth="1px" width="100%" borderRadius="md" p={4}>
          <Stack direction="column" gap={4} align="stretch">
            <Text fontWeight="bold" color="white">Select Address</Text>
            
            {/* Replace Select with a styled Box + styled native select */}
            <Box position="relative">
              <select
                value={selectedAddress}
                onChange={handleAddressChange}
                style={{
                  backgroundColor: theme.cardBg,
                  color: 'white',
                  borderColor: theme.border,
                  borderWidth: '1px',
                  borderRadius: '0.375rem',
                  padding: '0.5rem',
                  width: '100%',
                }}
              >
                {assetContext.pubkeys.map((pubkey: Pubkey) => {
                  const address = pubkey.address || pubkey.master || '';
                  return (
                    <option key={address} value={address}>
                      {pubkey.note || formatWithEllipsis(address)}
                    </option>
                  );
                })}
              </select>
            </Box>
          </Stack>
        </Box>

        {/* QR Code */}
        <Box
          bg="white"
          p={4}
          borderRadius="md"
          boxSize="180px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {qrCodeDataUrl ? (
            <Box as="div">
              <img src={qrCodeDataUrl} alt="QR Code" />
            </Box>
          ) : (
            <SkeletonCircle size="150px" />
          )}
        </Box>

        {/* Address */}
        <Box bg={theme.cardBg} borderColor={theme.border} borderWidth="1px" width="100%" borderRadius="md" p={4}>
          <Stack direction="column" gap={2}>
            <Text color="gray.400" fontSize="sm">Address</Text>
            <Text color="white" fontFamily="mono" fontSize="sm" wordBreak="break-all">
              {selectedAddress}
            </Text>
          </Stack>
        </Box>

        {/* Copy Button */}
        <Button
          width="100%"
          bg={hasCopied ? 'green.700' : theme.gold}
          color={hasCopied ? 'green.100' : 'black'}
          _hover={{
            bg: hasCopied ? 'green.600' : theme.goldHover,
          }}
          onClick={copyToClipboard}
        >
          <Flex align="center" gap={2}>
            <FaCopy />
            <Text>{hasCopied ? 'Copied!' : 'Copy Address'}</Text>
          </Flex>
        </Button>
      </Stack>
    </Box>
  );
}

export default Receive; 