'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePioneerContext } from '@/components/providers/pioneer'
import Asset from '@/components/asset/Asset'
import {
  Box,
  Flex,
  VStack,
  Text,
  Spinner
} from '@chakra-ui/react'
import Send from '@/components/send/Send'
import Receive from '@/components/receive/Receive'
import Swap from '@/components/swap/Swap'
import { isFeatureEnabled } from '@/config/features'

// Custom scrollbar styles
const scrollbarStyles = {
  css: {
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-track': {
      width: '6px',
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#4A5568',
      borderRadius: '24px',
    },
  }
};

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

// Helper function to get explorer URLs based on network ID
const getExplorerForNetwork = (networkId: string) => {
  // EVM chains
  if (networkId.startsWith('eip155:')) {
    const chainId = networkId.split(':')[1];
    const evmExplorers: Record<string, { explorer: string; explorerAddressLink: string; explorerTxLink: string }> = {
      '1': { 
        explorer: 'https://etherscan.io', 
        explorerAddressLink: 'https://etherscan.io/address/',
        explorerTxLink: 'https://etherscan.io/tx/'
      },
      '56': { 
        explorer: 'https://bscscan.com',
        explorerAddressLink: 'https://bscscan.com/address/',
        explorerTxLink: 'https://bscscan.com/tx/'
      },
      '137': { 
        explorer: 'https://polygonscan.com',
        explorerAddressLink: 'https://polygonscan.com/address/',
        explorerTxLink: 'https://polygonscan.com/tx/'
      },
      '43114': { 
        explorer: 'https://snowtrace.io',
        explorerAddressLink: 'https://snowtrace.io/address/',
        explorerTxLink: 'https://snowtrace.io/tx/'
      },
      '8453': { 
        explorer: 'https://basescan.org',
        explorerAddressLink: 'https://basescan.org/address/',
        explorerTxLink: 'https://basescan.org/tx/'
      },
      '10': { 
        explorer: 'https://optimistic.etherscan.io',
        explorerAddressLink: 'https://optimistic.etherscan.io/address/',
        explorerTxLink: 'https://optimistic.etherscan.io/tx/'
      },
      '42161': { 
        explorer: 'https://arbiscan.io',
        explorerAddressLink: 'https://arbiscan.io/address/',
        explorerTxLink: 'https://arbiscan.io/tx/'
      },
    };
    
    return evmExplorers[chainId] || {
      explorer: 'https://etherscan.io',
      explorerAddressLink: 'https://etherscan.io/address/',
      explorerTxLink: 'https://etherscan.io/tx/'
    };
  }
  
  // UTXO chains
  if (networkId.startsWith('bip122:')) {
    if (networkId.includes('000000000019d6689c085ae165831e93')) { // Bitcoin
      return {
        explorer: 'https://blockstream.info',
        explorerAddressLink: 'https://blockstream.info/address/',
        explorerXpubLink: 'https://blockstream.info/xpub/', // For viewing full wallet history
        explorerTxLink: 'https://blockstream.info/tx/'
      };
    } else if (networkId.includes('12a765e31ffd4059bada1e25190f6e98')) { // Litecoin
      return {
        explorer: 'https://blockchair.com/litecoin',
        explorerAddressLink: 'https://blockchair.com/litecoin/address/',
        explorerXpubLink: 'https://blockchair.com/litecoin/xpub/', // For viewing full wallet history
        explorerTxLink: 'https://blockchair.com/litecoin/transaction/'
      };
    } else if (networkId.includes('000000000933ea01ad0ee984209779ba')) { // Dogecoin
      return {
        explorer: 'https://blockchair.com/dogecoin',
        explorerAddressLink: 'https://blockchair.com/dogecoin/address/',
        explorerXpubLink: 'https://blockchair.com/dogecoin/xpub/', // For viewing full wallet history
        explorerTxLink: 'https://blockchair.com/dogecoin/transaction/'
      };
    } else if (networkId.includes('000000000000000000651ef99cb9fcbe')) { // Bitcoin Cash
      return {
        explorer: 'https://blockchair.com/bitcoin-cash',
        explorerAddressLink: 'https://blockchair.com/bitcoin-cash/address/',
        explorerXpubLink: 'https://blockchair.com/bitcoin-cash/xpub/', // For viewing full wallet history
        explorerTxLink: 'https://blockchair.com/bitcoin-cash/transaction/'
      };
    }
  }
  
  // Cosmos chains
  if (networkId.startsWith('cosmos:')) {
    if (networkId.includes('cosmoshub')) {
      return {
        explorer: 'https://www.mintscan.io/cosmos',
        explorerAddressLink: 'https://www.mintscan.io/cosmos/account/',
        explorerTxLink: 'https://www.mintscan.io/cosmos/tx/'
      };
    } else if (networkId.includes('osmosis')) {
      return {
        explorer: 'https://www.mintscan.io/osmosis',
        explorerAddressLink: 'https://www.mintscan.io/osmosis/account/',
        explorerTxLink: 'https://www.mintscan.io/osmosis/tx/'
      };
    } else if (networkId.includes('thorchain')) {
      return {
        explorer: 'https://viewblock.io/thorchain',
        explorerAddressLink: 'https://viewblock.io/thorchain/address/',
        explorerTxLink: 'https://viewblock.io/thorchain/tx/'
      };
    } else if (networkId.includes('mayachain')) {
      return {
        explorer: 'https://www.mayascan.org',
        explorerAddressLink: 'https://www.mayascan.org/address/',
        explorerTxLink: 'https://www.mayascan.org/tx/'
      };
    }
  }
  
  // Ripple
  if (networkId.includes('ripple')) {
    return {
      explorer: 'https://xrpscan.com',
      explorerAddressLink: 'https://xrpscan.com/account/',
      explorerTxLink: 'https://xrpscan.com/tx/'
    };
  }
  
  // Default fallback
  console.warn(`Unknown network ID for explorer: ${networkId}`);
  return {
    explorer: 'https://blockchair.com',
    explorerAddressLink: 'https://blockchair.com/search?q=',
    explorerTxLink: 'https://blockchair.com/search?q='
  };
};

// Define view types
type ViewType = 'asset' | 'send' | 'receive' | 'swap';

export default function AssetPage() {
  const params = useParams()
  const router = useRouter()
  const { state } = usePioneerContext()

  // Track the current view instead of dialog state
  const [currentView, setCurrentView] = useState<ViewType>('asset')

  // Get asset color from context
  const assetColor = state?.app?.assetContext?.color || theme.gold

  // Decode the CAIP parameter - memoized to avoid recalculation
  const decodedCaip = useMemo(() => {
    if (!params.caip) return null

    let encodedCaip = decodeURIComponent(params.caip as string)
    let caip: string

    try {
      // Attempt to decode from Base64
      caip = atob(encodedCaip)
      //console.log('🔍 [AssetPage] Successfully decoded caip from Base64:', { encodedCaip, caip })
    } catch (error) {
      // If Base64 decoding fails, use the original value
      caip = encodedCaip
      //console.log('🔍 [AssetPage] Using original caip (Base64 decoding failed):', { caip })
    }

    //console.log('🔍 [AssetPage] Final decoded parameter:', { caip })
    return caip
  }, [params.caip])

  // Override html and body background to allow our background image to show
  useEffect(() => {
    // Save original backgrounds
    const originalBodyBackground = document.body.style.cssText;
    const originalHtmlBackground = document.documentElement.style.cssText;

    // Set both html and body background to transparent with !important
    document.body.style.cssText = 'background: transparent !important;';
    document.documentElement.style.cssText = 'background: transparent !important;';

    // Restore original backgrounds on cleanup
    return () => {
      document.body.style.cssText = originalBodyBackground;
      document.documentElement.style.cssText = originalHtmlBackground;
    };
  }, []);

  // Check for view query parameter and automatically open the appropriate view (ONLY ON INITIAL LOAD)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const viewParam = searchParams.get('view')

      if (viewParam) {
        const validView = viewParam as ViewType

        // Check feature flags before allowing swap view
        if (validView === 'swap' && !isFeatureEnabled('enableSwaps')) {
          console.warn('🚫 [AssetPage] Swap feature is disabled, ignoring view parameter')
          return
        }

        // Only update if it's a valid view
        if (['asset', 'send', 'receive', 'swap'].includes(validView)) {
          //console.log('🔍 [AssetPage] Auto-opening view from query parameter:', validView)
          setCurrentView(validView)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedCaip]) // Only run when CAIP changes (initial load or navigation to different asset)

  // Handle navigation functions
  const handleBack = () => {
    if (currentView !== 'asset') {
      // If in send, receive, or swap view, go back to asset view
      setCurrentView('asset')
      // Clear URL query params
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('view')
        window.history.replaceState({}, '', url.toString())
      }
    } else {
      // If already in asset view, go back to dashboard
      //console.log('🔙 [AssetPage] Navigating back to dashboard')
      router.push('/')
    }
  }

  // Show loading state if CAIP is not decoded yet
  if (!decodedCaip) {
    return (
      <>
        {/* Fixed background layer */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.bg,
            backgroundImage: 'url(/images/backgrounds/splash-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            zIndex: -1
          }}
        />
        <Box
          height="100vh"
          p={{ base: 4, md: 6, lg: 8 }}
          style={{ background: 'none' }}
        >
          <Box
            minHeight={{ base: 'calc(100vh - 32px)', md: 'calc(100vh - 48px)', lg: 'calc(100vh - 64px)' }}
            maxW={{ base: '100%', md: '768px', lg: '1200px' }}
            mx="auto"
            bg="rgba(0, 0, 0, 0.6)"
            backdropFilter="blur(10px)"
            borderRadius="2xl"
            borderWidth="1px"
            borderColor={`${assetColor}40`}
            boxShadow={`0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${assetColor}20`}
          >
            <Flex
              justify="center"
              align="center"
              height="100%"
              direction="column"
              gap={6}
            >
              <Spinner color={theme.gold} size="xl" />
              <Text color="gray.400">Loading asset...</Text>
            </Flex>
          </Box>
        </Box>
      </>
    )
  }

  // Render the current view based on state
  return (
    <>
      {/* Fixed background layer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.bg,
          backgroundImage: 'url(/images/backgrounds/splash-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -1
        }}
      />

      {/* Content layer */}
      <Box
        minH="100vh"
        width="100%"
        style={{ background: 'none' }}
        p={{ base: 4, md: 6, lg: 8 }}
      >
        <Box
          minHeight={currentView === 'asset' ? { base: 'calc(100vh - 32px)', md: 'calc(100vh - 48px)', lg: 'calc(100vh - 64px)' } : undefined}
          overflow="hidden"
          position="relative"
          maxW={{ base: '100%', md: '768px', lg: '1200px' }}
          width="100%"
          mx="auto"
          bg="rgba(0, 0, 0, 0.6)"
          backdropFilter="blur(10px)"
          borderRadius="2xl"
          borderWidth="1px"
          borderColor={`${assetColor}40`}
          boxShadow={`0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${assetColor}20`}
        >
          <Box
            height={currentView === 'asset' ? '100%' : undefined}
            maxHeight={currentView !== 'asset' ? '90vh' : undefined}
            overflowY="auto"
            overflowX="hidden"
            style={{ background: 'none' }}
            {...scrollbarStyles}
          >
            {currentView === 'asset' && (
              <Asset
                key={decodedCaip}
                caip={decodedCaip}
                onBackClick={handleBack}
                onSendClick={() => setCurrentView('send')}
                onReceiveClick={() => setCurrentView('receive')}
                onSwapClick={() => {
                  // Check feature flag before allowing swap navigation
                  if (isFeatureEnabled('enableSwaps')) {
                    setCurrentView('swap')
                  } else {
                    console.warn('🚫 [AssetPage] Swap feature is disabled')
                  }
                }}
              />
            )}

            {currentView === 'send' && (
              /* @ts-ignore */
              <Send onBackClick={handleBack} />
            )}

            {currentView === 'receive' && (
              <Receive onBackClick={handleBack} />
            )}

            {currentView === 'swap' && isFeatureEnabled('enableSwaps') && (
              <Swap onBackClick={handleBack} />
            )}
          </Box>
        </Box>
      </Box>
    </>
  )
} 