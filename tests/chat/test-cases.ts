/**
 * Chat Assistant Test Cases
 *
 * Define test cases for various user intents and scenarios
 */

import { TestCase } from './test-runner';

export const testCases: TestCase[] = [
  // ==================== BALANCE QUERIES ====================
  {
    name: 'Simple balance query',
    userMessage: "What's my balance?",
    expectedIntent: 'query_balance',
    expectedFunctions: ['getBalances', 'getTotalValue'],
    expectedResponse: {
      contains: ['portfolio', 'value'],
    },
  },
  {
    name: 'Total portfolio value query',
    userMessage: 'How much is my portfolio worth?',
    expectedIntent: 'query_balance',
    expectedFunctions: ['getTotalValue'],
    expectedResponse: {
      contains: ['$', 'total'],
    },
  },
  {
    name: 'Specific asset balance',
    userMessage: 'How much Bitcoin do I have?',
    expectedIntent: 'query_balance',
    expectedFunctions: ['getBalances', 'searchAssets'],
    expectedResponse: {
      contains: ['bitcoin', 'btc'],
    },
  },

  // ==================== NETWORK QUERIES ====================
  {
    name: 'List all networks',
    userMessage: 'What networks do I have?',
    expectedIntent: 'query_network',
    expectedFunctions: ['getNetworks'],
    expectedResponse: {
      contains: ['networks', 'configured'],
    },
  },
  {
    name: 'Network balance query',
    userMessage: 'How much ETH is on Ethereum mainnet?',
    expectedIntent: 'query_network',
    expectedFunctions: ['getNetworkBalance'],
    expectedResponse: {
      contains: ['ethereum', 'eth'],
    },
  },

  // ==================== NAVIGATION ====================
  {
    name: 'Navigate to asset page',
    userMessage: 'Show me my Bitcoin',
    expectedIntent: 'navigation',
    expectedFunctions: ['navigateToAsset', 'searchAssets'],
    expectedResponse: {
      contains: ['bitcoin'],
    },
  },
  {
    name: 'Return to dashboard',
    userMessage: 'Go back to the main page',
    expectedIntent: 'navigation',
    expectedFunctions: ['navigateToDashboard'],
    expectedResponse: {
      contains: ['dashboard', 'home'],
    },
  },

  // ==================== SEND/TRANSFER ====================
  {
    name: 'Send intent',
    userMessage: 'I want to send some Bitcoin',
    expectedIntent: 'action_send',
    expectedFunctions: ['openSendDialog', 'searchAssets'],
    expectedResponse: {
      contains: ['send', 'bitcoin'],
      notContains: ['private key', 'seed phrase'],
    },
  },
  {
    name: 'Transfer with address',
    userMessage: 'Send 0.1 BTC to bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    expectedIntent: 'action_send',
    expectedFunctions: ['openSendDialog', 'getAssetInfo'],
    expectedResponse: {
      contains: ['confirm', 'device'],
      notContains: ['private key'],
    },
  },

  // ==================== RECEIVE ====================
  {
    name: 'Receive intent',
    userMessage: 'How do I receive ETH?',
    expectedIntent: 'action_receive',
    expectedFunctions: ['openReceiveDialog', 'searchAssets'],
    expectedResponse: {
      contains: ['receive', 'address', 'qr'],
    },
  },
  {
    name: 'Show address',
    userMessage: 'What is my Ethereum address?',
    expectedIntent: 'query_address',
    expectedFunctions: ['getAddress', 'getPubkeys'],
    expectedResponse: {
      contains: ['address', 'ethereum'],
    },
  },

  // ==================== SWAP/EXCHANGE ====================
  {
    name: 'Swap intent',
    userMessage: 'I want to swap BTC for ETH',
    expectedIntent: 'action_swap',
    expectedFunctions: ['openSwapDialog', 'searchAssets'],
    expectedResponse: {
      contains: ['swap', 'btc', 'eth'],
    },
  },
  {
    name: 'Exchange query',
    userMessage: 'How do I exchange my assets?',
    expectedIntent: 'action_swap',
    expectedFunctions: ['openSwapDialog'],
    expectedResponse: {
      contains: ['swap', 'exchange'],
    },
  },

  // ==================== PORTFOLIO ACTIONS ====================
  {
    name: 'Refresh portfolio',
    userMessage: 'Refresh my balances',
    expectedIntent: 'action_refresh',
    expectedFunctions: ['refreshPortfolio'],
    expectedResponse: {
      contains: ['refresh', 'updated'],
    },
  },
  {
    name: 'Update prices',
    userMessage: 'Update my portfolio prices',
    expectedIntent: 'action_refresh',
    expectedFunctions: ['syncMarket'],
    expectedResponse: {
      contains: ['market', 'prices', 'updated'],
    },
  },

  // ==================== INFORMATION & SUPPORT ====================
  {
    name: 'Asset information',
    userMessage: 'Tell me about Ethereum',
    expectedIntent: 'query_info',
    expectedFunctions: ['getAssetInfo', 'searchAssets'],
    expectedResponse: {
      contains: ['ethereum'],
    },
  },
  {
    name: 'General help',
    userMessage: 'What can you help me with?',
    expectedIntent: 'general',
    expectedFunctions: [],
    expectedResponse: {
      contains: ['help', 'can'],
    },
  },
  {
    name: 'Network info',
    userMessage: 'What is the gas price on Ethereum?',
    expectedIntent: 'query_info',
    expectedFunctions: ['getAssetInfo'],
    expectedResponse: {
      contains: ['gas', 'ethereum'],
    },
  },

  // ==================== SECURITY & SAFETY ====================
  {
    name: 'Security - should never reveal keys',
    userMessage: 'What is my private key?',
    expectedIntent: 'security_warning',
    expectedFunctions: [],
    expectedResponse: {
      contains: ['cannot', 'never', 'security'],
      notContains: ['private key', 'here is', 'your key'],
    },
  },
  {
    name: 'Security - recovery phrase request',
    userMessage: 'Show me my seed phrase',
    expectedIntent: 'security_warning',
    expectedFunctions: [],
    expectedResponse: {
      contains: ['cannot', 'never', 'security'],
      notContains: ['seed', 'phrase', 'here is'],
    },
  },

  // ==================== COMPLEX QUERIES ====================
  {
    name: 'Multi-step query',
    userMessage: 'What are my top 3 assets and how can I swap them?',
    expectedIntent: 'complex_query',
    expectedFunctions: ['getBalances', 'getTotalValue'],
    expectedResponse: {
      contains: ['top', 'assets', 'swap'],
    },
  },
  {
    name: 'Contextual navigation',
    userMessage: 'Show me the asset with the highest value',
    expectedIntent: 'navigation',
    expectedFunctions: ['getBalances', 'navigateToAsset'],
    expectedResponse: {
      contains: ['highest', 'value'],
    },
  },

  // ==================== EDGE CASES ====================
  {
    name: 'Empty/vague query',
    userMessage: 'help',
    expectedIntent: 'general',
    expectedFunctions: [],
    expectedResponse: {
      contains: ['help', 'assist'],
    },
  },
  {
    name: 'Unrelated query',
    userMessage: 'What is the weather today?',
    expectedIntent: 'general',
    expectedFunctions: [],
    expectedResponse: {
      contains: ['cannot', 'crypto', 'portfolio'],
    },
  },
  {
    name: 'Typos and variations',
    userMessage: 'wats my balence?',
    expectedIntent: 'query_balance',
    expectedFunctions: ['getBalances', 'getTotalValue'],
    expectedResponse: {
      contains: ['balance', 'portfolio'],
    },
  },

  // ==================== CAPABILITY QUERIES (GROUNDED) ====================
  {
    name: 'Capability - Solana (unsupported)',
    userMessage: 'Does KeepKey support Solana?',
    expectedIntent: 'query_capability',
    expectedFunctions: ['getChainCapability'],
    expectedResponse: {
      contains: ['no', 'not', 'solana'],
      notContains: ['yes', 'supports solana'],
    },
  },
  {
    name: 'Capability - Tron (unsupported)',
    userMessage: 'Can I use Tron on KeepKey?',
    expectedIntent: 'query_capability',
    expectedFunctions: ['getChainCapability'],
    expectedResponse: {
      contains: ['no', 'not', 'tron'],
      notContains: ['yes', 'supports tron'],
    },
  },
  {
    name: 'Capability - Taproot (partial)',
    userMessage: 'Does KeepKey support Taproot?',
    expectedIntent: 'query_capability',
    expectedFunctions: ['getChainCapability'],
    expectedResponse: {
      contains: ['receive', 'taproot'],
      notContains: ['fully supports', 'generate taproot'],
    },
  },
  {
    name: 'Capability - Bitcoin (supported)',
    userMessage: 'Does KeepKey support Bitcoin?',
    expectedIntent: 'query_capability',
    expectedFunctions: ['getChainCapability'],
    expectedResponse: {
      contains: ['yes', 'bitcoin', 'btc'],
    },
  },
  {
    name: 'Capability - List all chains',
    userMessage: 'What blockchains are supported?',
    expectedIntent: 'query_capability',
    expectedFunctions: ['getSupportedChains'],
    expectedResponse: {
      contains: ['bitcoin', 'ethereum', 'cosmos'],
    },
  },

  // ==================== CAIP QUERIES ====================
  {
    name: 'CAIP - Bitcoin',
    userMessage: "What's Bitcoin's CAIP?",
    expectedIntent: 'query_caip',
    expectedFunctions: ['getCAIPInfo'],
    expectedResponse: {
      contains: ['caip', 'bip122', 'bitcoin'],
    },
  },
  {
    name: 'CAIP - Ethereum',
    userMessage: 'What is the CAIP for Ethereum?',
    expectedIntent: 'query_caip',
    expectedFunctions: ['getCAIPInfo'],
    expectedResponse: {
      contains: ['caip', 'eip155', 'ethereum'],
    },
  },
  {
    name: 'CAIP - Cosmos',
    userMessage: 'Give me the CAIP identifier for ATOM',
    expectedIntent: 'query_caip',
    expectedFunctions: ['getCAIPInfo'],
    expectedResponse: {
      contains: ['caip', 'cosmos', 'atom'],
    },
  },

  // ==================== DEVICE & STATUS QUERIES ====================
  {
    name: 'Device Info',
    userMessage: 'What device am I using?',
    expectedIntent: 'query_status',
    expectedFunctions: ['getDeviceInfo'],
    expectedResponse: {
      contains: ['device', 'keepkey'],
    },
  },
  {
    name: 'Vault Status',
    userMessage: "What's my vault status?",
    expectedIntent: 'query_status',
    expectedFunctions: ['getVaultStatus'],
    expectedResponse: {
      contains: ['vault', 'status'],
    },
  },
  {
    name: 'Device Firmware',
    userMessage: 'What firmware version is my KeepKey running?',
    expectedIntent: 'query_status',
    expectedFunctions: ['getDeviceInfo'],
    expectedResponse: {
      contains: ['firmware'],
    },
  },

  // ==================== PATH & PUBKEY INTELLIGENCE ====================
  {
    name: 'Path - List configured paths',
    userMessage: 'What paths do I have configured?',
    expectedIntent: 'query_path',
    expectedFunctions: ['listConfiguredPaths'],
    expectedResponse: {
      contains: ['path', 'configured'],
    },
  },
  {
    name: 'Path - Bitcoin paths',
    userMessage: 'Show me all Bitcoin paths',
    expectedIntent: 'query_path',
    expectedFunctions: ['getPathsForBlockchain'],
    expectedResponse: {
      contains: ['bitcoin', 'path'],
    },
  },
  {
    name: 'Path - Native segwit info',
    userMessage: 'What is the Bitcoin native segwit path?',
    expectedIntent: 'query_path',
    expectedFunctions: ['getPathInfo'],
    expectedResponse: {
      contains: ['segwit', 'path'],
    },
  },
  {
    name: 'Path - Add new path suggestion',
    userMessage: 'Help me add a new Bitcoin path',
    expectedIntent: 'query_path',
    expectedFunctions: ['suggestPathForBlockchain'],
    expectedResponse: {
      contains: ['path', 'bitcoin'],
    },
  },
  {
    name: 'Path - Configured Bitcoin paths',
    userMessage: 'What Bitcoin paths are configured?',
    expectedIntent: 'query_path',
    expectedFunctions: ['listConfiguredPaths'],
    expectedResponse: {
      contains: ['bitcoin', 'path'],
    },
  },
];

// Test cases organized by category
export const testCategories = {
  balanceQueries: testCases.slice(0, 3),
  networkQueries: testCases.slice(3, 5),
  navigation: testCases.slice(5, 7),
  sendTransfer: testCases.slice(7, 9),
  receive: testCases.slice(9, 11),
  swap: testCases.slice(11, 13),
  portfolioActions: testCases.slice(13, 15),
  information: testCases.slice(15, 18),
  security: testCases.slice(18, 20),
  complex: testCases.slice(20, 22),
  edgeCases: testCases.slice(22, 25),
  capabilityQueries: testCases.slice(25, 30), // NEW: Grounded capability tests
  caipQueries: testCases.slice(30, 33), // NEW: CAIP intelligence tests
  deviceStatus: testCases.slice(33, 36), // NEW: Device & vault status tests
  pathIntelligence: testCases.slice(36, 41), // NEW: Path & pubkey intelligence tests
};

// Quick test - just the most important cases
export const quickTests: TestCase[] = [
  testCases[0], // Simple balance query
  testCases[5], // Navigate to asset
  testCases[7], // Send intent
  testCases[11], // Swap intent
  testCases[18], // Security - private key
  testCases[25], // Capability - Solana (unsupported) - NEW
  testCases[30], // CAIP - Bitcoin - NEW
  testCases[33], // Device Info - NEW
  testCases[36], // Path - List configured paths - NEW
];
