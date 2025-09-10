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
  Spinner,
  useDisclosure,
  Icon,
  Badge,
} from '@chakra-ui/react';

// Add sound effect imports
const chachingSound = typeof Audio !== 'undefined' ? new Audio('/sounds/chaching.mp3') : null;

// Play sound utility function
const playSound = (sound: HTMLAudioElement | null) => {
  if (sound) {
    sound.currentTime = 0; // Reset to start
    sound.play().catch(err => console.error('Error playing sound:', err));
  }
};

import { usePioneerContext } from '@/components/providers/pioneer';
import { FaTimes, FaChevronDown, FaChevronUp, FaPaperPlane, FaQrcode, FaExchangeAlt } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';
import { CosmosStaking } from './CosmosStaking';
import { isFeatureEnabled } from '@/config/features';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface AssetProps {
  onBackClick?: () => void;
  onSendClick?: () => void;
  onReceiveClick?: () => void;
  onSwapClick?: () => void;
}

export const Asset = ({ onBackClick, onSendClick, onReceiveClick, onSwapClick }: AssetProps) => {
  // State for managing the component's loading status
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  // Add state for tracking expanded/collapsed state of asset details
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  // Add state to track previous balance for comparison
  const [previousBalance, setPreviousBalance] = useState<string>('0');
  // Add flag to track if this is the initial load to prevent sound on first balance set
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [pubkeys, setPubkeys] = useState<any>([])
  const [balances, setBalances] = useState<any>([])

  // Access pioneer context in the same way as the Dashboard component
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const assetContext = app?.assetContext;
  
  const router = useRouter();

  // Add component mount/unmount logging and handle loading state
  useEffect(() => {
    console.log('🎯 [Asset] Component mounted with context:', assetContext);
    // Check if asset context is already available
    if (assetContext) {


      //get all pubkeys for networkId
      const pubkeys = app.pubkeys.filter((pubkey: any) =>
          pubkey.networks.some((n: string) => n.includes('cosmos:cosmoshub') || n.includes('cosmos:osmosis'))
      );
      console.log('[Asset component] pubkeys:', pubkeys)

      //get all balances for networkId
      const balances = app.balances.find((balance:any) => balance.caip === assetContext.caip);
      console.log('[Asset component] balances: ', balances)
      // Sort by USD value (highest first) and show ALL balances
      const sortedBalances = balances
          .sort((a: any, b: any) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));
      console.log('[Asset component] sortedBalances: ', sortedBalances)

      //



      console.log('✅ [Asset] AssetContext already available on mount');
      // Initialize previousBalance when asset context is available
      if (assetContext.balance) {
        setPreviousBalance(assetContext.balance);
        // Mark as no longer initial load after first balance is set
        setIsInitialLoad(false);
      }
      setLoading(false);
      return;
    }
    
    // Set a timeout to wait for assetContext to be populated
    let checkCount = 0;
    const maxChecks = 10;
    
    const checkAssetContext = () => {
      // Re-access the latest context values
      const currentApp = pioneer?.state?.app;
      const currentAssetContext = currentApp?.assetContext;
      if (currentAssetContext) {
        console.log('✅ [Asset] AssetContext became available on check', checkCount);
        setLoading(false);
        return true;
      }
      checkCount++;
      if (checkCount >= maxChecks) {
        setLoading(false);
        return true;
      }
      return false;
    };
    
    // Immediately check once
    if (checkAssetContext()) return;
    
    // Then set up an interval for repeated checks
    const timer = setInterval(() => {
      if (checkAssetContext()) {
        clearInterval(timer);
      }
    }, 500); // Check every 500ms
    
    return () => {
      console.log('👋 [Asset] Component unmounting');
      clearInterval(timer);
    };
  }, [app, assetContext, pioneer]);

  // Set up interval to sync market data every 15 seconds
  useEffect(() => {
    if (!app) return;
    
    // Initialize previousBalance when component mounts
    if (app.assetContext?.balance) {
      setPreviousBalance(app.assetContext.balance);
      // Mark as no longer initial load after first balance is set
      setIsInitialLoad(false);
    }
    
    const intervalId = setInterval(() => {
      app
        .syncMarket()
        .then(() => {
          console.log("📊 [Asset] syncMarket called from Asset component");
          
          // Check if balance has increased
          if (app.assetContext?.balance) {
            const currentBalance = app.assetContext.balance;
            const prevBalance = previousBalance;
            
            console.log("💰 [Asset] Balance comparison:", { 
              previous: prevBalance, 
              current: currentBalance,
              increased: parseFloat(currentBalance) > parseFloat(prevBalance),
              isInitialLoad
            });
            // Update previous balance for next comparison
            setPreviousBalance(currentBalance);
          }
          setLastSync(Date.now());
        })
        .catch((error: any) => {
          console.error("❌ [Asset] Error in syncMarket:", error);
        });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [app, previousBalance, isInitialLoad]);

  const handleBack = () => {
    if (onBackClick) {
      // Use the provided onBackClick handler if available
      console.log('🔙 [Asset] Using custom back handler');
      onBackClick();
    } else {
      // Default behavior - navigate to dashboard
      console.log('🔙 [Asset] Back button clicked, navigating to dashboard');
      router.push('/');
    }
  };

  const handleClose = () => {
    // Close button always goes to dashboard regardless of back button behavior
    console.log('❌ [Asset] Close button clicked, navigating to dashboard');
    router.push('/');
  };

  // Add a utility function for middle ellipsis
  const middleEllipsis = (text: string, visibleChars = 16) => {
    if (!text) return '';
    if (text.length <= visibleChars) return text;
    
    const charsToShow = Math.floor(visibleChars / 2);
    return `${text.substring(0, charsToShow)}...${text.substring(text.length - charsToShow)}`;
  };

  // Toggle details expanded/collapsed state
  const toggleDetails = () => {
    setIsDetailsExpanded(!isDetailsExpanded);
  };

  if (loading) {
    // Show loading state while waiting for context
    return (
      <Box 
        height="600px" 
        bg={theme.bg} 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        flexDirection="column"
        width="100%" 
        mx="auto"
      >
        <Spinner color={theme.gold} size="xl" mb={4} />
        <Text color="gray.400">Loading asset data...</Text>
      </Box>
    );
  }

  if (!assetContext) {
    console.log('❌ [Asset] AssetContext is null or undefined');
    console.log('❌ [Asset] This may indicate an issue with the context provider or URL parameters');
    
    // Show a user-friendly error message with a back button
    return (
      <Box height="600px" bg={theme.bg} width="100%" mx="auto">
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
              <Text>Back</Text>
            </Button>
          </HStack>
        </Box>
        
        <Box 
          p={8} 
          textAlign="center" 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center"
          height="400px"
        >
          <Box 
            w="80px" 
            h="80px" 
            borderRadius="full" 
            bg="rgba(254, 215, 226, 0.1)" 
            display="flex" 
            alignItems="center" 
            justifyContent="center"
            mb={4}
          >
            <FaTimes color="#FC8181" size="32px" />
          </Box>
          
          <Text fontSize="xl" fontWeight="bold" color="white" mb={2}>
            Asset Data Not Found
          </Text>
          
          <Text color="gray.400" maxWidth="sm" mb={6}>
            We couldn't load the asset data. This could be due to an invalid URL or a connection issue.
          </Text>
          
          <Button
            variant="outline"
            color={theme.gold}
            borderColor={theme.gold}
            onClick={handleBack}
          >
            Return to Previous Page
          </Button>
        </Box>
      </Box>
    );
  }

  const formatBalance = (balance: string | number) => {
    const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
    return numBalance.toFixed(8);
  };

  // Calculate the USD value
  const usdValue = (assetContext.value !== undefined && assetContext.value !== null) 
    ? assetContext.value 
    : (assetContext.balance && assetContext.priceUsd) 
      ? parseFloat(assetContext.balance) * assetContext.priceUsd 
      : 0;

  // Calculate the price
  const priceUsd = assetContext.priceUsd || 0;

  return (
    <Box 
      width="100%" 
      position="relative"
      pb={8} // Add bottom padding to ensure content doesn't get cut off
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
        <HStack justify="space-between" align="center">
          <Button
            size="sm"
            variant="ghost"
            color={theme.gold}
            onClick={handleBack}
            _hover={{ color: theme.goldHover }}
          >
            <Text>Back</Text>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color={theme.gold}
            onClick={handleClose}
            _hover={{ color: theme.goldHover }}
          >
            <Text>Close</Text>
          </Button>
        </HStack>
      </Box>
      
      <Box p={6}>
        <Flex
          direction={{ base: 'column', lg: isDetailsExpanded ? 'row' : 'column' }}
          gap={6}
          align="flex-start"
        >
          {/* Main Content - Left Side when expanded */}
          <VStack 
            gap={6} 
            align="stretch" 
            flex={{ base: '1', lg: isDetailsExpanded ? '1' : 'initial' }}
            width={{ base: '100%', lg: isDetailsExpanded ? 'auto' : '100%' }}
            maxW={{ base: '100%', lg: isDetailsExpanded ? '500px' : '100%' }}
            mx={{ base: 'auto', lg: isDetailsExpanded ? '0' : 'auto' }}
          >
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
                {/* Compound Avatar for Tokens */}
                {assetContext.isToken ? (
                  <Box position="relative">
                    {/* Main Network Icon */}
                    <Box 
                      borderRadius="full" 
                      overflow="hidden" 
                      boxSize="80px"
                      bg={theme.cardBg}
                      boxShadow="lg"
                      p={2}
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      {/* Get network icon based on networkId */}
                      <Image 
                        src={(() => {
                          // Map networkId to network icon
                          const networkId = assetContext.networkId;
                          if (networkId.includes('mayachain')) return 'https://pioneers.dev/coins/maya.png';
                          if (networkId.includes('thorchain')) return 'https://pioneers.dev/coins/thorchain.png';
                          if (networkId.includes('osmosis')) return 'https://pioneers.dev/coins/osmosis.png';
                          if (networkId.includes('eip155:1')) return 'https://pioneers.dev/coins/ethereum.png';
                          if (networkId.includes('eip155:137')) return 'https://pioneers.dev/coins/polygon.png';
                          if (networkId.includes('eip155:43114')) return 'https://pioneers.dev/coins/avalanche.png';
                          if (networkId.includes('eip155:56')) return 'https://pioneers.dev/coins/binance.png';
                          if (networkId.includes('eip155:8453')) return 'https://pioneers.dev/coins/base.png';
                          if (networkId.includes('eip155:10')) return 'https://pioneers.dev/coins/optimism.png';
                          if (networkId.includes('eip155:42161')) return 'https://pioneers.dev/coins/arbitrum.png';
                          // Default network icon
                          return 'https://pioneers.dev/coins/pioneer.png';
                        })()}
                        alt="Network Icon"
                        boxSize="100%"
                        objectFit="contain"
                      />
                    </Box>
                    
                    {/* Token Icon as smaller overlay */}
                    <Box 
                      position="absolute"
                      bottom="-2"
                      right="-2"
                      borderRadius="full" 
                      overflow="hidden" 
                      boxSize="32px"
                      bg={theme.cardBg}
                      boxShadow="md"
                      p={1}
                      borderWidth="2px"
                      borderColor={theme.bg}
                    >
                      <Image 
                        src={assetContext.icon}
                        alt={`${assetContext.name} Icon`}
                        boxSize="100%"
                        objectFit="contain"
                      />
                    </Box>
                  </Box>
                ) : (
                  /* Native Asset Icon */
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
                )}
                
                <Stack align="center" gap={1}>
                  <Text fontSize="2xl" fontWeight="bold" color="white">
                    {assetContext.name}
                  </Text>
                  <HStack gap={2} align="center">
                    <Text fontSize="md" color="gray.400">
                      {assetContext.symbol}
                    </Text>
                    {assetContext.isToken && (
                      <Badge 
                        colorScheme="purple" 
                        variant="subtle"
                        fontSize="xs"
                      >
                        TOKEN
                      </Badge>
                    )}
                  </HStack>
                  
                  {/* Display CAIP in small text */}
                  <Text fontSize="xs" color="gray.500" fontFamily="mono">
                    {assetContext.caip}
                  </Text>
                  
                  <Text fontSize="3xl" fontWeight="bold" color={theme.gold}>
                    $<CountUp 
                      key={`value-${lastSync}`}
                      end={usdValue} 
                      decimals={2}
                      duration={1.5}
                      separator=","
                    />
                  </Text>
                  
                  {/* For tokens, show BOTH balances clearly */}
                  {assetContext.isToken ? (
                    <VStack gap={2}>
                      {/* Token Balance */}
                      <Box textAlign="center">
                        <Text fontSize="lg" fontWeight="bold" color="white">
                          {formatBalance(assetContext.balance)} {assetContext.symbol}
                        </Text>
                        <Text fontSize="xs" color="gray.500">Token Balance</Text>
                      </Box>
                      
                      {/* Native Balance with warning if zero */}
                      <Box 
                        textAlign="center"
                        p={2}
                        borderRadius="md"
                        borderWidth={assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 ? "2px" : "0"}
                        borderColor="red.500"
                        position="relative"
                        _hover={assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 ? {
                          '& .warning-tooltip': { opacity: 1, visibility: 'visible' }
                        } : {}}
                      >
                        <Text fontSize="md" color={assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 ? "red.400" : "gray.300"}>
                          {assetContext.nativeBalance ? formatBalance(assetContext.nativeBalance) : '0'} {assetContext.nativeSymbol || 'GAS'}
                        </Text>
                        <Text fontSize="xs" color="gray.500">Gas Balance</Text>
                        
                        {/* Warning tooltip for zero balance */}
                        {assetContext.nativeBalance && parseFloat(assetContext.nativeBalance) === 0 && (
                          <Box
                            className="warning-tooltip"
                            position="absolute"
                            top="-40px"
                            left="50%"
                            transform="translateX(-50%)"
                            bg="red.600"
                            color="white"
                            px={3}
                            py={1}
                            borderRadius="md"
                            fontSize="xs"
                            whiteSpace="nowrap"
                            opacity={0}
                            visibility="hidden"
                            transition="all 0.2s"
                            zIndex={10}
                            _before={{
                              content: '""',
                              position: 'absolute',
                              bottom: '-4px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '4px solid transparent',
                              borderRight: '4px solid transparent',
                              borderTop: '4px solid',
                              borderTopColor: 'red.600',
                            }}
                          >
                            ⚠️ Gas required to transfer tokens
                          </Box>
                        )}
                      </Box>
                    </VStack>
                  ) : (
                    /* Native Asset Balance */
                    <Text fontSize="md" color="white">
                      {formatBalance(assetContext.balance)} {assetContext.symbol}
                    </Text>
                  )}
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
                onClick={onSendClick}
              >
                <Flex gap={2} align="center">
                  <FaPaperPlane />
                  <Text>Send</Text>
                </Flex>
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
                onClick={onReceiveClick}
              >
                <Flex gap={2} align="center">
                  <FaQrcode />
                  <Text>Receive</Text>
                </Flex>
              </Button>
              {isFeatureEnabled('enableSwaps') && (
                <Button
                  width="100%"
                  size="lg"
                  bg={theme.cardBg}
                  color="#9F7AEA"
                  borderColor={theme.border}
                  borderWidth="1px"
                  _hover={{
                    bg: 'rgba(159, 122, 234, 0.1)',
                    borderColor: '#9F7AEA',
                  }}
                  onClick={onSwapClick}
                >
                  <Flex gap={2} align="center">
                    <FaExchangeAlt />
                    <Text>Swap</Text>
                  </Flex>
                </Button>
              )}
            </VStack>
          </VStack>
          
          {/* Asset Details Section - Right column version for desktop when expanded */}
          {isDetailsExpanded && (
            <Box 
              bg={theme.cardBg}
              borderRadius="2xl"
              overflow="hidden"
              borderColor={theme.border}
              borderWidth="1px"
              flex="1"
              display={{ base: 'none', lg: 'block' }}
              minW="400px"
              maxW="600px"
            >
              {/* Clickable header */}
              <Flex 
                p={4} 
                borderBottom="1px"
                borderColor={theme.border}
                justifyContent="space-between"
                alignItems="center"
                onClick={toggleDetails}
                cursor="pointer"
                _hover={{
                  bg: 'rgba(255, 215, 0, 0.05)',
                }}
                transition="background 0.2s"
              >
                <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                  Asset Details
                </Text>
                <Icon 
                  as={FaChevronUp} 
                  color={theme.gold}
                  boxSize={4}
                />
              </Flex>
              
              {/* Details content */}
              <VStack align="stretch" p={4} gap={4}>
                {/* Network Info */}
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Network Information
                  </Text>
                  <HStack justify="space-between">
                    <Text color="gray.400">Type</Text>
                    <Text color="white">{assetContext.isToken ? 'Token' : 'Native Asset'}</Text>
                  </HStack>
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
                    <Text color="gray.400">CAIP</Text>
                    <Text 
                      color="white" 
                      fontSize="sm" 
                      fontFamily="mono"
                      title={assetContext.caip || assetContext.assetId}
                      cursor="help"
                      _hover={{
                        textDecoration: 'underline',
                        textDecorationStyle: 'dotted'
                      }}
                    >
                      {assetContext.caip}
                    </Text>
                  </HStack>
                </VStack>

                {/* Asset Info */}
                <VStack align="stretch" gap={3}>
                  <Text color="gray.400" fontSize="sm" fontWeight="medium">
                    Asset Information
                  </Text>
                  <HStack justify="space-between">
                    <Text color="gray.400">Precision</Text>
                    <Text color="white">{assetContext.precision}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.400">Price</Text>
                    <Text color="white">
                      $<CountUp 
                        key={`price-${lastSync}`}
                        end={priceUsd} 
                        decimals={2}
                        duration={1.5}
                        separator=","
                      />
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
                      <Text color="gray.400" fontSize="sm">{assetContext.networkId?.startsWith('bip122:') ? 'XPUB' : 'Address'}</Text>
                      <Box 
                        p={3}
                        bg={theme.bg}
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor={theme.border}
                      >
                        <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                          {assetContext.networkId?.startsWith('bip122:') 
                            ? assetContext.pubkeys[0].pubkey 
                            : assetContext.pubkeys[0].address}
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
                          onClick={() => {
                            // For UTXO coins, use XPUB explorer if available
                            if (assetContext.networkId?.startsWith('bip122:') && assetContext.explorerXpubLink) {
                              window.open(`${assetContext.explorerXpubLink}${assetContext.pubkeys[0].pubkey}`, '_blank');
                            } else {
                              // Fallback to address explorer
                              window.open(`${assetContext.explorerAddressLink}${assetContext.pubkeys[0].address}`, '_blank');
                            }
                          }}
                          flex="1"
                        >
                          TX History
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                )}
              </VStack>
            </Box>
          )}
        </Flex>

        {/* Asset Details Section - Collapsed/Mobile version */}
        <Box 
          bg={theme.cardBg}
          borderRadius="2xl"
          overflow="hidden"
          borderColor={theme.border}
          borderWidth="1px"
          mt={6}
          display={{ base: 'block', lg: isDetailsExpanded ? 'none' : 'block' }}
        >
          {/* Clickable header */}
          <Flex 
            p={4} 
            borderBottom={isDetailsExpanded ? "1px" : "none"} 
            borderColor={theme.border}
            justifyContent="space-between"
            alignItems="center"
            onClick={toggleDetails}
            cursor="pointer"
            _hover={{
              bg: 'rgba(255, 215, 0, 0.05)',
            }}
            transition="background 0.2s"
          >
            <Text color={theme.gold} fontSize="lg" fontWeight="bold">
              Asset Details
            </Text>
            <Icon 
              as={isDetailsExpanded ? FaChevronUp : FaChevronDown} 
              color={theme.gold}
              boxSize={4}
            />
          </Flex>
          
          {/* Collapsible content */}
          {isDetailsExpanded && (
            <VStack align="stretch" p={4} gap={4}>
              {/* Network Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Network Information
                </Text>
                <HStack justify="space-between">
                  <Text color="gray.400">Type</Text>
                  <Text color="white">{assetContext.isToken ? 'Token' : 'Native Asset'}</Text>
                </HStack>
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
                  <Text color="gray.400">CAIP</Text>
                  <Text 
                    color="white" 
                    fontSize="sm" 
                    fontFamily="mono"
                    title={assetContext.caip || assetContext.assetId}
                    cursor="help"
                    _hover={{
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted'
                    }}
                  >
                    {middleEllipsis(assetContext.caip || assetContext.assetId, 16)}
                  </Text>
                </HStack>
              </VStack>

              {/* Asset Info */}
              <VStack align="stretch" gap={3}>
                <Text color="gray.400" fontSize="sm" fontWeight="medium">
                  Asset Information
                </Text>
                <HStack justify="space-between">
                  <Text color="gray.400">Precision</Text>
                  <Text color="white">{assetContext.precision}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.400">Price</Text>
                  <Text color="white">
                    $<CountUp 
                      key={`price-${lastSync}`}
                      end={priceUsd} 
                      decimals={2}
                      duration={1.5}
                      separator=","
                    />
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
                    <Text color="gray.400" fontSize="sm">{assetContext.networkId?.startsWith('bip122:') ? 'XPUB' : 'Address'}</Text>
                    <Box 
                      p={3}
                      bg={theme.bg}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                        {assetContext.networkId?.startsWith('bip122:') 
                          ? assetContext.pubkeys[0].pubkey 
                          : assetContext.pubkeys[0].address}
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
                        onClick={() => {
                          // For UTXO coins, use XPUB explorer if available
                          if (assetContext.networkId?.startsWith('bip122:') && assetContext.explorerXpubLink) {
                            window.open(`${assetContext.explorerXpubLink}${assetContext.pubkeys[0].pubkey}`, '_blank');
                          } else {
                            // Fallback to address explorer
                            window.open(`${assetContext.explorerAddressLink}${assetContext.pubkeys[0].address}`, '_blank');
                          }
                        }}
                        flex="1"
                      >
                        {assetContext.networkId?.startsWith('bip122:') ? 'View XPUB' : 'View Address'}
                      </Button>
                    )}
                  </HStack>
                </VStack>
              )}
            </VStack>
          )}
        </Box>
        
        {/* Cosmos Staking Section */}
        <CosmosStaking assetContext={assetContext} />
      </Box>
    </Box>
  );
};

export default Asset; 