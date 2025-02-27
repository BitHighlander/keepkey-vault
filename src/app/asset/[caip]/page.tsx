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
      setAppCheckAttempts(prev => {
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
    let matchingNetwork = null
    
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
      
      // Create the asset context with the correct CAIP
      const assetContextData = {
        networkId: networkId, // The network part (e.g. "eip155:1")
        chainId: networkId,
        assetId: fullCaip, // The full CAIP (e.g. "eip155:1/slip44:60")
        caip: fullCaip,  // The full CAIP (e.g. "eip155:1/slip44:60")
        name: matchingNetwork.gasAssetSymbol,
        networkName: networkId.split(':').pop() || '',
        symbol: matchingNetwork.gasAssetSymbol,
        icon: matchingNetwork.icon,
        color: matchingNetwork.color,
        balance: matchingNetwork.totalNativeBalance,
        value: matchingNetwork.totalValueUsd,
        precision: 18,
        priceUsd: matchingNetwork.totalValueUsd / parseFloat(matchingNetwork.totalNativeBalance),
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
    <Flex 
      minH="100vh" 
      justify="center" 
      align="center" 
      bg="black"
    >
      <Box 
        width="375px" 
        height="100vh"
        bg="black" 
        overflow="hidden"
        position="relative"
        boxShadow="xl"
        borderRadius="2xl"
        border="1px solid"
        borderColor="gray.800"
      >
        {currentView === 'asset' && (
          <Asset 
            onBackClick={handleBack} 
            onSendClick={() => setCurrentView('send')}
            onReceiveClick={() => setCurrentView('receive')}
          />
        )}
        
        {currentView === 'send' && (
          <Send onBackClick={handleBack} />
        )}
        
        {currentView === 'receive' && (
          <Receive onBackClick={handleBack} />
        )}
      </Box>
    </Flex>
  )
} 