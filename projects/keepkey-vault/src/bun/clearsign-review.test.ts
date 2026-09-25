import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { utils as ethersUtils } from 'ethers'

import { buildCentralContractReview } from './clearsign-central-review'
import { buildEvmSchemaBody, CERTIFIED_METADATA_KEY_ID } from './evm-certified-schema'
import { deploymentMismatch, verifyPublishedReview } from './clearsign-review'
import { findCertifiedEvmSchema } from './evm-schema-registry'

// The MDM case study: Mordiem CapitalManager.deposit(address asset, uint256 amount) on Base.
const MANAGER = '0x6b6c05ee7f49d00e63e74a9426d74ef9614f6a0f'
const DEPOSIT = '0x47e7ef24'
const SHAPE = { chainId: 8453, contract: MANAGER, selector: DEPOSIT, calldataLength: 68 }
const CALLDATA = `${DEPOSIT}${'833589fcd6edb6e08f4c7c32d4f71b54bda02913'.padStart(64, '0')}${(100_000_000n).toString(16).padStart(64, '0')}`
const SCHEMA = { chainId: 8453, contract: MANAGER, selector: DEPOSIT, method: 'Mordiem capital deposit',
  args: [{ name: 'Asset', format: 1 }, { name: 'Amount', format: 2 }], expectedCalldataLength: 68 }
// MDM's CapitalManager is a UUPS proxy: the audit pins the proxy AND its implementation.
const IMPLEMENTATION = '0xed36c1df5e9865165916190dcf4c1bf93ad2a9e2'
const AUDITED = [
  { address: MANAGER, role: 'contract', codeHash: `0x${'cd'.repeat(32)}` },
  { address: IMPLEMENTATION, role: 'implementation', codeHash: `0x${'ee'.repeat(32)}` },
]
const unchanged = async () => AUDITED
const semantics = new ethersUtils.SigningKey(`0x${'0a'.padStart(64, '0')}`)
const security = new ethersUtils.SigningKey(`0x${'0b'.padStart(64, '0')}`)
const pub = (key: ethersUtils.SigningKey) => ethersUtils.computePublicKey(key.publicKey, true).slice(2)

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** A review exactly as the ClearSign Worker serves it (findPublishedEvm). */
function publishedReview(options: { evidence?: any; keys?: [ethersUtils.SigningKey, ethersUtils.SigningKey] } = {}) {
  const evidence = options.evidence ?? {
    version: 1, chain: 'Ethereum', auditedAt: 1, endpoint: 'https://mainnet.base.org', stateReference: 'block:0x1',
    identities: AUDITED, candidates: [], limitations: [],
    assessment: { version: 1, schema: SCHEMA,
      factors: { sourceVerified: true, upgradeable: true, adminDelaySeconds: 864000, controller: 'single-key', privilegedFundAccess: true, uncappedMint: true },
      findings: [{ severity: 'high', title: 'Single-key upgrade control', detail: '1-of-1 EOA Safe behind a 10-day timelock.' }],
      risk: { rubric: 'keepkey-contract-risk-v1', level: 'high', reasons: ['a single key controls upgrades, deposits, minting (delay 10d)'] } },
  }
  const evidenceHash = createHash('sha256').update(canonical(evidence)).digest('hex')
  const auditId = createHash('sha256').update(`req:${evidenceHash}`).digest('hex')
  const [first, second] = options.keys ?? [semantics, security]
  const approvals = ([[first, 'semantics-review'], [second, 'security-review']] as const).map(([key, role]) => {
    const { statement, digest } = buildCentralContractReview({ auditId, evidenceHash, reviewerPublicKey: pub(key), role, decision: 'approve', reviewedAt: 1 })
    return { role, reviewerPublicKey: pub(key), statement, signature: ethersUtils.joinSignature(key.signDigest(`0x${digest}`)).slice(2) }
  })
  return { requestId: 'req', auditId, evidenceHash, publishedAt: 2, evidence, approvals }
}

describe('verifyPublishedReview', () => {
  it('accepts the MDM review and reports it unpinned while no reviewer keys are pinned', () => {
    const { spec, review } = verifyPublishedReview(publishedReview(), SHAPE)
    expect(spec.method).toBe('Mordiem capital deposit')
    expect(review.riskLevel).toBe('high')
    expect(review.findings).toHaveLength(1)
    expect(review.auditedCodeHash).toBe(`0x${'cd'.repeat(32)}`)
    expect(review.reviewersPinned).toBe(false)
  })

  it('refuses evidence edited after the reviewers signed it', () => {
    const review = publishedReview()
    review.evidence.assessment.risk.level = 'low'
    expect(() => verifyPublishedReview(review, SHAPE)).toThrow('does not match its hash')
  })

  it('refuses one key holding both roles', () => {
    expect(() => verifyPublishedReview(publishedReview({ keys: [semantics, semantics] }), SHAPE)).toThrow('two distinct approvals')
  })

  it('refuses unknown reviewers once any reviewer key is pinned', () => {
    const pinned = { [pub(semantics)]: ['semantics-review' as const] }
    expect(() => verifyPublishedReview(publishedReview(), SHAPE, pinned)).toThrow('does not trust')
    const both = { ...pinned, [pub(security)]: ['security-review' as const] }
    expect(verifyPublishedReview(publishedReview(), SHAPE, both).review.reviewersPinned).toBe(true)
  })

  it('refuses a review of a different call', () => {
    expect(() => verifyPublishedReview(publishedReview(), { ...SHAPE, selector: '0xdeadbeef' })).toThrow('different call')
  })
})

describe('findCertifiedEvmSchema review lookup', () => {
  const envelope = (body: Buffer) => `0x03${'00'.repeat(2)}${(8453).toString(16).padStart(8, '0')}${'00'.repeat(133)}${body.toString('hex')}${'11'.repeat(65)}`
  const serve = (json: any, status = 200) => (async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch
  const verified = (review: any, body = buildEvmSchemaBody(SCHEMA as any)) => ({ success: true, classification: 'VERIFIED',
    signedPayload: envelope(body), keyId: CERTIFIED_METADATA_KEY_ID, method: SCHEMA.method, chainId: 8453,
    contract: MANAGER, selector: DEPOSIT, expectedCalldataLength: 68, review })

  async function withFetch<T>(impl: typeof fetch, run: () => Promise<T>) {
    const original = globalThis.fetch
    globalThis.fetch = impl
    try { return await run() } finally { globalThis.fetch = original }
  }

  it('returns the reviewed envelope with its verified review', async () => {
    const result = await withFetch(serve(verified(publishedReview())), () => findCertifiedEvmSchema(8453, MANAGER, CALLDATA, unchanged))
    expect(result?.method).toBe('Mordiem capital deposit')
    expect(result?.review?.riskLevel).toBe('high')
  })

  it('falls back to blind when the envelope body differs from the reviewed schema', async () => {
    const other = buildEvmSchemaBody({ ...SCHEMA, method: 'Something else' } as any)
    expect(await withFetch(serve(verified(publishedReview(), other)), () => findCertifiedEvmSchema(8453, MANAGER, CALLDATA, unchanged))).toBeUndefined()
  })

  it('stops clearsigning after an upgrade or when the deployment cannot be measured', async () => {
    const upgraded = async () => [AUDITED[0], { address: '0x' + '99'.repeat(20), role: 'implementation', codeHash: `0x${'aa'.repeat(32)}` }]
    const unmeasurable = async () => { throw new Error('rpc down') }
    for (const measure of [upgraded, unmeasurable]) {
      expect(await withFetch(serve(verified(publishedReview())), () => findCertifiedEvmSchema(8453, MANAGER, CALLDATA, measure))).toBeUndefined()
    }
  })

  it('falls back to blind on a tampered review, a miss, or an unreachable service', async () => {
    const tampered = publishedReview()
    tampered.evidence.assessment.findings = []
    expect(await withFetch(serve(verified(tampered)), () => findCertifiedEvmSchema(8453, MANAGER, CALLDATA, unchanged))).toBeUndefined()
    expect(await withFetch(serve({ classification: 'OPAQUE' }, 422), () => findCertifiedEvmSchema(8453, MANAGER, CALLDATA, unchanged))).toBeUndefined()
    expect(await withFetch((async () => { throw new Error('offline') }) as unknown as typeof fetch,
      () => findCertifiedEvmSchema(8453, MANAGER, CALLDATA, unchanged))).toBeUndefined()
  })
})

describe('deploymentMismatch', () => {
  it('is silent for the audited deployment and names what changed otherwise', () => {
    expect(deploymentMismatch(AUDITED as any, AUDITED)).toBeUndefined()
    expect(deploymentMismatch(AUDITED as any, [AUDITED[0], { ...AUDITED[1], codeHash: `0x${'ab'.repeat(32)}` }]))
      .toBe('the deployed implementation changed since the audit')
    expect(deploymentMismatch(AUDITED as any, [{ ...AUDITED[0], codeHash: `0x${'01'.repeat(32)}` }]))
      .toBe('the deployed contract, implementation changed since the audit')
    expect(deploymentMismatch(AUDITED as any, [{ ...AUDITED[0], codeHash: undefined }])).toBe('the contract has no deployed code to compare')
  })
})
