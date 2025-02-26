'use client'

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Stack, 
  Flex,
  Badge,
} from '@chakra-ui/react';
import { createDisclosure } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { Skeleton, SkeletonCircle } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { usePioneerContext } from '@/components/providers/pioneer';
import QRCode from 'qrcode';
import { FaArrowLeft, FaCopy, FaCheck, FaWallet } from 'react-icons/fa';
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
  const { open, onOpen, onClose } = createDisclosure();

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
            <SkeletonCircle size="150px" mx="auto" startColor="gray.700" endColor="gray.900" speed={1.2} />
            <Skeleton height="40px" width="100%" startColor="gray.700" endColor="gray.900" speed={1.2} />
            <Skeleton height="60px" width="100%" startColor="gray.700" endColor="gray.900" speed={1.2} />
            <Skeleton height="40px" width="80%" mx="auto" startColor="gray.700" endColor="gray.900" speed={1.2} />
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
    <MotionBox 
      height="100vh" 
      bg={theme.bg} 
      width="100%"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={4}
        bg={theme.cardBg}
        backdropFilter="blur(10px)"
      >
        <Flex justify="space-between" align="center">
          <MotionBox whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}>
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
          </MotionBox>
          <Text color={theme.gold} fontWeight="bold">
            Receive {assetContext?.name || 'Asset'}
          </Text>
          <Box w="20px"></Box> {/* Spacer for alignment */}
        </Flex>
      </Box>

      <Stack direction="column" gap={6} align="center" p={6}>
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
            sx={{
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '-4px',
                left: '-4px',
                right: '-4px',
                bottom: '-4px',
                borderRadius: 'full',
                border: '1px solid',
                borderColor: 'rgba(255, 215, 0, 0.3)',
                animation: `${pulseRing} 2s infinite`
              }
            }}
          />
          
          {/* Network Badge positioned over avatar */}
          <Badge
            position="absolute"
            bottom="-10px"
            right="-10px"
            bg="blue.800"
            color="blue.200"
            borderRadius="full"
            boxShadow="dark-lg"
            px={2}
            py={1}
          >
            {assetContext.networkId?.split('/')[0]?.split(':')[1] || ''}
          </Badge>
        </Box>
        
        <MotionBox
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Text fontSize="xl" fontWeight="bold" color="white" textAlign="center">
            Receive {assetContext.name}
          </Text>
        </MotionBox>

        {/* Network Badge - replacing with a styled Box */}
        <MotionBox 
          bg="blue.800" 
          color="blue.200" 
          fontSize="md" 
          p={2} 
          borderRadius="md"
          boxShadow="0px 4px 12px rgba(0, 0, 0, 0.3)"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {formatWithEllipsis(assetContext.networkId || '', 20)}
        </MotionBox>

        {/* Address Selection - replacing Card with Box */}
        <MotionBox 
          bg="rgba(17, 17, 17, 0.7)"
          backdropFilter="blur(10px)"
          borderColor="rgba(255, 215, 0, 0.2)"
          borderWidth="1px"
          width="100%"
          borderRadius="lg"
          p={4}
          boxShadow="0 8px 32px rgba(0, 0, 0, 0.2)"
          overflow="hidden"
          position="relative"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Stack direction="column" gap={4} align="stretch">
            <FormControl>
              <FormLabel fontWeight="bold" color="white">Select Address</FormLabel>
              
              {/* Replace Select with a styled Box + styled native select */}
              <Box 
                position="relative"
                _after={{
                  content: '""',
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `5px solid ${theme.gold}`,
                  pointerEvents: 'none'
                }}
              >
                <select
                  value={selectedAddress}
                  onChange={handleAddressChange}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    color: 'white',
                    borderColor: theme.border,
                    borderWidth: '1px',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    width: '100%',
                    appearance: 'none',
                    transition: 'all 0.2s',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)'
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
            </FormControl>
          </Stack>
          
          {/* Subtle gradient overlay */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bgGradient={theme.glassGradient}
            pointerEvents="none"
            zIndex="-1"
          />
        </MotionBox>

        {/* QR Code */}
        <MotionBox
          bg="white"
          p={4}
          borderRadius="md"
          boxSize="180px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          boxShadow="0 10px 25px rgba(0, 0, 0, 0.4)"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
        >
          {qrCodeDataUrl ? (
            <Box as="div">
              <img src={qrCodeDataUrl} alt="QR Code" />
            </Box>
          ) : (
            <SkeletonCircle size="150px" />
          )}
        </MotionBox>

        {/* Address */}
        <MotionBox 
          bg="rgba(17, 17, 17, 0.7)"
          backdropFilter="blur(10px)"
          borderColor="rgba(255, 215, 0, 0.2)"
          borderWidth="1px"
          width="100%"
          borderRadius="lg"
          p={4}
          boxShadow="0 8px 32px rgba(0, 0, 0, 0.2)"
          overflow="hidden"
          position="relative"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Stack direction="column" gap={2}>
            <Text color="gray.400" fontSize="sm">Address</Text>
            <Text color="white" fontFamily="mono" fontSize="sm" wordBreak="break-all">
              {selectedAddress}
            </Text>
          </Stack>
          
          {/* Subtle gradient overlay */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bgGradient={theme.glassGradient}
            pointerEvents="none"
            zIndex="-1"
          />
        </MotionBox>

        {/* Copy Button */}
        <MotionBox
          width="100%"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            width="100%"
            bg={hasCopied ? 'green.700' : theme.gold}
            color={hasCopied ? 'green.100' : 'black'}
            _hover={{
              bg: hasCopied ? 'green.600' : theme.goldHover,
              boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)'
            }}
            _active={{
              bg: hasCopied ? 'green.800' : 'orange.400',
            }}
            height="50px"
            fontSize="md"
            onClick={copyToClipboard}
            boxShadow="0 4px 10px rgba(0, 0, 0, 0.2)"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              background: 'linear-gradient(45deg, transparent 65%, rgba(255,255,255,0.2) 70%, transparent 75%)',
              backgroundSize: '200% 200%',
              backgroundPosition: '100% 100%',
              transition: 'all 0.6s ease',
            }}
            _hover={{
              _before: {
                backgroundPosition: '0 0',
              }
            }}
          >
            <Flex align="center" gap={2}>
              {hasCopied ? <FaCheck /> : <FaCopy />}
              <Text>{hasCopied ? 'Copied!' : 'Copy Address'}</Text>
            </Flex>
          </Button>
        </MotionBox>
      </Stack>
    </MotionBox>
  );
}

export default Receive; 