# Chat Assistant Testing

Simple, debuggable testing framework for the KeepKey Vault Chat Assistant.

## Philosophy

- **No Jest** - Simple TypeScript runner, easy to debug
- **Visual Output** - Color-coded terminal output with clear errors
- **Multiple Formats** - JSON, HTML, and Markdown reports
- **Fast Iteration** - Quick feedback loop for prompt engineering
- **Easy to Read** - Test cases are just data, not complex code

## Quick Start

```bash
# Install dependencies (if needed)
npm install

# Run all tests
npm run test:chat

# Run quick smoke tests
npm run test:chat quick

# Run specific category
npm run test:chat security
```

## Test Structure

### Test Cases (`test-cases.ts`)
Define test cases as simple objects:

```typescript
{
  name: 'Simple balance query',
  userMessage: "What's my balance?",
  expectedIntent: 'query_balance',
  expectedFunctions: ['getBalances', 'getTotalValue'],
  expectedResponse: {
    contains: ['portfolio', 'value'],
  },
}
```

### Test Runner (`test-runner.ts`)
Executes tests and generates reports:
- Terminal output with colors
- JSON for programmatic access
- HTML for visual inspection
- Markdown for documentation

### Run Tests (`run-tests.ts`)
Entry point with category filtering:
```bash
npm run test:chat [category]
```

## Test Categories

| Category | Tests | Focus |
|----------|-------|-------|
| `quick` | 5 | Smoke tests |
| `balance` | 3 | Balance queries |
| `network` | 2 | Network queries |
| `navigation` | 2 | Page navigation |
| `send` | 2 | Send/transfer |
| `receive` | 2 | Receive/addresses |
| `swap` | 2 | Swap/exchange |
| `portfolio` | 2 | Refresh/sync |
| `info` | 3 | Information queries |
| `security` | 2 | Security validation |
| `complex` | 2 | Multi-step queries |
| `edge` | 3 | Edge cases |

## Output Files

All test results are saved to `test-output/chat/`:

### JSON Report
```json
{
  "name": "Simple balance query",
  "passed": true,
  "duration": 150,
  "errors": [],
  "warnings": [],
  "details": {
    "userMessage": "What's my balance?",
    "actualIntent": "query_balance",
    "actualFunctions": ["getBalances", "getTotalValue"],
    "actualResponse": "Your total portfolio value is $1,234.56"
  }
}
```

### HTML Report
Interactive HTML page with:
- Summary statistics
- Color-coded pass/fail
- Function call visualization
- Full response inspection

### Markdown Report
GitHub-friendly markdown with:
- Test results table
- Detailed breakdowns
- Copy-paste friendly format

## Adding New Tests

1. **Add test case to `test-cases.ts`**:
```typescript
{
  name: 'My new test',
  userMessage: 'User input here',
  expectedIntent: 'expected_intent',
  expectedFunctions: ['function1', 'function2'],
  expectedResponse: {
    contains: ['required text'],
    notContains: ['forbidden text']
  }
}
```

2. **Run the test**:
```bash
npm run test:chat
```

3. **Review results**:
- Check terminal output for pass/fail
- Open HTML report for visual inspection
- Review JSON for detailed analysis

## Debugging Failed Tests

When a test fails:

1. **Check Terminal Output**:
```
▶ Running: Simple balance query
  Input: "What's my balance?"
  ✗ FAILED
    Error: Intent mismatch: expected "query_balance", got "general"
  Functions called: none
  Response: I can help you with that.
```

2. **Check HTML Report**:
- Open `test-output/chat/test-results-[timestamp].html`
- Visual inspection of function calls and responses

3. **Check JSON Report**:
- Open `test-output/chat/test-results-[timestamp].json`
- Full details including tool calls and arguments

4. **Fix Issues**:
- Update system prompt if intent is wrong
- Adjust function definitions if calls are missing
- Modify test expectations if behavior is correct

## Integration with Inference API

### Current State (Mock)
Tests use a simple mock implementation for rapid iteration:
```typescript
private async mockInferenceCall(testCase: TestCase) {
  // Pattern matching for testing
  if (input.includes('balance')) {
    return { intent: 'query_balance', functions: ['getBalances'] };
  }
}
```

### Real Implementation
To connect to actual inference API:

1. **Update `test-runner.ts`**:
```typescript
private async mockInferenceCall(testCase: TestCase) {
  // Replace mock with real call
  const response = await app.pioneer.Inference.chatCompletion({
    model: 'gpt-4o',
    messages: buildMessages(testCase),
    tools: buildTools()
  });

  return parseResponse(response);
}
```

2. **Add credentials**:
```bash
export OPENAI_API_KEY=your-key
# or configure in pioneer-server
```

3. **Run tests**:
```bash
npm run test:chat
```

## Best Practices

### Writing Good Tests

✅ **DO**:
- Test one intent per test case
- Use realistic user messages
- Include both positive and negative cases
- Test security boundaries (private keys, etc.)
- Test edge cases and typos

❌ **DON'T**:
- Make tests too specific (brittle)
- Test implementation details
- Assume exact response wording
- Skip security tests
- Ignore edge cases

### Test Naming

Good names are descriptive and specific:
```typescript
✅ "Simple balance query"
✅ "Send with address validation"
✅ "Security - should never reveal keys"

❌ "Test 1"
❌ "Balance"
❌ "Check something"
```

### Expected Values

Be specific but not brittle:
```typescript
✅ expectedResponse: {
  contains: ['balance', 'portfolio'],
  notContains: ['error', 'private key']
}

❌ expectedResponse: {
  contains: ['Your total portfolio value is exactly $1,234.56']
}
```

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Chat Tests
  run: npm run test:chat quick

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: chat-test-results
    path: test-output/chat/
```

## Performance Benchmarking

Track test execution time:
```bash
npm run test:chat | grep Duration
```

Expected performance:
- Mock mode: ~100ms per test
- Real inference: ~1-3s per test

## Troubleshooting

### Tests not running
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Check file permissions
chmod +x tests/chat/run-tests.ts
```

### No output files
```bash
# Check output directory exists
ls -la test-output/chat/

# Check write permissions
chmod -R 755 test-output/
```

### Mock vs Real API
```bash
# Verify API configuration
npm run test:chat info

# Check logs
cat test-output/chat/test-results-*.json
```

## Future Enhancements

- [ ] Parallel test execution
- [ ] Visual regression testing for UI
- [ ] Performance benchmarking suite
- [ ] A/B testing for different prompts
- [ ] Load testing for API limits
- [ ] Integration with LLM observability tools
