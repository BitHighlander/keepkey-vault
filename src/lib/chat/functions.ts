/**
 * Chat Assistant Function Library
 *
 * This module contains all executable functions that the chat assistant can call
 * to perform actions on behalf of the user.
 */

import { AssetContextState } from '@/components/providers/pioneer';
import {
  getSupportedChainsFromSDK,
  getCAIPFromSDK,
  getPathsForBlockchain,
  listConfiguredPaths,
  getPathInfo,
  suggestPathForBlockchain
} from './capabilities';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FunctionResult {
  success: boolean;
  message: string;
  data?: any;
}

// ============================================================================
// System-Grounded Capability Registry
// ============================================================================

/**
 * VAULT_CAPABILITIES: Ground truth for what KeepKey supports
 *
 * This registry prevents chat hallucinations about unsupported features.
 * NEVER respond with capabilities not listed here.
 */
export const VAULT_CAPABILITIES = {
  supportedChains: [
    { caip: 'bip122:000000000019d6689c085ae165831e93', name: 'Bitcoin', symbol: 'BTC', supported: true },
    { caip: 'eip155:1', name: 'Ethereum', symbol: 'ETH', supported: true },
    { caip: 'bip122:00000000001a91e3dace36e2be3bf030', name: 'Litecoin', symbol: 'LTC', supported: true },
    { caip: 'bip122:0000000000000000000651ef99cb9fcb', name: 'Bitcoin Cash', symbol: 'BCH', supported: true },
    { caip: 'bip122:12a765e31ffd4059bada1e25190f6e98', name: 'Dogecoin', symbol: 'DOGE', supported: true },
    { caip: 'cosmos:cosmoshub-4', name: 'Cosmos Hub', symbol: 'ATOM', supported: true },
    { caip: 'cosmos:thorchain-mainnet-v1', name: 'THORChain', symbol: 'RUNE', supported: true },
    { caip: 'cosmos:mayachain-mainnet-v1', name: 'Maya Protocol', symbol: 'CACAO', supported: true },
    { caip: 'cosmos:osmosis-1', name: 'Osmosis', symbol: 'OSMO', supported: true },
    { caip: 'bip122:00000000000000000009c870a04e0d42', name: 'Dash', symbol: 'DASH', supported: true },
    { caip: 'bip122:12a765e31ffd4059bada1e25190f6e99', name: 'Binance Chain', symbol: 'BNB', supported: true },
  ],

  features: {
    // Bitcoin features
    taproot: {
      supported: 'receive_only',
      details: 'KeepKey can receive to Taproot addresses (bc1p...) but cannot generate Taproot addresses. Receiving to Taproot is supported, but you must use legacy/segwit addresses for sending.',
      reason: 'Taproot signing not yet implemented in firmware'
    },

    // Recently added chain support
    solana: {
      supported: true,
      reason: 'Solana support available in pioneer-sdk v8.17.0+'
    },
    tron: {
      supported: true,
      reason: 'TRON support available in pioneer-sdk v8.17.0+'
    },
    ton: {
      supported: true,
      reason: 'TON support available via keepkey-server REST API'
    },
    cardano: {
      supported: false,
      reason: 'Cardano is not implemented in KeepKey firmware'
    },
    polkadot: {
      supported: false,
      reason: 'Polkadot is not implemented in KeepKey firmware'
    },

    // Security features
    privateKeyExport: {
      supported: false,
      reason: 'Private keys never leave the KeepKey device - this is a critical security feature'
    },
    seedPhraseDisplay: {
      supported: false,
      reason: 'Seed phrases are only shown during initial device setup, never after'
    },

    // Supported features
    multiChain: {
      supported: true,
      details: 'KeepKey supports 11+ blockchains across UTXO, EVM, and Cosmos ecosystems'
    },
    hardwareConfirmation: {
      supported: true,
      details: 'All transactions require physical confirmation on the KeepKey device'
    },
    addressDerivation: {
      supported: true,
      details: 'Supports BIP32/BIP39/BIP44 address derivation with multiple script types'
    }
  },

  limitations: {
    noPrivateKeyExport: true,
    requiresDeviceConfirmation: true,
    offlineSigningOnly: true
  }
};

export interface Asset {
  caip: string;
  symbol: string;
  name: string;
  balance: string;
  valueUsd?: string;
  networkId: string;
  chainId: string;
  assetId: string;
  networkName: string;
  icon?: string;
  color?: string;
  precision?: number;
  priceUsd?: number;
  pubkeys?: any[];
}

// ============================================================================
// 1. NAVIGATION FUNCTIONS
// ============================================================================

/**
 * Navigate to an asset's detail page
 */
export async function navigateToAsset(caip: string, app: any): Promise<FunctionResult> {
  try {
    // Find the asset in balances
    const asset = app?.balances?.find((b: any) => b.caip === caip);

    if (!asset) {
      return {
        success: false,
        message: `Asset not found: ${caip}`,
      };
    }

    // Set asset context
    const assetContext: AssetContextState = {
      networkId: asset.networkId,
      chainId: asset.chainId,
      assetId: asset.assetId,
      caip: asset.caip,
      name: asset.name,
      networkName: asset.networkName,
      symbol: asset.symbol,
      icon: asset.icon,
      color: asset.color,
      balance: asset.balance || '0',
      value: parseFloat(asset.valueUsd || '0'),
      precision: asset.precision || 18,
      priceUsd: asset.priceUsd,
      pubkeys: asset.pubkeys || [],
    };

    if (typeof app.setAssetContext === 'function') {
      app.setAssetContext(assetContext);
    }

    // Encode CAIP for URL (Base64)
    const encodedCaip = btoa(caip);

    // Use router for client-side navigation if available
    if (app.navigate) {
      app.navigate(`/asset/${encodeURIComponent(encodedCaip)}`);
    } else if (typeof window !== 'undefined') {
      // Fallback to window.location for tests
      window.location.href = `/asset/${encodeURIComponent(encodedCaip)}`;
    }

    return {
      success: true,
      message: `Opening ${asset.symbol} (${asset.name})`,
      data: { asset: asset.symbol },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to navigate: ${error.message}`,
    };
  }
}

/**
 * Navigate to the send page for an asset
 */
export async function navigateToSend(caip: string | undefined, app: any): Promise<FunctionResult> {
  try {
    let targetCaip = caip;
    let asset: any = null;

    //console.log('🔍 [navigateToSend] Called with CAIP:', caip);

    // If no CAIP provided, use current asset context
    if (!targetCaip) {
      const assetContext = app?.state?.app?.assetContext;
      if (!assetContext) {
        return {
          success: false,
          message: 'Please select an asset first',
        };
      }
      targetCaip = assetContext.caip;
      //console.log('🔍 [navigateToSend] Using context CAIP:', targetCaip);
    }

    // Find the asset in balances to set context
    asset = app?.balances?.find((b: any) => b.caip === targetCaip);
    //console.log('🔍 [navigateToSend] Found asset:', asset ? `${asset.symbol} (${asset.name})` : 'NOT FOUND');

    if (asset) {
      // Set asset context before navigation
      const assetContext: AssetContextState = {
        networkId: asset.networkId,
        chainId: asset.chainId,
        assetId: asset.assetId,
        caip: asset.caip,
        name: asset.name,
        networkName: asset.networkName,
        symbol: asset.symbol,
        icon: asset.icon,
        color: asset.color,
        balance: asset.balance || '0',
        value: parseFloat(asset.valueUsd || '0'),
        precision: asset.precision || 18,
        priceUsd: asset.priceUsd,
        pubkeys: asset.pubkeys || [],
      };

      if (typeof app.setAssetContext === 'function') {
        app.setAssetContext(assetContext);
      }
    }

    // Encode CAIP for URL
    const encodedCaip = btoa(targetCaip!);

    // Use router for client-side navigation if available
    if (app.navigate) {
      app.navigate(`/asset/${encodeURIComponent(encodedCaip)}?view=send`);
    } else if (typeof window !== 'undefined') {
      // Fallback to window.location for tests
      window.location.href = `/asset/${encodeURIComponent(encodedCaip)}?view=send`;
    }

    return {
      success: true,
      message: `Opening send page${asset ? ` for ${asset.symbol}` : ''}...`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to open send page: ${error.message}`,
    };
  }
}

/**
 * Navigate to the receive page for an asset
 */
export async function navigateToReceive(caip: string | undefined, app: any): Promise<FunctionResult> {
  try {
    let targetCaip = caip;
    let asset: any = null;

    // If no CAIP provided, use current asset context
    if (!targetCaip) {
      const assetContext = app?.state?.app?.assetContext;
      if (!assetContext) {
        return {
          success: false,
          message: 'Please select an asset first',
        };
      }
      targetCaip = assetContext.caip;
    }

    // Find the asset in balances to set context
    asset = app?.balances?.find((b: any) => b.caip === targetCaip);

    if (asset) {
      // Set asset context before navigation
      const assetContext: AssetContextState = {
        networkId: asset.networkId,
        chainId: asset.chainId,
        assetId: asset.assetId,
        caip: asset.caip,
        name: asset.name,
        networkName: asset.networkName,
        symbol: asset.symbol,
        icon: asset.icon,
        color: asset.color,
        balance: asset.balance || '0',
        value: parseFloat(asset.valueUsd || '0'),
        precision: asset.precision || 18,
        priceUsd: asset.priceUsd,
        pubkeys: asset.pubkeys || [],
      };

      if (typeof app.setAssetContext === 'function') {
        app.setAssetContext(assetContext);
      }
    }

    // Encode CAIP for URL
    const encodedCaip = btoa(targetCaip!);

    // Use router for client-side navigation if available
    if (app.navigate) {
      app.navigate(`/asset/${encodeURIComponent(encodedCaip)}?view=receive`);
    } else if (typeof window !== 'undefined') {
      // Fallback to window.location for tests
      window.location.href = `/asset/${encodeURIComponent(encodedCaip)}?view=receive`;
    }

    return {
      success: true,
      message: `Opening receive page${asset ? ` for ${asset.symbol}` : ''}...`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to open receive page: ${error.message}`,
    };
  }
}

/**
 * Navigate to the swap page for an asset
 */
export async function navigateToSwap(caip: string | undefined, app: any): Promise<FunctionResult> {
  try {
    // Check if swap feature is enabled
    const { isFeatureEnabled } = await import('@/config/features');
    if (!isFeatureEnabled('enableSwaps')) {
      return {
        success: false,
        message: 'Swap feature is currently disabled. Please enable it in settings.',
      };
    }

    let targetCaip = caip;
    let asset: any = null;

    // If no CAIP provided, use current asset context
    if (!targetCaip) {
      const assetContext = app?.state?.app?.assetContext;
      if (!assetContext) {
        return {
          success: false,
          message: 'Please select an asset first',
        };
      }
      targetCaip = assetContext.caip;
    }

    // Find the asset in balances to set context
    asset = app?.balances?.find((b: any) => b.caip === targetCaip);

    if (asset) {
      // Set asset context before navigation
      const assetContext: AssetContextState = {
        networkId: asset.networkId,
        chainId: asset.chainId,
        assetId: asset.assetId,
        caip: asset.caip,
        name: asset.name,
        networkName: asset.networkName,
        symbol: asset.symbol,
        icon: asset.icon,
        color: asset.color,
        balance: asset.balance || '0',
        value: parseFloat(asset.valueUsd || '0'),
        precision: asset.precision || 18,
        priceUsd: asset.priceUsd,
        pubkeys: asset.pubkeys || [],
      };

      if (typeof app.setAssetContext === 'function') {
        app.setAssetContext(assetContext);
      }
    }

    // Encode CAIP for URL
    const encodedCaip = btoa(targetCaip!);

    // Use router for client-side navigation if available
    if (app.navigate) {
      app.navigate(`/asset/${encodeURIComponent(encodedCaip)}?view=swap`);
    } else if (typeof window !== 'undefined') {
      // Fallback to window.location for tests
      window.location.href = `/asset/${encodeURIComponent(encodedCaip)}?view=swap`;
    }

    return {
      success: true,
      message: `Opening swap page${asset ? ` for ${asset.symbol}` : ''}...`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to open swap page: ${error.message}`,
    };
  }
}

/**
 * Navigate back to the dashboard
 */
export async function navigateToDashboard(app: any): Promise<FunctionResult> {
  try {
    // Clear asset context
    if (typeof app.clearAssetContext === 'function') {
      app.clearAssetContext();
    }

    // Use router for client-side navigation if available
    if (app.navigate) {
      app.navigate('/');
    } else if (typeof window !== 'undefined') {
      // Fallback to window.location for tests
      window.location.href = '/';
    }

    return {
      success: true,
      message: 'Returning to dashboard...',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to navigate: ${error.message}`,
    };
  }
}

// ============================================================================
// 2. QUERY FUNCTIONS
// ============================================================================

/**
 * Get all asset balances
 */
export async function getBalances(app: any): Promise<FunctionResult> {
  try {
    const balances = app?.balances || [];
    const totalValueUsd = app?.dashboard?.totalValueUsd || 0;

    return {
      success: true,
      message: 'Retrieved balances successfully',
      data: {
        balances,
        totalValueUsd,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get balances: ${error.message}`,
      data: {
        balances: [],
        totalValueUsd: 0,
      },
    };
  }
}

/**
 * Search for assets by name or symbol
 */
export async function searchAssets(query: string, app: any): Promise<FunctionResult> {
  try {
    const balances = app?.balances || [];
    const queryLower = query.toLowerCase();

    const results = balances.filter(
      (b: any) =>
        b.symbol?.toLowerCase().includes(queryLower) ||
        b.name?.toLowerCase().includes(queryLower) ||
        b.caip?.toLowerCase().includes(queryLower)
    );

    return {
      success: true,
      message: `Found ${results.length} asset(s) matching "${query}"`,
      data: {
        query,
        results,
        count: results.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to search assets: ${error.message}`,
      data: {
        query,
        results: [],
        count: 0,
      },
    };
  }
}

/**
 * Get all configured networks
 */
export async function getNetworks(app: any): Promise<FunctionResult> {
  try {
    const networks = app?.dashboard?.networks || [];

    const formattedNetworks = networks.map((n: any) => ({
      networkId: n.networkId,
      name: n.gasAssetName || n.gasAssetSymbol,
      symbol: n.gasAssetSymbol,
      totalValueUsd: n.totalValueUsd,
      balance: n.totalNativeBalance,
      icon: n.icon,
      color: n.color,
    }));

    return {
      success: true,
      message: `Found ${networks.length} network(s)`,
      data: {
        networks: formattedNetworks,
        count: networks.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get networks: ${error.message}`,
      data: {
        networks: [],
        count: 0,
      },
    };
  }
}

/**
 * Get receiving address for an asset
 */
export async function getAddress(assetSymbol: string, app: any): Promise<FunctionResult> {
  try {
    const asset = app?.balances?.find(
      (b: any) => b.symbol?.toLowerCase() === assetSymbol.toLowerCase()
    );

    if (!asset || !asset.pubkeys || asset.pubkeys.length === 0) {
      return {
        success: false,
        message: `No address found for ${assetSymbol}`,
        data: {
          asset: assetSymbol,
          address: null,
        },
      };
    }

    // Get first pubkey address
    const address = asset.pubkeys[0].address || asset.pubkeys[0].master;

    return {
      success: true,
      message: `Found address for ${asset.symbol}`,
      data: {
        asset: asset.symbol,
        address,
        caip: asset.caip,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get address: ${error.message}`,
      data: {
        asset: assetSymbol,
        address: null,
      },
    };
  }
}

// ============================================================================
// 3. ACTION FUNCTIONS
// ============================================================================

/**
 * Refresh portfolio data
 */
export async function refreshPortfolio(app: any): Promise<FunctionResult> {
  try {
    // Trigger balance refresh
    if (typeof app.refresh === 'function') {
      await app.refresh();

      // Trigger UI refresh
      if (typeof app.triggerBalanceRefresh === 'function') {
        app.triggerBalanceRefresh();
      }

      return {
        success: true,
        message: 'Portfolio refreshed successfully!',
      };
    } else {
      return {
        success: false,
        message: 'Refresh function not available',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to refresh: ${error.message}`,
    };
  }
}

// ============================================================================
// 4. TUTORIAL & HELP FUNCTIONS
// ============================================================================

/**
 * Start tutorial for current page
 */
export async function startTutorial(app: any): Promise<FunctionResult> {
  try {
    // Trigger tutorial start event
    if (typeof app.startTutorial === 'function') {
      app.startTutorial();
      return {
        success: true,
        message: 'Starting tutorial for this page...',
        data: { tutorialStarted: true },
      };
    } else {
      return {
        success: false,
        message: 'Tutorial system not available',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to start tutorial: ${error.message}`,
    };
  }
}

/**
 * Get help about current page
 */
export async function getPageHelp(app: any): Promise<FunctionResult> {
  try {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

    // Dynamically import page context
    const { getPageHelpText } = await import('./pageContext');
    const helpText = getPageHelpText(pathname);

    return {
      success: true,
      message: 'Here\'s what you can do on this page:',
      data: {
        helpText,
        page: pathname,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get page help: ${error.message}`,
    };
  }
}

/**
 * Highlight specific UI element
 */
export async function highlightElement(elementId: string, app: any): Promise<FunctionResult> {
  try {
    if (typeof app.highlightElement === 'function') {
      app.highlightElement(elementId);

      // Get element details
      const { findElement } = await import('./pageContext');
      const result = findElement(elementId);

      if (result) {
        return {
          success: true,
          message: `Highlighting: ${result.element.name}`,
          data: {
            element: result.element,
            page: result.page.name,
          },
        };
      }
    }

    return {
      success: false,
      message: 'Element highlighting not available',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to highlight element: ${error.message}`,
    };
  }
}

/**
 * Explain what a UI element does
 */
export async function explainElement(elementId: string, app: any): Promise<FunctionResult> {
  try {
    const { findElement } = await import('./pageContext');
    const result = findElement(elementId);

    if (result) {
      const { element, page } = result;
      const explanation = `**${element.name}** (on ${page.name})\n\n${element.description}\n\n${element.action ? `💡 What it does: ${element.action}` : ''}`;

      return {
        success: true,
        message: explanation,
        data: {
          element,
          page: page.name,
        },
      };
    }

    return {
      success: false,
      message: `Element not found: ${elementId}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to explain element: ${error.message}`,
    };
  }
}

/**
 * Get information about the KeepKey Vault project
 */
export async function getProjectInfo(topic?: string): Promise<FunctionResult> {
  const projectInfo = {
    overview: {
      name: 'KeepKey Vault',
      description: 'A secure, privacy-first cryptocurrency wallet powered by KeepKey hardware devices',
      purpose: 'Manage your cryptocurrency portfolio across multiple blockchains with hardware security',
    },
    features: [
      'Multi-chain support (Bitcoin, Ethereum, Cosmos, THORChain, Maya, and more)',
      'Hardware wallet security with KeepKey device integration',
      'Real-time portfolio tracking and USD valuations',
      'Send, Receive, and Swap cryptocurrencies',
      'Built-in DEX integration (THORChain, Maya Protocol)',
      'Multiple address/path management for privacy',
      'AI-powered chat assistant for guidance',
    ],
    security: [
      'Private keys never leave your KeepKey device',
      'All transactions require device confirmation',
      'Open-source and auditable code',
      'No data collection or tracking',
    ],
    pages: {
      dashboard: 'View total portfolio value and asset distribution',
      asset: 'Manage individual cryptocurrency assets',
      send: 'Send crypto to other addresses securely',
      receive: 'Get your address to receive crypto payments',
      swap: 'Exchange between different cryptocurrencies',
      settings: 'Configure networks and preferences',
    },
  };

  let message = '';
  let data = {};

  if (!topic || topic === 'overview') {
    message = `**${projectInfo.overview.name}**\n\n${projectInfo.overview.description}\n\n${projectInfo.overview.purpose}`;
    data = projectInfo.overview;
  } else if (topic === 'features') {
    message = '**Key Features:**\n' + projectInfo.features.map(f => `• ${f}`).join('\n');
    data = { features: projectInfo.features };
  } else if (topic === 'security') {
    message = '**Security Features:**\n' + projectInfo.security.map(s => `• ${s}`).join('\n');
    data = { security: projectInfo.security };
  } else if (topic === 'pages') {
    message = '**Pages & Navigation:**\n' + Object.entries(projectInfo.pages).map(([k, v]) => `• **${k}**: ${v}`).join('\n');
    data = { pages: projectInfo.pages };
  } else {
    message = `**${projectInfo.overview.name}**\n\n${projectInfo.overview.description}\n\n**Quick Links:**\n• "Tell me about features"\n• "Tell me about security"\n• "Tell me about pages"`;
    data = projectInfo;
  }

  return {
    success: true,
    message,
    data,
  };
}

// ============================================================================
// 5. CAPABILITY & INTELLIGENCE FUNCTIONS
// ============================================================================

/**
 * Check if KeepKey supports a specific chain or feature
 */
export async function getChainCapability(query: string): Promise<FunctionResult> {
  const queryLower = query.toLowerCase().trim();

  // Check if it's a known feature
  const featureKey = Object.keys(VAULT_CAPABILITIES.features).find(
    key => key.toLowerCase() === queryLower
  );

  if (featureKey) {
    const feature = VAULT_CAPABILITIES.features[featureKey as keyof typeof VAULT_CAPABILITIES.features];

    if (feature.supported === false) {
      return {
        success: true,
        message: `❌ No, KeepKey does not support ${query}.\n\n${(feature as any).reason || (feature as any).details}`,
        data: { feature: featureKey, ...feature }
      };
    } else if (feature.supported === 'receive_only') {
      return {
        success: true,
        message: `⚠️ Partial support for ${query}:\n\n${(feature as any).details || (feature as any).reason}`,
        data: { feature: featureKey, ...feature }
      };
    } else {
      return {
        success: true,
        message: `✅ Yes, KeepKey supports ${query}!\n\n${(feature as any).details || (feature as any).reason}`,
        data: { feature: featureKey, ...feature }
      };
    }
  }

  // Check if it's a supported chain
  const chain = VAULT_CAPABILITIES.supportedChains.find(
    c => c.name.toLowerCase() === queryLower ||
         c.symbol.toLowerCase() === queryLower
  );

  if (chain) {
    return {
      success: true,
      message: `✅ Yes, KeepKey supports ${chain.name} (${chain.symbol})!\n\nCAIP: ${chain.caip}`,
      data: { supported: true, chain }
    };
  }

  // Unknown chain/feature
  return {
    success: true,
    message: `❓ I don't have information about "${query}" support.\n\nKeepKey officially supports: ${VAULT_CAPABILITIES.supportedChains.map(c => c.symbol).join(', ')}`,
    data: { supported: false, query }
  };
}

/**
 * Get CAIP identifier for a specific asset (uses Pioneer SDK)
 */
export async function getCAIPInfo(assetQuery: string, app: any): Promise<FunctionResult> {
  // Use SDK-powered function instead of hardcoded registry
  return await getCAIPFromSDK(assetQuery, app);
}

/**
 * Get KeepKey device information (safe metadata only)
 */
export async function getDeviceInfo(app: any): Promise<FunctionResult> {
  try {
    const device = app?.deviceInfo || app?.keepkey;

    if (!device) {
      return {
        success: false,
        message: '❌ No KeepKey device connected.\n\nPlease connect your KeepKey and ensure it\'s unlocked.'
      };
    }

    // Safe metadata only - NO PRIVATE DATA
    const safeInfo = {
      label: device.label || 'KeepKey',
      firmware: device.firmwareVersion || 'Unknown',
      model: device.model || 'KeepKey',
      initialized: device.initialized ?? true
    };

    return {
      success: true,
      message: `**Device Information**\n\n📱 Label: ${safeInfo.label}\n🔧 Firmware: ${safeInfo.firmware}\n📦 Model: ${safeInfo.model}\n${safeInfo.initialized ? '✅' : '❌'} Initialized`,
      data: safeInfo
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get device info: ${error.message}`
    };
  }
}

/**
 * Get vault and portfolio status
 */
export async function getVaultStatus(app: any): Promise<FunctionResult> {
  const status = {
    device: {
      connected: !!app?.deviceInfo,
      label: app?.deviceInfo?.label || 'Unknown',
      firmware: app?.deviceInfo?.firmwareVersion || 'Unknown'
    },
    portfolio: {
      totalValueUsd: app?.dashboard?.totalValueUsd || 0,
      assetsCount: app?.balances?.length || 0,
      networksCount: app?.dashboard?.networks?.length || 0
    },
    server: {
      pioneer: app?.pioneer ? 'Connected' : 'Disconnected'
    }
  };

  return {
    success: true,
    message: `**Vault Status**\n\n📱 Device: ${status.device.connected ? '✅ Connected' : '❌ Disconnected'} (${status.device.label}, v${status.device.firmware})\n💰 Portfolio: $${status.portfolio.totalValueUsd.toFixed(2)} across ${status.portfolio.assetsCount} assets on ${status.portfolio.networksCount} networks\n🌐 Server: ${status.server.pioneer}`,
    data: status
  };
}

/**
 * List all supported chains with CAIPs (uses Pioneer SDK)
 */
export async function getSupportedChains(app: any): Promise<FunctionResult> {
  // Use SDK-powered function for REAL supported chains
  return await getSupportedChainsFromSDK(app);
}

// ============================================================================
// FUNCTION REGISTRY
// ============================================================================

export const FUNCTION_REGISTRY = {
  // Navigation
  navigateToAsset,
  navigateToSend,
  navigateToReceive,
  navigateToSwap,
  navigateToDashboard,

  // Queries
  getBalances,
  searchAssets,
  getNetworks,
  getAddress,

  // Capability & Intelligence (SDK-powered)
  getChainCapability,
  getCAIPInfo, // Now uses Pioneer SDK
  getDeviceInfo,
  getVaultStatus,
  getSupportedChains, // Now uses Pioneer SDK

  // Path Intelligence (SDK-powered)
  getPathsForBlockchain,
  listConfiguredPaths,
  getPathInfo,
  suggestPathForBlockchain,

  // Actions
  refreshPortfolio,

  // Tutorials & Help
  startTutorial,
  getPageHelp,
  highlightElement,
  explainElement,
  getProjectInfo,
};

export type FunctionName = keyof typeof FUNCTION_REGISTRY;
