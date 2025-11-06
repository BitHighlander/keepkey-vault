#!/usr/bin/env ts-node
/**
 * Test Chat Functions
 *
 * Tests the function execution system with real ChatCompletion API
 * Usage: npx ts-node tests/chat/test-chat-functions.ts
 */

import { initPioneerForTesting } from './setup-pioneer';
import { executeChatFunctions, formatExecutionResponse } from '../../src/lib/chat/executor';

interface TestCase {
  name: string;
  userInput: string;
  expectedIntent: string;
  expectedFunctions: string[];
}

const testCases: TestCase[] = [
  {
    name: 'Balance Query',
    userInput: "What's my balance?",
    expectedIntent: 'query_balance',
    expectedFunctions: ['getBalances'],
  },
  {
    name: 'Navigate to Bitcoin',
    userInput: 'Show me my Bitcoin',
    expectedIntent: 'navigation',
    expectedFunctions: ['searchAssets', 'navigateToAsset'],
  },
  {
    name: 'Send Intent',
    userInput: 'I want to send Bitcoin',
    expectedIntent: 'action_send',
    expectedFunctions: ['searchAssets', 'navigateToSend'],
  },
  {
    name: 'Receive Intent',
    userInput: 'How do I receive ETH?',
    expectedIntent: 'action_receive',
    expectedFunctions: ['searchAssets', 'navigateToReceive'],
  },
  {
    name: 'Network Query',
    userInput: 'What networks do I have?',
    expectedIntent: 'query_network',
    expectedFunctions: ['getNetworks'],
  },
  {
    name: 'Refresh Portfolio',
    userInput: 'Refresh my portfolio',
    expectedIntent: 'action_refresh',
    expectedFunctions: ['refreshPortfolio'],
  },
  {
    name: 'Security Warning',
    userInput: "What's my private key?",
    expectedIntent: 'security_warning',
    expectedFunctions: [],
  },
  {
    name: 'Navigate to Dashboard',
    userInput: 'Go back to dashboard',
    expectedIntent: 'navigation',
    expectedFunctions: ['navigateToDashboard'],
  },
];

async function runTest(testCase: TestCase, app: any): Promise<{
  passed: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    console.log(`\n🧪 Test: ${testCase.name}`);
    console.log(`   Input: "${testCase.userInput}"`);

    // Call SupportChat API (Venice.ai with server-side system prompt)
    const response = await app.pioneer.SupportChat({
      messages: [
        { role: 'user', content: testCase.userInput }
      ]
    });

    // Handle response.data wrapper from swagger client
    const chatData = response.data || response;

    if (!chatData?.choices?.[0]?.message?.content) {
      errors.push('Invalid response from SupportChat');
      return { passed: false, errors };
    }

    // Parse intent
    const intentResult = JSON.parse(chatData.choices[0].message.content);
    console.log(`   Detected Intent: ${intentResult.intent}`);
    console.log(`   Functions: [${intentResult.functions?.join(', ')}]`);
    console.log(`   Parameters:`, intentResult.parameters);

    // Verify intent
    if (intentResult.intent !== testCase.expectedIntent) {
      errors.push(`Intent mismatch: expected "${testCase.expectedIntent}", got "${intentResult.intent}"`);
    }

    // Verify functions
    const detectedFunctions = intentResult.functions || [];
    for (const expectedFn of testCase.expectedFunctions) {
      if (!detectedFunctions.includes(expectedFn)) {
        errors.push(`Missing function: ${expectedFn}`);
      }
    }

    // Execute functions (but don't actually navigate)
    console.log(`   Executing functions...`);
    const executionResult = await executeChatFunctions(
      intentResult.intent,
      intentResult.functions || [],
      intentResult.parameters || {},
      app
    );

    console.log(`   Execution Result: ${executionResult.success ? '✅ Success' : '❌ Failed'}`);
    if (!executionResult.success) {
      console.log(`   Error: ${executionResult.message}`);
    }

    // Format response
    const formattedResponse = formatExecutionResponse(intentResult, executionResult);
    console.log(`   Response Preview: ${formattedResponse.substring(0, 100)}...`);

    if (errors.length === 0) {
      console.log(`   ✅ PASSED`);
      return { passed: true, errors: [] };
    } else {
      console.log(`   ❌ FAILED`);
      errors.forEach(err => console.log(`      - ${err}`));
      return { passed: false, errors };
    }

  } catch (error: any) {
    console.log(`   ❌ EXCEPTION: ${error.message}`);
    errors.push(`Exception: ${error.message}`);
    return { passed: false, errors };
  }
}

async function main() {
  console.log('🚀 Chat Function Tests\n');

  try {
    // Initialize Pioneer SDK
    console.log('Step 1: Initializing Pioneer SDK...');
    const app = await initPioneerForTesting();

    // Check if SupportChat API is available
    if (!app.pioneer?.SupportChat) {
      console.error('❌ SupportChat API not available');
      console.log('Available methods:', Object.keys(app.pioneer).filter(k => typeof app.pioneer[k] === 'function'));
      process.exit(1);
    }

    console.log('✅ Pioneer SDK initialized\n');
    console.log('═══════════════════════════════════════════════\n');

    // Run all tests sequentially
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\nRunning test ${i + 1}/${testCases.length}...`);

      try {
        const result = await runTest(testCase, app);
        if (result.passed) {
          passed++;
        } else {
          failed++;
        }

        // Small delay between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`   ❌ Test failed with exception: ${error.message}`);
        failed++;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('\n📊 Test Summary:');
    console.log(`   Total: ${testCases.length}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
