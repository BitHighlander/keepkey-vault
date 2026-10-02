import { describe, expect, it } from 'bun:test'

import {
  buildEvmSchemaBody,
  buildEvmV2SchemaBody,
  CERTIFIED_EVM_CATALOG,
  CERTIFIED_METADATA_KEY_ID,
  findCertifiedEvmSchemaByShape,
  findCertifiedEvmSchemaSpec,
} from './evm-certified-schema'

const TO = '0x4cd00e387622c35bddb9b4c962c136462338bc31'
const DATA =
  '0x49290c1c' +
  '000000000000000000000000909ef6b32dfdc12ca86aa710b54c991af3c5f82e' +
  '8a2c121197efc95c42f53142ab409735ee353287f877ed4d351f63094d5bfcb1'
const PORTALS = '0xbf5A7F3629fB325E2a8453D595AB103465F75E62'

describe('7.16 certified EVM schemas', () => {
  it('serializes the Relay schema with a delegate sentinel trailer', () => {
    const spec = CERTIFIED_EVM_CATALOG[`1:${TO}:0x49290c1c`]
    const body = buildEvmV2SchemaBody(spec)
    expect(body[0]).toBe(0x05)
    expect(body[body.length - 1]).toBe(CERTIFIED_METADATA_KEY_ID)
    expect(body.subarray(1, 5).readUInt32BE()).toBe(1)
    expect(body.includes(Buffer.from('bridgeDeposit', 'ascii'))).toBe(true)
  })

  it('serializes the Relay intent (v0x05) byte-for-byte as the firmware unit test pins it', () => {
    const spec = CERTIFIED_EVM_CATALOG[`1:${TO}:0x49290c1c`]
    // Same bytes as fw unittests signed_metadata.cpp kRelayIntentBodyFromServer.
    expect(buildEvmSchemaBody(spec).toString('hex')).toBe(
      '05000000014cd00e387622c35bddb9b4c962c136462338bc3149290c1c000d6272696467654465706f73697402096465706f7369746f720100076f7264657249640300030552656c617936427269646765207b767d207468726f7567682052656c617920666f72207b307d3b2064656c69766572792069732062792052656c6179010000000080',
    )
  })

  it('refuses intents the firmware would reject', () => {
    const base = CERTIFIED_EVM_CATALOG[`1:${TO}:0x49290c1c`]
    const bad = (intent: Partial<NonNullable<typeof base.intent>>) => () =>
      buildEvmSchemaBody({ ...base, intent: { ...base.intent!, ...intent } })
    expect(bad({ template: 'Bridge through Relay for {0}' })).toThrow(/\{v\}/)
    expect(bad({ valueRole: 0 })).toThrow(/\{v\}/)
    expect(bad({ template: 'Bridge {v} for {1}' })).toThrow(/not displayable/)
    expect(bad({ template: 'Bridge {v} for {2}' })).toThrow(/out of range/)
    expect(bad({ template: '{v}{v}{v}{v}' })).toThrow(/firmware limit/)
    expect(bad({ valueRole: 2 })).toThrow(/value role/)
    expect(bad({ template: 'Bridge {v} for {0}, about 1 ETH' })).toThrow(/number of its own/)
  })

  it('matches only the complete reviewed Relay calldata shape', () => {
    expect(findCertifiedEvmSchemaSpec(1, TO, DATA)?.method).toBe('bridgeDeposit')
    expect(findCertifiedEvmSchemaSpec(1, TO, `${DATA}00`)).toBeUndefined()
    expect(findCertifiedEvmSchemaSpec(8453, TO, DATA)).toBeUndefined()
    expect(findCertifiedEvmSchemaSpec(1, TO, `0xdeadbeef${DATA.slice(10)}`)).toBeUndefined()
  })

  it('matches the privacy-preserving call shape without argument values', () => {
    expect(findCertifiedEvmSchemaByShape(1, TO, '0x49290c1c', 68)?.method).toBe('bridgeDeposit')
    expect(findCertifiedEvmSchemaByShape(1, TO, '0x49290c1c', 100)).toBeUndefined()
    expect(findCertifiedEvmSchemaByShape(1, TO, '0xdeadbeef', 68)).toBeUndefined()
  })

  it('serializes and bounds the firmware-owned Portals dynamic decoder', () => {
    const spec = findCertifiedEvmSchemaByShape(1, PORTALS, '0xa2e42c65', 1476)
    expect(spec?.method).toBe('Portals swap')
    expect(findCertifiedEvmSchemaByShape(1, PORTALS, '0xa2e42c65', 1477)).toBeUndefined()
    expect(findCertifiedEvmSchemaByShape(1, PORTALS, '0xa2e42c65', 16_420)).toBeUndefined()
    const body = buildEvmSchemaBody(spec!)
    expect(body[0]).toBe(0x04)
    expect(body.includes(Buffer.from('Portals swap', 'ascii'))).toBe(true)
    expect(body[body.length - 1]).toBe(CERTIFIED_METADATA_KEY_ID)
  })
})
