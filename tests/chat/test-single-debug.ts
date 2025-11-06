#!/usr/bin/env ts-node
/**
 * Single Test Debug - Test Venice.ai SupportChat endpoint
 */

import { initPioneerForTesting } from './setup-pioneer';

async function main() {
  console.log('🔍 Debug Test - Venice.ai SupportChat (Privacy-Preserving)\n');

  try {
    // Initialize
    console.log('Initializing Pioneer SDK...');
    const app = await initPioneerForTesting();

    if (!app.pioneer?.SupportChat) {
      console.error('❌ SupportChat API not available');
      console.log('Available methods:', Object.keys(app.pioneer).filter(k => typeof app.pioneer[k] === 'function'));
      process.exit(1);
    }

    console.log('✅ Pioneer SDK initialized\n');

    // Simple test with timeout
    console.log('Making SupportChat API call with 30s timeout...');
    console.log('User input: "What\'s my balance?"');
    console.log('Note: System prompt is server-side (Venice.ai qwen3-4b)\n');

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API call timed out after 30 seconds')), 30000)
    );

    // NO system prompt sent from client - it's server-side now
    const apiPromise = app.pioneer.SupportChat({
      messages: [
        { role: 'user', content: "What's my balance?" }
      ]
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);

    console.log('✅ Response received!');

    // Handle response.data wrapper from swagger client
    const chatData = response.data || response;

    console.log('Response structure:', {
      hasData: !!response.data,
      hasChoices: !!chatData?.choices,
      choicesLength: chatData?.choices?.length,
      hasMessage: !!chatData?.choices?.[0]?.message,
      hasContent: !!chatData?.choices?.[0]?.message?.content,
    });

    if (chatData?.choices?.[0]?.message?.content) {
      const content = chatData.choices[0].message.content;
      console.log('\nRaw content:');
      console.log(content);
      console.log('\nParsed JSON:');
      const parsed = JSON.parse(content);
      console.log(JSON.stringify(parsed, null, 2));

      console.log('\n✅ Venice.ai response parsed successfully!');
      console.log(`Model: ${chatData.model || 'qwen3-4b'}`);
      console.log(`Privacy: Venice.ai (no tracking)`);
    } else {
      console.error('❌ Invalid response structure');
      console.log('Full response:', JSON.stringify(response, null, 2));
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();
