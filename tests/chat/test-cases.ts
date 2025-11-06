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
};

// Quick test - just the most important cases
export const quickTests: TestCase[] = [
  testCases[0], // Simple balance query
  testCases[5], // Navigate to asset
  testCases[7], // Send intent
  testCases[11], // Swap intent
  testCases[18], // Security - private key
];
