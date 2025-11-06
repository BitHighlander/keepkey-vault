#!/usr/bin/env ts-node
/**
 * Check if Pioneer SDK and Inference API are properly set up for testing
 *
 * Run this before running tests to ensure everything is configured
 */

import { initPioneerForTesting, checkInferenceAvailable } from './setup-pioneer';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

async function checkSetup() {
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}KeepKey Vault - Chat Testing Setup Check${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);

  let allGood = true;

  // Check 1: Pioneer SDK initialization
  console.log(`${colors.cyan}[1/3]${colors.reset} Checking Pioneer SDK initialization...`);
  try {
    const app = await initPioneerForTesting();
    console.log(`  ${colors.green}✓${colors.reset} Pioneer SDK initialized`);
    console.log(`  ${colors.green}✓${colors.reset} Status: ${app.status}`);
  } catch (error: any) {
    console.log(`  ${colors.red}✗${colors.reset} Failed: ${error.message}`);
    allGood = false;
  }

  // Check 2: Inference API availability
  console.log(`\n${colors.cyan}[2/3]${colors.reset} Checking Inference API...`);
  try {
    const available = await checkInferenceAvailable();
    if (available) {
      console.log(`  ${colors.green}✓${colors.reset} Inference API is available and configured`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset}  Inference API not configured`);
      console.log(`  ${colors.yellow}→${colors.reset} Tests will use mock mode`);
      console.log(`  ${colors.yellow}→${colors.reset} To use real API, configure inference provider in pioneer-server`);
    }
  } catch (error: any) {
    console.log(`  ${colors.red}✗${colors.reset} Failed: ${error.message}`);
    allGood = false;
  }

  // Check 3: Environment variables
  console.log(`\n${colors.cyan}[3/3]${colors.reset} Checking environment variables...`);

  const envVars = [
    { name: 'PIONEER_URL', value: process.env.PIONEER_URL, required: false, default: 'https://api.keepkey.info/spec/swagger.json' },
    { name: 'PIONEER_WSS', value: process.env.PIONEER_WSS, required: false, default: 'wss://api.keepkey.info' },
    { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY ? '[SET]' : undefined, required: false, note: 'For real inference (optional)' },
  ];

  envVars.forEach((envVar) => {
    if (envVar.value) {
      console.log(`  ${colors.green}✓${colors.reset} ${envVar.name}: ${envVar.value}`);
    } else if (envVar.required) {
      console.log(`  ${colors.red}✗${colors.reset} ${envVar.name}: NOT SET (required)`);
      allGood = false;
    } else {
      const defaultMsg = envVar.default ? ` (using default: ${envVar.default})` : '';
      const noteMsg = envVar.note ? ` - ${envVar.note}` : '';
      console.log(`  ${colors.yellow}⚠${colors.reset}  ${envVar.name}: NOT SET${defaultMsg}${noteMsg}`);
    }
  });

  // Summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  if (allGood) {
    console.log(`${colors.green}✓ All checks passed!${colors.reset}`);
    console.log(`\nYou can now run tests:`);
    console.log(`  ${colors.cyan}npm run test:chat${colors.reset}`);
    console.log(`  ${colors.cyan}npm run test:chat quick${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Some checks failed${colors.reset}`);
    console.log(`\nPlease fix the issues above before running tests.`);
  }
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);

  process.exit(allGood ? 0 : 1);
}

checkSetup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
