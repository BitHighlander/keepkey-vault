#!/usr/bin/env ts-node
/**
 * Basic Inference API Test
 *
 * Test the inference API with a simple message
 * Usage: npx ts-node tests/chat/test-inference-basic.ts
 */

import { initPioneerForTesting } from './setup-pioneer';

async function testBasicInference() {
  console.log('🧪 Basic Inference API Test\n');

  try {
    // Initialize Pioneer SDK
    console.log('Step 1: Initializing Pioneer SDK...');
    const app = await initPioneerForTesting();

    // Check if ChatCompletion API is available
    if (!app.pioneer?.ChatCompletion) {
      console.error('❌ ChatCompletion API not available');
      console.error('   Available methods:', Object.keys(app.pioneer || {}));
      process.exit(1);
    }

    console.log('✅ ChatCompletion API is available\n');

    // Test 1: Simple greeting
    console.log('Test 1: Simple greeting');
    console.log('Input: "Hello"');
    const response1 = await app.pioneer.ChatCompletion({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    });
    console.log('Response:', JSON.stringify(response1, null, 2));
    console.log('');

    // Test 2: Balance query with JSON response
    console.log('Test 2: Balance query with intent detection');
    console.log('Input: "What\'s my balance?"');
    const systemPrompt = `You are a KeepKey Vault assistant. Analyze the user's message and return JSON with:
{
  "intent": "query_balance|action_send|query_network|general",
  "functions": ["getBalances", "getTotalValue", etc],
  "content": "response text"
}`;

    const response2 = await app.pioneer.ChatCompletion({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "What's my balance?" }
      ],
      response_format: { type: 'json_object' }
    });
    console.log('Response:', JSON.stringify(response2, null, 2));

    // Parse and display the intent
    if (response2.choices && response2.choices[0]) {
      const completionText = response2.choices[0].message.content;
      try {
        const result = JSON.parse(completionText);
        console.log('\nParsed Intent:');
        console.log('  Intent:', result.intent);
        console.log('  Functions:', result.functions);
        console.log('  Content:', result.content);
      } catch (e) {
        console.error('Failed to parse JSON result');
      }
    }

    console.log('\n✅ All tests passed!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

// Run the test
testBasicInference().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
