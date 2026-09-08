import { describe, it, expect, spyOn } from 'bun:test'
import { findEvmSchema, isCertifiedEvmMetadata, resolveEvmSchema } from './evm-schema-registry'
import { supportsCertifiedClearSign } from './solana-certified-policy'

/* The exact Relay ETH->Solana bridge deposit captured from api.relay.link on
 * 2026-07-27 — the transaction that used to blind-sign. */
const TO = '0x4cd00e387622c35bddb9b4c962c136462338bc31'
const DATA =
  '0x49290c1c' +
  '000000000000000000000000909ef6b32dfdc12ca86aa710b54c991af3c5f82e' +
  '8a2c121197efc95c42f53142ab409735ee353287f877ed4d351f63094d5bfcb1'

describe('findEvmSchema', () => {
  it('matches the real Relay bridge deposit', () => {
    const hit = findEvmSchema(1, TO, DATA)
    expect(hit).toBeDefined()
    expect(hit!.method).toBe('bridgeDeposit')
    expect(hit!.signedPayload.startsWith('0x')).toBe(true)
    // 4-byte selector + 2 words
    expect(hit!.expectedCalldataLength).toBe(68)
    expect((DATA.length - 2) / 2).toBe(hit!.expectedCalldataLength)
  })

  it('is case-insensitive on the contract address', () => {
    expect(findEvmSchema(1, TO.toUpperCase(), DATA)).toBeDefined()
  })

  /* A schema authorises a specific decode. Matching too loosely would let the
   * device render one method's labels over another call's bytes, so every
   * component of the key must be required. */
  it('does not match a different chain, contract, or selector', () => {
    expect(findEvmSchema(8453, TO, DATA)).toBeUndefined()
    expect(findEvmSchema(1, '0x0000000000000000000000000000000000000001', DATA)).toBeUndefined()
    expect(findEvmSchema(1, TO, '0xdeadbeef' + DATA.slice(10))).toBeUndefined()
  })

  /* Firmware requires declared arg widths to account for the calldata exactly;
   * refusing here avoids a confusing mid-signing rejection on the device. */
  it('rejects calldata whose length does not match the schema', () => {
    expect(findEvmSchema(1, TO, DATA + 'ab'.repeat(32))).toBeUndefined()
    expect(findEvmSchema(1, TO, DATA.slice(0, 42))).toBeUndefined()
  })

  it('returns undefined on missing input rather than throwing', () => {
    expect(findEvmSchema(undefined, TO, DATA)).toBeUndefined()
    expect(findEvmSchema(1, undefined, DATA)).toBeUndefined()
    expect(findEvmSchema(1, TO, undefined)).toBeUndefined()
    expect(findEvmSchema(1, TO, '0x')).toBeUndefined()
  })
})

describe('certified EVM metadata admission', () => {
  const envelope = `0x03${'00'.repeat(140)}`

  it('recognizes only version 3 at the reserved delegate key id', () => {
    expect(isCertifiedEvmMetadata({ signedPayload: envelope, keyId: 0x80 })).toBe(true)
    expect(isCertifiedEvmMetadata({ signedPayload: envelope, keyId: 3 })).toBe(false)
    expect(isCertifiedEvmMetadata({ signedPayload: `0x02${'00'.repeat(140)}`, keyId: 0x80 })).toBe(false)
  })

  it('rejects malformed encodings before the firmware boundary', () => {
    expect(isCertifiedEvmMetadata({ signedPayload: '0x03zz', keyId: 0x80 })).toBe(false)
    expect(isCertifiedEvmMetadata({ signedPayload: '0x03', keyId: 0x80 })).toBe(false)
    expect(isCertifiedEvmMetadata(undefined)).toBe(false)
  })

  it('does not attach the CI-key schema or contact the signer on firmware 7.14.2', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('No network expected') })
    try {
      expect(findEvmSchema(1, TO, DATA)?.keyId).toBe(3)
      expect(await resolveEvmSchema(1, TO, DATA, supportsCertifiedClearSign('7.14.2'))).toBeUndefined()
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })
})
