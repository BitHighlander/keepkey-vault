import { afterEach, describe, expect, test } from 'bun:test'
import type { SigningRequestInfo } from '../shared/types'
import { applyEvmTxPreview, evmPriorityFee, normalizeEvmChainId, typedDataNativelyReviewed } from './evm-signing-preview'
import { approveSpender, findCertifiedEvmSchema } from './evm-schema-registry'
import { findCertifiedEvmEnvelope } from './evm-certified-registry'
import { findEvmSchema } from './evm-schema-registry'
import { SolanaSignMessageRequest } from './schemas'
import { solanaSignerChangedError } from './solana-message-preview'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const USDC_ETH = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3'
const RECIPIENT = '1111111111111111111111111111111111111111'
const word = (hex: string) => hex.padStart(64, '0')
const transfer = '0xa9059cbb' + word(RECIPIENT) + word('f4240')
const approve = (spender: string) => '0x095ea7b3' + word(spender.replace(/^0x/, '')) + word('f4240')
const PAYLOAD = `0x03${'ab'.repeat(200)}`

const info = (): SigningRequestInfo => ({ id: 't', method: '/eth/sign-transaction', appName: 'test' })

/** A VERIFIED worker reply for a Base USDC call; records what was asked. */
function service(method: 'transfer' | 'approve', entry: string, seen: any[] = []) {
  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    seen.push(body)
    return new Response(JSON.stringify({
      classification: 'VERIFIED', keyId: 0x80, chainId: 8453, contract: USDC_BASE,
      selector: body.selector, method, expectedCalldataLength: 68, signedPayload: PAYLOAD, entry,
      ...(body.spender === PERMIT2 ? { spender: PERMIT2 } : {}),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return seen
}

describe('normalizeEvmChainId', () => {
  test('hex from the browser extension, decimal strings and numbers', () => {
    expect(normalizeEvmChainId('0x2105')).toBe(8453)
    expect(normalizeEvmChainId('8453')).toBe(8453)
    expect(normalizeEvmChainId(42161)).toBe(42161)
    expect(normalizeEvmChainId('0x')).toBeUndefined()
    expect(normalizeEvmChainId('1abc')).toBeUndefined()
    expect(normalizeEvmChainId(0)).toBeUndefined()
    expect(normalizeEvmChainId(undefined)).toBeUndefined()
  })
})

describe('applyEvmTxPreview = needsAdvancedMode = !(native || (fw >= 7.16 && certified))', () => {
  test('firmware-native token transfer: no AdvancedMode, no service call', async () => {
    let called = false
    globalThis.fetch = (async () => { called = true; throw new Error('no') }) as unknown as typeof fetch
    const s = info()
    await applyEvmTxPreview(s, USDC_ETH, transfer, 1, '7.16.0')
    expect(s.deviceClearSigns).toBe(true)
    expect(s.needsBlindSigning).toBe(false)
    expect(called).toBe(false)
  })

  test('7.16 + certified schema attaches the blob; the sign handler round-trips it to txMetadata', async () => {
    const seen = service('transfer', `eip155:8453:${USDC_BASE}:0xa9059cbb`)
    const s = info()
    await applyEvmTxPreview(s, USDC_BASE, transfer, 8453, '7.16.0')
    expect(s.deviceClearSigns).toBe(false)
    expect(s.needsBlindSigning).toBe(false)
    expect(s.calldataDecoded?.insightKeyId).toBe(0x80)
    // rest-api.ts "EVM Clear-Signing: attach signed metadata blob" decodes base64 → bytes.
    const bytes = new Uint8Array(Buffer.from(s.calldataDecoded!.signedInsightBlob!, 'base64'))
    expect(Buffer.from(bytes).toString('hex')).toBe(PAYLOAD.slice(2))
    expect(seen[0].spender).toBeUndefined() // a transfer sends no argument off the host
  })

  test('7.15: no certified lookup, AdvancedMode required', async () => {
    let called = false
    globalThis.fetch = (async () => { called = true; throw new Error('no') }) as unknown as typeof fetch
    const s = info()
    await applyEvmTxPreview(s, USDC_BASE, transfer, 8453, '7.15.0')
    expect(s.needsBlindSigning).toBe(true)
    expect(called).toBe(false)
  })

  test('service down → falls back to AdvancedMode, never throws', async () => {
    globalThis.fetch = (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    const s = info()
    await applyEvmTxPreview(s, USDC_BASE, transfer, 8453, '7.16.0')
    expect(s.needsBlindSigning).toBe(true)
    expect(s.calldataDecoded?.signedInsightBlob).toBeUndefined()
  })

  test('never substitutes the local CI-key schema', async () => {
    const TO = '0x4cd00e387622c35bddb9b4c962c136462338bc31'
    const DATA = '0x49290c1c' + word('909ef6b32dfdc12ca86aa710b54c991af3c5f82e') + '8a2c121197efc95c42f53142ab409735ee353287f877ed4d351f63094d5bfcb1'
    expect(findEvmSchema(1, TO, DATA)).toBeDefined()
    globalThis.fetch = (async () => new Response(JSON.stringify({ classification: 'OPAQUE' }), { status: 422 })) as typeof fetch
    const s = info()
    await applyEvmTxPreview(s, TO, DATA, 1, '7.16.0')
    expect(s.needsBlindSigning).toBe(true)
    expect(s.calldataDecoded?.signedInsightBlob).toBeUndefined()
  })

  test('caller-provided runtime-signer blob keeps its REST priority', async () => {
    const s = info()
    await applyEvmTxPreview(s, USDC_BASE, transfer, 8453, '7.15.0', { signedPayload: 'AAEC', keyId: 3 })
    expect(s.needsBlindSigning).toBe(false)
    expect(s.calldataDecoded?.signedInsightBlob).toBe('AAEC')
    expect(s.calldataDecoded?.insightKeyId).toBe(3)
  })
})

describe('approve spender selects the certified entry', () => {
  test('approveSpender reads only a clean 68-byte approve', () => {
    expect(approveSpender(approve(PERMIT2))).toBe(PERMIT2)
    expect(approveSpender(transfer)).toBeUndefined()
    expect(approveSpender('0x095ea7b3' + 'ff'.repeat(12) + PERMIT2.slice(2) + word('1'))).toBeUndefined()
    expect(approveSpender(approve(PERMIT2) + '00')).toBeUndefined()
  })

  test('schema registry sends the Permit2 spender and checks the pinned entry', async () => {
    const seen = service('approve', `eip155:8453:${USDC_BASE}:0x095ea7b3:permit2`)
    expect((await findCertifiedEvmSchema(8453, USDC_BASE, approve(PERMIT2)))?.keyId).toBe(0x80)
    expect(seen[0].spender).toBe(PERMIT2)
    // Generic entry back for a Permit2 approve → refused, not silently used.
    service('approve', `eip155:8453:${USDC_BASE}:0x095ea7b3`)
    await expect(findCertifiedEvmSchema(8453, USDC_BASE, approve(PERMIT2))).rejects.toThrow(/does not match/)
  })

  test('envelope registry sends the spender for approve, not for transfer', async () => {
    const seen = service('approve', `eip155:8453:${USDC_BASE}:0x095ea7b3:permit2`)
    expect((await findCertifiedEvmEnvelope(8453, USDC_BASE, approve(PERMIT2)))?.keyId).toBe(0x80)
    expect(seen[0].spender).toBe(PERMIT2)
    const seen2 = service('transfer', `eip155:8453:${USDC_BASE}:0xa9059cbb`)
    await findCertifiedEvmEnvelope(8453, USDC_BASE, transfer)
    expect('spender' in seen2[0]).toBe(false)
    service('approve', `eip155:8453:${USDC_BASE}:0x095ea7b3`)
    await expect(findCertifiedEvmEnvelope(8453, USDC_BASE, approve(PERMIT2))).rejects.toThrow(/invalid certified/)
  })
})

describe('evmPriorityFee (canonical RLP, shared by REST and WalletConnect)', () => {
  test('zero or absent → empty string', () => {
    expect(evmPriorityFee(undefined)).toBe('0x')
    expect(evmPriorityFee('0x0')).toBe('0x')
    expect(evmPriorityFee('0x00')).toBe('0x')
    expect(evmPriorityFee('0x59682f00')).toBe('0x59682f00')
  })
})

describe('typedDataNativelyReviewed', () => {
  const permit = () => ({
    primaryType: 'PermitSingle',
    domain: { name: 'Permit2', chainId: 1, verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
      PermitSingle: [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }],
      PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
    },
    message: {},
  })
  test('canonical Permit2 PermitSingle on 7.16+ only', () => {
    expect(typedDataNativelyReviewed(permit(), '7.16.0')).toBe(true)
    expect(typedDataNativelyReviewed(permit(), '7.15.2')).toBe(false)
    expect(typedDataNativelyReviewed(permit(), undefined)).toBe(false)
  })
  test('anything off-canonical stays AdvancedMode-gated', () => {
    const wrongContract = permit(); wrongContract.domain.verifyingContract = '0x1111111111111111111111111111111111111111'
    const extraDomain: any = permit(); extraDomain.domain.version = '1'
    const wrongName = permit(); wrongName.domain.name = 'Permit3'
    const batch = permit(); batch.primaryType = 'PermitBatch'
    const wrongWidth = permit(); wrongWidth.types.PermitDetails[1].type = 'uint256'
    for (const doc of [wrongContract, extraDomain, wrongName, batch, wrongWidth]) {
      expect(typedDataNativelyReviewed(doc, '7.16.0')).toBe(false)
    }
  })
})

describe('Solana sign-message signer check', () => {
  test('schema keeps the claimed signer (zod .strip() would drop unknown keys)', () => {
    const parsed = SolanaSignMessageRequest.parse({ message: 'aGk=', pubkey: 'A', address: 'B', junk: 1 })
    expect(parsed.pubkey).toBe('A')
    expect(parsed.address).toBe('B')
    expect((parsed as any).junk).toBeUndefined()
  })
  test('a different derived account is a clear "reconnect" error', () => {
    expect(solanaSignerChangedError(undefined, 'X')).toBeUndefined()
    expect(solanaSignerChangedError('X', 'X')).toBeUndefined()
    expect(solanaSignerChangedError('Old', 'New')).toMatch(/account changed — reconnect the dapp/)
  })
})

describe('Uniswap Universal Router: no certified entry', () => {
  // Firmware no longer decodes the Universal Router (owner decision 2026-10-04;
  // 7.16 refuses inner version 0x07), so execute() gets no certified payload
  // and follows the ordinary rule: AdvancedMode.
  test('execute() on a Base Universal Router on 7.16: AdvancedMode, nothing attached, no ClearSign request', async () => {
    const urls: string[] = []
    globalThis.fetch = (async (url: any) => {
      urls.push(String(url))
      return new Response('{}', { status: 404 })
    }) as unknown as typeof fetch
    const s = info()
    await applyEvmTxPreview(s, '0xd6145b2d3f379919e8cdeda7b97e37c4b2ca9c40', '0x3593564c' + word('60') + word('a0') + word('ffffffff'), 8453, '7.16.0')
    expect(s.needsBlindSigning).toBe(true)
    expect(s.calldataDecoded?.signedInsightBlob).toBeUndefined()
    expect(urls.filter((u) => u.includes('/v1/evm/'))).toEqual([])
  })
})
