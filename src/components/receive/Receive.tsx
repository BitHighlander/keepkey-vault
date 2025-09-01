'use client'

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Stack, 
  Flex,
  Badge,
  VStack,
  Image,
  IconButton
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { Skeleton, SkeletonCircle } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { usePioneerContext } from '@/components/providers/pioneer';
import QRCode from 'qrcode';
import { FaArrowLeft, FaCopy, FaCheck, FaWallet, FaChevronDown, FaEye } from 'react-icons/fa';
import { motion } from 'framer-motion';

// Define animation keyframes
const pulseRing = keyframes`
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.3);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(255, 215, 0, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
  }
`;

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: 'rgba(17, 17, 17, 0.8)', // Slightly transparent for glassmorphism
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  glassGradient: 'linear(to-br, rgba(255,215,0,0.05), transparent)',
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

const MotionFlex = motion(Flex);
const MotionBox = motion(Box);
const MotionAvatar = motion(Avatar);

export function Receive({ onBackClick }: ReceiveProps) {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedPubkey, setSelectedPubkey] = useState<Pubkey | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addressIndices, setAddressIndices] = useState<{changeIndex: number, receiveIndex: number} | null>(null);
  const [viewingOnDevice, setViewingOnDevice] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);

  // Use the Pioneer context to get asset context
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const assetContext = app?.assetContext;

  // Effect to handle scrolling issue when advanced details are shown/hidden
  useEffect(() => {
    if (showAdvanced) {
      // Small delay to ensure content has rendered
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [showAdvanced]);

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

  // Handle view on device - this is a security verification step
  const handleViewOnDevice = async () => {
    if (!selectedPubkey || !pioneer.api) return;
    
    try {
      setViewingOnDevice(true);
      console.log('👁️ [Receive] Viewing on device for verification...');
      
      // Get the xpub from the selected pubkey
      const xpub = selectedPubkey.master || selectedPubkey.address;
      
      // First get the address indices
      const addressInfo = await pioneer.api.GetChangeAddress({
        network: assetContext.symbol || 'BTC',
        xpub
      });
      
      console.log('📊 [Receive] Address indices:', addressInfo);
      
      if (addressInfo?.data) {
        setAddressIndices({
          changeIndex: addressInfo.data.changeIndex || 0,
          receiveIndex: addressInfo.data.receiveIndex || 0
        });
      }
      
      // Now display the address on the device for verification
      // This is the critical security step - user must verify the address shown on device
      const verifyResult = await pioneer.api.getAddress({
        addressNList: selectedPubkey.pathMaster ? 
          selectedPubkey.pathMaster.split('/').map(p => parseInt(p.replace("'", ""))) : 
          [44, 0, 0, 0, 0], // Default path if not specified
        coin: assetContext.symbol || 'BTC',
        showDisplay: true // CRITICAL: This shows the address on the device screen
      });
      
      console.log('✅ [Receive] Address verified on device:', verifyResult);
      
    } catch (error) {
      console.error('❌ [Receive] Error viewing on device:', error);
    } finally {
      setViewingOnDevice(false);
    }
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
        width: 170, 
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
      <Box height="100vh" bg={theme.bg} width="100%">
        {/* Header */}
        <Box 
          borderBottom="1px" 
          borderColor={theme.border}
          p={4}
          bg={theme.cardBg}
          backdropFilter="blur(10px)"
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
        
        <MotionBox 
          p={6}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Stack gap={4}>
            <SkeletonCircle size="150px" mx="auto" />
            <Skeleton height="40px" width="100%" />
            <Skeleton height="60px" width="100%" />
            <Skeleton height="40px" width="80%" mx="auto" />
          </Stack>
        </MotionBox>
      </Box>
    );
  }

  // No asset context or pubkeys
  if (!assetContext || !assetContext.pubkeys || assetContext.pubkeys.length === 0) {
    return (
      <Box height="100vh" bg={theme.bg} width="100%">
        {/* Header */}
        <Box 
          borderBottom="1px" 
          borderColor={theme.border}
          p={4}
          bg={theme.cardBg}
          backdropFilter="blur(10px)"
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
        
        <MotionFlex 
          direction="column" 
          justify="center" 
          align="center" 
          height="calc(100% - 60px)" 
          p={6} gap={4}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <MotionBox
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <Avatar 
              size="xl" 
              icon={<FaWallet size="2em" />}
              bg={theme.cardBg}
              p={2}
              borderWidth="2px"
              borderColor={theme.gold}
              borderRadius="full"
              opacity={0.7}
            />
          </MotionBox>
          
          <Text color="white" textAlign="center" fontSize="lg" mt={4}>
            No addresses available for this asset
          </Text>
          
          <MotionBox
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
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
          </MotionBox>
        </MotionFlex>
      </Box>
    );
  }

  return (
    <Box 
      width="100%" 
      position="relative"
      pb={8}
    >
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
        position="sticky"
        top={0}
        zIndex={10}
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
              <Text>Back</Text>
            </Flex>
          </Button>
          <Text color={theme.gold} fontWeight="bold">
            Receive {assetContext.name}
          </Text>
          <Box w="20px"></Box> {/* Spacer for alignment */}
        </Flex>
      </Box>

      {/* Main content - Scrollable */}
      <Box
        p={6}
        width="100%"
      >
        <Box 
          width="100%" 
          display="flex"
          flexDirection="column"
          alignItems="center"
        >
          {/* Avatar and Title */}
          <Box position="relative">
            <MotionAvatar 
              size="xl" 
              src={assetContext.icon} 
              bg={theme.cardBg}
              p={2}
              borderWidth="3px"
              borderColor={theme.gold}
              borderRadius="full"
              icon={<FaWallet size="2em" />}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20
              }}
              style={{
                position: 'relative',
                zIndex: 1
              }}
            />
            
            {/* Add the pulse ring effect as a separate element */}
            <Box
              position="absolute"
              top="-4px"
              left="-4px"
              right="-4px"
              bottom="-4px"
              borderRadius="full"
              border="1px solid"
              borderColor="rgba(255, 215, 0, 0.3)"
              animation={`${pulseRing} 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite`}
            />
          </Box>
          
          <Text fontSize="lg" fontWeight="bold" color="white" mt={4} textAlign="center">
            {assetContext.name} ({assetContext.symbol})
          </Text>
          
          <Badge 
            colorScheme="orange" 
            variant="solid" 
            bg={theme.gold} 
            color="black" 
            mt={2} 
            mb={4}
            px={3} 
            py={1} 
            borderRadius="full"
          >
            {assetContext.networkName || assetContext.networkId?.split(':').pop() || 'Network'}
          </Badge>
          
          {/* Pubkey Selector */}
          <Box width="100%" maxW="sm" mt={4}>
            <Text color="gray.400" fontSize="sm" mb={2}>Select Bitcoin Address</Text>
            <select
              value={selectedAddress}
              onChange={handleAddressChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
                borderWidth: '1px',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {assetContext.pubkeys?.map((pubkey: Pubkey) => {
                const address = pubkey.address || pubkey.master || '';
                return (
                  <option key={address} value={address} style={{ background: '#111', color: 'white' }}>
                    {pubkey.note || 'Bitcoin Address'} - {formatWithEllipsis(address, 20)}
                  </option>
                );
              })}
            </select>
          </Box>

          {/* View on Device Button */}
          <MotionBox
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            mt={4}
          >
            <Button
              onClick={handleViewOnDevice}
              isLoading={viewingOnDevice}
              loadingText="Viewing on Device..."
              leftIcon={<FaEye />}
              bg={theme.gold}
              color="black"
              _hover={{ bg: theme.goldHover }}
              size="lg"
              px={8}
              fontWeight="bold"
            >
              View on Device
            </Button>
          </MotionBox>
          
          {/* Display indices if available */}
          {addressIndices && (
            <Box mt={2} textAlign="center">
              <Text color="gray.400" fontSize="xs">
                Change Index: {addressIndices.changeIndex} | Receive Index: {addressIndices.receiveIndex}
              </Text>
            </Box>
          )}

          {/* QR Code Section */}
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            mt={6}
            mb={6}
          >
            <Box
              bg={theme.cardBg}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={theme.border}
              overflow="hidden"
              p={6}
              width="100%"
              maxW="sm"
              boxShadow="lg"
              backdropFilter="blur(10px)"
              bgGradient={theme.glassGradient}
            >
              <VStack gap={4} align="center">
                {/* QR Code */}
                <Box
                  bg="white"
                  p={4}
                  borderRadius="xl"
                  width="200px"
                  height="200px"
                  position="relative"
                >
                  {qrCodeDataUrl ? (
                    <Image src={qrCodeDataUrl} alt="QR Code" width="100%" height="100%" />
                  ) : (
                    <Skeleton width="100%" height="100%" />
                  )}
                </Box>
                
                {/* Address */}
                <VStack width="100%" gap={2}>
                  <Text color="gray.400" fontSize="sm">Address</Text>
                  <Box 
                    bg="rgba(0, 0, 0, 0.3)" 
                    p={3}
                    borderRadius="md"
                    width="100%"
                    position="relative"
                    borderWidth="1px"
                    borderColor={theme.border}
                  >
                    <Text 
                      color="white" 
                      fontSize="sm" 
                      fontFamily="mono" 
                      wordBreak="break-all"
                    >
                      {selectedAddress}
                    </Text>
                    
                    <Box position="absolute" top={2} right={2}>
                      <MotionBox
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <IconButton
                          aria-label="Copy address"
                          onClick={copyToClipboard}
                          size="sm"
                          colorScheme={hasCopied ? "green" : "gray"}
                          variant="ghost"
                        >
                          {hasCopied ? <FaCheck /> : <FaCopy />}
                        </IconButton>
                      </MotionBox>
                    </Box>
                  </Box>
                </VStack>
              </VStack>
            </Box>
          </MotionBox>
                  
          {/* Show/Hide Details */}
          <Button
            variant="ghost"
            size="sm"
            mt={4}
            color={theme.gold}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Flex align="center" gap={2}>
              <Text>{showAdvanced ? "Hide Details" : "Show Details"}</Text>
              <Box transform={showAdvanced ? "rotate(180deg)" : "rotate(0deg)"}>
                <FaChevronDown />
              </Box>
            </Flex>
          </Button>
          
          {/* Advanced Details Section */}
          {showAdvanced && (
            <MotionBox
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              overflow="hidden"
              width="100%"
              maxW="sm"
              mt={4}
            >
              <Box
                bg={theme.cardBg}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={theme.border}
                overflow="hidden"
                p={6}
                boxShadow="lg"
                backdropFilter="blur(10px)"
                bgGradient={theme.glassGradient}
              >
                <VStack gap={4} align="stretch">
                  {selectedPubkey && (
                    <>
                      {/* Path */}
                      <Box>
                        <Text color="gray.400" fontSize="sm" mb={1}>Derivation Path</Text>
                        <Text color="white" fontSize="sm" fontFamily="mono">
                          {selectedPubkey.pathMaster || 'Unknown'}
                        </Text>
                      </Box>
                      
                      {/* Network Info */}
                      <Box>
                        <Text color="gray.400" fontSize="sm" mb={1}>Network ID</Text>
                        <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                          {assetContext.networkId}
                        </Text>
                      </Box>
                      
                      {/* Asset Info */}
                      <Box>
                        <Text color="gray.400" fontSize="sm" mb={1}>Asset ID</Text>
                        <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                          {assetContext.assetId}
                        </Text>
                      </Box>
                      
                      {/* Note */}
                      {selectedPubkey.note && (
                        <Box>
                          <Text color="gray.400" fontSize="sm" mb={1}>Note</Text>
                          <Text color="white" fontSize="sm">
                            {selectedPubkey.note}
                          </Text>
                        </Box>
                      )}
                    </>
                  )}
                </VStack>
              </Box>
            </MotionBox>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default Receive; 