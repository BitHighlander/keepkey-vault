import { test, expect } from 'bun:test'
import protobuf from 'protobufjs/light'
import { tronPreview } from './tron-preview'

const owner = Buffer.from('41' + '11'.repeat(20), 'hex')
const vault = Buffer.from('41' + '22'.repeat(20), 'hex')
const memo = '=:ETH.ETH:0x' + '33'.repeat(20) + ':1935036:keep:30'
const w = () => new protobuf.Writer()
const raw = (payload: Uint8Array, type: number, url: string) => {
  const any = w().uint32(10).string(url).uint32(18).bytes(payload).finish()
  const contract = w().uint32(8).uint32(type).uint32(18).bytes(any).finish()
  return Buffer.from(w().uint32(82).bytes(Buffer.from(memo)).uint32(90).bytes(contract).finish()).toString('hex')
}

test('TRX approval comes from signed protobuf, including memo terms', () => {
  const transfer = w().uint32(10).bytes(owner).uint32(18).bytes(vault)
    .uint32(24).uint64(257033375).finish()
  const tx = raw(transfer, 1, 'type.googleapis.com/protocol.TransferContract')
  const preview = tronPreview(tx)
  expect(preview?.amount).toBe('257.033375 TRX')
  expect(preview?.minimumOutput).toBe('0.01935036 ETH')
  expect(preview?.affiliateFee).toBe('0.30%')
  expect(preview?.memo).toBe(memo)
  // A second contract changes the signed effect; no reassuring summary.
  expect(tronPreview(tx + '5a00')).toBeNull()
})

test('only the pinned USDT contract receives six-decimal token labeling', () => {
  const usdt = Buffer.from('41a614f803b6fd780986a42c78ec9c7f77e6ded13c', 'hex')
  const other = Buffer.from('41' + '44'.repeat(20), 'hex')
  const call = Buffer.concat([Buffer.from('a9059cbb', 'hex'), Buffer.alloc(12), vault.subarray(1),
    Buffer.from((34421641n).toString(16).padStart(64, '0'), 'hex')])
  const trigger = (contract: Buffer) => w().uint32(10).bytes(owner).uint32(18).bytes(contract)
    .uint32(34).bytes(call).finish()
  expect(tronPreview(raw(trigger(usdt), 31, 'type.googleapis.com/protocol.TriggerSmartContract'))?.amount)
    .toBe('34.421641 USDT')
  expect(tronPreview(raw(trigger(other), 31, 'type.googleapis.com/protocol.TriggerSmartContract'))?.amount)
    .toBe('34421641 base units (unverified token)')
})
