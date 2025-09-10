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

// Define view types
type ViewType = 'asset' | 'send' | 'receive' | 'swap';

export default function AssetPage() {
  const params = useParams()
  const [isAppReady, setIsAppReady] = useState(false)
  const [appCheckAttempts, setAppCheckAttempts] = useState(0)
  const [decodedCaip, setDecodedCaip] = useState<string | null>(null)
  const [pubkeys, setPubkeys] = useState<any>([])
  const [balances, setBalances] = useState<any>([])

  // Track the current view instead of dialog state
  const [currentView, setCurrentView] = useState<ViewType>('asset')
  
  // Decode the parameter immediately - it might be both URL-encoded AND Base64 encoded
  useEffect(() => {
    if (!params.caip) return;
    const encodedCaip = decodeURIComponent(params.caip as string)
    let caip: string
    try {
      // Attempt to decode from Base64
      caip = atob(encodedCaip)
      console.log('🔍 [AssetPage] Final decoded parameter:', { caip })
      setDecodedCaip(caip)
    } catch (error:any) {
      console.error('invalid url: ',error)
    }
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
     try {
       const caip = decodedCaip
       console.log('🔄 [AssetPage] App is ready, setting asset context from URL parameter:', caip)
       app.setAssetContext({caip})
       console.log('✅ [AssetPage] Asset context set successfully')

       console.log('[AssetPage] ', app.assetContext)
     } catch (error) {
       console.error('❌ [AssetPage] Error setting asset context:', error)
     }
  }, [isAppReady, decodedCaip, app, router])

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
              onSwapClick={() => {
                if (isFeatureEnabled('enableSwaps')) {
                  setCurrentView('swap')
                }
              }}
            />
          )}
          
          {currentView === 'send' && (
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