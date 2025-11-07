/**
 * Test Navigation Functions
 *
 * Tests that the Venice.ai chat can navigate to asset pages with different views
 */

import { initPioneerForTesting } from './setup-pioneer';
import { executeChatFunctions } from '../../src/lib/chat/executor';

async function testNavigationFunctions() {
  console.log('🧪 [Navigation Test] Starting...\n');

  try {
    // Initialize Pioneer SDK
    console.log('📦 [Setup] Initializing Pioneer SDK...');
    const app = await initPioneerForTesting();
    console.log('✅ [Setup] Pioneer SDK initialized\n');

    // Test 1: Navigate to Bitcoin asset
    console.log('🧪 [Test 1] Navigate to Bitcoin asset page');
    const test1Result = await executeChatFunctions(
      'navigation',
      ['searchAssets', 'navigateToAsset'],
      { query: 'bitcoin' },
      app
    );
    console.log('Result:', test1Result);
    console.log(test1Result.success ? '✅ Test 1 PASSED\n' : '❌ Test 1 FAILED\n');

    // Test 2: Navigate to Ethereum send page
    console.log('🧪 [Test 2] Navigate to Ethereum send page');
    const test2Result = await executeChatFunctions(
      'action_send',
      ['searchAssets', 'navigateToSend'],
      { query: 'ethereum' },
      app
    );
    console.log('Result:', test2Result);
    console.log(test2Result.success ? '✅ Test 2 PASSED\n' : '❌ Test 2 FAILED\n');

    // Test 3: Navigate to Bitcoin receive page
    console.log('🧪 [Test 3] Navigate to Bitcoin receive page');
    const test3Result = await executeChatFunctions(
      'action_receive',
      ['searchAssets', 'navigateToReceive'],
      { query: 'bitcoin' },
      app
    );
    console.log('Result:', test3Result);
    console.log(test3Result.success ? '✅ Test 3 PASSED\n' : '❌ Test 3 FAILED\n');

    // Test 4: Navigate to Ethereum swap page
    console.log('🧪 [Test 4] Navigate to Ethereum swap page');
    const test4Result = await executeChatFunctions(
      'action_swap',
      ['searchAssets', 'navigateToSwap'],
      { query: 'ethereum' },
      app
    );
    console.log('Result:', test4Result);
    console.log(test4Result.success ? '✅ Test 4 PASSED\n' : '❌ Test 4 FAILED\n');

    // Test 5: Navigate back to dashboard
    console.log('🧪 [Test 5] Navigate to dashboard');
    const test5Result = await executeChatFunctions(
      'navigation',
      ['navigateToDashboard'],
      {},
      app
    );
    console.log('Result:', test5Result);
    console.log(test5Result.success ? '✅ Test 5 PASSED\n' : '❌ Test 5 FAILED\n');

    // Summary
    const allPassed = [test1Result, test2Result, test3Result, test4Result, test5Result].every(r => r.success);
    console.log('\n' + '='.repeat(60));
    console.log(allPassed ? '✅ ALL NAVIGATION TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ [Test Error]', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testNavigationFunctions()
  .then(() => {
    console.log('\n✅ Navigation test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Navigation test failed:', error);
    process.exit(1);
  });
