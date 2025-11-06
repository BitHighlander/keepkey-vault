#!/usr/bin/env ts-node
/**
 * Main entry point for running chat assistant tests
 *
 * Usage:
 *   npm run test:chat              # Run all tests
 *   npm run test:chat quick        # Run quick tests only
 *   npm run test:chat balance      # Run balance query tests
 *   npm run test:chat security     # Run security tests
 */

import { TestRunner } from './test-runner';
import { testCases, testCategories, quickTests } from './test-cases';
import { initPioneerForTesting, checkInferenceAvailable } from './setup-pioneer';

async function main() {
  const args = process.argv.slice(2);
  const category = args[0]?.toLowerCase();

  // Initialize Pioneer SDK first
  console.log('🚀 Initializing Pioneer SDK...\n');
  try {
    await initPioneerForTesting();

    // Check if inference API is available
    const inferenceAvailable = await checkInferenceAvailable();
    if (!inferenceAvailable) {
      console.error('\n⚠️  WARNING: Inference API is not available.');
      console.error('   Tests will use fallback pattern matching instead of real AI.');
      console.error('   To use real inference, make sure:');
      console.error('   1. pioneer-server is running');
      console.error('   2. OPENAI_API_KEY is configured\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to initialize Pioneer SDK:', error.message);
    console.error('   Tests will use fallback pattern matching.\n');
  }

  const runner = new TestRunner('./test-output/chat');

  let casesToRun = testCases;
  let description = 'All Tests';

  // Select test cases based on argument
  switch (category) {
    case 'quick':
      casesToRun = quickTests;
      description = 'Quick Tests';
      break;
    case 'balance':
      casesToRun = testCategories.balanceQueries;
      description = 'Balance Query Tests';
      break;
    case 'network':
      casesToRun = testCategories.networkQueries;
      description = 'Network Query Tests';
      break;
    case 'navigation':
    case 'nav':
      casesToRun = testCategories.navigation;
      description = 'Navigation Tests';
      break;
    case 'send':
      casesToRun = testCategories.sendTransfer;
      description = 'Send/Transfer Tests';
      break;
    case 'receive':
      casesToRun = testCategories.receive;
      description = 'Receive Tests';
      break;
    case 'swap':
      casesToRun = testCategories.swap;
      description = 'Swap Tests';
      break;
    case 'portfolio':
      casesToRun = testCategories.portfolioActions;
      description = 'Portfolio Action Tests';
      break;
    case 'info':
    case 'information':
      casesToRun = testCategories.information;
      description = 'Information Tests';
      break;
    case 'security':
      casesToRun = testCategories.security;
      description = 'Security Tests';
      break;
    case 'complex':
      casesToRun = testCategories.complex;
      description = 'Complex Query Tests';
      break;
    case 'edge':
      casesToRun = testCategories.edgeCases;
      description = 'Edge Case Tests';
      break;
    case 'help':
      printHelp();
      process.exit(0);
    case undefined:
      // Run all tests by default
      break;
    default:
      console.error(`Unknown category: ${category}`);
      console.error('Run with "help" to see available categories');
      process.exit(1);
  }

  console.log(`\nRunning: ${description}\n`);
  await runner.runAll(casesToRun);
}

function printHelp() {
  console.log(`
Chat Assistant Test Runner

Usage:
  npm run test:chat [category]

Categories:
  (none)      Run all tests
  quick       Run quick smoke tests (5 tests)
  balance     Balance query tests
  network     Network query tests
  navigation  Navigation tests
  send        Send/transfer tests
  receive     Receive tests
  swap        Swap/exchange tests
  portfolio   Portfolio action tests
  info        Information query tests
  security    Security-related tests
  complex     Complex multi-step queries
  edge        Edge cases and error handling

Examples:
  npm run test:chat              # Run all tests
  npm run test:chat quick        # Run quick tests
  npm run test:chat security     # Run security tests
  `);
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
