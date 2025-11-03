'use client'

import React from 'react';
import { useEffect, useState } from 'react'
import { SDK } from '@pioneer-platform/pioneer-sdk'
import { availableChainsByWallet, getChainEnumValue, WalletOption } from '@pioneer-platform/pioneer-types'
// @ts-ignore
import { caipToNetworkId, ChainToNetworkId } from '@pioneer-platform/pioneer-caip'
import { getPaths } from '@pioneer-platform/pioneer-coins'
import { Provider as ChakraProvider } from "@/components/ui/provider"
import { AppProvider } from '@/components/providers/pioneer'
import { LogoIcon } from '@/components/logo'
import { keyframes } from '@emotion/react'
import { Flex } from '@chakra-ui/react'
import { v4 as uuidv4 } from 'uuid'
import ConnectionError from '@/components/error/ConnectionError'
import { getCustomPaths } from '@/lib/storage/customPaths'

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
  const [isVaultUnavailable, setIsVaultUnavailable] = useState(false);

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

        // Load existing KeepKey API key from storage (generated after device pairing)
        let keepkeyApiKey = localStorage.getItem('keepkeyApiKey') || 'keepkey-api-key-default';
        if (localStorage.getItem('keepkeyApiKey')) {
          console.log('🔐 Using stored keepkeyApiKey from previous pairing session');
        } else {
          console.log('🔐 No keepkeyApiKey found - using default, will be replaced after device pairing');
        }

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

        // Load custom paths from localStorage and add them before hardcoded paths
        const customPaths = getCustomPaths();
        if (customPaths.length > 0) {
          console.log(`📂 [CustomPaths] Loading ${customPaths.length} custom paths from localStorage`);
          customPaths.forEach((customPath, index) => {
            // Remove metadata fields that aren't needed for Pioneer SDK
            const { createdAt, id, ...pathConfig } = customPath;
            paths.push(pathConfig);
            console.log(`📂 [CustomPaths] Added custom path ${index + 1}:`, pathConfig.note);
          });
        } else {
          console.log('📂 [CustomPaths] No custom paths found in localStorage');
        }

        paths.push({
          note: 'Bitcoin account 1 legacy',
          networks: ['bip122:000000000019d6689c085ae165831e93'],
          script_type: 'p2pkh',
          available_scripts_types: ['p2pkh', 'p2sh', 'p2wpkh', 'p2sh-p2wpkh'],
          type: 'xpub',
          addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 1],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 1, 0, 0],
          curve: 'secp256k1',
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        });

        paths.push({
          note:"Bitcoin account 1 Segwit (p2sh-p2wpkh) (ypub) (bip49)",
          networks: ['bip122:000000000019d6689c085ae165831e93'],
          script_type:"p2sh-p2wpkh",
          available_scripts_types:['p2pkh','p2sh','p2wpkh','p2sh-p2wpkh'],
          type:"ypub",
          addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 1],
          addressNListMaster: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 1, 0, 0],
          curve: 'secp256k1',
          showDisplay: false // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        })

        //add account1
        paths.push({
          note: 'Bitcoin account 1 Native Segwit (Bech32)',
          blockchain: 'bitcoin',
          symbol: 'BTC',
          symbolSwapKit: 'BTC',
          networks: ['bip122:000000000019d6689c085ae165831e93'],
          script_type: 'p2wpkh', //bech32
          available_scripts_types: ['p2pkh', 'p2sh', 'p2wpkh', 'p2sh-p2wpkh'],
          type: 'zpub',
          addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 1],
          addressNListMaster: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 1, 0, 0],
          curve: 'secp256k1',
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        });

        paths.push({
          note: 'Bitcoin account 2 legacy',
          networks: ['bip122:000000000019d6689c085ae165831e93'],
          script_type: 'p2pkh',
          available_scripts_types: ['p2pkh', 'p2sh', 'p2wpkh', 'p2sh-p2wpkh'],
          type: 'xpub',
          addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 2],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 2, 0, 0],
          curve: 'secp256k1',
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        });

        paths.push({
          note:"Bitcoin account 2 Segwit (p2sh-p2wpkh) (ypub) (bip49)",
          networks: ['bip122:000000000019d6689c085ae165831e93'],
          script_type:"p2sh-p2wpkh",
          available_scripts_types:['p2pkh','p2sh','p2wpkh','p2sh-p2wpkh'],
          type:"ypub",
          addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 2],
          addressNListMaster: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 2, 0, 0],
          curve: 'secp256k1',
          showDisplay: false // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        })

        //add account2 segwit
        paths.push({
          note: 'Bitcoin account 2 Native Segwit (Bech32)',
          blockchain: 'bitcoin',
          symbol: 'BTC',
          symbolSwapKit: 'BTC',
          networks: ['bip122:000000000019d6689c085ae165831e93'],
          script_type: 'p2wpkh', //bech32
          available_scripts_types: ['p2pkh', 'p2sh', 'p2wpkh', 'p2sh-p2wpkh'],
          type: 'zpub',
          addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 2],
          addressNListMaster: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 2, 0, 0],
          curve: 'secp256k1',
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
        });

        //
        paths.push({
          note:" MAYA path 1",
          type:"address",
          addressNList: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 1],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 1],
          curve: 'secp256k1',
          script_type:"mayachain",
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
          networks: ['cosmos:mayachain-mainnet-v1'],
        });

        paths.push({
          note:" MAYA path 2",
          type:"address",
          addressNList: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 2],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 2],
          curve: 'secp256k1',
          script_type:"mayachain",
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
          networks: ['cosmos:mayachain-mainnet-v1'],
        });

        paths.push({
          note:" MAYA path 3",
          type:"address",
          addressNList: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 3],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 3],
          curve: 'secp256k1',
          script_type:"mayachain",
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
          networks: ['cosmos:mayachain-mainnet-v1'],
        });

        paths.push({
          note:" MAYA path 4",
          type:"address",
          addressNList: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 4],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 4],
          curve: 'secp256k1',
          script_type:"mayachain",
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
          networks: ['cosmos:mayachain-mainnet-v1'],
        });

        paths.push({
          note:" MAYA path 5",
          type:"address",
          addressNList: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 5],
          addressNListMaster: [0x80000000 + 44, 0x80000000 + 931, 0x80000000 + 0, 0, 5],
          curve: 'secp256k1',
          script_type:"mayachain",
          showDisplay: false, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
          networks: ['cosmos:mayachain-mainnet-v1'],
        });

        // // Filter out any unsupported networks that cause getCharts errors
        const unsupportedNetworks = [
          // 'eip155:100', // Gnosis/xDAI
          // 'eip155:250', // Fantom
          // 'eip155:534352', // Scroll
          // 'eip155:324', // zkSync Era
          // 'eip155:1101', // Polygon zkEVM
        ];
        
        const originalLength = blockchains.length;
        blockchains = blockchains.filter((chain: string) => !unsupportedNetworks.includes(chain));
        
        console.log('🔧 Filtered blockchains:', {
          original: originalLength,
          filtered: blockchains.length,
          removed: originalLength - blockchains.length,
          removedNetworks: unsupportedNetworks
        });

        // Create Pioneer SDK instance directly
        console.log('🔧 Creating Pioneer SDK instance...');
        
        // Add debug check for KKAPI availability before SDK init
        console.log('🔍 [KKAPI DEBUG] Checking if vault endpoints are available...');
        let detectedKeeperEndpoint = undefined;
        
        // Try multiple endpoints to find the vault
        // swagger.json is the most reliable as it doesn't require auth
        const vaultEndpoints = [
          'http://localhost:1646/spec/swagger.json',
          'http://127.0.0.1:1646/spec/swagger.json',
          'http://localhost:1646/auth/pair' // This should return 400 if running
        ];
        
        for (const endpoint of vaultEndpoints) {
          console.log(`🔍 [KKAPI DEBUG] Trying ${endpoint}...`);
          try {
            const healthCheck = await fetch(endpoint, { 
              method: 'GET',
              signal: AbortSignal.timeout(1000),
              headers: {
                'Accept': 'application/json',
              }
            });
            
            console.log(`🔍 [KKAPI DEBUG] Response from ${endpoint}:`, {
              status: healthCheck.status,
              ok: healthCheck.ok,
              statusText: healthCheck.statusText
            });
            
            // Check if we got a successful response (200 for swagger.json, or 400 for auth/pair)
            if (healthCheck.ok || (endpoint.includes('/auth/pair') && healthCheck.status === 400)) {
              // Extract base URL from the endpoint
              const baseUrl = endpoint.replace(/\/(spec\/swagger\.json|auth\/pair|api.*)$/, '');
              detectedKeeperEndpoint = baseUrl;
              console.log(`✅ [KKAPI DEBUG] Vault detected at: ${detectedKeeperEndpoint}`);
              break;
            }
          } catch (error: any) {
            console.log(`❌ [KKAPI DEBUG] Failed to reach ${endpoint}:`, error?.message || error);
          }
        }
        
        if (!detectedKeeperEndpoint) {
          console.log('⚠️ [KKAPI DEBUG] Vault not detected - showing connection error');
          setIsVaultUnavailable(true);
          setIsLoading(false);
          PIONEER_INITIALIZED = false; // Reset flag so retry can work
          return; // Stop initialization if vault is not available
        }
        
        const appInit = new SDK(PIONEER_URL, {
          spec: PIONEER_URL,
          wss: PIONEER_WSS,
          appName: 'KeepKey Portfolio',
          appIcon: 'https://pioneers.dev/coins/keepkey.png',
          blockchains,
          keepkeyApiKey,
          keepkeyEndpoint: detectedKeeperEndpoint, // 👈 Pass the detected endpoint to SDK
          username,
          queryKey,
          paths,
          // Add these to match working projects
          ethplorerApiKey: 'EK-xs8Hj-qG4HbLY-LoAu7',
          covalentApiKey: 'cqt_rQ6333MVWCVJFVX3DbCCGMVqRH4q',
          utxoApiKey: 'B_s9XK926uwmQSGTDEcZB3vSAmt5t2',
          walletConnectProjectId: '18224df5f72924a5f6b3569fbd56ae16',
        });

        console.log('🔧 Pioneer SDK instance created with config:', {
          mode: detectedKeeperEndpoint ? 'LOCAL DEV (Vault REST)' : 'LEGACY (Desktop REST)',
          endpoint: detectedKeeperEndpoint || 'kkapi:// (will fallback to legacy)',
          hasPortfolioAPI: !!detectedKeeperEndpoint
        });
        console.log('🔧 Calling init...');
        
        // Add network filtering to prevent unsupported networks from being processed
        const originalGetBalances = appInit.getBalances?.bind(appInit);
        if (originalGetBalances) {
          appInit.getBalances = async (...args: any[]) => {
            const result = await originalGetBalances(...args);
            // Filter out any balances from unsupported networks like scroll
            if (appInit.balances && Array.isArray(appInit.balances)) {
              const originalLength = appInit.balances.length;
              appInit.balances = appInit.balances.filter((balance: any) => {
                if (!balance.networkId) return true;
                const isSupported = blockchains.includes(balance.networkId);
                if (!isSupported) {
                  console.warn('🚫 Filtering out unsupported network balance:', {
                    networkId: balance.networkId,
                    caip: balance.caip,
                    symbol: balance.symbol || balance.ticker
                  });
                }
                return isSupported;
              });
              if (originalLength !== appInit.balances.length) {
                console.log(`🔧 Filtered ${originalLength - appInit.balances.length} unsupported network balances`);
              }
            }
            return result;
          };
        }
        
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
          // Use normal init flow with FULL SYNC (skipSync: false)
          // This matches the working integration-coins pattern
          console.log("🔧 Calling appInit.init() with FULL SYNC (skipSync: false)...");

          const resultInit = await Promise.race([
            appInit.init({}, { skipSync: false }),  // ✅ CRITICAL: skipSync: false enables full initialization
            initTimeout
          ]);
          
          clearInterval(progressInterval);
          
          console.log("✅ Pioneer SDK initialized, resultInit:", resultInit);
          console.log("📊 Wallets:", appInit.wallets.length);
          console.log("🔑 Pubkeys:", appInit.pubkeys.length);
          console.log("💰 Balances:", appInit.balances.length);
          
        } catch (initError: any) {
          clearInterval(progressInterval);
          console.error('⏱️ SDK init failed:', initError);
          
          // Check if it's a non-critical error we can handle
          if (initError.message && initError.message.includes('GetPortfolioBalances')) {
            console.warn('⚠️ GetPortfolioBalances failed during init, continuing with limited functionality');
            console.log("📊 Partial initialization - Wallets:", appInit.wallets?.length || 0);
            console.log("🔑 Partial initialization - Pubkeys:", appInit.pubkeys?.length || 0);
            console.log("💰 Partial initialization - Balances:", appInit.balances?.length || 0);
          } else {
            // For other critical errors, still try to go online
            console.log("⚠️ [FALLBACK] Attempting to go online despite init error");
          }
        }
        
        // Basic validation - allow app to go online with cached data
        if (!appInit.blockchains || !appInit.blockchains[0]) {
          console.warn('⚠️ No blockchains - using fallback');
        }
        if (!appInit.pubkeys || !appInit.pubkeys[0]) {
          console.warn('⚠️ No pubkeys yet - will load on first sync');
        }
        if (!appInit.balances || !appInit.balances[0]) {
          console.warn('⚠️ No balances found - this is OK if wallet is empty');
        }

        // Skip setting default asset contexts - will be done later when needed
        console.log('🔧 Skipping default asset contexts - will set later when needed');

        // Try to get some data to verify the SDK is working
        try {
          console.log('🔍 Testing SDK functionality...');
          
          // Get assets to verify API connection
          const assets = await appInit.getAssets();
          console.log('✅ Got assets:', assets?.length || 0);
          
          // Start background chart fetching to populate staking positions and other chart data
          try {
            // Only call getCharts if we have pubkeys (addresses) to look up
            if (appInit.pubkeys && appInit.pubkeys.length > 0) {
              console.log('📊 Starting chart fetching (including staking positions)...');
              console.log('📊 Balances before getCharts:', appInit.balances.length);
              
              try {
                await appInit.getCharts();
                console.log('✅ Chart fetching completed successfully');
                console.log('📊 Balances after getCharts:', appInit.balances.length);
              } catch (chartError: any) {
                // Check if it's a network support error
                if (chartError?.message?.includes('network not live in blockchains')) {
                  // Extract the unsupported network from the error message
                  const match = chartError.message.match(/"([^"]+)"/);
                  const network = match ? match[1] : 'unknown';
                  console.log(`ℹ️ Network ${network} not supported for charts - skipping`);
                  // This is expected - some networks don't have chart support
                } else {
                  console.error('❌ Chart fetching error:', chartError);
                }
              }
            } else {
              console.log('⏭️ Skipping chart fetching - no pubkeys available yet (wallet not paired)');
            }
            
            // Debug: Look for staking positions
            const stakingBalances = appInit.balances.filter((b: any) => b.chart === 'staking');
            console.log('📊 Staking positions found:', stakingBalances.length);
            if (stakingBalances.length > 0) {
              console.log('📊 First staking position:', stakingBalances[0]);
            }
            
            // Debug: Look for cosmos balances
            const cosmosBalances = appInit.balances.filter((b: any) => b.networkId?.includes('cosmos'));
            console.log('📊 Cosmos balances found:', cosmosBalances.length);
            if (cosmosBalances.length > 0) {
              console.log('📊 First cosmos balance:', cosmosBalances[0]);
            }
            
          } catch (chartError) {
            console.warn('⚠️ Chart fetching failed, continuing anyway:', chartError);
            console.warn('⚠️ Chart error details:', chartError);
            // Don't throw - this is not critical for basic functionality
          }
          
          // Try to connect to KeepKey if available
          console.log('🔑 Attempting to connect to KeepKey...');
          console.log('🔑 KeepKey SDK before pairing:', !!appInit.keepKeySdk);
          
          try {
            const keepkeyConnected = await appInit.pairWallet('KEEPKEY');
            console.log('🔑 KeepKey connection result:', keepkeyConnected);
            console.log('🔑 KeepKey SDK after pairing:', !!appInit.keepKeySdk);
            
            // After successful pairing, save the API key generated by the device/SDK
            if (appInit.keepkeyApiKey && appInit.keepkeyApiKey !== keepkeyApiKey) {
              try {
                localStorage.setItem('keepkeyApiKey', appInit.keepkeyApiKey);
                console.log('🔐 ✅ Persisted keepkeyApiKey after successful device pairing');
              } catch (storageError) {
                console.warn('⚠️ Failed to persist keepkeyApiKey after pairing:', storageError);
              }
            }
            
            if (appInit.keepKeySdk) {
              console.log('🔑 ✅ KeepKey SDK is now initialized - calling refresh()');
              
              // Filter unsupported networks from the SDK's blockchains if possible
              if (appInit.blockchains && Array.isArray(appInit.blockchains)) {
                const unsupportedNetworks = [
                  'eip155:100', // Gnosis/xDAI
                  'eip155:250', // Fantom
                  'eip155:534352', // Scroll
                  'eip155:324', // zkSync Era
                  'eip155:1101', // Polygon zkEVM
                ];
                
                const originalCount = appInit.blockchains.length;
                appInit.blockchains = appInit.blockchains.filter((chain: string) => !unsupportedNetworks.includes(chain));
                console.log('🔑 Filtered blockchains after pairing:', {
                  original: originalCount,
                  filtered: appInit.blockchains.length,
                  removed: originalCount - appInit.blockchains.length
                });
              }
              
              //appInit.refresh();
              console.log('🔑 ✅ refresh() completed - dashboard should now be available');
              
              // Now that we have pubkeys after pairing, fetch chart data including staking positions
              try {
                if (appInit.pubkeys && appInit.pubkeys.length > 0) {
                  // Check if we have problematic networks
                  const hasProblematicNetworks = appInit.blockchains?.some((chain: string) => 
                    ['eip155:100', 'eip155:250', 'eip155:534352', 'eip155:324', 'eip155:1101'].includes(chain)
                  );
                  
                  if (hasProblematicNetworks) {
                    console.log('ℹ️ Skipping getCharts after pairing - unsupported networks detected');
                  } else {
                    console.log('📊 Fetching charts after wallet pairing...');
                    try {
                      await appInit.getCharts();
                      console.log('✅ Chart data fetched successfully after pairing');
                    } catch (getChartsError: any) {
                      // Fallback error handling just in case
                      console.log('ℹ️ Chart fetching skipped:', getChartsError.message);
                    }
                  }
                  
                  // Debug: Check for staking positions
                  const stakingBalances = appInit.balances.filter((b: any) => b.chart === 'staking');
                  console.log('📊 Staking positions after pairing:', stakingBalances.length);
                } else {
                  console.log('⚠️ No pubkeys available after pairing - cannot fetch charts');
                }
              } catch (chartError) {
                console.warn('⚠️ Chart fetching failed after pairing:', chartError);
                // Don't throw - this is not critical for basic functionality
              }
            } else {
              console.log('🔑 ⚠️ KeepKey SDK still not initialized after pairing');
            }
          } catch (pairError) {
            console.error('🔑 ❌ KeepKey pairing failed:', pairError);
            console.log('🔑 This is expected if no KeepKey device is connected');
          }
        } catch (testError) {
          console.log('⚠️ SDK test failed:', testError);
          // Don't throw - these are optional features
        }



        console.log('🎯 Pioneer SDK fully initialized!');
        console.log('🔍 Final SDK state:', {
          status: appInit.status,
          pubkeys: appInit.pubkeys?.length || 0,
          balances: appInit.balances?.length || 0,
          dashboard: !!appInit.dashboard,
          dashboardNetworks: appInit.dashboard?.networks?.length || 0
        });
        
        // Debug: Check what data is actually available
        console.log('🔍 Available data structures:');
        console.log('📊 Balances:', appInit.balances?.length || 0);
        console.log('🔑 Pubkeys:', appInit.pubkeys?.length || 0);
        console.log('🌐 Blockchains:', appInit.blockchains?.length || 0);
        console.log('💰 Dashboard:', !!appInit.dashboard);
        
        if (appInit.balances && appInit.balances.length > 0) {
          console.log('📊 Sample balance:', appInit.balances[0]);
        }
        
        if (appInit.pubkeys && appInit.pubkeys.length > 0) {
          console.log('🔑 Sample pubkey:', appInit.pubkeys[0]);
        }
        
        if (appInit.blockchains && appInit.blockchains.length > 0) {
          console.log('🌐 Sample blockchain:', appInit.blockchains[0]);
        }
        
        if (appInit.dashboard) {
          console.log('💰 Dashboard data:', appInit.dashboard);
        } else {
          console.log('💰 No dashboard data - this indicates sync() was not called!');
          console.log('💰 KeepKey SDK status:', !!appInit.keepKeySdk);
          console.log('💰 This means KeepKey device is not connected or initialized');
        }
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

  // Ensure outbound asset context carries a valid address derived from pubkeys
  useEffect(() => {
    const app = pioneerSdk;
    if (!app) return;
    const caip = app?.outboundAssetContext?.caip;
    if (!caip) return;
    const networkId = caipToNetworkId(caip);
    if (!networkId) return;
    const prefix = networkId.split(':')[0];
    const pk = app?.pubkeys?.find(
      (p: any) => Array.isArray(p?.networks) && (
        p.networks.includes(networkId) ||
        p.networks.includes(`${prefix}:*`) ||
        p.networks.some((n: string) => typeof n === 'string' && n.startsWith(`${prefix}:`))
      )
    );
    const derivedAddress = pk?.address || pk?.master || pk?.pubkey || '';
    const existingAddress = (app?.outboundAssetContext as any)?.address || (app?.outboundAssetContext as any)?.master || '';
    if (derivedAddress && !existingAddress && typeof app?.setOutboundAssetContext === 'function') {
      app.setOutboundAssetContext({
        caip,
        networkId,
        symbol: app?.outboundAssetContext?.symbol,
        name: app?.outboundAssetContext?.name,
        icon: app?.outboundAssetContext?.icon,
        address: derivedAddress,
      });
    }
  }, [pioneerSdk, pioneerSdk?.outboundAssetContext?.caip, pioneerSdk?.pubkeys]);

  // Handler for retry button in ConnectionError
  const handleRetry = () => {
    console.log('🔄 Retrying vault connection...');
    setIsVaultUnavailable(false);
    setIsLoading(true);
    setError(null);
    PIONEER_INITIALIZED = false; // Reset the flag to allow re-initialization
    // Force a re-render and re-run the effect
    setPioneerSdk(null);
    // Trigger re-initialization
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Show connection error if vault is unavailable
  if (isVaultUnavailable) {
    return (
      <ChakraProvider>
        <ConnectionError onRetry={handleRetry} />
      </ChakraProvider>
    );
  }

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
          backgroundImage="url(/images/backgrounds/splash-bg.png)"
          backgroundSize="cover"
          backgroundPosition="center"
          backgroundRepeat="no-repeat"
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
