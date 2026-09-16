import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { utils } from 'ethers'
import { broadcastTx } from '../src/bun/txbuilder'
import { CHAINS } from '../src/shared/chains'

const arbitrum = CHAINS.find(c => c.id === 'arbitrum')!
const signed = '0xdeadbeef'
let originalFetch: typeof fetch

beforeEach(() => { originalFetch = globalThis.fetch })
afterEach(() => { globalThis.fetch = originalFetch })

describe('Arbitrum broadcast acceptance', () => {
  test('returns only the hash acknowledged by the sequencer RPC', async () => {
    const hash = utils.keccak256(signed)
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body))
      expect(request.method).toBe('eth_sendRawTransaction')
      expect(request.params).toEqual([signed])
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: hash }))
    }) as typeof fetch

    const pioneer = { Broadcast: () => { throw new Error('Pioneer must not broadcast Arbitrum') } }
    await expect(broadcastTx(pioneer, arbitrum, { serializedTx: signed })).resolves.toEqual({ txid: hash })
  })

  test('surfaces sequencer rejection instead of reporting success', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'intrinsic gas too low' },
    }))) as typeof fetch

    await expect(broadcastTx({}, arbitrum, { serializedTx: signed })).rejects.toThrow(/intrinsic gas too low/)
  })
})
