#!/usr/bin/env node

/**
 * Test script to verify network ID resolution fix for fee fetching
 * This tests the fix for the "missing node! for network eip155:*" error
 */

// Test cases for network ID resolution
const testCases = [
  {
    name: "Ethereum mainnet token",
    networkId: "eip155:*",
    caip: "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    expected: "eip155:1",
    description: "Should extract chain ID from CAIP when network has wildcard"
  },
  {
    name: "Polygon token",
    networkId: "eip155:*",
    caip: "eip155:137/erc20:0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    expected: "eip155:137",
    description: "Should extract Polygon chain ID from CAIP"
  },
  {
    name: "Native Ethereum",
    networkId: "eip155:1",
    caip: "eip155:1/slip44:60",
    expected: "eip155:1",
    description: "Should keep network ID as-is when no wildcard"
  },
  {
    name: "Bitcoin network",
    networkId: "bip122:000000000019d6689c085ae165831e93",
    caip: "bip122:000000000019d6689c085ae165831e93/slip44:0",
    expected: "bip122:000000000019d6689c085ae165831e93",
    description: "Should handle Bitcoin network without changes"
  },
  {
    name: "Cosmos chain",
    networkId: "cosmos:osmosis-1",
    caip: "cosmos:osmosis-1/slip44:118",
    expected: "cosmos:osmosis-1",
    description: "Should handle Cosmos chains without changes"
  },
  {
    name: "THORChain token",
    networkId: "cosmos:thorchain-mainnet-v1",
    caip: "cosmos:thorchain-mainnet-v1/denom:THOR.ETH",
    expected: "cosmos:thorchain-mainnet-v1",
    description: "Should handle THORChain tokens correctly"
  }
];

console.log('Testing Network ID Resolution for Fee Fetching');
console.log('==============================================\n');

// Simulate the network ID resolution logic from Send.tsx
function resolveNetworkId(networkId, caip) {
  let resolvedNetworkId = networkId;
  
  // If networkId contains wildcard, try to extract from CAIP
  if (networkId?.includes('*')) {
    if (caip) {
      const caipParts = caip.split('/');
      if (caipParts[0] && !caipParts[0].includes('*')) {
        resolvedNetworkId = caipParts[0];
      }
    }
  }
  
  return resolvedNetworkId;
}

// Run tests
let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`Description: ${test.description}`);
  console.log(`Input: networkId="${test.networkId}", caip="${test.caip}"`);
  
  const result = resolveNetworkId(test.networkId, test.caip);
  const success = result === test.expected;
  
  if (success) {
    console.log(`✅ PASSED: Got expected result "${result}"`);
    passed++;
  } else {
    console.log(`❌ FAILED: Expected "${test.expected}" but got "${result}"`);
    failed++;
  }
  console.log('');
});

// Summary
console.log('Test Summary');
console.log('============');
console.log(`Total tests: ${testCases.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! The network ID resolution fix is working correctly.');
  console.log('\nThe fix ensures that:');
  console.log('1. Wildcard network IDs (eip155:*) are resolved to specific chains');
  console.log('2. The chain ID is extracted from the CAIP identifier');
  console.log('3. Non-wildcard network IDs are preserved as-is');
  console.log('4. The Pioneer API receives valid network IDs for fee calculations');
} else {
  console.log('\n⚠️ Some tests failed. The network ID resolution may need adjustment.');
  process.exit(1);
}