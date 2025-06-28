'use client'

import React from 'react';
import { useEffect, useState } from 'react'
import { SDK } from '@coinmasters/pioneer-sdk'
import { availableChainsByWallet, getChainEnumValue, WalletOption } from '@coinmasters/types'
// @ts-ignore
import { caipToNetworkId, ChainToNetworkId } from '@pioneer-platform/pioneer-caip'
import { getPaths } from '@pioneer-platform/pioneer-coins'
import { Provider as ChakraProvider } from "@/components/ui/provider"
import { AppProvider } from '@/components/providers/pioneer'
import { LogoIcon } from '@/components/logo'
import { keyframes } from '@emotion/react'
import { Flex } from '@chakra-ui/react'
import { v4 as uuidv4 } from 'uuid'

interface ProviderProps {
  children: React.ReactNode;
}

const scale = keyframes`
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
`

// Get environment variables with fallbacks
const PIONEER_URL = process.env.NEXT_PUBLIC_PIONEER_URL || 'https://pioneers.dev/spec/swagger.json'
const PIONEER_WSS = process.env.NEXT_PUBLIC_PIONEER_WSS || 'wss://pioneers.dev'

// Global flag to prevent multiple Pioneer initializations in development
let PIONEER_INITIALIZED = false;

export function Provider({ children }: ProviderProps) {
  console.log('🚀 Direct Pioneer SDK Provider started!');
  const [pioneerSdk, setPioneerSdk] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Prevent multiple initializations
    if (PIONEER_INITIALIZED) {
      console.log('🚫 Pioneer already initialized, skipping');
      return;
    }

    const initPioneerSDK = async () => {
      console.log('🔥 Starting direct Pioneer SDK initialization');
      PIONEER_INITIALIZED = true;
      
      try {
        setIsLoading(true);
        setError(null);

        // Generate credentials like pioneer-react does
        const username = localStorage.getItem('username') || `user:${uuidv4()}`.substring(0, 13);
        localStorage.setItem('username', username);

        const queryKey = localStorage.getItem('queryKey') || `key:${uuidv4()}`;
        localStorage.setItem('queryKey', queryKey);

        let keepkeyApiKey = localStorage.getItem('keepkeyApiKey');
        if (!keepkeyApiKey) keepkeyApiKey = '57dd3fa6-9344-4bc5-8a92-924629076018';
        localStorage.setItem('keepkeyApiKey', keepkeyApiKey);

        console.log('🔧 Pioneer credentials:', { username, queryKey, keepkeyApiKey });
        console.log('🔧 Pioneer URLs:', { PIONEER_URL, PIONEER_WSS });

        // Get supported blockchains like pioneer-react does
        const walletType = WalletOption.KEEPKEY;
        const allSupported = availableChainsByWallet[walletType];
        let blockchains = allSupported.map(
          // @ts-ignore
          (chainStr: any) => ChainToNetworkId[getChainEnumValue(chainStr)],
        );
        const paths = getPaths(blockchains);

        console.log('🔧 Blockchains:', blockchains);
        console.log('🔧 Paths length:', paths.length);

        // Create Pioneer SDK instance directly
        console.log('🔧 Creating Pioneer SDK instance...');
        const appInit = new SDK(PIONEER_URL, {
          spec: PIONEER_URL,
          wss: PIONEER_WSS,
          appName: 'KeepKey Portfolio',
          appIcon: 'https://pioneers.dev/coins/keepkey.png',
          blockchains,
          keepkeyApiKey,
          username,
          queryKey,
          paths,
          // Add these to match working projects
          ethplorerApiKey: 'EK-xs8Hj-qG4HbLY-LoAu7',
          covalentApiKey: 'cqt_rQ6333MVWCVJFVX3DbCCGMVqRH4q',
          utxoApiKey: 'B_s9XK926uwmQSGTDEcZB3vSAmt5t2',
          walletConnectProjectId: '18224df5f72924a5f6b3569fbd56ae16',
        });

        console.log('🔧 Pioneer SDK instance created, calling init...');
        
        // Add progress tracking
        let progressInterval = setInterval(() => {
          console.log('⏳ Still initializing...', {
            status: appInit.status,
            pioneer: !!appInit.pioneer,
            keepKeySdk: !!appInit.keepKeySdk,
            events: !!appInit.events,
            wallets: appInit.wallets?.length || 0,
            pubkeys: appInit.pubkeys?.length || 0,
            balances: appInit.balances?.length || 0
          });
        }, 3000);
        
        // Add timeout to prevent infinite hanging
        const initTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SDK init timeout after 30 seconds')), 30000)
        );
        
        try {
          // Initialize exactly like e2e test
          const resultInit = await Promise.race([
            appInit.init({}, {}),
            initTimeout
          ]);
          
          clearInterval(progressInterval);
          
          console.log("✅ Pioneer SDK initialized, resultInit:", resultInit);
          console.log("📊 Wallets:", appInit.wallets.length);
          console.log("🔑 Pubkeys:", appInit.pubkeys.length);
          console.log("💰 Balances:", appInit.balances.length);
        } catch (timeoutError) {
          clearInterval(progressInterval);
          console.error('⏱️ SDK init timed out:', timeoutError);
          throw new Error('Pioneer SDK initialization timed out. Check the browser console for more details.');
        }
        
        // Verify initialization like e2e test
        if (!appInit.blockchains || !appInit.blockchains[0]) {
          throw new Error('Blockchains not initialized');
        }
        if (!appInit.pubkeys || !appInit.pubkeys[0]) {
          throw new Error('Pubkeys not initialized');
        }
        if (!appInit.balances || !appInit.balances[0]) {
          console.warn('⚠️ No balances found - this is OK if wallet is empty');
        }

        // Set default asset contexts like pioneer-react does
        let assets_enabled = [
          'eip155:1/slip44:60', // ETH
          'bip122:000000000019d6689c085ae165831e93/slip44:0', // BTC
        ];
        const defaultInput = {
          caip: assets_enabled[0],
          networkId: caipToNetworkId(assets_enabled[0]),
        };
        const defaultOutput = {
          caip: assets_enabled[1],
          networkId: caipToNetworkId(assets_enabled[1]),
        };
        
        console.log('🔧 Setting default asset contexts...');
        await appInit.setAssetContext(defaultInput);
        await appInit.setOutboundAssetContext(defaultOutput);

        // Try to get some data to verify the SDK is working
        try {
          console.log('🔍 Testing SDK functionality...');
          
          // Get assets to verify API connection
          const assets = await appInit.getAssets();
          console.log('✅ Got assets:', assets?.length || 0);
          
          // Start background chart fetching
          appInit.getCharts();
          
          // Try to connect to KeepKey if available
          console.log('🔑 Attempting to connect to KeepKey...');
          const keepkeyConnected = await appInit.pairWallet('KEEPKEY');
          console.log('🔑 KeepKey connection result:', keepkeyConnected);
        } catch (testError) {
          console.log('⚠️ SDK test failed:', testError);
          // Don't throw - these are optional features
        }

        console.log('🎯 Pioneer SDK fully initialized!');
        console.log('🔍 Final SDK state:', {
          status: appInit.status,
          pubkeys: appInit.pubkeys?.length || 0,
          balances: appInit.balances?.length || 0,
          dashboard: !!appInit.dashboard
        });
        setPioneerSdk(appInit);
      } catch (e) {
        console.error('💥 FATAL: Pioneer SDK initialization failed:', e);
        console.error('💥 Error details:', {
          message: (e as Error)?.message,
          stack: (e as Error)?.stack,
          name: (e as Error)?.name
        });
        PIONEER_INITIALIZED = false; // Reset flag on error
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    };

    initPioneerSDK();
  }, []);

  if (error) {
    return (
      <ChakraProvider>
        <Flex 
          width="100vw" 
          height="100vh" 
          justify="center" 
          align="center"
          flexDirection="column" 
          gap={4}
          bg="gray.800"
        >
          <LogoIcon 
            boxSize="8"
            opacity="0.5"
          />
          <div style={{ color: '#EF4444' }}>Failed to initialize Pioneer SDK!</div>
          <div style={{ color: '#6B7280', fontSize: '14px', maxWidth: '80%', textAlign: 'center' }}>
            {error.message}
          </div>
          <div 
            style={{ color: '#60A5FA', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </div>
        </Flex>
      </ChakraProvider>
    )
  }

  if (isLoading) {
    return (
      <ChakraProvider>
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
      </ChakraProvider>
    )
  }

  // Create a simple context value
  const contextValue = {
    state: {
      status: 'connected',
      app: pioneerSdk,
      api: pioneerSdk?.pioneer,
      username: pioneerSdk?.username,
      assetContext: pioneerSdk?.assetContext,
      outboundAssetContext: pioneerSdk?.outboundAssetContext,
      balances: pioneerSdk?.balances || [],
      pubkeys: pioneerSdk?.pubkeys || [],
      dashboard: pioneerSdk?.dashboard,
    },
    dispatch: () => {},
  };

  return (
    <ChakraProvider>
      <AppProvider pioneer={contextValue}>
        {children}
      </AppProvider>
    </ChakraProvider>
  );
} 
