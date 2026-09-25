import { createHash } from 'node:crypto'
import { utils as ethersUtils } from 'ethers'

import { buildCentralContractReview } from './clearsign-central-review'
import type { EvmSchemaSpec } from './evm-certified-schema'
import type { ClearSignReview } from '../shared/clearsign-report'
import { DEFAULT_CLEARSIGN_SERVICE_URL } from './solana-certified-registry'

/** Reviewer keys this Vault trusts, by role. Empty until the reviewer key
 * ceremony: reviews then verify cryptographically but show as unpinned. Once
 * populated, a review signed by any other key is refused outright. */
export const PINNED_REVIEWERS: Record<string, Array<'semantics-review' | 'security-review'>> = {}

const RISK_LEVELS = ['low', 'medium', 'high', 'critical']

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Verify a published review from the ClearSign service before any of it is
 * shown. Proves: the evidence hashes to what both approvals signed; the two
 * approvals are distinct keys holding the semantics and security roles; the
 * reviewed schema describes exactly this call shape. The caller must still
 * bind the returned schema to the signed envelope bytes.
 */
export function verifyPublishedReview(review: any, shape: { chainId: number; contract: string; selector: string; calldataLength: number },
  pinned = PINNED_REVIEWERS): { spec: EvmSchemaSpec; review: ClearSignReview } {
  const evidence = review?.evidence
  const evidenceHash = String(review?.evidenceHash || '')
  if (!evidence || !/^[0-9a-f]{64}$/.test(evidenceHash)
    || createHash('sha256').update(canonical(evidence)).digest('hex') !== evidenceHash) {
    throw new Error('ClearSign review evidence does not match its hash')
  }
  const approvals = Array.isArray(review.approvals) ? review.approvals : []
  const roles = new Map<string, string>()
  for (const approval of approvals) {
    const { statement, digest } = buildCentralContractReview(approval?.statement || {})
    if (statement.decision !== 'approve' || statement.auditId !== review.auditId || statement.evidenceHash !== evidenceHash
      || statement.role !== approval.role || statement.reviewerPublicKey !== String(approval.reviewerPublicKey).toLowerCase()) {
      throw new Error('ClearSign review approval is not bound to this evidence')
    }
    const recovered = ethersUtils.computePublicKey(ethersUtils.recoverPublicKey(`0x${digest}`,
      `0x${String(approval.signature).replace(/^0x/i, '')}`), true).slice(2).toLowerCase()
    if (recovered !== statement.reviewerPublicKey) throw new Error('ClearSign review approval signature is invalid')
    roles.set(statement.role, statement.reviewerPublicKey)
  }
  const semantics = roles.get('semantics-review'), security = roles.get('security-review')
  if (!semantics || !security || semantics === security) throw new Error('ClearSign review lacks two distinct approvals')
  const reviewersPinned = Boolean(pinned[semantics]?.includes('semantics-review') && pinned[security]?.includes('security-review'))
  if (Object.keys(pinned).length && !reviewersPinned) throw new Error('ClearSign review is signed by reviewers this Vault does not trust')

  const assessment = evidence.assessment
  const spec = assessment?.schema as EvmSchemaSpec | undefined
  if (!spec || spec.chainId !== shape.chainId || String(spec.contract).toLowerCase() !== shape.contract.toLowerCase()
    || String(spec.selector).toLowerCase() !== shape.selector.toLowerCase()) {
    throw new Error('ClearSign review describes a different call')
  }
  const level = assessment?.risk?.level
  if (!RISK_LEVELS.includes(level) || !Array.isArray(assessment?.findings)) throw new Error('ClearSign review assessment is malformed')
  const identity = (evidence.identities || []).find((item: any) => item?.role === 'contract'
    && String(item?.address).toLowerCase() === shape.contract.toLowerCase())
  return {
    spec,
    review: {
      requestId: String(review.requestId), auditId: String(review.auditId), evidenceHash,
      publishedAt: Number(review.publishedAt), rubric: String(assessment.risk.rubric),
      riskLevel: level, riskReasons: (assessment.risk.reasons || []).map(String),
      findings: assessment.findings.map((item: any) => ({ severity: String(item.severity), title: String(item.title),
        detail: String(item.detail), ...(item.reference ? { reference: String(item.reference) } : {}) })),
      auditedCodeHash: identity?.codeHash, auditedIdentities: deploymentIdentities(evidence.identities),
      stateReference: String(evidence.stateReference || ''),
      reviewersPinned,
      approvals: [...roles].map(([role, reviewerPublicKey]) => ({ role, reviewerPublicKey })),
    },
  }
}

const DEPLOYMENT_ROLES = ['contract', 'implementation', 'beacon']

function deploymentIdentities(identities: any): Array<{ role: string; address: string; codeHash: string }> {
  return (Array.isArray(identities) ? identities : [])
    .filter((item: any) => DEPLOYMENT_ROLES.includes(item?.role))
    .map((item: any) => ({ role: String(item.role), address: String(item.address).toLowerCase(), codeHash: String(item.codeHash || '').toLowerCase() }))
}

/** Compare the deployment as audited with the deployment as measured now.
 * Returns why they differ, or undefined when they are the same code. */
export function deploymentMismatch(audited: Array<{ role: string; address: string; codeHash: string }>, live: unknown): string | undefined {
  const now = deploymentIdentities(live)
  if (!now.length || now.some((item) => !/^0x[0-9a-f]{64}$/.test(item.codeHash))) return 'the contract has no deployed code to compare'
  const key = (item: { role: string; address: string; codeHash: string }) => `${item.role} ${item.address} ${item.codeHash}`
  const was = new Set(audited.map(key)), is = new Set(now.map(key))
  const changed = [...is].filter((entry) => !was.has(entry)).concat([...was].filter((entry) => !is.has(entry)))
  if (!changed.length) return undefined
  const roles = [...new Set(changed.map((entry) => entry.split(' ')[0]))].join(', ')
  return `the deployed ${roles} changed since the audit`
}

/** The user's explicit "Request clearsign review". Sends only the public call
 * shape — never the calldata arguments, amounts, or the user's address. */
export async function requestClearSignReview(chainId: number, to: string, data: string): Promise<{ queued: boolean; requestId?: string }> {
  const calldata = String(data || '').replace(/^0x/i, '')
  if (!Number.isSafeInteger(chainId) || chainId < 1 || !/^0x[0-9a-f]{40}$/i.test(String(to || ''))
    || !/^[0-9a-f]+$/i.test(calldata) || calldata.length < 8 || calldata.length % 2) {
    throw new Error('Only a contract call can be submitted for review')
  }
  const base = String(process.env.CLEARSIGN_SERVICE_URL || DEFAULT_CLEARSIGN_SERVICE_URL).trim().replace(/\/+$/, '')
  const response = await fetch(`${base}/v1/evm/schema`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chainId, contract: to, selector: `0x${calldata.slice(0, 8).toLowerCase()}`,
      calldataLength: calldata.length / 2, requestReview: true }),
    signal: AbortSignal.timeout(10_000),
  })
  const result: any = await response.json().catch(() => null)
  const request = result?.discoveryRequest
  if (!request?.queued) throw new Error(result?.error || `ClearSign service did not queue the request (HTTP ${response.status})`)
  return { queued: true, requestId: String(request.requestId) }
}
