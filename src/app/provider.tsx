'use client'

import React from 'react';
import { useEffect, useState } from 'react'
import { PioneerProvider as BasePioneerProvider, usePioneer } from "@coinmasters/pioneer-react"
import { AppProvider } from '@/components/providers/pioneer'
import { Provider as ChakraProvider } from "@/components/ui/provider"
import { LogoIcon } from '@/components/logo'
import { keyframes } from '@emotion/react'
import { Flex, Center, Text } from '@chakra-ui/react'
import { ConnectionError } from '@/components/error'

interface ProviderProps {
  children: React.ReactNode;
}

const scale = keyframes`
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
`

// Get environment variables with fallbacks
const PIONEER_URL = process.env.NEXT_PUBLIC_PIONEER_URL
const PIONEER_WSS = process.env.NEXT_PUBLIC_PIONEER_WSS

// Create a wrapper component to handle Pioneer initialization
function PioneerInitializer({ children, onPioneerReady }: {
  children: React.ReactNode
  onPioneerReady: (pioneer: ReturnType<typeof usePioneer>) => void
}) {
  const pioneer = usePioneer()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const initPioneer = async () => {
      if (isInitialized) return

      try {
        setIsLoading(true)
        setError(null)

        // Initialize Pioneer with retries
        let retries = 3;
        while (retries > 0) {
          try {
            const pioneerSetup = {
              appName: 'KeepKey Portfolio',
              appIcon: 'https://pioneers.dev/coins/keepkey.png',
              spec: PIONEER_URL,
              wss: PIONEER_WSS,
              configWss: {
                reconnect: true,
                reconnectInterval: 3000,
                maxRetries: 5
              }
            }
            
            console.log('pioneerSetup: ', pioneerSetup)
            await pioneer.onStart([], pioneerSetup)
            break;
          } catch (e) {
            retries--;
            if (retries === 0) throw e;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        setIsInitialized(true)
        onPioneerReady(pioneer)
      } catch (e) {
        console.error('Pioneer initialization error:', e)
        setError(e as Error)
      } finally {
        setIsLoading(false)
      }
    }

    initPioneer()
  }, [pioneer, isInitialized, onPioneerReady])

  if (error) {
    return (
      <Center w="100vw" h="100vh" flexDirection="column" gap={4}>
        <LogoIcon 
          boxSize="8"
          opacity="0.5"
        />
        <Text color="red.500">Failed to connect to Server!</Text>
        <Text color="gray.500" fontSize="sm" maxW="80%" textAlign="center">
          {error.message}
        </Text>
        <Text 
          as="button" 
          color="blue.400" 
          fontSize="sm" 
          onClick={() => window.location.reload()}
          _hover={{ textDecoration: 'underline' }}
        >
          Retry Connection
        </Text>
      </Center>
    )
  }

  if (isLoading) {
    return (
      <Flex 
        width="100vw" 
        height="100vh" 
        justify="center" 
        align="center"
        bg="gray.800"
      >
        <LogoIcon 
          boxSize="24"
          animation={`${scale} 2s ease-in-out infinite`}
          opacity="0.8"
        />
      </Flex>
    )
  }

  return <>{children}</>
}

export function Provider({ children }: ProviderProps) {
  const [pioneerInstance, setPioneerInstance] = useState<ReturnType<typeof usePioneer> | null>(null)

  const handlePioneerReady = (pioneer: ReturnType<typeof usePioneer>) => {
    setPioneerInstance(pioneer)
  }

  return (
    <ChakraProvider>
      <BasePioneerProvider>
        <PioneerInitializer onPioneerReady={handlePioneerReady}>
          <AppProvider 
            onError={(error, info) => console.error(error, info)} 
            initialColorMode={'dark'} 
            pioneer={pioneerInstance}
          >
            {children}
          </AppProvider>
        </PioneerInitializer>
      </BasePioneerProvider>
    </ChakraProvider>
  );
} 
