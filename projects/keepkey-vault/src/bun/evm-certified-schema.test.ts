import { describe, expect, it } from 'bun:test'

import {
  buildEvmSchemaBody,
  buildEvmV2SchemaBody,
  CERTIFIED_EVM_CATALOG,
  CERTIFIED_METADATA_KEY_ID,
  findCertifiedEvmSchemaByShape,
  findCertifiedEvmSchemaSpec,
  buildCertifiedEvmEnvelope,
} from './evm-certified-schema'
import capturedEnvelope from '../../../../docs/clearsign-case-studies/uniswap-usdt/certified-response.json'

const TO = '0x4cd00e387622c35bddb9b4c962c136462338bc31'
const DATA =
  '0x49290c1c' +
  '000000000000000000000000909ef6b32dfdc12ca86aa710b54c991af3c5f82e' +
  '8a2c121197efc95c42f53142ab409735ee353287f877ed4d351f63094d5bfcb1'
const PORTALS = '0xbf5A7F3629fB325E2a8453D595AB103465F75E62'
const ACROSS = '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A'

describe('7.16 certified EVM schemas', () => {
  it('refuses the captured mainnet certificate for the Arbitrum schema before using the delegate key', () => {
    const spec = CERTIFIED_EVM_CATALOG['42161:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9:0x095ea7b3']
    const certificate = Buffer.from(capturedEnvelope.signedPayload.slice(2), 'hex').subarray(1, 140).toString('hex')
    expect(() => buildCertifiedEvmEnvelope(spec, certificate, '00'.repeat(32))).toThrow(/scoped to chain 1, not transaction chain 42161/)
  })
  it('binds Arbitrum USDT identity and unlimited allowance rendering metadata', () => {
    const spec = CERTIFIED_EVM_CATALOG['42161:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9:0x095ea7b3']
    expect(findCertifiedEvmSchemaSpec(42161, spec.contract, `0x095ea7b3${'00'.repeat(64)}`)).toBe(spec)
    const body = buildEvmSchemaBody(spec)
    expect(body[0]).toBe(2)
    expect(body.includes(Buffer.from('Arbitrum USDT approval'))).toBe(true)
    expect(body.includes(Buffer.from('USDT'))).toBe(true)
    expect(spec.args).toEqual([
      { name: 'Spender', format: 1 },
      { name: 'Allowance', format: 5, decimals: 6, symbol: 'USDT' },
    ])
  })
  it('serializes the Relay schema with a delegate sentinel trailer', () => {
    const spec = CERTIFIED_EVM_CATALOG[`1:${TO}:0x49290c1c`]
    const body = buildEvmV2SchemaBody(spec)
    expect(body[0]).toBe(0x02)
    expect(body[body.length - 1]).toBe(CERTIFIED_METADATA_KEY_ID)
    expect(body.subarray(1, 5).readUInt32BE()).toBe(1)
    expect(body.includes(Buffer.from('bridgeDeposit', 'ascii'))).toBe(true)
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

  it('selects the firmware-owned Across decoder for its non-padded ABI shape', () => {
    const spec = findCertifiedEvmSchemaByShape(42161, ACROSS, '0x7b939232', 429)
    expect(spec?.method).toBe('Across bridge')
    expect(spec?.decoder).toBe(2)
    expect(findCertifiedEvmSchemaByShape(1, ACROSS, '0x7b939232', 429)).toBeUndefined()
    expect(findCertifiedEvmSchemaByShape(42161, ACROSS, '0x7b939232', 419)).toBeUndefined()
    expect(findCertifiedEvmSchemaByShape(42161, ACROSS, '0x7b939232', 1025)).toBeUndefined()
    const body = buildEvmSchemaBody(spec!)
    expect(body[0]).toBe(0x04)
    expect(body.includes(Buffer.from('Across bridge', 'ascii'))).toBe(true)
  })
})
