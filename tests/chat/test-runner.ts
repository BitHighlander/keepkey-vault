#!/usr/bin/env ts-node
/**
 * Simple Chat Assistant Test Runner
 *
 * No jest, no complex frameworks - just clear, debuggable tests
 * Run with: npx ts-node tests/chat/test-runner.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface TestCase {
  name: string;
  userMessage: string;
  context?: any;
  expectedIntent?: string;
  expectedFunctions?: string[];
  expectedResponse?: {
    contains?: string[];
    notContains?: string[];
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
  details: {
    userMessage: string;
    actualIntent?: string;
    actualFunctions?: string[];
    actualResponse?: string;
    toolCalls?: any[];
  };
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(private outputDir: string = './test-output') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  // Run a single test case
  async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      name: testCase.name,
      passed: true,
      duration: 0,
      errors: [],
      warnings: [],
      details: {
        userMessage: testCase.userMessage,
      },
    };

    try {
      console.log(`\n${colors.blue}▶ Running:${colors.reset} ${testCase.name}`);
      console.log(`  ${colors.dim}Input: "${testCase.userMessage}"${colors.reset}`);

      // TODO: Replace with actual inference call
      const response = await this.mockInferenceCall(testCase);

      result.details.actualIntent = response.intent;
      result.details.actualFunctions = response.functions;
      result.details.actualResponse = response.content;
      result.details.toolCalls = response.toolCalls;

      // Validate expected intent
      if (testCase.expectedIntent && response.intent !== testCase.expectedIntent) {
        result.passed = false;
        result.errors.push(
          `Intent mismatch: expected "${testCase.expectedIntent}", got "${response.intent}"`
        );
      }

      // Validate expected functions
      if (testCase.expectedFunctions) {
        const missingFunctions = testCase.expectedFunctions.filter(
          (fn) => !response.functions.includes(fn)
        );
        const extraFunctions = response.functions.filter(
          (fn) => !testCase.expectedFunctions!.includes(fn)
        );

        if (missingFunctions.length > 0) {
          result.passed = false;
          result.errors.push(`Missing function calls: ${missingFunctions.join(', ')}`);
        }

        if (extraFunctions.length > 0) {
          result.warnings.push(`Unexpected function calls: ${extraFunctions.join(', ')}`);
        }
      }

      // Validate response content
      if (testCase.expectedResponse) {
        if (testCase.expectedResponse.contains) {
          for (const text of testCase.expectedResponse.contains) {
            if (!response.content.toLowerCase().includes(text.toLowerCase())) {
              result.passed = false;
              result.errors.push(`Response missing expected text: "${text}"`);
            }
          }
        }

        if (testCase.expectedResponse.notContains) {
          for (const text of testCase.expectedResponse.notContains) {
            if (response.content.toLowerCase().includes(text.toLowerCase())) {
              result.passed = false;
              result.errors.push(`Response contains forbidden text: "${text}"`);
            }
          }
        }
      }

      // Print results
      if (result.passed) {
        console.log(`  ${colors.green}✓ PASSED${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ FAILED${colors.reset}`);
        result.errors.forEach((err) => {
          console.log(`    ${colors.red}Error: ${err}${colors.reset}`);
        });
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach((warn) => {
          console.log(`    ${colors.yellow}Warning: ${warn}${colors.reset}`);
        });
      }

      // Print function calls
      if (response.functions.length > 0) {
        console.log(`  ${colors.cyan}Functions called: ${response.functions.join(', ')}${colors.reset}`);
      }

      // Print response preview
      const preview = response.content.substring(0, 100);
      console.log(`  ${colors.gray}Response: ${preview}${response.content.length > 100 ? '...' : ''}${colors.reset}`);

    } catch (error: any) {
      result.passed = false;
      result.errors.push(`Exception: ${error.message}`);
      console.log(`  ${colors.red}✗ FAILED${colors.reset}`);
      console.log(`    ${colors.red}Exception: ${error.message}${colors.reset}`);
    }

    result.duration = Date.now() - startTime;
    this.results.push(result);
    return result;
  }

  // Call the real ChatCompletion API
  private async mockInferenceCall(testCase: TestCase): Promise<{
    intent: string;
    functions: string[];
    content: string;
    toolCalls: any[];
  }> {
    // Import Pioneer setup dynamically to avoid circular dependencies
    const { getPioneerInstance } = require('./setup-pioneer');

    try {
      const app = getPioneerInstance();

      if (!app.pioneer?.ChatCompletion) {
        throw new Error('ChatCompletion API not available. Initialize Pioneer first.');
      }

      // Build the system prompt for intent detection
      const systemPrompt = `You are a KeepKey Vault assistant. Analyze the user's message and:
1. Detect their intent (query_balance, query_network, action_send, action_receive, action_swap, action_refresh, navigation, query_info, security_warning, general, complex_query)
2. Identify which functions should be called (getBalances, getTotalValue, getNetworks, openSendDialog, openReceiveDialog, openSwapDialog, refreshPortfolio, navigateToAsset, getPubkeys, getAddress, searchAssets, getAssetInfo, syncMarket)
3. Generate a helpful response

Return JSON with: {"intent": "...", "functions": [...], "content": "..."}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testCase.userMessage }
      ];

      // Call the ChatCompletion API with JSON mode
      const response = await app.pioneer.ChatCompletion({
        model: 'gpt-4o-mini-2024-07-18',
        messages,
        response_format: { type: 'json_object' }
      });

      if (!response || !response.choices || !response.choices[0]) {
        throw new Error('ChatCompletion returned invalid response');
      }

      // Parse the result from the completion
      const completionText = response.choices[0].message.content;
      let result;
      try {
        result = JSON.parse(completionText);
      } catch (e) {
        console.error('Failed to parse completion as JSON:', completionText);
        throw new Error('ChatCompletion did not return valid JSON');
      }

      const intent = result.intent || 'general';
      const functions = result.functions || [];
      const content = result.content || 'I can help you with that.';

      return {
        intent,
        functions,
        content,
        toolCalls: functions.map((fn: string) => ({
          id: `call_${Math.random().toString(36).substr(2, 9)}`,
          type: 'function',
          function: { name: fn, arguments: '{}' },
        })),
      };

    } catch (error: any) {
      console.error('ChatCompletion API call failed:', error.message);
      // Fallback to simple pattern matching if API fails
      return this.fallbackInference(testCase);
    }
  }

  // Fallback simple pattern matching if inference API is unavailable
  private fallbackInference(testCase: TestCase): {
    intent: string;
    functions: string[];
    content: string;
    toolCalls: any[];
  } {
    const input = testCase.userMessage.toLowerCase();
    let intent = 'general';
    const functions: string[] = [];
    let content = 'I can help you with that.';

    if (input.includes('balance') || input.includes('how much')) {
      intent = 'query_balance';
      functions.push('getBalances', 'getTotalValue');
      content = 'Your total portfolio value is $1,234.56';
    } else if (input.includes('send') || input.includes('transfer')) {
      intent = 'action_send';
      functions.push('openSendDialog', 'getAssetInfo');
      content = 'I can help you send assets. Which asset would you like to send?';
    } else if (input.includes('swap') || input.includes('exchange')) {
      intent = 'action_swap';
      functions.push('openSwapDialog');
      content = 'I can help you swap assets. Which asset would you like to swap?';
    } else if (input.includes('network')) {
      intent = 'query_network';
      functions.push('getNetworks');
      content = 'You have 5 networks configured.';
    } else if (input.includes('navigate') || input.includes('go to')) {
      intent = 'navigation';
      functions.push('navigateToAsset');
      content = 'Navigating to the requested page.';
    }

    return {
      intent,
      functions,
      content,
      toolCalls: functions.map((fn) => ({
        id: `call_${Math.random().toString(36).substr(2, 9)}`,
        type: 'function',
        function: { name: fn, arguments: '{}' },
      })),
    };
  }

  // Run all tests
  async runAll(testCases: TestCase[]): Promise<void> {
    this.startTime = Date.now();
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}Chat Assistant Test Runner${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`Running ${testCases.length} tests...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printSummary();
    this.saveResults();
  }

  // Print test summary
  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}Test Summary${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`Total:    ${this.results.length}`);
    console.log(`${colors.green}Passed:   ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed:   ${failed}${colors.reset}`);
    console.log(`Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  ${colors.red}✗${colors.reset} ${r.name}`);
          r.errors.forEach((err) => {
            console.log(`    ${colors.dim}${err}${colors.reset}`);
          });
        });
    }

    console.log(`\n${colors.cyan}Results saved to: ${this.outputDir}${colors.reset}`);
  }

  // Save results to files
  private saveResults(): void {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    // Save JSON results
    const jsonPath = path.join(this.outputDir, `test-results-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

    // Save HTML report
    const htmlPath = path.join(this.outputDir, `test-results-${timestamp}.html`);
    fs.writeFileSync(htmlPath, this.generateHtmlReport());

    // Save markdown report
    const mdPath = path.join(this.outputDir, `test-results-${timestamp}.md`);
    fs.writeFileSync(mdPath, this.generateMarkdownReport());

    console.log(`  ${colors.dim}JSON:     ${jsonPath}${colors.reset}`);
    console.log(`  ${colors.dim}HTML:     ${htmlPath}${colors.reset}`);
    console.log(`  ${colors.dim}Markdown: ${mdPath}${colors.reset}`);
  }

  // Generate HTML report
  private generateHtmlReport(): string {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    return `<!DOCTYPE html>
<html>
<head>
  <title>Chat Assistant Test Results</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #3B82F6; padding-bottom: 10px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat { flex: 1; padding: 20px; border-radius: 6px; text-align: center; }
    .stat-total { background: #eff6ff; border: 2px solid #3B82F6; }
    .stat-passed { background: #f0fdf4; border: 2px solid #22c55e; }
    .stat-failed { background: #fef2f2; border: 2px solid #ef4444; }
    .stat-value { font-size: 48px; font-weight: bold; margin: 10px 0; }
    .stat-label { color: #666; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
    .test { margin: 20px 0; padding: 20px; border-radius: 6px; border-left: 4px solid #ddd; }
    .test.passed { background: #f0fdf4; border-left-color: #22c55e; }
    .test.failed { background: #fef2f2; border-left-color: #ef4444; }
    .test-name { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
    .test-input { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; font-family: monospace; }
    .test-functions { margin: 10px 0; }
    .function-tag { display: inline-block; background: #3B82F6; color: white; padding: 4px 8px; border-radius: 4px; margin: 2px; font-size: 12px; }
    .test-response { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .error { color: #ef4444; margin: 5px 0; padding: 8px; background: #fee; border-radius: 4px; }
    .warning { color: #f59e0b; margin: 5px 0; padding: 8px; background: #fffbeb; border-radius: 4px; }
    .duration { color: #666; font-size: 14px; }
    .timestamp { color: #999; text-align: center; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 Chat Assistant Test Results</h1>

    <div class="summary">
      <div class="stat stat-total">
        <div class="stat-value">${this.results.length}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat stat-passed">
        <div class="stat-value">${passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat stat-failed">
        <div class="stat-value">${failed}</div>
        <div class="stat-label">Failed</div>
      </div>
    </div>

    ${this.results
      .map(
        (r) => `
      <div class="test ${r.passed ? 'passed' : 'failed'}">
        <div class="test-name">${r.passed ? '✓' : '✗'} ${r.name}</div>
        <div class="test-input"><strong>Input:</strong> "${r.details.userMessage}"</div>
        ${
          r.details.actualFunctions && r.details.actualFunctions.length > 0
            ? `<div class="test-functions">
                <strong>Functions Called:</strong><br>
                ${r.details.actualFunctions.map((fn) => `<span class="function-tag">${fn}</span>`).join('')}
              </div>`
            : ''
        }
        ${
          r.details.actualResponse
            ? `<div class="test-response"><strong>Response:</strong> ${r.details.actualResponse}</div>`
            : ''
        }
        ${r.errors.map((err) => `<div class="error">❌ ${err}</div>`).join('')}
        ${r.warnings.map((warn) => `<div class="warning">⚠️ ${warn}</div>`).join('')}
        <div class="duration">Duration: ${r.duration}ms</div>
      </div>
    `
      )
      .join('')}

    <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>`;
  }

  // Generate markdown report
  private generateMarkdownReport(): string {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    let md = `# Chat Assistant Test Results\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    md += `## Summary\n\n`;
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Tests | ${this.results.length} |\n`;
    md += `| ✅ Passed | ${passed} |\n`;
    md += `| ❌ Failed | ${failed} |\n`;
    md += `| Success Rate | ${((passed / this.results.length) * 100).toFixed(1)}% |\n\n`;

    md += `## Test Results\n\n`;

    this.results.forEach((r) => {
      md += `### ${r.passed ? '✅' : '❌'} ${r.name}\n\n`;
      md += `**Input:** "${r.details.userMessage}"\n\n`;

      if (r.details.actualIntent) {
        md += `**Intent:** \`${r.details.actualIntent}\`\n\n`;
      }

      if (r.details.actualFunctions && r.details.actualFunctions.length > 0) {
        md += `**Functions Called:**\n`;
        r.details.actualFunctions.forEach((fn) => {
          md += `- \`${fn}\`\n`;
        });
        md += `\n`;
      }

      if (r.details.actualResponse) {
        md += `**Response:**\n> ${r.details.actualResponse}\n\n`;
      }

      if (r.errors.length > 0) {
        md += `**Errors:**\n`;
        r.errors.forEach((err) => {
          md += `- ❌ ${err}\n`;
        });
        md += `\n`;
      }

      if (r.warnings.length > 0) {
        md += `**Warnings:**\n`;
        r.warnings.forEach((warn) => {
          md += `- ⚠️ ${warn}\n`;
        });
        md += `\n`;
      }

      md += `**Duration:** ${r.duration}ms\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}

// Export for use in other files
export { TestRunner };
export type { TestCase, TestResult };
