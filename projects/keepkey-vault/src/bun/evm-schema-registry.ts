/**
 * Signed EVM v2 clear-sign schemas, looked up per transaction.
 *
 * A v2 schema describes ONE (chain, contract, selector): the method name and
 * the labelled args, each one 32-byte ABI word. It carries no amounts and no
 * transaction hash, so a single signature covers every future call to that
 * method — the device decodes the values out of the calldata it is about to
 * sign. That is why this can be a static registry at all, unlike the v1
 * per-transaction blobs which must commit to a sighash.
 *
 * Attaching a schema does not weaken anything: firmware still verifies the
 * signature against a trusted ClearSign key, still requires the declared arg
 * widths to account for the calldata exactly, and for a payable call still
 * shows the native amount screen. A wrong or unsigned schema is refused, not
 * silently trusted.
 */
import registry from './evm-schemas-local.json'
import { DEFAULT_CLEARSIGN_SERVICE_URL } from './solana-certified-registry'
import {
  CERTIFIED_METADATA_KEY_ID,
  findCertifiedEvmSchemaSpec,
  isCertifiedEvmMetadata,
  buildEvmSchemaBody,
} from './evm-certified-schema'
import { buildTokenSchema, tokenCallShape } from './evm-token-schema'
import { findPromotedEvmArtifact } from './clearsign-artifact-resolver'
import { runtimeEvmSighash } from './uniswap-runtime-envelope'

export { isCertifiedEvmMetadata }

export interface SignedEvmSchema {
  method: string
  keyId: number
  /** 0x-prefixed hex — the format hdwallet's ethSignTx expects. */
  signedPayload: string
  /** 4 + 32*num_args; firmware requires the calldata to match exactly. */
  expectedCalldataLength?: number
  source?: 'local-test' | 'certified-service' | 'promoted-local'
  /** Present only for a locally reviewed, identity-bound promotion. */
  bundleHash?: string
}

const SCHEMAS: Record<string, SignedEvmSchema> = (registry as any).schemas ?? {}

/**
 * Find a schema for this call, or undefined. Returns undefined rather than
 * throwing on any doubt — a missing schema means the existing (blind-sign)
 * behaviour, never a blocked transaction.
 */
export function findEvmSchema(
  chainId: number | undefined,
  to: string | undefined,
  data: string | undefined,
): SignedEvmSchema | undefined {
  if (!chainId || !to || !data) return undefined
  const calldata = data.startsWith('0x') ? data.slice(2) : data
  if (calldata.length < 8) return undefined
  const selector = '0x' + calldata.slice(0, 8).toLowerCase()
  const schema = SCHEMAS[`${chainId}:${to.toLowerCase()}:${selector}`]
  if (!schema) return undefined
  // The device enforces this too, but checking here keeps a stale registry
  // entry from producing a confusing on-device refusal mid-signing.
  if (calldata.length / 2 !== schema.expectedCalldataLength) return undefined
  return schema
}

/** Fetch a KeepKey-certified v3 envelope from the isolated signer service. */
export async function findCertifiedEvmSchema(
  chainId: number | undefined,
  to: string | undefined,
  data: string | undefined,
): Promise<SignedEvmSchema | undefined> {
  let spec = findCertifiedEvmSchemaSpec(chainId, to, data)
  const calldata = String(data || '').replace(/^0x/i, '')
  const selector = `0x${calldata.slice(0, 8).toLowerCase()}`
  const length = calldata.length / 2
  const tokenCandidate = /^[0-9a-f]+$/i.test(calldata) && tokenCallShape(Number(chainId), String(to || ''), selector, length)
  if (!spec && !tokenCandidate) return undefined
  const base = String(process.env.CLEARSIGN_SERVICE_URL || DEFAULT_CLEARSIGN_SERVICE_URL)
    .trim()
    .replace(/\/+$/, '')

  let response: Response
  try {
    response = await fetch(`${base}/v1/evm/schema`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The service only needs the reviewed call shape. Do not send addresses,
      // order IDs, amounts, or any other calldata arguments off the host.
      body: JSON.stringify({
        chainId,
        contract: to,
        selector,
        calldataLength: length,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error: any) {
    throw new Error(`ClearSign verification service is unavailable: ${error?.message || 'connection failed'}`)
  }
  let result: any
  try {
    result = await response.json()
  } catch {
    throw new Error(`ClearSign verification service returned HTTP ${response.status} without valid JSON`)
  }
  if (!response.ok) {
    if (response.status === 422) {
      if (!spec && result?.code !== 'TOKEN_IDENTITY_UNVERIFIED') return undefined
      throw new Error(`ClearSign certified description unavailable for ${spec?.method || 'token call'}: ${result?.error || 'the service catalog must be updated and its signed artifact provisioned before signing'}`)
    }
    throw new Error(`ClearSign verification service returned HTTP ${response.status}: ${result?.error || 'request failed'}`)
  }

  if (!spec) {
    const token = result?.tokenIdentity
    if (!token || token.chainId !== chainId || String(token.contract).toLowerCase() !== String(to).toLowerCase()
      || token.source !== 'pioneer-discovery' || !/^[0-9a-f]{64}$/.test(token.sourceSha256)) {
      throw new Error('ClearSign service returned an invalid token identity')
    }
    spec = buildTokenSchema(Number(chainId), String(to), selector, length, token)
    // Bind displayed symbol/scale to the actual signed schema, never just JSON.
    const envelope = Buffer.from(String(result.signedPayload || '').replace(/^0x/i, ''), 'hex')
    if (!envelope.subarray(140, -65).equals(buildEvmSchemaBody(spec))) {
      throw new Error('ClearSign token identity differs from the signed schema')
    }
  }

  const candidate = {
    signedPayload: result?.signedPayload,
    keyId: result?.keyId,
  }
  if (!isCertifiedEvmMetadata(candidate)) {
    throw new Error('ClearSign verification service returned a non-certified payload')
  }
  const certificateEnvelope = Buffer.from(String(result.signedPayload).replace(/^0x/i, ''), 'hex')
  if (certificateEnvelope.readUInt32BE(3) !== chainId) {
    throw new Error(`ClearSign certificate is not authorized for chain ${chainId}; a chain-scoped root certificate is required`)
  }
  if (
    result?.classification !== 'VERIFIED' ||
    result?.chainId !== spec.chainId ||
    String(result?.contract || '').toLowerCase() !== spec.contract.toLowerCase() ||
    String(result?.selector || '').toLowerCase() !== spec.selector.toLowerCase() ||
    result?.method !== spec.method ||
    result?.expectedCalldataLength !== spec.expectedCalldataLength ||
    result?.keyId !== CERTIFIED_METADATA_KEY_ID
  ) {
    throw new Error('ClearSign verification service response does not match the requested schema')
  }
  return {
    method: spec.method,
    keyId: CERTIFIED_METADATA_KEY_ID,
    signedPayload: result.signedPayload,
    expectedCalldataLength: spec.expectedCalldataLength,
    source: 'certified-service',
  }
}

export async function resolveEvmSchema(
  chainId: number | undefined,
  to: string | undefined,
  data: string | undefined,
  certifiedMetadataSupported = true,
): Promise<SignedEvmSchema | undefined> {
  // Older firmware may not handle EthereumTxMetadata at all. In particular,
  // never substitute the local CI-key schema when the certified path is off.
  // The caller's ordinary Advanced Mode policy gate still applies.
  if (!certifiedMetadataSupported) return undefined
  const promoted = findPromotedEvmArtifact(chainId, to, data)
  if (promoted) return { ...promoted, keyId: CERTIFIED_METADATA_KEY_ID, source: 'promoted-local' }
  return (await findCertifiedEvmSchema(chainId, to, data))
    ?? findEvmSchema(chainId, to, data)
}

/** Resolve a reviewed description bound to this complete transaction. Used
 * for dynamic router programs whose safety-defining fields exceed the device's
 * initial calldata chunk. */
export async function resolveCertifiedEvmTransaction(tx: any): Promise<SignedEvmSchema | undefined> {
  if (Number(tx?.chainId) !== 42161
    || String(tx?.to || '').toLowerCase() !== '0x2d01411773c8c24805306e89a41f7855c3c4fe65'
    || !String(tx?.data || '').toLowerCase().startsWith('0x3593564c')) return undefined
  const base = String(process.env.CLEARSIGN_SERVICE_URL || DEFAULT_CLEARSIGN_SERVICE_URL).trim().replace(/\/+$/, '')
  const response = await fetch(`${base}/v1/evm/transaction`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tx), signal: AbortSignal.timeout(10_000),
  })
  const result: any = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`ClearSign transaction description unavailable: ${result?.error || `HTTP ${response.status}`}`)
  if (!isCertifiedEvmMetadata({ signedPayload: result?.signedPayload, keyId: result?.keyId })
    || result?.classification !== 'VERIFIED' || result?.chainId !== 42161
    || String(result?.contract).toLowerCase() !== String(tx.to).toLowerCase()
    || String(result?.selector).toLowerCase() !== '0x3593564c'
    || String(result?.txHash).toLowerCase() !== `0x${runtimeEvmSighash(tx).toString('hex')}`) {
    throw new Error('ClearSign transaction response does not match the transaction being approved')
  }
  return { method: String(result.method), keyId: CERTIFIED_METADATA_KEY_ID,
    signedPayload: String(result.signedPayload), source: 'certified-service' }
}
