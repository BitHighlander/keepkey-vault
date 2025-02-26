'use client'

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Stack, 
  Flex,
  Spinner,
  Avatar,
  Badge,
  Card,
  CardBody,
  Divider,
  Select,
} from '@chakra-ui/react';
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
      <Box height="600px" bg={theme.bg}>
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
        
        <Spinner 
          position="absolute" 
          top="50%" 
          left="50%" 
          transform="translate(-50%, -50%)" 
          color={theme.gold}
          size="xl"
        />
      </Box>
    );
  }

  // No asset context or pubkeys
  if (!assetContext || !assetContext.pubkeys || assetContext.pubkeys.length === 0) {
    return (
      <Box height="600px" bg={theme.bg}>
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
    <Box height="600px" bg={theme.bg}>
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
            Receive {assetContext.name}
          </Text>
          <Box w="20px"></Box> {/* Spacer for alignment */}
        </Flex>
      </Box>

      {/* Main Content */}
      <Box 
        height="calc(100% - 60px)" 
        overflowY="auto" 
        p={4}
      >
        <Stack direction="column" gap={6} align="center">
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

          {/* Network Badge */}
          <Badge 
            bg="blue.800" 
            color="blue.200" 
            fontSize="md" 
            p={2} 
            borderRadius="md"
          >
            {formatWithEllipsis(assetContext.networkId || '', 20)}
          </Badge>

          {/* Address Selection Card */}
          <Card bg={theme.cardBg} borderColor={theme.border} borderWidth="1px" width="100%">
            <CardBody>
              <Stack direction="column" gap={4} align="stretch">
                <Text fontWeight="bold" fontSize="sm" color="blue.200">
                  SELECT ADDRESS
                </Text>
                
                <Select
                  value={selectedAddress}
                  onChange={handleAddressChange}
                  fontSize="sm"
                  fontFamily="mono"
                  bg="rgba(0,0,0,0.3)"
                  color="white"
                  borderColor={theme.border}
                  _hover={{ borderColor: theme.goldHover }}
                >
                  {assetContext.pubkeys.map((pubkey: Pubkey, index: number) => {
                    const address = pubkey.address || pubkey.master || '';
                    if (!address) return null;
                    return (
                      <option key={index} value={address} style={{ background: '#2D3748' }}>
                        {formatWithEllipsis(address, 30)}
                      </option>
                    );
                  })}
                </Select>

                {selectedPubkey && (
                  <>
                    <Divider borderColor="gray.700" opacity={0.2} />
                    
                    <Box>
                      <Text fontSize="sm" color="blue.200" mb={1} fontWeight="bold">
                        ADDRESS TYPE
                      </Text>
                      <Text fontSize="sm" fontWeight="medium" color="white">
                        {selectedPubkey.note}
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text fontSize="sm" color="blue.200" mb={1} fontWeight="bold">
                        DERIVATION PATH
                      </Text>
                      <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="white">
                        {selectedPubkey.pathMaster}
                      </Text>
                    </Box>
                  </>
                )}
              </Stack>
            </CardBody>
          </Card>

          {/* QR Code and Address Display */}
          {selectedAddress && (
            <Card bg={theme.cardBg} borderColor={theme.border} borderWidth="1px" width="100%">
              <CardBody>
                <Stack direction="column" gap={4}>
                  {qrCodeDataUrl ? (
                    <Box p={4} bg="white" borderRadius="md">
                      <img src={qrCodeDataUrl} alt="QR Code" style={{ margin: 'auto' }} />
                    </Box>
                  ) : (
                    <Spinner color={theme.gold} />
                  )}

                  <Box width="100%">
                    <Text fontSize="sm" color="blue.200" mb={1} fontWeight="bold">
                      ADDRESS
                    </Text>
                    <Text wordBreak="break-all" fontSize="sm" fontFamily="mono" color="white">
                      {selectedAddress}
                    </Text>
                  </Box>

                  <Button 
                    width="full" 
                    bg={theme.cardBg}
                    color={theme.gold}
                    borderColor={theme.border}
                    borderWidth="1px"
                    onClick={copyToClipboard}
                    _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                  >
                    <Flex align="center" gap={2}>
                      <FaCopy />
                      {hasCopied ? 'Copied!' : 'Copy Address'}
                    </Flex>
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export default Receive; 