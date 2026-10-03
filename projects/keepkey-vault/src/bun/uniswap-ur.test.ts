import { describe, expect, it } from 'bun:test'

import {
  buildCertifiedEvmDecoderEnvelope,
  buildEvmDecoderBody,
  findReviewedUniversalRouter,
  REVIEWED_UNIVERSAL_ROUTERS,
  reviewedSwapTokens,
  UNIVERSAL_ROUTER_PROVENANCE,
} from './evm-certified-schema'
import { urDecode, urPrecheck, urSummarize, UR_MAX_CALLDATA } from './uniswap-ur'

/**
 * Real Base Universal Router calls, copied verbatim from the firmware unit test
 * vectors (keepkey-firmware fw716-fix unittests/firmware/uniswap_ur_vectors.h,
 * generated 2026-10-03 from base.blockscout.com by an independent Python
 * decoder). Parsed here from the header's own strings.
 */
const header = await Bun.file(new URL('../../__tests__/fixtures/uniswap/uniswap_ur_vectors.h', import.meta.url)).text()
interface Step { kind: string; tokenIn: string; tokenOut: string; amount: string; limit: string }
interface Vec { tx: string; router: string; value: string; calldata: string; steps: Step[] }
const accepted: Vec[] = [...header.matchAll(/\{"(0x[0-9a-f]{64})", "([0-9a-f]{40})", "([0-9a-f]{64})", "([0-9a-f]+)", \{(.*?)\}\},?\n/g)]
  .map((m) => ({
    tx: m[1], router: `0x${m[2]}`, value: m[3], calldata: m[4],
    steps: [...m[5].matchAll(/\{UR_(\w+),"([0-9a-f]*)","([0-9a-f]*)","([0-9a-f]*)","([0-9a-f]*)"\}/g)]
      .map((s) => ({ kind: s[1], tokenIn: s[2], tokenOut: s[3], amount: s[4], limit: s[5] })),
  }))
const v4Section = header.slice(header.indexOf('v4_rejected()'))
const v4Rejected = [...v4Section.matchAll(/^\s+"((?:3593564c|24856bc3)[0-9a-f]+)",?$/gm)].map((m) => m[1])
// Row counts straight from the header's layout, independent of the regexes above.
const acceptedRows = (header.slice(0, header.indexOf('v4_rejected()')).match(/^ {2}\{"0x/gm) || []).length
const v4Rows = (v4Section.match(/^ {2}"[0-9a-f]+",?$/gm) || []).length

const BASE_UR12 = '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad'
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const BASE_WETH = '0x4200000000000000000000000000000000000006'
const hasKind = (v: Vec, kind: string) => v.steps.some((s) => s.kind === kind)
const appShaped = accepted.filter((v) => hasKind(v, 'PERMIT2_PERMIT') || hasKind(v, 'WRAP_ETH'))

describe('Uniswap UR pre-check against real Base swaps (firmware vectors)', () => {
  it('parses the whole header', () => {
    expect(acceptedRows).toBeGreaterThan(0)
    expect(accepted).toHaveLength(acceptedRows)
    expect(v4Rows).toBeGreaterThan(0)
    expect(v4Rejected).toHaveLength(v4Rows)
    expect(appShaped.length).toBeGreaterThan(0)
  })

  it('decodes every accepted call step-for-step as the independent decoder did', () => {
    for (const v of accepted) {
      const steps = urDecode(Buffer.from(v.calldata, 'hex'))
      expect(steps, v.tx).not.toBeNull()
      expect(steps!.map((s) => s.kind)).toEqual(v.steps.map((s) => s.kind))
      steps!.forEach((got, i) => {
        const want = v.steps[i]
        if (want.tokenIn) expect(got.tokenIn).toBe(`0x${want.tokenIn}`)
        if (want.tokenOut) expect(got.tokenOut).toBe(`0x${want.tokenOut}`)
        expect(got.amount).toBe(BigInt(`0x${want.amount}`))
        if (want.limit) expect(got.limit).toBe(BigInt(`0x${want.limit}`))
      })
    }
  })

  it('every app-shaped swap that fits the first chunk pre-checks OK with the firmware token set', () => {
    let permits = 0
    let wraps = 0
    for (const v of appShaped) {
      const pre = urPrecheck(v.router, v.calldata, BigInt(`0x${v.value}`))
      if (v.calldata.length / 2 > UR_MAX_CALLDATA) {
        // The device needs the whole call in the first 1024-byte chunk.
        expect(urDecode(Buffer.from(v.calldata, 'hex')), v.tx).not.toBeNull()
        expect(pre, v.tx).toBeNull()
        continue
      }
      expect(pre, v.tx).not.toBeNull()
      const swap = v.steps.find((s) => s.kind.includes('_SWAP_'))!
      const wrap = hasKind(v, 'WRAP_ETH')
      const unwrap = hasKind(v, 'UNWRAP_WETH')
      const want = new Set([...(wrap ? [] : [swap.tokenIn]), ...(unwrap ? [] : [swap.tokenOut])].map((a) => `0x${a}`))
      expect(new Set(pre!.tokens)).toEqual(want)
      expect(pre!.summary.outIsEth).toBe(unwrap)
      expect(pre!.summary.inIsEth).toBe(wrap)
      expect(!!pre!.summary.permit).toBe(hasKind(v, 'PERMIT2_PERMIT'))
      if (wrap) {
        expect(pre!.summary.amountIn).toBe(BigInt(`0x${v.value}`))
        wraps++
      } else if (swap.kind.endsWith('EXACT_IN')) {
        expect(pre!.summary.amountIn).toBe(BigInt(`0x${swap.amount}`))
        if (!hasKind(v, 'PAY_PORTION')) expect(pre!.summary.amountOut).toBe(BigInt(`0x${swap.limit}`))
      }
      if (hasKind(v, 'PERMIT2_PERMIT')) permits++
    }
    expect(permits + wraps).toBeGreaterThan(0)
  })

  it('the router\'s own address means "held by the router", like ADDRESS_THIS', () => {
    // Apps encode both; e.g. WRAP_ETH to the router's address, then a V3 swap.
    const byAddress = appShaped.filter((v) => {
      const steps = urDecode(Buffer.from(v.calldata, 'hex'))
      return steps?.some((s) => (s.kind === 'WRAP_ETH' || s.kind.includes('_SWAP_')) && s.recipient === v.router)
    })
    expect(byAddress.length, 'no row in the sample sends funds to the router by address').toBeGreaterThan(0)
    for (const v of byAddress.filter((v) => v.calldata.length / 2 <= UR_MAX_CALLDATA)) {
      const value = BigInt(`0x${v.value}`)
      expect(urPrecheck(v.router, v.calldata, value), v.tx).not.toBeNull()
      // Called through another router, that address is just a third party.
      const steps = urDecode(Buffer.from(v.calldata, 'hex'))!
      expect(urSummarize(steps, '0x6ff5693b99212da76ad316178a184ab56d299b43', value), v.tx).toBeNull()
    }
  })

  it('rejects every V4 call, with no partial plan', () => {
    for (const hex of v4Rejected) {
      expect(urDecode(Buffer.from(hex, 'hex'))).toBeNull()
      expect(urPrecheck(BASE_UR12, hex, 0n)).toBeNull()
    }
  })

  const permitSwap = accepted.find((v) => v.tx.startsWith('0xd873988f'))!
  const cd = () => Buffer.from(permitSwap.calldata, 'hex')
  const commandsAt = (b: Buffer) => 4 + Number(BigInt('0x' + b.subarray(4, 36).toString('hex'))) + 32

  it('control: the firmware review vector pre-checks', () => {
    const pre = urPrecheck(permitSwap.router, permitSwap.calldata, 0n)!
    expect(pre.tokens).toEqual(['0x41b481c3d2e3960f8f312212adfeecf6ce7c35ef', BASE_USDC])
    expect(pre.summary.permit?.amount).toBe((1n << 160n) - 1n)
    expect(pre.summary.recipientIsSender).toBe(true)
  })

  it('refuses allow-revert flags, unknown commands, and truncation', () => {
    const flagged = cd(); flagged[commandsAt(flagged)] |= 0x80
    expect(urDecode(flagged)).toBeNull()
    const v4 = cd(); v4[commandsAt(v4)] = 0x10
    expect(urDecode(v4)).toBeNull()
    for (let cut = 1; cut < cd().length; cut += 31) expect(urDecode(cd().subarray(0, cd().length - cut))).toBeNull()
  })

  it('refuses a permit for another spender, ETH sent beside a token swap, and oversize calldata', () => {
    const other = '0x6ff5693b99212da76ad316178a184ab56d299b43'
    expect(urPrecheck(other, permitSwap.calldata, 0n)).toBeNull() // permit names 0x3fc9..., not this router
    expect(urPrecheck(permitSwap.router, permitSwap.calldata, 1n)).toBeNull()
    const padded = permitSwap.calldata + '00'.repeat(UR_MAX_CALLDATA - permitSwap.calldata.length / 2 + 1)
    expect(urDecode(Buffer.from(padded, 'hex'))).not.toBeNull() // trailing bytes decode...
    expect(urPrecheck(permitSwap.router, padded, 0n)).toBeNull() // ...but cannot fit the first chunk
  })

  it('a wrap must spend exactly msg.value', () => {
    const wrap = appShaped.find((v) => hasKind(v, 'WRAP_ETH'))!
    const value = BigInt(`0x${wrap.value}`)
    expect(urPrecheck(wrap.router, wrap.calldata, value)?.tokens).toHaveLength(1)
    expect(urPrecheck(wrap.router, wrap.calldata, value + 1n)).toBeNull()
    expect(urPrecheck(wrap.router, wrap.calldata, 0n)).toBeNull()
    const steps = urDecode(Buffer.from(wrap.calldata, 'hex'))!
    expect(urSummarize(steps, wrap.router, value)?.tokenIn).toBe(BASE_WETH)
  })
})

describe('v0x07 decoder entry body', () => {
  const tokens = reviewedSwapTokens(8453, [BASE_USDC, BASE_WETH])!

  it('lays out bytes exactly as firmware parse_metadata_binary reads them', () => {
    const body = buildEvmDecoderBody(8453, BASE_UR12, '0x3593564c', tokens)
    let o = 0
    const take = (n: number) => { const b = body.subarray(o, o + n); o += n; return b }
    const u8 = () => take(1)[0]
    expect(u8()).toBe(0x07)
    expect(take(4).readUInt32BE()).toBe(8453)
    expect(take(20).toString('hex')).toBe(BASE_UR12.slice(2))
    expect(take(4).toString('hex')).toBe('3593564c')
    const methodLen = take(2).readUInt16BE()
    expect(take(methodLen).toString('ascii')).toBe('execute')
    expect(u8()).toBe(1) // METADATA_DECODER_UNISWAP_UR
    expect(take(u8()).toString('ascii')).toBe('Uniswap')
    expect(u8()).toBe(2)
    expect([take(20).toString('hex'), u8(), take(u8()).toString('ascii')]).toEqual([BASE_USDC.slice(2), 6, 'USDC'])
    expect([take(20).toString('hex'), u8(), take(u8()).toString('ascii')]).toEqual([BASE_WETH.slice(2), 18, 'WETH'])
    expect(u8()).toBe(1) // METADATA_VERIFIED
    expect(take(4).readUInt32BE()).toBe(0)
    expect(u8()).toBe(0x80)
    expect(o).toBe(body.length) // the 65-byte signature is appended by signCertifiedEvmBody
  })

  it('takes token identities only by exact chain:address', () => {
    expect(reviewedSwapTokens(42161, [BASE_USDC])).toBeUndefined() // same address, other chain
    expect(reviewedSwapTokens(8453, ['0x41b481c3d2e3960f8f312212adfeecf6ce7c35ef'])).toBeUndefined()
    expect(reviewedSwapTokens(8453, [BASE_USDC, BASE_USDC])).toBeUndefined()
    expect(reviewedSwapTokens(8453, [])).toBeUndefined()
    expect(reviewedSwapTokens(8453, [BASE_USDC.toUpperCase().replace('0X', '0x')])?.[0].symbol).toBe('USDC')
  })

  it('refuses unreviewed routers, other selectors, and 0 or >4 tokens', () => {
    expect(() => buildEvmDecoderBody(8453, '0xd6145b2d3f379919e8cdeda7b97e37c4b2ca9c40', '0x3593564c', tokens)).toThrow(/reviewed Universal Router/)
    expect(() => buildEvmDecoderBody(42161, BASE_UR12, '0x3593564c', tokens)).toThrow(/reviewed Universal Router/)
    expect(() => buildEvmDecoderBody(8453, BASE_UR12, '0x12345678', tokens)).toThrow(/execute/)
    expect(() => buildEvmDecoderBody(8453, BASE_UR12, '0x24856bc3', [])).toThrow(/1-4 tokens/)
    expect(() => buildEvmDecoderBody(8453, BASE_UR12, '0x24856bc3', [...tokens, ...tokens, tokens[0]])).toThrow(/1-4 tokens/)
    expect(() => buildEvmDecoderBody(8453, BASE_UR12, '0x24856bc3', [{ ...tokens[0], symbol: 'USD₮0' }])).toThrow(/symbol/)
  })

  it('envelope: a certificate for another chain cannot certify the swap', () => {
    // Real 2026-10-03 Arbitrum certificate (public; firmware ClearsignRootCeremony20261003).
    const arbitrumCert = '01010000a4b16b359b004b6565704b657920416c706861203731360000000000000000000000000000000342f5f9704494b3f9bd72295eecaf29d783d23ea02b2dc9f48abcd2e46d4850cf2fe56b2ec1cd8540b8c5eff6ad5c30b5aea85edd7499c3340074e0df12cba0d31a973fb36ab9cc9e3ca759fba08dd96908e3f5541b891f00fc6ff941e9365a6c'
    expect(() => buildCertifiedEvmDecoderEnvelope(8453, BASE_UR12, '0x3593564c', tokens, arbitrumCert, '11'.repeat(32)))
      .toThrow(/scoped to 42161, not chain 8453/)
    const baseCert = '0101000021056b359b004b6565704b657920416c706861203731360000000000000000000000000000000342f5f9704494b3f9bd72295eecaf29d783d23ea02b2dc9f48abcd2e46d4850cfd3f4638bcd78bd822b88d56dc66bb34c167e3509597a8d3e86a37f14c5b89a504b04f2868e5fcb3ff93f317e2cae7b1cfca149559a272a3ea713125d37757a98'
    expect(() => buildCertifiedEvmDecoderEnvelope(8453, BASE_UR12, '0x3593564c', tokens, baseCert, '11'.repeat(32)))
      .toThrow(/does not match reviewed signer/)
  })

  it('reviews only UR 1.2 and UR 2.0 deployments, all from the pinned Uniswap list', () => {
    expect(UNIVERSAL_ROUTER_PROVENANCE).toContain('a9c574f6caf1d6f1b51facd3fe32dec7c4df392c')
    expect(REVIEWED_UNIVERSAL_ROUTERS.map((r) => `${r.chainId}:${r.address}`)).toEqual([
      '8453:0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad',
      '8453:0x6ff5693b99212da76ad316178a184ab56d299b43',
      '1:0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad',
      '1:0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
      '42161:0x5e325eda8064b456f4781070c0738d849c824258',
      '42161:0xa51afafe0263b40edaef0df8781ea9aa03e381a3',
    ])
    for (const r of REVIEWED_UNIVERSAL_ROUTERS) expect(r.source).toMatch(/UniversalRouterV(1_2_V2Support|2)$/)
    expect(findReviewedUniversalRouter(8453, '0x6fF5693b99212Da76ad316178A184AB56D299b43')).toBeDefined()
  })
})
