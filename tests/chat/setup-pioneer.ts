/**
 * Pioneer SDK Setup for Testing
 *
 * Initializes a real Pioneer SDK instance for testing the inference API
 */

import { SDK } from '@pioneer-platform/pioneer-sdk';
import { availableChainsByWallet, getChainEnumValue, WalletOption } from '@pioneer-platform/pioneer-types';
// @ts-ignore
import { ChainToNetworkId } from '@pioneer-platform/pioneer-caip';
import { getPaths } from '@pioneer-platform/pioneer-coins';

// Environment variables - use localhost for testing Venice.ai endpoint
const PIONEER_URL = process.env.PIONEER_URL || 'http://localhost:9001/spec/swagger.json';
const PIONEER_WSS = process.env.PIONEER_WSS || 'ws://localhost:9001';

let pioneerInstance: any = null;

/**
 * Initialize Pioneer SDK for testing
 * Reuses the same initialization logic as the vault app
 */
export async function initPioneerForTesting(): Promise<any> {
  // Return existing instance if already initialized
  if (pioneerInstance) {
    console.log('📦 Using existing Pioneer SDK instance');
    return pioneerInstance;
  }

  console.log('🔧 Initializing Pioneer SDK for testing...');

  try {
    // Generate test credentials
    const username = `test-user-${Date.now()}`;
    const queryKey = `test-key-${Date.now()}`;
    const keepkeyApiKey = 'test-keepkey-api-key';

    // Get supported blockchains
    const walletType = WalletOption.KEEPKEY;
    const allSupported = availableChainsByWallet[walletType];
    const blockchains = allSupported.map(
      // @ts-ignore
      (chainStr: any) => ChainToNetworkId[getChainEnumValue(chainStr)],
    );
    const paths = getPaths(blockchains);

    console.log(`  Blockchains: ${blockchains.length}`);
    console.log(`  Paths: ${paths.length}`);

    // Create Pioneer SDK instance
    const app = new SDK(PIONEER_URL, {
      spec: PIONEER_URL,
      wss: PIONEER_WSS,
      appName: 'KeepKey Vault Tests',
      appIcon: 'https://pioneers.dev/coins/keepkey.png',
      blockchains,
      keepkeyApiKey,
      username,
      queryKey,
      paths,
      // API keys for testing
      ethplorerApiKey: process.env.ETHPLORER_API_KEY || 'EK-xs8Hj-qG4HbLY-LoAu7',
      covalentApiKey: process.env.COVALENT_API_KEY || 'cqt_rQ6333MVWCVJFVX3DbCCGMVqRH4q',
      utxoApiKey: process.env.UTXO_API_KEY || 'B_s9XK926uwmQSGTDEcZB3vSAmt5t2',
      walletConnectProjectId: process.env.WALLET_CONNECT_PROJECT_ID || '18224df5f72924a5f6b3569fbd56ae16',
    });

    console.log('  Calling app.init()...');

    // Initialize with skipSync to avoid needing device
    await app.init({}, { skipSync: true });

    console.log('✅ Pioneer SDK initialized for testing');
    console.log(`  Status: ${app.status}`);
    console.log(`  Has pioneer client: ${!!app.pioneer}`);
    console.log(`  Has SupportChat API: ${!!app.pioneer?.SupportChat}`);

    // The Venice.ai endpoint uses SupportChat method (Swagger auto-generated from POST /supportChat)
    if (!app.pioneer?.SupportChat) {
      console.log('⚠️  SupportChat API not available on Pioneer client');
      console.log('   Make sure pioneer-server is rebuilt and running on localhost:9001');
      console.log('   Available methods:', Object.keys(app.pioneer || {}).filter(k => typeof app.pioneer[k] === 'function'));
    }

    pioneerInstance = app;
    return app;

  } catch (error: any) {
    console.error('❌ Failed to initialize Pioneer SDK:', error.message);
    throw error;
  }
}

/**
 * Get the initialized Pioneer SDK instance
 */
export function getPioneerInstance(): any {
  if (!pioneerInstance) {
    throw new Error('Pioneer SDK not initialized. Call initPioneerForTesting() first.');
  }
  return pioneerInstance;
}

/**
 * Check if chat completion API is available and configured
 */
export async function checkInferenceAvailable(): Promise<boolean> {
  try {
    const app = await initPioneerForTesting();

    if (!app.pioneer?.ChatCompletion) {
      console.log('⚠️  ChatCompletion API not available');
      return false;
    }

    // Try a simple chat completion call to check if it's working
    const testMessages = [
      { role: 'user', content: 'Hello' }
    ];

    const response = await app.pioneer.ChatCompletion({
      model: 'gpt-4o-mini-2024-07-18',
      messages: testMessages
    });

    console.log('📡 Chat completion test response:', response);

    if (!response || !response.id) {
      console.log('⚠️  ChatCompletion API not working properly');
      console.log('   Check if OPENAI_API_KEY is configured in pioneer-server');
      return false;
    }

    console.log('✅ ChatCompletion API is available and working');
    return true;

  } catch (error: any) {
    console.error('❌ Chat completion check failed:', error.message);
    console.error('   Make sure pioneer-server is running with OPENAI_API_KEY configured');
    return false;
  }
}

/**
 * Cleanup - close Pioneer SDK connections
 */
export function cleanupPioneer(): void {
  if (pioneerInstance) {
    console.log('🧹 Cleaning up Pioneer SDK instance');
    // Add any cleanup needed
    pioneerInstance = null;
  }
}
