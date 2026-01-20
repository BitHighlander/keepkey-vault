// @ts-ignore

'use client'

// ============================================================================
// Console Filter: Suppress noisy Fast Refresh logs
// ============================================================================
if (typeof window !== 'undefined') {
  const shouldFilterMessage = (args: any[]) => {
    return args.some(arg => {
      const message = arg?.toString() || '';
      return message.includes('[Fast Refresh]');
    });
  };

  const originalLog = console.log;
  const originalInfo = console.info;

  console.log = (...args: any[]) => {
    if (shouldFilterMessage(args)) return;
    originalLog.apply(console, args);
  };

  console.info = (...args: any[]) => {
    if (shouldFilterMessage(args)) return;
    originalInfo.apply(console, args);
  };
}
// ============================================================================

// ============================================================================
// CRITICAL DIAGNOSTIC: Verify console works and file loads
// ============================================================================
console.log('========================================');
console.log('🚀 PROVIDER.TSX LOADED');
console.log('========================================');
// ============================================================================

import React from 'react';
import { useEffect, useState } from 'react'
import { SDK } from '@pioneer-platform/pioneer-sdk'
import { availableChainsByWallet, getChainEnumValue, WalletOption } from '@pioneer-platform/pioneer-types'
import { caipToNetworkId, ChainToNetworkId } from '@pioneer-platform/pioneer-caip'
import { getPaths } from '@pioneer-platform/pioneer-coins'
import { AppProvider } from '@/components/providers/pioneer'
import { LogoIcon } from '@/components/logo'
import { keyframes } from '@emotion/react'
import { Flex } from '@chakra-ui/react'
import { v4 as uuidv4 } from 'uuid'
import ConnectionError from '@/components/error/ConnectionError'
import WatchOnlyLanding from '@/components/landing/WatchOnlyLanding'
import { isZcashEnabled, ZCASH_NETWORK_ID, isPioneerV2Enabled, isFeatureEnabled } from '@/config/features'
import { getCustomPaths } from '@/lib/storage/customPaths'
import { savePubkeys, getDeviceInfo } from '@/lib/storage/pubkeyStorage'
import { isMobileApp } from '@/lib/platformDetection'
import { PendingSwapsPopup } from '@/components/swap/PendingSwapsPopup'
import { GlobalSwapProgress } from '@/components/swap/GlobalSwapProgress'
import { ChatPopup } from '@/components/chat/ChatPopup'

interface ProviderProps {
  children: React.ReactNode;
}

// Error state types for comprehensive error tracking
type InitPhase = 'sdk_create' | 'sdk_init' | 'get_balances' | 'get_charts' | 'pair_wallet' | 'event_subscription' | 'complete';

interface InitializationError {
  phase: InitPhase;
  error: Error;
  timestamp: number;
  recoverable: boolean;
}

const scale = keyframes`
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
`

// Get environment variables with fallbacks
const PIONEER_URL = process.env.NEXT_PUBLIC_PIONEER_URL || 'https://api.keepkey.info/spec/swagger.json'
// Allow user to configure WSS URL via Settings, fallback to env or default
const getConfiguredWss = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('pioneerWss') || process.env.NEXT_PUBLIC_PIONEER_WSS || 'wss://api.keepkey.info';
  }
  return process.env.NEXT_PUBLIC_PIONEER_WSS || 'wss://api.keepkey.info';
};
const PIONEER_WSS = getConfiguredWss()

// Global flag to prevent multiple Pioneer initializations in development
let PIONEER_INITIALIZED = false;

export function Provider({ children }: ProviderProps) {
  console.log('🚀 Direct Pioneer SDK Provider started!');
  const [pioneerSdk, setPioneerSdk] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isVaultUnavailable, setIsVaultUnavailable] = useState(false);
  const [showWatchOnlyLanding, setShowWatchOnlyLanding] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Phase 1: Enhanced error tracking (only fatal errors, warnings stay in logs)
  const [initError, setInitError] = useState<InitializationError | null>(null);
  const [initPhase, setInitPhase] = useState<InitPhase>('sdk_create');
  const [initStartTime] = useState(Date.now());

  // SwapProgress state and event handling moved to GlobalSwapProgress component
  // to prevent Provider re-renders and dashboard refreshes

  // Timeout mechanism - fail if init takes too long
  useEffect(() => {
    const INIT_TIMEOUT = 120000; // 2 minutes (120 seconds)

    const timeoutId = setTimeout(() => {
      if (isLoading && !pioneerSdk) {
        console.error('[INIT] ❌ Initialization timeout after 2 minutes');
        setInitError({
          phase: initPhase,
          error: new Error('Initialization timeout - Pioneer SDK not responding after 2 minutes'),
          timestamp: Date.now(),
          recoverable: true
        });
        setIsLoading(false);
      }
    }, INIT_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [isLoading, pioneerSdk, initPhase]);

  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎬 [INIT] useEffect triggered');
    console.log('🔍 [INIT] Current state:', {
      pioneerSdk: !!pioneerSdk,
      isLoading,
      PIONEER_INITIALIZED,
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const initPioneerSDK = async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔥 [INIT] Starting Pioneer SDK initialization');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      PIONEER_INITIALIZED = true;

      // 🕐 PERFORMANCE BENCHMARKING - Track initialization phases
      const perfTimers: Record<string, { start: number; end?: number; duration?: number }> = {};
      const startTimer = (label: string) => {
        perfTimers[label] = { start: performance.now() };
        console.log(`⏱️ [PERF] START: ${label}`);
      };
      const endTimer = (label: string) => {
        if (perfTimers[label]) {
          perfTimers[label].end = performance.now();
          perfTimers[label].duration = perfTimers[label].end! - perfTimers[label].start;
          console.log(`⏱️ [PERF] END: ${label} - Duration: ${perfTimers[label].duration!.toFixed(2)}ms (${(perfTimers[label].duration! / 1000).toFixed(2)}s)`);
        }
      };
      const logPerfSummary = () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 [PERF] INITIALIZATION PERFORMANCE SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Object.entries(perfTimers).forEach(([label, timer]) => {
          if (timer.duration !== undefined) {
            const seconds = (timer.duration / 1000).toFixed(2);
            const percentage = ((timer.duration / perfTimers['Total Initialization']?.duration!) * 100).toFixed(1);
            console.log(`⏱️ ${label.padEnd(40)}: ${timer.duration.toFixed(2).padStart(10)}ms (${seconds.padStart(6)}s) ${percentage ? `[${percentage}%]` : ''}`);
          }
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      };

      startTimer('Total Initialization');

      // Detect if mobile app
      const isOnMobile = isMobileApp();
      setIsMobile(isOnMobile);
      console.log('📱 Platform detection:', isOnMobile ? 'Mobile App' : 'Desktop/Web');

      try {
        console.log('🏁 [Loading] Setting isLoading to TRUE - starting initialization');
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
        let allSupported = availableChainsByWallet[walletType];

        //remove v2 assets for now (case-insensitive filter)
        const v2Assets = ['TRX', 'TRON', 'TON', 'SOL', 'SOLANA', 'ZCASH'];
        console.log('🔧 All supported chains before filter:', allSupported);
        allSupported = allSupported.filter((chain: string) => {
          const chainUpper = String(chain).toUpperCase();
          const shouldFilter = v2Assets.some(v2 => chainUpper.includes(v2.toUpperCase()));
          if (shouldFilter) {
            console.log(`🚫 Filtering out v2 chain: ${chain}`);
          }
          return !shouldFilter;
        });
        console.log('🔧 All supported chains after filter:', allSupported);

        let blockchains = allSupported.map(
          // @ts-ignore
          (chainStr: any) => ChainToNetworkId[getChainEnumValue(chainStr)],
        );

        // Also filter out v2 network IDs from the blockchains array (after conversion)
        const v2NetworkPrefixes = ['tron:', 'ton:', 'solana:', 'sol:'];
        const originalBlockchainsCount = blockchains.length;
        blockchains = blockchains.filter((networkId: string) => {
          if (!networkId) return false;
          const networkIdLower = networkId.toLowerCase();
          const shouldFilter = v2NetworkPrefixes.some(prefix => networkIdLower.startsWith(prefix));
          if (shouldFilter) {
            console.log(`🚫 Filtering out v2 network ID: ${networkId}`);
          }
          return !shouldFilter;
        });
        console.log(`🔧 Filtered ${originalBlockchainsCount - blockchains.length} v2 network IDs from blockchains`);

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
        const unsupportedNetworks: string[] = [
          // 'eip155:100', // Gnosis/xDAI
          // 'eip155:250', // Fantom
          // 'eip155:534352', // Scroll
          // 'eip155:324', // zkSync Era
          // 'eip155:1101', // Polygon zkEVM
        ];

        // Filter ZCash if feature flag is disabled
        if (!isZcashEnabled()) {
          unsupportedNetworks.push(ZCASH_NETWORK_ID);
          console.log('🚫 ZCash feature flag disabled - filtering out ZCash network');
        }

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

        startTimer('Vault Endpoint Detection');
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
        endTimer('Vault Endpoint Detection');

        if (!detectedKeeperEndpoint) {
          console.log('⚠️ [KKAPI DEBUG] Vault not detected - continuing in view-only mode');
          // Don't return - continue with initialization in view-only mode
        }

        startTimer('Load Cached Pubkeys');
        // Load cached pubkeys from localStorage (always try to load, regardless of vault detection)
        let cachedPubkeys: any[] | null = null;
        if (!detectedKeeperEndpoint) {
          console.log('📂 [CACHE] Step 1: Attempting to load pubkeys from localStorage...');
          const cachedPubkeysRaw = localStorage.getItem('keepkey_vault_pubkeys');
          console.log('📂 [CACHE] Step 2: Raw value from localStorage:', cachedPubkeysRaw ? `${cachedPubkeysRaw.substring(0, 100)}...` : 'null');

          if (cachedPubkeysRaw) {
            try {
              console.log('📂 [CACHE] Step 3: Parsing cached data...');
              const cacheData = JSON.parse(cachedPubkeysRaw);
              console.log('📂 [CACHE] Step 4: ✅ Successfully parsed cache data!');

              // Extract the pubkeys array from the cache object
              console.log('📂 [CACHE] Step 5: Extracting pubkeys array from cache...');
              cachedPubkeys = cacheData?.pubkeys || null;
              console.log('📂 [CACHE] Step 6: Number of pubkeys:', Array.isArray(cachedPubkeys) ? cachedPubkeys.length : 'not an array (missing pubkeys property?)');

              if (Array.isArray(cachedPubkeys) && cachedPubkeys.length > 0) {
                console.log('📂 [CACHE] Step 7: ✅ Successfully extracted', cachedPubkeys.length, 'pubkeys!');
                console.log('📂 [CACHE] Step 8: Sample pubkey:', cachedPubkeys[0]);
              } else {
                console.warn('⚠️ [CACHE] Step 7: Cache data exists but no pubkeys array found');
              }
            } catch (parseError) {
              console.error('❌ [CACHE] Step 3 FAILED: Error parsing cached data:', parseError);
              cachedPubkeys = null;
            }
          } else {
            console.log('📂 [CACHE] Step 2: No cached data found in localStorage');
          }
        }
        endTimer('Load Cached Pubkeys');

        // Validate we have either vault connection OR cached pubkeys
        if (!detectedKeeperEndpoint && (!cachedPubkeys || cachedPubkeys.length === 0)) {
          console.error('❌ [VALIDATION] Cannot start app - no vault detected and no cached pubkeys found');
          console.error('❌ [VALIDATION] User must open KeepKey Desktop to pair device and cache pubkeys');
          setIsVaultUnavailable(true);
          setIsLoading(false);
          PIONEER_INITIALIZED = false; // Reset flag so retry works
          return; // Stop initialization
        }

        // If we have cached pubkeys but no vault, check if we should show watch-only landing
        if (!detectedKeeperEndpoint && cachedPubkeys && cachedPubkeys.length > 0) {
          // Check if user already continued in this session (only persists until tab/browser closes)
          const continuedThisSession = sessionStorage.getItem('keepkey_watch_only_session') === 'true';

          console.log('🔍 [WATCH-ONLY CHECK]', {
            isOnMobile,
            cachedPubkeysCount: cachedPubkeys.length,
            continuedThisSession
          });

          // Desktop users get a landing page option, mobile users go straight to watch-only
          if (!isOnMobile && !continuedThisSession) {
            console.log('💻 [DESKTOP] No vault detected but cached pubkeys found - showing watch-only landing');
            setShowWatchOnlyLanding(true);
            setIsLoading(false);
            PIONEER_INITIALIZED = false; // Reset flag so they can initialize if they continue
            return; // Stop here and show landing
          } else {
            if (continuedThisSession) {
              console.log('💻 [DESKTOP] User already continued in this session - skipping landing');
            } else {
              console.log('📱 [MOBILE] No vault detected but cached pubkeys found - continuing in watch-only mode');
            }
          }
        }

        console.log('✅ [VALIDATION] Initialization prerequisites met:', {
          vaultDetected: !!detectedKeeperEndpoint,
          cachedPubkeysCount: cachedPubkeys?.length || 0,
          mode: detectedKeeperEndpoint ? 'NORMAL' : 'VIEW-ONLY',
          platform: isOnMobile ? 'Mobile' : 'Desktop'
        });

        startTimer('SDK Config Creation');
        // Build SDK config matching the test configuration exactly
        const sdkConfig: any = {
          username,
          queryKey,
          spec: PIONEER_URL,  // Also passed as first param to SDK constructor
          appName: 'KeepKey Portfolio',
          appIcon: 'https://pioneers.dev/coins/keepkey.png',
          wss: PIONEER_WSS,
          keepkeyApiKey,
          paths,
          blockchains,
          // 🚨 CRITICAL: Initialize state arrays like the test does - required for dashboard
          nodes: [],
          pubkeys: [],
          balances: [],
          transactions: [],
          // Add these to match working projects
          ethplorerApiKey: 'EK-xs8Hj-qG4HbLY-LoAu7',
          covalentApiKey: 'cqt_rQ6333MVWCVJFVX3DbCCGMVqRH4q',
          utxoApiKey: 'B_s9XK926uwmQSGTDEcZB3vSAmt5t2',
          walletConnectProjectId: '18224df5f72924a5f6b3569fbd56ae16',
        };

        // Add view-only mode flags when no vault detected
        if (!detectedKeeperEndpoint) {
          console.log('🔧 [CONFIG] Step 9: Enabling view-only mode (no vault detected)');
          sdkConfig.viewOnlyMode = true;
          sdkConfig.skipDevicePairing = true;
          sdkConfig.skipKeeperEndpoint = true;

          // Add cached pubkeys to config if available
          if (cachedPubkeys && Array.isArray(cachedPubkeys) && cachedPubkeys.length > 0) {
            console.log('🔧 [CONFIG] Step 10: ✅ Adding', cachedPubkeys.length, 'cached pubkeys to SDK config');
            sdkConfig.pubkeys = cachedPubkeys;
          } else {
            console.log('⚠️ [CONFIG] Step 10: No cached pubkeys to add to SDK config');
          }
        } else {
          // Pass vault endpoint when available
          sdkConfig.keepkeyEndpoint = detectedKeeperEndpoint;
        }
        endTimer('SDK Config Creation');

        startTimer('SDK Instance Creation (new SDK())');
        const appInit = new SDK(PIONEER_URL, sdkConfig);
        endTimer('SDK Instance Creation (new SDK())');

        console.log('🔧 Pioneer SDK instance created with config:', {
          mode: detectedKeeperEndpoint ? 'LOCAL DEV (Vault REST)' : 'LEGACY (Desktop REST)',
          endpoint: detectedKeeperEndpoint || 'kkapi:// (will fallback to legacy)',
          hasPortfolioAPI: !!detectedKeeperEndpoint
        });

        // DEEP DEBUG: Inspect SDK internals before init
        console.log('🔍 [DEBUG] SDK internal state before init:', {
          hasPioneer: !!appInit.pioneer,
          pioneerType: typeof appInit.pioneer,
          pioneerKeys: appInit.pioneer ? Object.keys(appInit.pioneer).slice(0, 10) : 'N/A',
          sdkKeys: Object.keys(appInit).slice(0, 15),
          specUrl: PIONEER_URL
        });

        console.log('🔧 Calling init...');

        startTimer('Setup network filtering');
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
        endTimer('Setup network filtering');

        // Add progress tracking
        const progressInterval = setInterval(() => {
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
        
        try {
          // Phase 1: SDK Init
          console.log('[INIT] Phase 1: Initializing Pioneer SDK');
          setInitPhase('sdk_init');

          startTimer('app.init() - CRITICAL PHASE');
          const resultInit = await appInit.init({}, { skipSync: false });
          endTimer('app.init() - CRITICAL PHASE');

          clearInterval(progressInterval);

          console.log('[INIT] ✅ Phase 1 complete - SDK initialized');
          console.log("📊 Wallets:", appInit.wallets.length);
          console.log("🔑 Pubkeys:", appInit.pubkeys.length);
          console.log("💰 Balances:", appInit.balances.length);

          // 🔍 CRITICAL DEBUG: Check if we have account 1 pubkeys for EVM chains
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('🔍 [PUBKEY AUDIT] Checking for account 1 EVM pubkeys after init()');
          const evmPubkeys = appInit.pubkeys.filter((p: any) =>
            p.networks?.some((n: string) => n.startsWith('eip155:'))
          );
          console.error('🔍 EVM pubkeys found:', evmPubkeys.length);
          evmPubkeys.forEach((pk: any, idx: number) => {
            console.error(`🔍 [${idx}] ${pk.note || 'Unnamed'}`, {
              networks: pk.networks,
              address: pk.address?.substring(0, 10) + '...',
              master: pk.master?.substring(0, 10) + '...',
              path: pk.addressNList
            });
          });

          // Check if tokens were loaded during init
          const tokensAfterInit = appInit.balances.filter((b: any) => b.token === true);
          console.error('🔍 Tokens loaded after init():', tokensAfterInit.length);
          if (tokensAfterInit.length > 0) {
            console.error('✅ Tokens found:', tokensAfterInit.map((t: any) => `${t.symbol} (${t.networkId})`).join(', '));
          } else {
            console.error('⚠️ NO TOKENS loaded after init() - this is the problem!');
          }
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // 🚨 CRITICAL: Validate dashboard was created after init
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('🚨 [POST-INIT] Checking if dashboard was created...');
          console.error('🚨 appInit.dashboard:', !!appInit.dashboard);
          console.error('🚨 dashboard type:', typeof appInit.dashboard);
          if (!appInit.dashboard) {
            console.error('🚨🚨🚨 DASHBOARD WAS NOT CREATED BY init()!');
            console.error('🚨 This is the root cause of yellow logo!');
            console.error('🚨 SDK state:', {
              wallets: appInit.wallets?.length,
              pubkeys: appInit.pubkeys?.length,
              balances: appInit.balances?.length,
              status: appInit.status
            });
          } else {
            console.log('✅ Dashboard exists after init()');
            console.log('✅ Dashboard networks:', appInit.dashboard.networks?.length || 0);
          }
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Phase 2: Fetch Balances
          console.log('[INIT] Phase 2: Fetching balances');
          setInitPhase('get_balances');

          startTimer('getBalances()');
          await appInit.getBalances();
          endTimer('getBalances()');
          console.log('[INIT] ✅ Phase 2 complete - Balances loaded:', appInit.balances?.length || 0);
          
        } catch (initError: any) {
          clearInterval(progressInterval);
          console.error(`[INIT] ❌ Phase ${initPhase} failed:`, initError);

          // DEEP DEBUG: Inspect SDK internal state after failure
          console.log('🔍 [DEBUG] SDK internal state AFTER init failure:', {
            errorMessage: initError.message,
            errorStack: initError.stack,
            currentPhase: initPhase,
            hasPioneer: !!appInit.pioneer,
            hasSpec: !!appInit.spec,
            walletCount: appInit.wallets?.length || 0,
            pubkeyCount: appInit.pubkeys?.length || 0,
            balanceCount: appInit.balances?.length || 0
          });

          // Determine if error is recoverable
          const isRecoverable = initError.message && (
            initError.message.includes('GetPortfolioBalances') ||
            initError.message.includes('timeout') ||
            initError.message.includes('network')
          );

          // Check if it's a non-critical error we can handle
          if (initError.message && initError.message.includes('GetPortfolioBalances')) {
            console.warn('[INIT] ⚠️ GetPortfolioBalances failed - continuing with limited functionality (non-fatal)');
            console.log("📊 Partial initialization - Wallets:", appInit.wallets?.length || 0);
            console.log("🔑 Partial initialization - Pubkeys:", appInit.pubkeys?.length || 0);
            console.log("💰 Partial initialization - Balances:", appInit.balances?.length || 0);
          } else {
            // For critical errors, store in error state
            console.error('[INIT] ❌ Critical initialization failure');
            setInitError({
              phase: initPhase,
              error: initError,
              timestamp: Date.now(),
              recoverable: isRecoverable
            });

            // Don't continue if it's a critical error
            if (!isRecoverable) {
              setIsLoading(false);
              return;
            }

            console.log("[INIT] ⚠️ [FALLBACK] Attempting to continue despite error");
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
              // Phase 3: Fetch Charts
              console.log('[INIT] Phase 3: Fetching charts (staking + tokens)');
              setInitPhase('get_charts');
              console.log('📊 Balances before getCharts:', appInit.balances.length);

              try {
                startTimer('getCharts() - Initial Load');
                await appInit.getCharts();
                endTimer('getCharts() - Initial Load');
                console.log('[INIT] ✅ Phase 3 complete - Charts fetched');
                console.log('📊 Balances after getCharts:', appInit.balances.length);

                // Verify tokens were loaded
                const tokens = appInit.balances.filter((b: any) => b.token === true);
                console.log('📊 Tokens loaded:', tokens.length);
                if (tokens.length === 0) {
                  console.warn('[INIT] ⚠️ No tokens loaded - token functionality may be limited (non-fatal)');
                }
              } catch (chartError: any) {
                // Non-critical error - charts/staking unavailable but app can continue
                console.warn('[INIT] ⚠️ Phase 3 failed (non-critical, non-fatal):', chartError.message);
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('❌ getCharts failed during initialization (NON-CRITICAL)');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('Error type:', chartError?.constructor?.name);
                console.error('Error message:', chartError?.message);
                console.error('Error stack:', chartError?.stack);
                console.error('Pioneer client exists:', !!appInit.pioneer);
                console.error('Pubkeys count:', appInit.pubkeys?.length || 0);
                console.error('Blockchains count:', appInit.blockchains?.length || 0);
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Check if it's a network support error
                if (chartError?.message?.includes('network not live in blockchains')) {
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
          // Skip pairing if no vault detected (view-only mode)
          if (!detectedKeeperEndpoint) {
            console.log('🔑 ⏭️ Skipping KeepKey pairing - no vault detected (view-only mode)');
            console.log('👁️ [VIEW-ONLY] App will use cached pubkeys and balances from localStorage');
          } else {
            console.log('🔑 Attempting to connect to KeepKey...');
            console.log('🔑 KeepKey SDK before pairing:', !!appInit.keepKeySdk);

          try {
            startTimer('pairWallet(KEEPKEY)');
            const keepkeyConnected = await appInit.pairWallet('KEEPKEY');
            endTimer('pairWallet(KEEPKEY)');
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

            // Save pubkeys to localStorage after successful pairing
            if (appInit.pubkeys && appInit.pubkeys.length > 0) {
              try {
                // Get device info from the SDK or use defaults
                const deviceInfo = {
                  label: appInit.keepKeySdk?.device?.label || 'KeepKey',
                  model: appInit.keepKeySdk?.device?.model || 'KeepKey',
                  deviceId: appInit.keepKeySdk?.device?.deviceId || 'unknown',
                  features: appInit.keepKeySdk?.device?.features,
                };

                const saved = savePubkeys(appInit.pubkeys, deviceInfo);
                if (saved) {
                  console.log('📂 ✅ Saved', appInit.pubkeys.length, 'pubkeys to localStorage after pairing');
                } else {
                  console.warn('⚠️ Failed to save pubkeys to localStorage (cache might be disabled)');
                }
              } catch (saveError) {
                console.error('❌ Error saving pubkeys to localStorage:', saveError);
              }
            } else {
              console.warn('⚠️ No pubkeys available to save after pairing');
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
                      startTimer('getCharts() - After Pairing');
                      await appInit.getCharts();
                      endTimer('getCharts() - After Pairing');
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
          } // End else block - pairing when vault is detected
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
        
        // Check dashboard data - only warn if v2 APIs are enabled
        const v2Enabled = isPioneerV2Enabled();

        if (appInit.dashboard) {
          console.log('💰 Dashboard data:', appInit.dashboard);

          // Check if dashboard is empty (no meaningful data)
          const hasNetworks = appInit.dashboard.networks && appInit.dashboard.networks.length > 0;
          const hasBalances = appInit.balances && appInit.balances.length > 0;
          const hasPubkeys = appInit.pubkeys && appInit.pubkeys.length > 0;

          if (!hasNetworks && !hasBalances && !hasPubkeys) {
            console.warn('⚠️ WARNING: Dashboard exists but appears to be EMPTY!');
            console.warn('⚠️ Dashboard state:', {
              networks: appInit.dashboard.networks?.length || 0,
              balances: appInit.balances?.length || 0,
              pubkeys: appInit.pubkeys?.length || 0,
              keepKeySdk: !!appInit.keepKeySdk,
              vaultDetected: !!detectedKeeperEndpoint
            });
          } else {
            console.log('✅ Dashboard has data:', {
              networks: appInit.dashboard.networks?.length || 0,
              balances: appInit.balances?.length || 0,
              pubkeys: appInit.pubkeys?.length || 0
            });
          }
        } else {
          // Only warn about missing dashboard if v2 APIs are enabled
          if (v2Enabled) {
            console.warn('⚠️ No dashboard data - this indicates sync() was not called!');
            console.warn('⚠️ KeepKey SDK status:', !!appInit.keepKeySdk);
            console.warn('⚠️ Vault detected:', !!detectedKeeperEndpoint);
            console.warn('⚠️ This may cause an empty dashboard to be shown');
          } else {
            console.log('ℹ️ Dashboard not available - Pioneer v2 APIs are disabled (v1 desktop app mode)');
            console.log('ℹ️ Using direct balances/pubkeys instead of dashboard aggregation');
          }
        }

        // Register pioneer event listeners for real-time transaction events
        // console.log('🔧 Registering pioneer event listeners...');
        //
        // appInit.events.on('pioneer:tx', (data: any) => {
        //   console.log('🔔 [VAULT] Transaction event received:', {
        //     chain: data.chain,
        //     address: data.address,
        //     txid: data.txid,
        //     value: data.value,
        //     confirmations: data.confirmations,
        //     timestamp: data.timestamp
        //   });
        // });
        //
        // appInit.events.on('pioneer:utxo', (data: any) => {
        //   console.log('💰 [VAULT] UTXO event received:', {
        //     chain: data.chain,
        //     address: data.address
        //   });
        // });
        //
        // appInit.events.on('pioneer:balance', (data: any) => {
        //   console.log('💵 [VAULT] Balance event received:', {
        //     chain: data.chain,
        //     address: data.address,
        //     balance: data.balance
        //   });
        // });
        //
        // appInit.events.on('sync:complete', (data: any) => {
        //   console.log('✅ [VAULT] Sync complete event received:', data);
        // });
        //
        // appInit.events.on('sync:progress', (data: any) => {
        //   console.log('🔄 [VAULT] Sync progress event received:', data);
        // });
        //
        // console.log('✅ Pioneer event listeners registered:', {
        //   'pioneer:tx': appInit.events.listenerCount('pioneer:tx'),
        //   'pioneer:utxo': appInit.events.listenerCount('pioneer:utxo'),
        //   'pioneer:balance': appInit.events.listenerCount('pioneer:balance'),
        //   'sync:complete': appInit.events.listenerCount('sync:complete'),
        //   'sync:progress': appInit.events.listenerCount('sync:progress')
        // });

        // Phase 4: Event Subscription Verification
        console.log('[INIT] Phase 4: Verifying event subscriptions');
        setInitPhase('event_subscription');

        // CRITICAL: Events SHOULD exist - if they don't, something went wrong
        console.log('🔍 [EVENTS CHECK] Inspecting SDK events:', {
          hasEvents: !!appInit.events,
          eventsType: typeof appInit.events,
          eventsConstructor: appInit.events?.constructor?.name,
          hasOn: typeof appInit.events?.on,
          hasEmit: typeof appInit.events?.emit,
          sdkKeys: Object.keys(appInit).filter(k => k.includes('event')),
          hasPioneer: !!appInit.pioneer,
          pioneerHasEvents: !!appInit.pioneer?.events,
        });

        if (!appInit.events) {
          console.error('[INIT] ❌ CRITICAL: Events not available - this should NOT happen!');
          console.error('[INIT] SDK state when events missing:', {
            status: appInit.status,
            hasPioneer: !!appInit.pioneer,
            hasSpec: !!appInit.spec,
            pubkeyCount: appInit.pubkeys?.length || 0,
            balanceCount: appInit.balances?.length || 0,
          });
          // This is actually a problem, but let's continue and see what breaks
        } else {
          console.log('[INIT] ✅ Phase 4 complete - Events available');
          console.log('[INIT] Events details:', {
            constructor: appInit.events.constructor.name,
            listenerCount: appInit.events.listenerCount ? appInit.events.listenerCount('*') : 'N/A',
          });
        }

        // Mark initialization complete
        console.log('[INIT] ✅ All phases complete - SDK ready');
        setInitPhase('complete');

        console.log('🔍 [FINAL CHECK] About to call setPioneerSdk with:', {
          hasEvents: !!appInit.events,
          hasDashboard: !!appInit.dashboard,
          hasBalances: !!appInit.balances,
          balanceCount: appInit.balances?.length || 0,
          hasPubkeys: !!appInit.pubkeys,
          pubkeyCount: appInit.pubkeys?.length || 0,
        });

        // 🚨 CRITICAL DEBUG - Check if dashboard exists RIGHT BEFORE setPioneerSdk
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🚨 [DASHBOARD CHECK] RIGHT BEFORE setPioneerSdk');
        console.error('🚨 appInit:', !!appInit);
        console.error('🚨 appInit.dashboard:', !!appInit.dashboard);
        console.error('🚨 appInit.dashboard type:', typeof appInit.dashboard);
        console.error('🚨 appInit.dashboard networks:', appInit.dashboard?.networks?.length || 0);
        console.error('🚨 appInit.balances:', appInit.balances?.length || 0);
        console.error('🚨 appInit.pubkeys:', appInit.pubkeys?.length || 0);
        if (!appInit.dashboard) {
          console.error('🚨🚨🚨 DASHBOARD IS MISSING FROM appInit BEFORE setPioneerSdk!');
          console.error('🚨 appInit keys:', Object.keys(appInit).slice(0, 30));
        } else {
          console.log('✅ Dashboard IS present in appInit before setPioneerSdk');
          console.log('✅ Dashboard structure:', Object.keys(appInit.dashboard));
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [INIT] Calling setPioneerSdk - this will hide loading screen');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setPioneerSdk(appInit);
        console.log('✅ [INIT] setPioneerSdk called successfully');

        // 🚨 CRITICAL: Note that state update is async - pioneerSdk won't update until next render
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('⚠️ [STATE UPDATE] setPioneerSdk called');
        console.error('⚠️ React will schedule a re-render');
        console.error('⚠️ pioneerSdk state will update on NEXT render cycle');
        console.error('⚠️ Current pioneerSdk in this closure is still:', !!pioneerSdk);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } catch (e) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('💥 [INIT] FATAL: Pioneer SDK initialization failed');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('💥 Error details:', {
          message: (e as Error)?.message,
          stack: (e as Error)?.stack,
          name: (e as Error)?.name
        });
        PIONEER_INITIALIZED = false; // Reset flag on error
        setError(e as Error);
      } finally {
        endTimer('Total Initialization');
        logPerfSummary();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏁 [INIT] Finally block: Setting isLoading to FALSE');
        console.log('🏁 [INIT] This will hide loading screen regardless of success/failure');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setIsLoading(false);
        console.log('🏁 [INIT] setIsLoading(false) CALLED - state should update on next render');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    };

    console.log('🚀 [INIT] About to call initPioneerSDK()');
    initPioneerSDK();
    console.log('🚀 [INIT] initPioneerSDK() called (async, will continue in background)');
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
    console.error('FAILING TO INIT!!!!')
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

  // Handler for continuing in watch-only mode (dismissing the landing)
  const handleContinueWatchOnly = () => {
    console.log('👁️ User chose to continue in watch-only mode');
    // Remember for this browser session only (clears when tab/browser closes)
    sessionStorage.setItem('keepkey_watch_only_session', 'true');
    setShowWatchOnlyLanding(false);
    setIsLoading(true);
    // Trigger re-initialization in watch-only mode
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Show connection error if vault is unavailable and no cached data
  if (isVaultUnavailable) {
    return <ConnectionError onRetry={handleRetry} />;
  }

  // 🚨 CRITICAL RENDER LOGGING - Track all state before render decisions
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎨 [RENDER] Provider render cycle executing');
  console.log('🎨 [RENDER] Current state:', {
    isLoading,
    pioneerSdk: !!pioneerSdk,
    error: !!error,
    initError: !!initError,
    showWatchOnlyLanding,
    isVaultUnavailable,
    initPhase,
    PIONEER_INITIALIZED
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Show watch-only landing for desktop users (not mobile) with cached data
  if (showWatchOnlyLanding) {
    console.log('🎨 [RENDER] Showing watch-only landing');
    const deviceInfo = getDeviceInfo();
    return (
      <WatchOnlyLanding
        onContinueWatchOnly={handleContinueWatchOnly}
        deviceInfo={deviceInfo}
      />
    );
  }

  //Enhanced error UI with phase information and retry
  if (initError) {
    console.log('🎨 [RENDER] Showing initError UI - phase:', initError.phase);
    return (
      <Flex
        width="100vw"
        height="100vh"
        justify="center"
        align="center"
        flexDirection="column"
        gap={6}
        bg="gray.800"
      >
        <LogoIcon
          boxSize="8"
          opacity="0.5"
        />
        <div style={{ color: '#EF4444', fontSize: '20px', fontWeight: 'bold' }}>
          Initialization Failed
        </div>
        <div style={{ color: '#9CA3AF', fontSize: '14px' }}>
          Phase: {initError.phase.replace(/_/g, ' ').toUpperCase()}
        </div>
        <div style={{ color: '#6B7280', fontSize: '14px', maxWidth: '500px', textAlign: 'center', padding: '0 20px' }}>
          {initError.error.message}
        </div>

        {initError.recoverable && (
          <div
            style={{
              backgroundColor: '#FFD700',
              color: '#000',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onClick={() => {
              setInitError(null);
              setIsLoading(true);
              PIONEER_INITIALIZED = false;
              window.location.reload();
            }}
          >
            Retry Initialization
          </div>
        )}

        <div style={{ color: '#60A5FA', fontSize: '12px', cursor: 'pointer' }}>
          <a href="/diagnostics" style={{ textDecoration: 'underline' }}>
            View Diagnostic Logs
          </a>
        </div>
      </Flex>
    );
  }

  // Fallback error UI (legacy)
  if (error) {
    console.log('🎨 [RENDER] Showing legacy error UI');
    console.error('Error: ',error)
    return (
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
    )
  }

  if (isLoading) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🟡 [YELLOW LOGO] Rendering loading screen - isLoading is TRUE');
    console.log('🟡 [YELLOW LOGO] WHY IS THIS STILL TRUE?', {
      pioneerSdk: !!pioneerSdk,
      initPhase,
      PIONEER_INITIALIZED,
      errorState: !!error,
      initErrorState: !!initError
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return (
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
        flexDirection="column"
        gap={4}
      >
        <LogoIcon
          boxSize="24"
          animation={`${scale} 2s ease-in-out infinite`}
          opacity="0.8"
          border="2px solid"
          borderColor="gold.500"
          borderRadius="lg"
          padding={2}
        />
        <Flex
          flexDirection="column"
          align="center"
          gap={1}
          color="gray.400"
          fontSize="sm"
        >
          <div style={{ color: '#D1D5DB' }}>
            Loading balances on {availableChainsByWallet[WalletOption.KEEPKEY]?.length || 0} networks
          </div>
          <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
            (this may take a bit)
          </div>
        </Flex>
      </Flex>
    )
  }

  console.log('✅ [Loading] Rendering app - isLoading is FALSE, pioneerSdk:', !!pioneerSdk);

  // CRITICAL DEBUG: Check if SDK has events property
  console.log('🔍 [CONTEXT-VALUE] SDK events check:', {
    hasSDK: !!pioneerSdk,
    hasEvents: !!pioneerSdk?.events,
    eventsType: typeof pioneerSdk?.events,
    eventsConstructor: pioneerSdk?.events?.constructor?.name,
    sdkKeys: pioneerSdk ? Object.keys(pioneerSdk).filter(k => k.includes('event') || k === 'events') : 'N/A',
  });

  // 🚨 CRITICAL: Log pioneerSdk state BEFORE creating context value
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('🚨 [CONTEXT-VALUE] About to create context value');
  console.error('🚨 pioneerSdk:', !!pioneerSdk);
  console.error('🚨 pioneerSdk.dashboard:', !!pioneerSdk?.dashboard);
  console.error('🚨 pioneerSdk.dashboard type:', typeof pioneerSdk?.dashboard);
  console.error('🚨 pioneerSdk.dashboard networks:', pioneerSdk?.dashboard?.networks?.length || 0);
  console.error('🚨 pioneerSdk.balances:', pioneerSdk?.balances?.length || 0);
  console.error('🚨 pioneerSdk.pubkeys:', pioneerSdk?.pubkeys?.length || 0);
  if (!pioneerSdk?.dashboard) {
    console.error('🚨🚨🚨 DASHBOARD IS MISSING FROM pioneerSdk STATE!');
    console.error('🚨 This means setPioneerSdk was called with an SDK that lacks dashboard');
    console.error('🚨 OR React state update lost the dashboard property somehow');
  }
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

  // 🚨 CRITICAL: Log context value AFTER creation
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('🚨 [CONTEXT-VALUE] Created context value');
  console.error('🚨 contextValue.state.app:', !!contextValue.state.app);
  console.error('🚨 contextValue.state.dashboard:', !!contextValue.state.dashboard);
  console.error('🚨 contextValue.state.balances:', contextValue.state.balances?.length || 0);
  console.error('🚨 contextValue.state.pubkeys:', contextValue.state.pubkeys?.length || 0);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('📦 [CONTEXT-VALUE] Created contextValue:', {
    hasState: !!contextValue.state,
    hasApp: !!contextValue.state.app,
    hasAppEvents: !!contextValue.state.app?.events,
  });

  return (
    <AppProvider pioneer={contextValue}>
      {children}
      {/* Global Swaps Bubble - Shows on all pages */}
      {isFeatureEnabled('enableSwaps') && contextValue.state.app && (
        <PendingSwapsPopup app={contextValue.state.app} />
      )}

      {/* Global SwapProgress Dialog - Separate component with own state to avoid Provider re-renders */}
      <GlobalSwapProgress />

      {/* Global Chat Assistant - Shows on all pages */}
      {contextValue.state.app && (
        <ChatPopup app={contextValue.state.app} />
      )}
    </AppProvider>
  );
} 
