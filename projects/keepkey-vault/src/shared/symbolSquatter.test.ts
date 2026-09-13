import assert from 'assert'
import { impersonatesNativeIdentity, decideSquatter } from './symbolSquatter'

// impersonatesNativeIdentity: tickers + chain names, case/space-insensitive.
assert.equal(impersonatesNativeIdentity('SOLANA'), true)
assert.equal(impersonatesNativeIdentity(' solana '), true)
assert.equal(impersonatesNativeIdentity('BTC'), true)
assert.equal(impersonatesNativeIdentity('WBTC'), false)   // wrapped != native
assert.equal(impersonatesNativeIdentity('WETH'), false)
assert.equal(impersonatesNativeIdentity('USDT'), false)   // legit token, no impersonation
assert.equal(impersonatesNativeIdentity(undefined), false)

// The scam: unverified ERC-20 named "SOLANA" → squatter.
assert.equal(decideSquatter({ isToken: true, catalogReady: true, knownAsset: false, symbol: 'SOLANA' }), true)

// Native asset (slip44) with the same symbol → legit, never flagged.
assert.equal(decideSquatter({ isToken: false, catalogReady: true, knownAsset: false, symbol: 'SOL' }), false)

// Catalogued token wearing a native ticker (e.g. MATIC's ERC-20) → not flagged.
assert.equal(decideSquatter({ isToken: true, catalogReady: true, knownAsset: true, symbol: 'MATIC' }), false)

// Ordinary token → not flagged.
assert.equal(decideSquatter({ isToken: true, catalogReady: true, knownAsset: false, symbol: 'USDT' }), false)

// Fail open while the catalog is still loading (can't verify → no false alarm).
assert.equal(decideSquatter({ isToken: true, catalogReady: false, knownAsset: false, symbol: 'SOLANA' }), false)

// ── Squatters that wear the identity inside a longer string ────────────────
// The exact-match-only version missed every one of these.
assert.equal(impersonatesNativeIdentity('Barbie Solana'), true)   // word match
assert.equal(impersonatesNativeIdentity('BarbieSolana'), true)    // squashed substring
assert.equal(impersonatesNativeIdentity('SOLANA 2.0'), true)
assert.equal(impersonatesNativeIdentity('Wrapped Bitcoin '), true) // uncatalogued → suspect
assert.equal(impersonatesNativeIdentity('bitcoin-cash'), true)     // punctuation delimiter

// Short tickers must NOT substring-match, or every token gets flagged.
assert.equal(impersonatesNativeIdentity('SOLEND'), false)   // contains SOL
assert.equal(impersonatesNativeIdentity('BUTTON'), false)   // contains TON
assert.equal(impersonatesNativeIdentity('ADAPT'), false)    // contains ADA
assert.equal(impersonatesNativeIdentity('DOTS'), false)     // contains DOT
assert.equal(impersonatesNativeIdentity('USDT'), false)
assert.equal(impersonatesNativeIdentity('WETH'), false)

// The name is squatted as often as the ticker — a token showing symbol
// "BARBIE" with name "Solana" reads as Solana in any list rendering the name.
assert.equal(decideSquatter({
  isToken: true, catalogReady: true, knownAsset: false, symbol: 'BARBIE', name: 'Solana',
}), true)

// Curated token keeps its escape hatch even with a squatting-shaped name.
assert.equal(decideSquatter({
  isToken: true, catalogReady: true, knownAsset: true, symbol: 'WBTC', name: 'Wrapped Bitcoin',
}), false)

// Native asset is never flagged, whatever it is called.
assert.equal(decideSquatter({
  isToken: false, catalogReady: true, knownAsset: false, symbol: 'SOL', name: 'Solana',
}), false)

console.log('symbolSquatter: all assertions passed')
