import { createHash } from 'node:crypto'
import protobuf from 'protobufjs/light'
import bs58 from 'bs58'
import type { TronTxPreview } from '../shared/types'

type Value = { wire: number; bytes?: Buffer; number?: bigint }
function fields(bytes: Buffer, allowed: Record<number, number>): Map<number, Value> {
  const reader = new protobuf.Reader(bytes)
  const out = new Map<number, Value>()
  while (reader.pos < reader.len) {
    const tag = reader.uint32(), field = tag >>> 3, wire = tag & 7
    if (allowed[field] !== wire || out.has(field)) throw Error('Unsupported or duplicate TRON field')
    out.set(field, wire === 2
      ? { wire, bytes: Buffer.from(reader.bytes()) }
      : { wire, number: BigInt(reader.uint64().toString()) })
  }
  return out
}
function bytes(f: Map<number, Value>, n: number): Buffer {
  const b = f.get(n)?.bytes
  if (!b) throw Error(`Missing TRON bytes field ${n}`)
  return b
}
function number(f: Map<number, Value>, n: number): bigint {
  const v = f.get(n)?.number
  if (v === undefined) throw Error(`Missing TRON number field ${n}`)
  return v
}
function address(raw: Buffer): string {
  if (raw.length !== 21 || raw[0] !== 0x41) throw Error('Invalid TRON address')
  const hash = (b: Buffer) => createHash('sha256').update(b).digest()
  return bs58.encode(Buffer.concat([raw, hash(hash(raw)).subarray(0, 4)]))
}
function human(raw: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals)
  const fraction = (raw % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${raw / scale}${fraction ? `.${fraction}` : ''}`
}

/** Fail closed like firmware tron_parseRawTx. Only a single plain TRX or
 * TRC-20 transfer earns a human summary; all displayed values come from the
 * exact protobuf raw_data bytes signed by the device. */
export function tronPreview(rawHex: unknown): TronTxPreview | null {
  if (typeof rawHex !== 'string' || !/^(?:0x)?(?:[0-9a-fA-F]{2})+$/.test(rawHex)) return null
  try {
    const raw = Buffer.from(rawHex.replace(/^0x/i, ''), 'hex')
    const top = fields(raw, { 1: 2, 3: 0, 4: 2, 8: 0, 10: 2, 11: 2, 14: 0, 18: 0 })
    const contract = fields(bytes(top, 11), { 1: 0, 2: 2 })
    const kind = Number(number(contract, 1))
    const any = fields(bytes(contract, 2), { 1: 2, 2: 2 })
    const url = bytes(any, 1).toString('utf8')
    const payload = bytes(any, 2)
    let owner: string, to: string, amount: string, tokenContract: string | undefined
    if (kind === 1 && url.endsWith('/protocol.TransferContract')) {
      const transfer = fields(payload, { 1: 2, 2: 2, 3: 0 })
      owner = address(bytes(transfer, 1)); to = address(bytes(transfer, 2))
      amount = `${human(number(transfer, 3), 6)} TRX`
    } else if (kind === 31 && url.endsWith('/protocol.TriggerSmartContract')) {
      const trigger = fields(payload, { 1: 2, 2: 2, 3: 0, 4: 2 })
      if (trigger.has(3) && number(trigger, 3) !== 0n) return null
      owner = address(bytes(trigger, 1)); tokenContract = address(bytes(trigger, 2))
      const call = bytes(trigger, 4)
      if (call.length !== 68 || call.subarray(0, 4).toString('hex') !== 'a9059cbb' ||
          call.subarray(4, 15).some(v => v !== 0) || ![0, 0x41].includes(call[15])) return null
      to = address(Buffer.concat([Buffer.from([0x41]), call.subarray(16, 36)]))
      const units = BigInt(`0x${call.subarray(36).toString('hex')}`)
      amount = tokenContract === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        ? `${human(units, 6)} USDT` : `${units} base units (unverified token)`
    } else return null
    const memo = top.has(10) ? new TextDecoder('utf-8', { fatal: true }).decode(bytes(top, 10)) : undefined
    if (memo?.includes('\0')) return null
    const preview: TronTxPreview = {
      kind: kind === 1 ? 'TRX transfer' : 'TRC-20 transfer', owner, to, amount, tokenContract, memo,
      feeLimit: top.has(18) ? `${human(number(top, 18), 6)} TRX` : undefined,
      warning: 'Swap terms come from the signed memo. The destination and settlement outcome are not independently verified here.',
    }
    const parts = memo?.split(':')
    if (parts && (parts[0] === '=' || parts[0] === 'SWAP') && parts[1] && parts[2]) {
      preview.outputAsset = parts[1]
      preview.outputDestination = parts[2]
      const symbol = parts[1].split('.')[1]?.split('-')[0] || parts[1]
      preview.minimumOutput = parts[3] && /^\d+$/.test(parts[3])
        ? `${human(BigInt(parts[3]), 8)} ${symbol}` : 'NO MINIMUM IN SIGNED MEMO'
      if (parts[5] && /^\d+$/.test(parts[5])) preview.affiliateFee = `${(Number(parts[5]) / 100).toFixed(2)}%`
    }
    return preview
  } catch { return null }
}
