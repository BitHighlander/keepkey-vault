import { expect, test } from 'bun:test'
import { isRelayBridgeDeposit } from './relayBridgePreview'

test('only the exact Ethereum Relay bridgeDeposit shape gets the output warning', () => {
  const address = '0x4cd00e387622c35bddb9b4c962c136462338bc31'
  const data = `0x49290c1c${'0'.repeat(128)}`
  expect(isRelayBridgeDeposit(address, data, 1)).toBe(true)
  expect(isRelayBridgeDeposit(address, data + '00', 1)).toBe(false)
  expect(isRelayBridgeDeposit(address, data, 8453)).toBe(false)
  expect(isRelayBridgeDeposit('0x1111111111111111111111111111111111111111', data, 1)).toBe(false)
})
