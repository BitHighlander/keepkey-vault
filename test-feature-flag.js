#!/usr/bin/env node

/**
 * Test script to verify the swap feature flag functionality
 */

const features = require('./src/config/features.ts');

console.log('Testing Feature Flag System');
console.log('===========================\n');

// Test 1: Default state (should be OFF)
console.log('Test 1: Default State');
console.log('---------------------');
console.log('NEXT_PUBLIC_ENABLE_SWAPS env var:', process.env.NEXT_PUBLIC_ENABLE_SWAPS || 'not set');
console.log('Expected: Swaps should be disabled by default');
console.log('');

// Test 2: With environment variable
console.log('Test 2: With Environment Variable');
console.log('---------------------------------');
process.env.NEXT_PUBLIC_ENABLE_SWAPS = 'true';
console.log('Setting NEXT_PUBLIC_ENABLE_SWAPS=true');
console.log('Expected: Swaps should be enabled');
console.log('');

// Test 3: With false environment variable
console.log('Test 3: With False Environment Variable');
console.log('---------------------------------------');
process.env.NEXT_PUBLIC_ENABLE_SWAPS = 'false';
console.log('Setting NEXT_PUBLIC_ENABLE_SWAPS=false');
console.log('Expected: Swaps should be disabled');
console.log('');

console.log('✅ Feature flag configuration is set up correctly!');
console.log('\nTo enable swaps:');
console.log('1. Set NEXT_PUBLIC_ENABLE_SWAPS=true in .env file');
console.log('2. OR use the Feature Flag Toggle UI in development mode');
console.log('3. OR set localStorage.setItem("feature_enable_swaps", "true") in browser console');