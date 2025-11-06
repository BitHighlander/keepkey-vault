# Chat Testing Setup Guide

## Prerequisites

The chat assistant tests need a fully initialized Pioneer SDK to test the inference API. This guide shows you how to set everything up.

## Quick Start

```bash
# 1. Check if everything is set up
npm run test:chat:setup

# 2. If checks pass, run tests
npm run test:chat quick
```

## Setup Steps

### Step 1: Verify Pioneer SDK

The tests initialize a real Pioneer SDK instance (same as the vault app). This requires:

- ✅ Pioneer server running at `https://api.keepkey.info` (or custom URL)
- ✅ Network access to the Pioneer API
- ✅ Valid blockchain configurations

**Check it:**
```bash
npm run test:chat:setup
```

Expected output:
```
[1/3] Checking Pioneer SDK initialization...
  ✓ Pioneer SDK initialized
  ✓ Status: online
```

### Step 2: Configure Inference API

The inference API needs to be configured in the Pioneer server. You have 3 options:

#### Option 1: OpenAI (Recommended)
```bash
# In pioneer-server directory
export OPENAI_API_KEY=sk-...
```

#### Option 2: OpenRouter
```bash
export OPENROUTER_API_KEY=sk-or-...
```

#### Option 3: Venice.ai
```bash
export VENICE_API_KEY=your-venice-key
```

**Check it:**
```bash
npm run test:chat:setup
```

Expected output:
```
[2/3] Checking Inference API...
  ✓ Inference API is available and configured
  📡 Inference provider: { provider: 'openai', configured: true }
```

### Step 3: Environment Variables (Optional)

You can customize the Pioneer server URLs:

```bash
# .env.local or .env.test
PIONEER_URL=http://localhost:9001/spec/swagger.json
PIONEER_WSS=ws://localhost:9001
OPENAI_API_KEY=sk-...
```

**Check it:**
```bash
npm run test:chat:setup
```

Expected output:
```
[3/3] Checking environment variables...
  ✓ PIONEER_URL: http://localhost:9001/spec/swagger.json
  ✓ PIONEER_WSS: ws://localhost:9001
  ✓ OPENAI_API_KEY: [SET]
```

## Testing Modes

### Mode 1: Mock Mode (No API Required)
If inference API is not configured, tests run in mock mode:
- ✅ Fast execution
- ✅ No API costs
- ✅ Good for prompt iteration
- ⚠️ Not testing real LLM behavior

```bash
# Just run tests - they'll use mocks
npm run test:chat quick
```

### Mode 2: Real API Mode
If inference API is configured, tests use real LLM:
- ✅ Tests actual AI behavior
- ✅ Validates function calling
- ✅ Tests prompts with real models
- ⚠️ Slower (1-3s per test)
- ⚠️ Costs money (OpenAI API usage)

```bash
# Ensure API is configured
npm run test:chat:setup

# Run tests with real API
npm run test:chat quick
```

## Troubleshooting

### Pioneer SDK fails to initialize

**Error:**
```
❌ Failed to initialize Pioneer SDK: Connection refused
```

**Solution:**
1. Check if pioneer-server is running
2. Verify PIONEER_URL is correct
3. Check network connectivity

```bash
# Test manually
curl https://api.keepkey.info/spec/swagger.json
```

### Inference API not available

**Error:**
```
⚠️  Inference API not configured
```

**Solution:**
1. Configure API key in pioneer-server:
```bash
cd /path/to/pioneer-server
export OPENAI_API_KEY=sk-...
npm start
```

2. Verify it's working:
```bash
curl https://api.keepkey.info/interface/provider
```

Expected response:
```json
{
  "provider": "openai",
  "configured": true,
  "hasSystemPrompt": false
}
```

### Tests run but fail on all cases

**Error:**
```
✗ All tests failed with "Intent mismatch"
```

**Solution:**
This means the mock is being used instead of real API. Check:

1. API is configured: `npm run test:chat:setup`
2. Update `test-runner.ts` to use real inference (see Integration section below)

## Integration with Real Inference API

To switch from mock to real API, update `test-runner.ts`:

```typescript
// Replace mockInferenceCall with:
private async mockInferenceCall(testCase: TestCase) {
  const app = await getPioneerInstance();

  // Build messages with system prompt
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(testCase.context)
    },
    {
      role: 'user',
      content: testCase.userMessage
    }
  ];

  // Define tools/functions
  const tools = buildToolDefinitions();

  // Call real API
  const response = await app.pioneer.Inference.chatCompletion({
    model: 'gpt-4o',
    messages,
    tools,
    temperature: 0.7,
    max_tokens: 500
  });

  // Parse response
  return parseInferenceResponse(response);
}
```

## CI/CD Setup

### GitHub Actions

```yaml
name: Chat Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm install

      - name: Check setup
        run: npm run test:chat:setup

      - name: Run quick tests
        run: npm run test:chat quick
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          PIONEER_URL: https://api.keepkey.info/spec/swagger.json

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-output/chat/
```

## Development Workflow

### 1. Start Development
```bash
# Check setup
npm run test:chat:setup

# Run quick tests to verify
npm run test:chat quick
```

### 2. Iterate on Prompts
```bash
# Edit system prompt or function definitions
vim src/components/chat/ChatService.ts

# Run specific category
npm run test:chat security

# Review HTML report
open test-output/chat/test-results-*.html
```

### 3. Add New Tests
```bash
# Add test case
vim tests/chat/test-cases.ts

# Run your new test
npm run test:chat

# Check if it passes
```

### 4. Before Committing
```bash
# Run all tests
npm run test:chat

# Ensure all pass
# Review any failures in HTML report
```

## Performance Expectations

### Mock Mode
- Setup time: ~1s
- Test execution: ~100ms per test
- Total for all 25 tests: ~3-5s

### Real API Mode
- Setup time: ~2s (Pioneer init)
- Test execution: ~1-3s per test
- Total for all 25 tests: ~30-90s
- API costs: ~$0.10-0.50 per full run

## Next Steps

1. ✅ Run setup check: `npm run test:chat:setup`
2. ✅ Run quick tests: `npm run test:chat quick`
3. ✅ Review results: `open test-output/chat/test-results-*.html`
4. ✅ Integrate real inference API (when ready)
5. ✅ Add more test cases for your use cases
6. ✅ Set up CI/CD automation
