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

// Define view types
type ViewType = 'asset' | 'send' | 'receive';

export default function AssetPage() {
  const params = useParams()
  const [isAppReady, setIsAppReady] = useState(false)
  const [appCheckAttempts, setAppCheckAttempts] = useState(0)
  const [decodedCaip, setDecodedCaip] = useState<string | null>(null)
  
  // Track the current view instead of dialog state
  const [currentView, setCurrentView] = useState<ViewType>('asset')
  
  // Decode the parameter - it might be both URL-encoded AND Base64 encoded
  useEffect(() => {
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

  // Check if app is ready and has all required properties
  useEffect(() => {
    const checkAppReady = () => {
      const isReady = !!(
        app && 
        app.setAssetContext && 
        app.dashboard && 
        app.dashboard.networks && 
        app.dashboard.networks.length > 0
      )
      
      console.log('🔄 [AssetPage] Checking if app is ready:', { 
        isReady,
        hasApp: !!app, 
        hasSetAssetContext: !!app?.setAssetContext, 
        hasDashboard: !!app?.dashboard,
        hasNetworks: !!app?.dashboard?.networks,
        networkCount: app?.dashboard?.networks?.length
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

    // If not ready, start polling with a longer timeout
    const checkInterval = setInterval(() => {
      setAppCheckAttempts((prev: number) => {
        const newAttempt = prev + 1
        console.log(`🔄 [AssetPage] App check attempt ${newAttempt}`)
        return newAttempt
      })
      
      const isReady = checkAppReady()
      // Increased from 10 to 30 attempts (15 seconds instead of 5)
      if (isReady || appCheckAttempts >= 30) {
        clearInterval(checkInterval)
        
        if (appCheckAttempts >= 30 && !isReady) {
          console.error('⚠️ [AssetPage] Gave up waiting for app context after 30 attempts')
          // Provide a fallback option - redirect to dashboard
          router.push('/')
        }
      }
    }, 500) // Check every 500ms
    
    return () => clearInterval(checkInterval)
  }, [app, state, appCheckAttempts, router])
  
  // Set asset context when app is ready and we have a decoded CAIP
  useEffect(() => {
    // Only proceed if app is ready and we have a CAIP
    if (!isAppReady || !decodedCaip) return
    
    const caip = decodedCaip
    console.log('🔄 [AssetPage] App is ready, setting asset context from URL parameter:', caip)
    
    // Helper function to determine if a CAIP represents a token vs native asset
    const isTokenCaip = (caip: string): boolean => {
      if (!caip) return false;
      
      // Explicit token type
      if (caip.includes('erc20') || caip.includes('eip721')) return true;
      
      // ERC20 tokens have contract addresses (0x followed by 40 hex chars)
      if (caip.includes('eip155:') && /0x[a-fA-F0-9]{40}/.test(caip)) return true;
      
      // Cosmos ecosystem tokens (not using slip44 format)
      if (caip.includes('MAYA.') || caip.includes('THOR.') || caip.includes('OSMO.')) return true;
      
      // Cosmos tokens using denom or ibc format
      if (caip.includes('/denom:') || caip.includes('/ibc:')) return true;
      
      // Any CAIP that doesn't use slip44 format is likely a token
      if (!caip.includes('slip44:') && caip.includes('.')) return true;
      
      return false;
    };

    // Check if this is a token
    const isToken = isTokenCaip(caip);
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
          value: tokenBalance.valueUsd || 0,
          precision: tokenBalance.precision || 18,
          priceUsd: parseFloat(tokenBalance.priceUsd || 0),
          isToken: true, // Add flag to indicate this is a token
          type: 'token',
          nativeBalance: nativeBalance, // Add native balance for display
          nativeSymbol: nativeSymbol, // Add native symbol for display
          explorer: tokenNetworkId.startsWith('eip155') 
            ? `https://${tokenNetworkId.split(':').pop()?.toLowerCase()}.etherscan.io`
            : tokenNetworkId.startsWith('cosmos')
            ? `https://www.mintscan.io/${tokenNetworkId.split(':')[1]}`
            : `https://explorer.pioneers.dev/${tokenNetworkId}`,
          explorerAddressLink: tokenNetworkId.startsWith('eip155')
            ? `https://${tokenNetworkId.split(':').pop()?.toLowerCase()}.etherscan.io/address/`
            : tokenNetworkId.startsWith('cosmos')
            ? `https://www.mintscan.io/${tokenNetworkId.split(':')[1]}/account/`
            : `https://explorer.pioneers.dev/${tokenNetworkId}/address/`,
          explorerTxLink: tokenNetworkId.startsWith('eip155')
            ? `https://${tokenNetworkId.split(':').pop()?.toLowerCase()}.etherscan.io/tx/`
            : tokenNetworkId.startsWith('cosmos')
            ? `https://www.mintscan.io/${tokenNetworkId.split(':')[1]}/txs/`
            : `https://explorer.pioneers.dev/${tokenNetworkId}/tx/`,
          pubkeys: (app.pubkeys || []).filter((p: any) => {
            return p.networks.includes(tokenNetworkId);
          })
        };
        
        console.log('🪙 [AssetPage] Setting token asset context:', tokenAssetContextData);
        
        try {
          app.setAssetContext(tokenAssetContextData);
          console.log('✅ [AssetPage] Token asset context set successfully');
          return; // Exit early, we're done
        } catch (error) {
          console.error('❌ [AssetPage] Error setting token asset context:', error);
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
    
    // Find the network matching the networkId - try various matching strategies
    let matchingNetwork: any = null
    
    if (app.dashboard?.networks) {
      console.log('🔍 [AssetPage] Searching for network match among', app.dashboard.networks.length, 'networks')
      
      // Strategy 1: Try direct exact match first
      matchingNetwork = app.dashboard.networks.find((network: any) => 
        network.networkId === networkId
      )
      
      if (matchingNetwork) {
        console.log('🔍 [AssetPage] Found exact network match:', matchingNetwork.networkId)
      }
      
      // Strategy 2: If not found, check for wildcard networks that would match this specific network
      if (!matchingNetwork) {
        matchingNetwork = app.dashboard.networks.find((network: any) => {
          // If network has a wildcard (*) and our specific networkId starts with the prefix part
          if (network.networkId.includes('*')) {
            const prefix = network.networkId.split('*')[0]
            return networkId.startsWith(prefix)
          }
          return false
        })
        
        if (matchingNetwork) {
          console.log('🔍 [AssetPage] Found matching wildcard network:', matchingNetwork.networkId)
        }
      }
      
      // Strategy 3: Check if full CAIP matches any network's gasAssetCaip
      if (!matchingNetwork) {
        matchingNetwork = app.dashboard.networks.find((network: any) => 
          network.gasAssetCaip === caip
        )
        
        if (matchingNetwork) {
          console.log('🔍 [AssetPage] Found network by matching gasAssetCaip:', matchingNetwork.networkId)
        }
      }
    }
    
    if (matchingNetwork) {
      console.log('🔍 [AssetPage] Found network:', matchingNetwork.networkId)
      console.log('🔍 [AssetPage] Network details:', matchingNetwork)
      
      // Always use the full CAIP passed in the URL
      const fullCaip = caip
      
      // For native assets, we should also check if we have the balance in app.balances
      let nativeAssetBalance = app.balances?.find((balance: any) => balance.caip === fullCaip);
      
      // Determine the correct symbol based on the network
      let correctSymbol = matchingNetwork.gasAssetSymbol;
      let correctName = matchingNetwork.gasAssetSymbol;
      let correctIcon = matchingNetwork.icon;
      let correctBalance = matchingNetwork.totalNativeBalance;
      let correctValue = matchingNetwork.totalValueUsd;
      let correctPriceUsd = matchingNetwork.totalValueUsd / parseFloat(matchingNetwork.totalNativeBalance);
      
      // Override with balance data if available (more accurate)
      if (nativeAssetBalance) {
        console.log('🔍 [AssetPage] Found native asset balance data:', nativeAssetBalance);
        correctSymbol = nativeAssetBalance.ticker || nativeAssetBalance.symbol || correctSymbol;
        correctName = nativeAssetBalance.name || correctSymbol;
        correctIcon = nativeAssetBalance.icon || nativeAssetBalance.image || correctIcon;
        correctBalance = nativeAssetBalance.balance || correctBalance;
        correctValue = parseFloat(nativeAssetBalance.valueUsd || correctValue);
        correctPriceUsd = parseFloat(nativeAssetBalance.priceUsd || correctPriceUsd);
      }
      
      // Special handling for MAYA chain native asset (CACAO)
      if (networkId === 'cosmos:mayachain-mainnet-v1' && fullCaip.includes('slip44:931')) {
        correctSymbol = 'CACAO';
        correctName = 'CACAO';
        correctIcon = 'https://pioneers.dev/coins/cacao.png';
      }
      
      // Create the asset context with the correct CAIP
      const assetContextData = {
        networkId: networkId, // The network part (e.g. "eip155:1")
        chainId: networkId,
        assetId: fullCaip, // The full CAIP (e.g. "eip155:1/slip44:60")
        caip: fullCaip,  // The full CAIP (e.g. "eip155:1/slip44:60")
        name: correctName,
        networkName: networkId.split(':').pop() || '',
        symbol: correctSymbol,
        icon: correctIcon,
        color: matchingNetwork.color,
        balance: correctBalance,
        value: correctValue,
        precision: nativeAssetBalance?.precision || 18,
        priceUsd: correctPriceUsd,
        explorer: networkId.startsWith('eip155') 
          ? `https://${networkId.split(':').pop()?.toLowerCase()}.etherscan.io`
          : networkId.startsWith('cosmos')
          ? `https://www.mintscan.io/${networkId.split(':')[1]}`
          : `https://explorer.pioneers.dev/${networkId}`,
        explorerAddressLink: networkId.startsWith('eip155')
          ? `https://${networkId.split(':').pop()?.toLowerCase()}.etherscan.io/address/`
          : networkId.startsWith('cosmos')
          ? `https://www.mintscan.io/${networkId.split(':')[1]}/account/`
          : `https://explorer.pioneers.dev/${networkId}/address/`,
        explorerTxLink: networkId.startsWith('eip155')
          ? `https://${networkId.split(':').pop()?.toLowerCase()}.etherscan.io/tx/`
          : networkId.startsWith('cosmos')
          ? `https://www.mintscan.io/${networkId.split(':')[1]}/txs/`
          : `https://explorer.pioneers.dev/${networkId}/tx/`,
        pubkeys: (app.pubkeys || []).filter((p: any) => {
          // Include pubkeys that match either the specific network or the wildcard
          return p.networks.includes(networkId) || 
                (matchingNetwork.networkId.includes('*') && 
                 p.networks.includes(matchingNetwork.networkId));
        })
      }
      
      console.log('🔍 [AssetPage] Setting asset context with data:', assetContextData)
      console.log('🔍 [AssetPage] Asset context pubkeys:', assetContextData.pubkeys)
      
      try {
        app.setAssetContext(assetContextData)
        console.log('✅ [AssetPage] Asset context set successfully')
      } catch (error) {
        console.error('❌ [AssetPage] Error setting asset context:', error)
      }
    } else {
      console.error('⚠️ [AssetPage] Could not find network with ID:', networkId)
      // Could redirect to an error page or dashboard
      router.push('/')
    }
  }, [isAppReady, decodedCaip, app, router])

  // Handle navigation functions
  const handleBack = () => {
    if (currentView !== 'asset') {
      // If in send or receive view, go back to asset view
      setCurrentView('asset')
    } else {
      // If already in asset view, go back to dashboard
      console.log('🔙 [AssetPage] Navigating back to dashboard')
      router.push('/') 
    }
  }

  // Render skeleton while waiting for app to be ready
  if (!isAppReady) {
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
            Loading asset data...
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
              onBackClick={handleBack} 
              onSendClick={() => setCurrentView('send')}
              onReceiveClick={() => setCurrentView('receive')}
            />
          )}
          
          {currentView === 'send' && (
            /* @ts-ignore */
            <Send onBackClick={handleBack} />
          )}
          
          {currentView === 'receive' && (
            <Receive onBackClick={handleBack} />
          )}
        </Box>
      </Box>
    </Box>
  )
} 