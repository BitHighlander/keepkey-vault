'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePioneerContext } from '@/components/providers/pioneer'
import Asset from '@/components/asset/Asset'
import { 
  Box, 
  Flex, 
  Skeleton, 
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
  const [isAppReady, setIsAppReady] = useState(false)
  const [appCheckAttempts, setAppCheckAttempts] = useState(0)
  const [decodedCaip, setDecodedCaip] = useState<string | null>(null)
  const [isAssetLoading, setIsAssetLoading] = useState(false)
  const [currentAssetCaip, setCurrentAssetCaip] = useState<string | null>(null)

  // Track the current view instead of dialog state
  const [currentView, setCurrentView] = useState<ViewType>('asset')
  
  // Decode the parameter immediately - it might be both URL-encoded AND Base64 encoded
  useEffect(() => {
    if (!params.caip) return;
    
    let encodedCaip = decodeURIComponent(params.caip as string)
    let caip: string
    
    try {
      // Attempt to decode from Base64
      caip = atob(encodedCaip)
      console.log('🔍 [AssetPage] Successfully decoded caip from Base64:', 
        { encodedCaip, caip })
    } catch (error) {
      // If Base64 decoding fails, use the original value
      caip = encodedCaip
      console.log('🔍 [AssetPage] Using original caip (Base64 decoding failed):', 
        { caip })
    }
    
    console.log('🔍 [AssetPage] Final decoded parameter:', { caip })
    setDecodedCaip(caip)
  }, [params.caip])
  
  // Use the Pioneer context approach similar to the dashboard
  const pioneer = usePioneerContext()
  const { state } = pioneer
  const { app } = state
  const router = useRouter()
  
  // Check if app is already ready on mount
  useEffect(() => {
    if (app && app.setAssetContext && app.balances && app.pubkeys && decodedCaip) {
      console.log('🚀 [AssetPage] App already ready on mount, setting ready immediately');
      setIsAppReady(true);
    }
  }, [app, decodedCaip])

  // Check if app is ready and has all required properties
  useEffect(() => {
    const checkAppReady = () => {
      const isReady = !!(
        app && 
        app.setAssetContext && 
        app.balances &&
        app.pubkeys
      )
      
      console.log('🔄 [AssetPage] Checking if app is ready:', { 
        isReady,
        hasApp: !!app, 
        hasSetAssetContext: !!app?.setAssetContext, 
        hasBalances: !!app?.balances,
        balanceCount: app?.balances?.length || 0,
        hasPubkeys: !!app?.pubkeys,
        pubkeyCount: app?.pubkeys?.length || 0
      })
      
      if (isReady) {
        setIsAppReady(true)
        return true
      }
      
      return false
    }
    
    // Initial check
    const isReady = checkAppReady()
    if (isReady) return

    // Reduced polling time and attempts for faster loading
    const checkInterval = setInterval(() => {
      setAppCheckAttempts((prev: number) => {
        const newAttempt = prev + 1
        console.log(`🔄 [AssetPage] App check attempt ${newAttempt}`)
        return newAttempt
      })
      
      const isReady = checkAppReady()
      // Reduced to 10 attempts (2 seconds instead of 15)
      if (isReady || appCheckAttempts >= 10) {
        clearInterval(checkInterval)
        
        if (appCheckAttempts >= 10 && !isReady) {
          console.error('⚠️ [AssetPage] Gave up waiting for app context after 10 attempts')
          // Provide a fallback option - redirect to dashboard
          router.push('/')
        }
      }
    }, 200) // Check every 200ms instead of 500ms
    
    return () => clearInterval(checkInterval)
  }, [app, state, appCheckAttempts, router])
  
  // Set asset context when app is ready and we have a decoded CAIP
  useEffect(() => {
    // Only proceed if app is ready and we have a CAIP
    if (!isAppReady || !decodedCaip) {
      console.log('🔄 [AssetPage] Not ready yet:', { isAppReady, decodedCaip });
      return;
    }

    const caip = decodedCaip

    // Check if we're navigating to a different asset
    if (currentAssetCaip && currentAssetCaip !== caip) {
      console.log('🔄 [AssetPage] Navigating to different asset, showing loading state');
      setIsAssetLoading(true);

      // Clear the current asset context to force a refresh
      if (app?.setAssetContext) {
        app.setAssetContext(null);
      }
    }

    console.log('🔄 [AssetPage] App is ready, setting asset context from URL parameter:', caip)
    
    // Quick check if this is a token (simplified for speed)
    const isToken = caip.includes('/denom:') || caip.includes('/ibc:') || caip.includes('erc20') || caip.includes('eip721') || /0x[a-fA-F0-9]{40}/.test(caip);
    console.log('🪙 [AssetPage] CAIP analysis:', { caip, isToken });

    if (isToken) {
      // Handle token case
      console.log('🪙 [AssetPage] Detected token, searching in balances...');
      
      // Find the token in balances
      const tokenBalance = app.balances?.find((balance: any) => balance.caip === caip);
      
      if (tokenBalance) {
        console.log('🪙 [AssetPage] Found token balance:', tokenBalance);
        
        // Determine the network this token belongs to
        let tokenNetworkId = '';
        if (caip.includes('MAYA.')) {
          tokenNetworkId = 'cosmos:mayachain-mainnet-v1';
        } else if (caip.includes('cosmos:mayachain-mainnet-v1')) {
          // Handle new MAYA token format
          tokenNetworkId = 'cosmos:mayachain-mainnet-v1';
        } else if (caip.includes('THOR.')) {
          tokenNetworkId = 'cosmos:thorchain-mainnet-v1';
        } else if (caip.includes('cosmos:thorchain-mainnet-v1')) {
          tokenNetworkId = 'cosmos:thorchain-mainnet-v1';
        } else if (caip.includes('OSMO.')) {
          tokenNetworkId = 'cosmos:osmosis-1';
        } else if (caip.includes('cosmos:osmosis-1')) {
          tokenNetworkId = 'cosmos:osmosis-1';
        } else if (caip.includes('eip155:')) {
          // Extract network from ERC20 token CAIP
          const parts = caip.split('/');
          tokenNetworkId = parts[0];
        } else if (caip.includes('cosmos:')) {
          // Generic Cosmos token handling
          const parts = caip.split('/');
          tokenNetworkId = parts[0];
        }
        
        console.log('🪙 [AssetPage] Determined token network:', tokenNetworkId);
        
        // Get the native balance for the token's network
        let nativeBalance = null;
        let nativeSymbol = '';
        
        // Map network to native asset CAIP and symbol
        const nativeAssetMap: { [key: string]: { caip: string, symbol: string } } = {
          'cosmos:mayachain-mainnet-v1': { caip: 'cosmos:mayachain-mainnet-v1/slip44:931', symbol: 'CACAO' }, // CACAO is the gas asset, not MAYA
          'cosmos:thorchain-mainnet-v1': { caip: 'cosmos:thorchain-mainnet-v1/slip44:931', symbol: 'RUNE' },
          'cosmos:osmosis-1': { caip: 'cosmos:osmosis-1/slip44:118', symbol: 'OSMO' },
          'eip155:1': { caip: 'eip155:1/slip44:60', symbol: 'ETH' },
          'eip155:137': { caip: 'eip155:137/slip44:60', symbol: 'MATIC' },
          'eip155:43114': { caip: 'eip155:43114/slip44:60', symbol: 'AVAX' },
          'eip155:56': { caip: 'eip155:56/slip44:60', symbol: 'BNB' },
          'eip155:8453': { caip: 'eip155:8453/slip44:60', symbol: 'ETH' },
          'eip155:10': { caip: 'eip155:10/slip44:60', symbol: 'ETH' },
          'eip155:42161': { caip: 'eip155:42161/slip44:60', symbol: 'ETH' },
        };
        
        const nativeAssetInfo = nativeAssetMap[tokenNetworkId];
        if (nativeAssetInfo) {
          // Find native balance
          const nativeAssetBalance = app.balances?.find((balance: any) => 
            balance.caip === nativeAssetInfo.caip
          );
          if (nativeAssetBalance) {
            nativeBalance = nativeAssetBalance.balance;
            nativeSymbol = nativeAssetInfo.symbol;
            console.log('🪙 [AssetPage] Found native balance for', nativeSymbol, ':', nativeBalance);
          } else {
            // If no balance found, set to 0
            nativeBalance = '0';
            nativeSymbol = nativeAssetInfo.symbol;
            console.log('⚠️ [AssetPage] No native balance found for', nativeSymbol, ', setting to 0');
          }
        }
        
        // Create asset context for the token
        const tokenAssetContextData = {
          networkId: tokenNetworkId,
          chainId: tokenNetworkId,
          assetId: caip,
          caip: caip,
          name: tokenBalance.name || tokenBalance.symbol || tokenBalance.ticker || 'TOKEN',
          networkName: tokenNetworkId.split(':').pop() || '',
          symbol: tokenBalance.ticker || tokenBalance.symbol || 'TOKEN',
          icon: tokenBalance.icon || tokenBalance.image || 'https://pioneers.dev/coins/pioneer.png',
          color: tokenBalance.color || '#FFD700',
          balance: tokenBalance.balance || '0',
          value: tokenBalance.valueUsd || tokenBalance.value || 0,
          precision: tokenBalance.precision || 18,
          priceUsd: parseFloat(tokenBalance.priceUsd || tokenBalance.price || 0),
          isToken: true, // Add flag to indicate this is a token
          type: 'token',
          nativeBalance: nativeBalance, // Add native balance for display
          nativeSymbol: nativeSymbol, // Add native symbol for display
          explorer: app.assetsMap?.get(caip)?.explorer || getExplorerForNetwork(tokenNetworkId).explorer,
          explorerAddressLink: app.assetsMap?.get(caip)?.explorerAddressLink || getExplorerForNetwork(tokenNetworkId).explorerAddressLink,
          explorerTxLink: app.assetsMap?.get(caip)?.explorerTxLink || getExplorerForNetwork(tokenNetworkId).explorerTxLink,
          pubkeys: (app.pubkeys || []).filter((p: any) => {
            return p.networks.includes(tokenNetworkId);
          })
        };
        
        console.log('🪙 [AssetPage] Setting token asset context:', tokenAssetContextData);
        
        try {
          app.setAssetContext(tokenAssetContextData);
          console.log('✅ [AssetPage] Token asset context set successfully');
          setCurrentAssetCaip(caip);
          setIsAssetLoading(false);
          return; // Exit early, we're done
        } catch (error) {
          console.error('❌ [AssetPage] Error setting token asset context:', error);
          setIsAssetLoading(false);
        }
      } else {
        console.error('⚠️ [AssetPage] Token not found in balances:', caip);
        router.push('/');
        return;
      }
    }
    
    // Handle native asset case (existing logic)
    console.log('💎 [AssetPage] Detected native asset, using network logic...');
    
    // Parse the CAIP to extract networkId and assetType
    let networkId: string = caip
    let assetType: string = ''
    
    // If this is a full CAIP (e.g., "eip155:1/slip44:60")
    if (caip.includes('/')) {
      const parts = caip.split('/')
      networkId = parts[0] // e.g., "eip155:1"
      assetType = parts[1] // e.g., "slip44:60"
      console.log('🔍 [AssetPage] Parsed CAIP into parts:', { networkId, assetType })
    }
    
    // Find the balance matching the CAIP
    // IMPORTANT: Prioritize native assets over tokens to avoid showing eETH instead of ETH
    let nativeAssetBalance = null;
    
    // First, try to find a native asset (not a token)
    // Special case for ETH: avoid selecting eETH (ether-fi) or other wrapped versions
    if (caip === 'eip155:1/slip44:60') {
      nativeAssetBalance = app.balances?.find((balance: any) => 
        balance.caip === caip && 
        balance.name !== 'eETH' && 
        balance.appId !== 'ether-fi' &&
        (!balance.appId || balance.appId === 'native' || balance.appId === 'ethereum')
      );
    } else {
      nativeAssetBalance = app.balances?.find((balance: any) => 
        balance.caip === caip && 
        (!balance.appId || balance.appId === 'native' || balance.appId === 'ethereum')
      );
    }
    
    // If no native asset found, fall back to any matching balance
    if (!nativeAssetBalance) {
      nativeAssetBalance = app.balances?.find((balance: any) => balance.caip === caip);
    }
    
    console.log('🔍 [AssetPage] Looking for balance with CAIP:', caip);
    console.log('🔍 [AssetPage] Available balances:', app.balances?.map((b: any) => ({ 
      caip: b.caip, 
      name: b.name, 
      appId: b.appId 
    })) || []);
    
    if (!nativeAssetBalance) {
      console.error('⚠️ [AssetPage] Could not find balance for CAIP:', caip);
      router.push('/');
      return;
    }

    console.log('🔍 [AssetPage] Found balance:', nativeAssetBalance);
     const assetContextData = {
       caip: caip, // Ensure we use the decoded CAIP
     };

     console.log('🔍 [AssetPage] Setting asset context with full data:', assetContextData)

     try {
       app.setAssetContext(assetContextData)
       console.log('✅ [AssetPage] Asset context set successfully with price data')
       setCurrentAssetCaip(caip);
       setIsAssetLoading(false);
     } catch (error) {
       console.error('❌ [AssetPage] Error setting asset context:', error)
       setIsAssetLoading(false);
     }
  }, [isAppReady, decodedCaip, app, router, currentAssetCaip])

  // Handle navigation functions
  const handleBack = () => {
    if (currentView !== 'asset') {
      // If in send, receive, or swap view, go back to asset view
      setCurrentView('asset')
    } else {
      // If already in asset view, go back to dashboard
      console.log('🔙 [AssetPage] Navigating back to dashboard')
      router.push('/') 
    }
  }

  // Render skeleton while waiting for app to be ready or asset to load
  if (!isAppReady || isAssetLoading) {
    return (
      <Box height="100vh" bg={theme.bg} p={4}>
        <Box
          borderBottom="1px"
          borderColor={theme.border}
          p={4}
          bg={theme.cardBg}
        >
          <Skeleton height="32px" width="80px" />
        </Box>

        <Flex
          justify="center"
          align="center"
          height="calc(100% - 60px)"
          direction="column"
          gap={6}
        >
          <Spinner
            color={theme.gold}
            size="xl"
          />
          <VStack width="100%" maxWidth="400px" gap={4}>
            <Skeleton height="40px" />
            <Skeleton height="20px" />
            <Skeleton height="60px" />
            <Skeleton height="40px" />
          </VStack>
          <Text color="gray.400" mt={4}>
            {isAssetLoading ? 'Loading asset...' : 'Loading asset data...'}
          </Text>
        </Flex>
      </Box>
    )
  }

  // Render the current view based on state
  return (
    <Box 
      minH="100vh" 
      bg="black"
      width="100%"
    >
      <Box 
        height="100vh"
        bg="black" 
        overflow="hidden"
        position="relative"
        maxW={{ base: '100%', md: '768px', lg: '1200px' }}
        width="100%"
        mx="auto"
      >
        <Box 
          height="100%" 
          overflowY="auto" 
          overflowX="hidden"
          {...scrollbarStyles}
        >
          {currentView === 'asset' && (
            <Asset
              key={decodedCaip || 'asset'}
              onBackClick={handleBack}
              onSendClick={() => setCurrentView('send')}
              onReceiveClick={() => setCurrentView('receive')}
              onSwapClick={() => {
                if (isFeatureEnabled('enableSwaps')) {
                  setCurrentView('swap')
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
  )
} 