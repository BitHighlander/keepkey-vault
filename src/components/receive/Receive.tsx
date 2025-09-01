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
import { getAndVerifyAddress } from '@/utils/keepkeyAddress';

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
  scriptType?: string;
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
  const [loadingIndices, setLoadingIndices] = useState(false);

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
      
      // Set initial pubkey but DON'T set address or generate QR until verified
      if (availablePubkeys.length > 0) {
        // For Bitcoin, prefer Segwit addresses
        let initialPubkey = availablePubkeys[0];
        
        // Check if this is Bitcoin (BTC or similar)
        const isBitcoin = assetContext.symbol === 'BTC' || 
                         assetContext.name?.toLowerCase().includes('bitcoin') ||
                         assetContext.networkId === 'bip122:000000000019d6689c085ae165831e93';
        
        if (isBitcoin) {
          // Find Native Segwit pubkey (Bech32 - bc1 addresses)
          // Native Segwit uses BIP84 (m/84'/0'/0') and p2wpkh script type
          const nativeSegwitPubkey = availablePubkeys.find(pk => 
            (pk.note?.toLowerCase().includes('native') && pk.note?.toLowerCase().includes('segwit')) ||
            pk.note?.toLowerCase() === 'segwit native' ||
            (pk.pathMaster?.includes("84'") && pk.scriptType === 'p2wpkh') ||
            pk.scriptType === 'p2wpkh'
          );
          
          if (nativeSegwitPubkey) {
            console.log('🔐 [Receive] Defaulting to Native Segwit (Bech32) address for Bitcoin');
            initialPubkey = nativeSegwitPubkey;
          } else {
            // Fallback to any Segwit if Native not found
            const anySegwitPubkey = availablePubkeys.find(pk => 
              pk.note?.toLowerCase().includes('segwit') || 
              pk.pathMaster?.includes("84'") ||
              pk.pathMaster?.includes("49'") // P2SH-Segwit
            );
            
            if (anySegwitPubkey) {
              console.log('⚠️ [Receive] Native Segwit not found, using Segwit address');
              initialPubkey = anySegwitPubkey;
            } else {
              console.log('⚠️ [Receive] No Segwit address found, using first available');
            }
          }
        }
        
        setSelectedPubkey(initialPubkey);
        // DO NOT set address or generate QR code until verified on device!
        
        // Get initial indices for the first pubkey
        if (pioneer.api) {
          setLoadingIndices(true);
          const xpub = initialPubkey.master || initialPubkey.address;
          pioneer.api.GetChangeAddress({
            network: assetContext.symbol || 'BTC',
            xpub
          }).then(addressInfo => {
            console.log('📊 [Receive] Initial indices:', addressInfo);
            if (addressInfo?.data) {
              setAddressIndices({
                changeIndex: addressInfo.data.changeIndex || 0,
                receiveIndex: addressInfo.data.receiveIndex || 0
              });
            } else {
              // Use defaults if no data
              setAddressIndices({ changeIndex: 0, receiveIndex: 0 });
            }
            setLoadingIndices(false);
          }).catch(error => {
            console.error('❌ [Receive] Error getting initial indices:', error);
            setAddressIndices({ changeIndex: 0, receiveIndex: 0 });
            setLoadingIndices(false);
          });
        } else {
          // No API, use defaults
          setAddressIndices({ changeIndex: 0, receiveIndex: 0 });
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ [Receive] Error initializing pubkeys:', error);
      setLoading(false);
    }
  }, [assetContext]);

  // Handle pubkey selection change - DO NOT show address yet!
  const handlePubkeyChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const pubkeyPath = event.target.value;
    
    // Find the pubkey that matches the selected path
    if (assetContext?.pubkeys) {
      const result = assetContext.pubkeys.find((pubkey: Pubkey) => 
        pubkey.pathMaster === pubkeyPath
      );
      
      if (result) {
        setSelectedPubkey(result as Pubkey);
        // Reset verification state when changing selection
        setAddressVerified(false);
        setSelectedAddress('');
        setQrCodeDataUrl(null);
        
        // Get the indices for this xpub from Pioneer
        if (pioneer.api) {
          setLoadingIndices(true);
          try {
            const xpub = result.master || result.address;
            console.log('🔍 [Receive] Getting indices for xpub:', xpub);
            
            const addressInfo = await pioneer.api.GetChangeAddress({
              network: assetContext.symbol || 'BTC',
              xpub
            });
            
            console.log('📊 [Receive] Address indices received:', addressInfo);
            
            if (addressInfo?.data) {
              setAddressIndices({
                changeIndex: addressInfo.data.changeIndex || 0,
                receiveIndex: addressInfo.data.receiveIndex || 0
              });
            } else {
              // If no data, use defaults
              setAddressIndices({ changeIndex: 0, receiveIndex: 0 });
            }
          } catch (error) {
            console.error('❌ [Receive] Error getting indices:', error);
            // Use defaults on error
            setAddressIndices({ changeIndex: 0, receiveIndex: 0 });
          } finally {
            setLoadingIndices(false);
          }
        } else {
          // No pioneer API, use defaults
          setAddressIndices({ changeIndex: 0, receiveIndex: 0 });
        }
      }
    }
  };

  // Handle view on device - this is a security verification step
  const handleViewOnDevice = async () => {
    if (!selectedPubkey || !app?.keepKeySdk) return;
    
    try {
      setViewingOnDevice(true);
      console.log('👁️ [Receive] Viewing on device for verification...');
      console.log('📊 [Receive] Using indices - Change:', addressIndices?.changeIndex, 'Receive:', addressIndices?.receiveIndex);
      console.log('🔐 [Receive] Network ID:', assetContext.networkId);
      console.log('📝 [Receive] Script Type:', assetContext.scriptType);
      
      // Use the KeepKey SDK directly to get and display the address
      const deviceAddress = await getAndVerifyAddress({
        keepKeySdk: app.keepKeySdk,
        networkId: assetContext.networkId,
        pathMaster: selectedPubkey.pathMaster,
        scriptType: selectedPubkey.scriptType || assetContext.scriptType,
        receiveIndex: addressIndices?.receiveIndex || 0,
        showDisplay: true // CRITICAL: This shows the address on the device screen
      });
      
      console.log('✅ [Receive] Address from device:', deviceAddress);
      
      // Optionally verify against the expected address if we have one
      const expectedAddress = selectedPubkey.address || selectedPubkey.master;
      if (expectedAddress && deviceAddress !== expectedAddress) {
        console.warn('⚠️ [Receive] Address mismatch!', {
          device: deviceAddress,
          expected: expectedAddress
        });
        // You might want to show an error to the user here
        // For now, we'll use the device address as the source of truth
      }
      
      // NOW it's safe to show the address after device verification
      setSelectedAddress(deviceAddress);
      generateQrCode(deviceAddress);
      setAddressVerified(true);
      
    } catch (error) {
      console.error('❌ [Receive] Error viewing on device:', error);
      setAddressVerified(false);
      // Optionally show error message to user
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
          
          {/* Pubkey Selector - Shows path only, NOT address */}
          <Box width="100%" maxW="sm" mt={4}>
            <Text color="gray.400" fontSize="sm" mb={2}>Select Address Path</Text>
            <select
              value={selectedPubkey?.pathMaster || ''}
              onChange={handlePubkeyChange}
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
              {(() => {
                // Sort pubkeys to show Segwit first for Bitcoin
                let sortedPubkeys = assetContext.pubkeys || [];
                
                const isBitcoin = assetContext.symbol === 'BTC' || 
                                assetContext.name?.toLowerCase().includes('bitcoin') ||
                                assetContext.networkId === 'bip122:000000000019d6689c085ae165831e93';
                
                if (isBitcoin && sortedPubkeys.length > 0) {
                  // Sort to put Native Segwit first, then other Segwit, then Legacy
                  sortedPubkeys = [...sortedPubkeys].sort((a: Pubkey, b: Pubkey) => {
                    // Check for Native Segwit (Bech32)
                    const aIsNativeSegwit = (a.note?.toLowerCase().includes('native') && a.note?.toLowerCase().includes('segwit')) ||
                                           a.note?.toLowerCase() === 'segwit native' ||
                                           (a.pathMaster?.includes("84'") && a.scriptType === 'p2wpkh') ||
                                           a.scriptType === 'p2wpkh';
                    const bIsNativeSegwit = (b.note?.toLowerCase().includes('native') && b.note?.toLowerCase().includes('segwit')) ||
                                           b.note?.toLowerCase() === 'segwit native' ||
                                           (b.pathMaster?.includes("84'") && b.scriptType === 'p2wpkh') ||
                                           b.scriptType === 'p2wpkh';
                    
                    // Check for P2SH-Segwit (wrapped Segwit)
                    const aIsP2SHSegwit = a.pathMaster?.includes("49'") || 
                                         (a.note?.toLowerCase().includes('segwit') && !aIsNativeSegwit);
                    const bIsP2SHSegwit = b.pathMaster?.includes("49'") || 
                                         (b.note?.toLowerCase().includes('segwit') && !bIsNativeSegwit);
                    
                    // Native Segwit comes first
                    if (aIsNativeSegwit && !bIsNativeSegwit) return -1;
                    if (!aIsNativeSegwit && bIsNativeSegwit) return 1;
                    
                    // Then P2SH-Segwit
                    if (aIsP2SHSegwit && !bIsP2SHSegwit) return -1;
                    if (!aIsP2SHSegwit && bIsP2SHSegwit) return 1;
                    
                    return 0;
                  });
                }
                
                return sortedPubkeys.map((pubkey: Pubkey) => {
                  // Check address type for labeling
                  const isNativeSegwit = (pubkey.note?.toLowerCase().includes('native') && pubkey.note?.toLowerCase().includes('segwit')) ||
                                        pubkey.note?.toLowerCase() === 'segwit native' ||
                                        (pubkey.pathMaster?.includes("84'") && pubkey.scriptType === 'p2wpkh') ||
                                        pubkey.scriptType === 'p2wpkh';
                  
                  const isP2SHSegwit = pubkey.pathMaster?.includes("49'") || 
                                      (pubkey.note?.toLowerCase().includes('segwit') && !isNativeSegwit);
                  
                  let label = pubkey.note || 'Bitcoin';
                  
                  // Add appropriate labels for Bitcoin addresses
                  if (isBitcoin) {
                    if (isNativeSegwit) {
                      label = `${label} (Recommended - Lowest Fees)`;
                    } else if (isP2SHSegwit) {
                      label = `${label} (Compatible Segwit)`;
                    } else {
                      label = `${label} (Legacy - Higher Fees)`;
                    }
                  }
                  
                  label = `${label} - Path: ${pubkey.pathMaster}`;
                  
                  return (
                    <option key={pubkey.pathMaster} value={pubkey.pathMaster} style={{ background: '#111', color: 'white' }}>
                      {label}
                    </option>
                  );
                });
              })()}
            </select>
          </Box>

          {/* Display indices when available */}
          {(loadingIndices || addressIndices) && (
            <Box 
              mt={3} 
              p={3} 
              bg="rgba(255, 215, 0, 0.05)" 
              borderRadius="md" 
              borderWidth="1px" 
              borderColor={theme.border}
              width="100%"
              maxW="sm"
            >
              {loadingIndices ? (
                <Flex justify="center" align="center" height="40px">
                  <Text color="gray.400" fontSize="sm">Loading indices...</Text>
                </Flex>
              ) : addressIndices ? (
                <Flex justify="space-around" align="center">
                  <VStack spacing={0}>
                    <Text color="gray.400" fontSize="xs">Change Index</Text>
                    <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                      {addressIndices.changeIndex}
                    </Text>
                  </VStack>
                  <Box width="1px" height="40px" bg={theme.border} />
                  <VStack spacing={0}>
                    <Text color="gray.400" fontSize="xs">Receive Index</Text>
                    <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                      {addressIndices.receiveIndex}
                    </Text>
                  </VStack>
                </Flex>
              ) : null}
            </Box>
          )}

          {/* QR Code Section - ONLY SHOW AFTER VERIFICATION */}
          {addressVerified ? (
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
                  {/* Success Badge */}
                  <Badge 
                    colorScheme="green" 
                    variant="solid" 
                    px={3} 
                    py={1} 
                    borderRadius="full"
                  >
                    ✅ Address Verified on Device
                  </Badge>
                  
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
                    <Text color="gray.400" fontSize="sm">Verified Address</Text>
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
          ) : (
            /* Show placeholder when address not verified */
            <Box
              mt={6}
              mb={6}
              p={8}
              bg={theme.cardBg}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={theme.border}
              width="100%"
              maxW="sm"
              textAlign="center"
              opacity={0.7}
            >
              <VStack gap={4}>
                <Box fontSize="48px">🔒</Box>
                <Text color={theme.gold} fontWeight="bold" fontSize="lg">
                  Address Not Yet Verified
                </Text>
                <Text color="gray.400" fontSize="sm">
                  Please select an address path above and click "View on Device" to verify the address on your KeepKey before receiving funds.
                </Text>
                <Text color="orange.400" fontSize="xs" fontStyle="italic">
                  ⚠️ Never receive funds without verifying the address on your device first!
                </Text>
              </VStack>
            </Box>
          )}
          
          {/* View on Device Button - At the bottom with eye icon */}
          <MotionBox
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            mt={6}
            width="100%"
            maxW="sm"
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
              width="100%"
              fontWeight="bold"
              isDisabled={!selectedPubkey || loadingIndices || !addressIndices}
            >
              <Flex align="center" gap={2}>
                <FaEye />
                <Text>View on Device</Text>
              </Flex>
            </Button>
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