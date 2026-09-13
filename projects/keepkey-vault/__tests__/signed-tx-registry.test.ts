/**
 * REST broadcast attribution: a broadcast counts as the wallet's activity only
 * for a tx the vault signed in the SAME wallet session — per chain response shape.
 */
import { describe, test, expect } from 'bun:test'
import { createSignedTxRegistry } from '../src/bun/signed-tx-registry'

const HEX_TX = 'ab'.repeat(120)
const SIG = 'cd'.repeat(65)

describe('signed-tx registry', () => {
  test('EVM: serialized 0x-hex matches with or without 0x / case', () => {
    const r = createSignedTxRegistry()
    r.remember({ v: 37, r: '0x1', s: '0x2', serialized: '0x' + HEX_TX }, 1)
    expect(r.signedIn(HEX_TX.toUpperCase(), 1)).toBe(true)
    expect(r.signedIn('0x' + HEX_TX, 1)).toBe(true)
  })

  test('a tx signed in another wallet session is not attributed', () => {
    const r = createSignedTxRegistry()
    r.remember({ serializedTx: HEX_TX }, 1) // hidden session
    expect(r.signedIn(HEX_TX, 2)).toBe(false) // broadcast after switching wallets
  })

  test('UTXO serializedTx and Solana base64 serializedTx', () => {
    const r = createSignedTxRegistry()
    const b64 = Buffer.from('ef'.repeat(100), 'hex').toString('base64')
    r.remember({ serializedTx: HEX_TX }, 1)
    r.remember({ signature: Buffer.from('11'.repeat(64), 'hex').toString('base64'), serializedTx: b64 }, 1)
    expect(r.signedIn(HEX_TX, 1)).toBe(true)
    expect(r.signedIn(b64, 1)).toBe(true)
  })

  test('XRP: tx nested in the StdTx signatures', () => {
    const r = createSignedTxRegistry()
    const b64 = Buffer.from('12'.repeat(100), 'hex').toString('base64')
    r.remember({ type: 'cosmos-sdk/StdTx', value: { fee: {}, memo: '', msg: [], signatures: [{ serializedTx: b64, signature: 'short' }] } }, 1)
    expect(r.signedIn(b64, 1)).toBe(true)
  })

  test('TRON: client-built JSON envelope carrying our signature', () => {
    const r = createSignedTxRegistry()
    r.remember({ signature: SIG }, 1)
    const envelope = JSON.stringify({ txID: 'aa'.repeat(32), raw_data: { contract: [] }, signature: [SIG.toUpperCase()] })
    expect(r.signedIn(envelope, 1)).toBe(true)
    expect(r.signedIn(envelope, 2)).toBe(false)
  })

  test('TON: Uint8Array signature found inside the base64 BOC', () => {
    const r = createSignedTxRegistry()
    const sig = new Uint8Array(64).fill(7)
    r.remember({ signature: sig }, 1)
    const boc = Buffer.concat([Buffer.from('b5ee9c72', 'hex'), Buffer.from(sig), Buffer.from('00ff', 'hex')]).toString('base64')
    expect(r.signedIn(boc, 1)).toBe(true)
  })

  test('echoed request input (cosmos sign doc memo) is never remembered', () => {
    const r = createSignedTxRegistry()
    const foreignTx = 'f0'.repeat(110)
    r.remember({ signature: Buffer.from('22'.repeat(64), 'hex').toString('base64'), serialized: undefined, signed: { memo: foreignTx } }, 1)
    expect(r.signedIn(foreignTx, 1)).toBe(false)
  })

  test('unknown tx is not attributed; oldest entry is evicted past the cap', () => {
    const r = createSignedTxRegistry()
    expect(r.signedIn(HEX_TX, 1)).toBe(false)
    const tx = (i: number) => i.toString(16).padStart(4, '0').repeat(40)
    for (let i = 0; i <= 200; i++) r.remember({ serializedTx: tx(i) }, 1)
    expect(r.signedIn(tx(0), 1)).toBe(false)
    expect(r.signedIn(tx(200), 1)).toBe(true)
  })
})
