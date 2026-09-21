import { createHash } from 'node:crypto'
import { utils as ethersUtils } from 'ethers'
import bs58 from 'bs58'

import {
  ALPHA_DELEGATE_FINGERPRINT,
  ALPHA_DELEGATE_PUBLIC_KEY,
  ALPHA_ROOT_PUBLIC_KEY,
  CLEARSIGN_SCOPE_ETHEREUM,
  CLEARSIGN_SCOPE_SOLANA,
  inspectAlphaCertificate,
} from '../../src/bun/clearsign-alpha-ceremony'
import {
  buildEvmSchemaBody,
  CERTIFIED_EVM_CATALOG,
  CERTIFIED_METADATA_KEY_ID,
  findCertifiedEvmSchemaByShape,
} from '../../src/bun/evm-certified-schema'
import {
  CERTIFIED_SOLANA_CATALOG,
  serializeSolanaSchema,
  solanaSchemaCoverage,
} from '../../src/bun/solana-certified-schema'
import { parseSolanaMessage, parseSolanaTx, solanaMessageSlice } from '../../src/bun/solana-tx'

interface Env {
  CLEARSIGN_ENVIRONMENT?: string
  /** Offline-produced, individually verified artifacts. No signing key is accepted. */
  CLEARSIGN_ARTIFACTS_JSON?: string
}

interface StaticArtifactManifest {
  version: 1
  evm?: Record<string, string>
  solana?: Record<string, { schema: { payload: string; signature: string; signerKeyId: number }; certificate: string }>
  revoked?: string[]
}

const SERVICE = 'KeepKey ClearSign'
const REQUEST_LIMIT = 64 * 1024
const PROVENANCE = {
  operator: 'KeepKey',
  firmware: 'https://github.com/keepkey/keepkey-firmware',
  vault: 'https://github.com/keepkey/keepkey-vault',
  protocol: 'https://docs.relay.link/references/protocol/how-it-works',
  protocolSecurity: 'https://docs.relay.link/references/protocol/security',
  portals: 'https://docs.portals.fi/',
  portalsRouter: 'https://eth.blockscout.com/address/0xbf5A7F3629fB325E2a8453D595AB103465F75E62?tab=contract',
} as const

const commonHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
}

function json(value: unknown, status = 200, cache = 'no-store'): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...commonHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  })
}

function reviewedCatalog() {
  const evm = Object.values(CERTIFIED_EVM_CATALOG).map((spec) => ({
    id: `eip155:${spec.chainId}:${spec.contract}:${spec.selector}`,
    family: 'evm',
    network: 'Ethereum',
    protocol: spec.protocol || 'Relay',
    maintainedBy: spec.maintainedBy || 'Relay',
    action: spec.action || 'Deposit funds for a cross-chain swap',
    method: spec.method,
    contract: spec.contract,
    selector: spec.selector,
    ...(spec.expectedCalldataLength !== undefined
      ? { calldataLength: spec.expectedCalldataLength }
      : { calldataLength: { min: spec.minimumCalldataLength, max: spec.maximumCalldataLength, alignment: 'selector + ABI words' } }),
    fieldsShownByKeepKey: spec.displayFields || spec.args.map((arg) => arg.name),
    provenance: spec.provenance || { protocol: PROVENANCE.protocol, security: PROVENANCE.protocolSecurity },
  }))
  const solana = Object.entries(CERTIFIED_SOLANA_CATALOG).map(([key, spec]) => ({
    id: `solana:${key}`,
    family: 'solana',
    network: 'Solana',
    protocol: 'Relay',
    maintainedBy: 'Relay',
    action: 'Deposit funds for a cross-chain swap',
    method: spec.instructionName,
    program: spec.programId,
    discriminator: spec.discriminator.toString('hex'),
    instructionLength: solanaSchemaCoverage(spec),
    fieldsShownByKeepKey: [
      ...(spec.args || []).map((arg) => arg.label),
      ...(spec.accounts || []).map((account) => account.label),
    ],
    provenance: { protocol: PROVENANCE.protocol, security: PROVENANCE.protocolSecurity },
  }))
  return [...evm, ...solana]
}

function cleanHex(value: unknown, bytes: number | undefined, label: string): Buffer {
  const clean = String(value || '').replace(/^0x/i, '')
  if (!clean || !/^[0-9a-f]+$/i.test(clean) || clean.length % 2 || (bytes !== undefined && clean.length !== bytes * 2)) {
    throw new Error(`${label} must be${bytes === undefined ? '' : ` ${bytes}-byte`} hex`)
  }
  return Buffer.from(clean, 'hex')
}

function compactSignatureMatches(payload: Buffer, signature: Buffer, publicKey: string, recovery?: number): boolean {
  const digest = createHash('sha256').update(payload).digest('hex')
  const r = `0x${signature.subarray(0, 32).toString('hex')}`
  const s = `0x${signature.subarray(32, 64).toString('hex')}`
  return (recovery === undefined ? [27, 28] : [recovery]).some((v) => {
    try {
      const recovered = ethersUtils.computePublicKey(ethersUtils.recoverPublicKey(`0x${digest}`, { r, s, v }), true).slice(2).toLowerCase()
      return recovered === publicKey.toLowerCase()
    } catch { return false }
  })
}

function loadArtifacts(env: Env) {
  const issues: string[] = []
  const evm = new Map<string, { signedPayload: string; certificate: ReturnType<typeof inspectAlphaCertificate> }>()
  const solana = new Map<string, { schema: { payload: string; signature: string; signerKeyId: 128 }; certificate: string; certificateInfo: ReturnType<typeof inspectAlphaCertificate> }>()
  let manifest: StaticArtifactManifest
  try {
    manifest = JSON.parse(env.CLEARSIGN_ARTIFACTS_JSON || '')
    if (manifest.version !== 1 || (manifest.revoked && !Array.isArray(manifest.revoked))) throw new Error('unsupported manifest')
  } catch {
    return { ready: false, evmReady: false, solanaReady: false, evm, solana, certificates: [], issues: ['offline artifact manifest pending or invalid'] }
  }
  const revoked = new Set((manifest.revoked || []).map(String))
  for (const [id, value] of Object.entries(manifest.evm || {})) {
    try {
      if (revoked.has(id)) continue
      const spec = CERTIFIED_EVM_CATALOG[id]
      if (!spec) throw new Error('not in reviewed catalog')
      const bytes = cleanHex(value, undefined, 'EVM envelope')
      if (bytes[0] !== 3 || bytes.length < 1 + 139 + 65) throw new Error('invalid envelope')
      const certificate = inspectAlphaCertificate(bytes.subarray(1, 140).toString('hex'))
      if (certificate.chainId !== spec.chainId) throw new Error('wrong certificate scope')
      const body = bytes.subarray(140, -65)
      if (!body.equals(buildEvmSchemaBody(spec))) throw new Error('payload differs from reviewed catalog')
      const signature = bytes.subarray(-65, -1)
      if (!compactSignatureMatches(body, signature, certificate.delegatePublicKey, bytes[bytes.length - 1])) throw new Error('invalid delegate signature')
      evm.set(id, { signedPayload: `0x${bytes.toString('hex')}`, certificate })
    } catch (error: any) { issues.push(`EVM artifact ${id}: ${error?.message || 'invalid'}`) }
  }
  for (const [id, value] of Object.entries(manifest.solana || {})) {
    try {
      if (revoked.has(`solana:${id}`) || revoked.has(id)) continue
      const spec = CERTIFIED_SOLANA_CATALOG[id]
      if (!spec) throw new Error('not in reviewed catalog')
      if (value.schema?.signerKeyId !== CERTIFIED_METADATA_KEY_ID) throw new Error('wrong signer key id')
      const payload = cleanHex(value.schema?.payload, undefined, 'Solana schema payload')
      if (!payload.equals(serializeSolanaSchema(spec))) throw new Error('payload differs from reviewed catalog')
      const signature = cleanHex(value.schema?.signature, 64, 'Solana schema signature')
      const certificateBytes = cleanHex(value.certificate, 139, 'Solana certificate')
      const certificateInfo = inspectAlphaCertificate(certificateBytes.toString('hex'))
      if (certificateInfo.chainId !== CLEARSIGN_SCOPE_SOLANA) throw new Error('wrong certificate scope')
      if (!compactSignatureMatches(payload, signature, certificateInfo.delegatePublicKey)) throw new Error('invalid delegate signature')
      solana.set(id, { schema: { payload: `0x${payload.toString('hex')}`, signature: `0x${signature.toString('hex')}`, signerKeyId: 128 }, certificate: `0x${certificateBytes.toString('hex')}`, certificateInfo })
    } catch (error: any) { issues.push(`Solana artifact ${id}: ${error?.message || 'invalid'}`) }
  }
  const certificates = [...evm.values()].map(value => value.certificate).concat([...solana.values()].map(value => value.certificateInfo))

  return {
    ready: evm.size + solana.size > 0,
    evmReady: evm.size > 0,
    solanaReady: solana.size > 0,
    evm, solana, certificates,
    issues,
  }
}

function publicStatus(env: Env, origin: string) {
  const state = loadArtifacts(env)
  const expires = state.certificates.map(certificate => certificate.notAfter)
  return {
    service: SERVICE,
    environment: env.CLEARSIGN_ENVIRONMENT || 'production',
    status: state.ready ? 'ready' : 'provisioning',
    message: state.ready
      ? 'KeepKey can authenticate transaction descriptions for every scope marked ready below, without blind signing.'
      : 'The service is online, but no certified signing scope is active yet.',
    endpoints: {
      status: `${origin}/v1/status`,
      catalog: `${origin}/v1/catalog`,
      evmSchema: `${origin}/v1/evm/schema`,
      solanaCertify: `${origin}/v1/solana/certify`,
    },
    scopes: {
      ethereum: state.evmReady ? 'ready' : 'provisioning',
      solana: state.solanaReady ? 'ready' : 'provisioning',
    },
    trust: {
      label: state.ready ? 'Authenticated by KeepKey' : 'Certificate pending',
      signerAlias: state.certificates[0]?.alias || 'KeepKey Vault',
      signerFingerprint: ALPHA_DELEGATE_FINGERPRINT,
      signerPublicKey: ALPHA_DELEGATE_PUBLIC_KEY,
      rootPublicKey: ALPHA_ROOT_PUBLIC_KEY,
      certificateExpiresAt: expires.length ? new Date(Math.min(...expires) * 1000).toISOString() : null,
      deviceChecksCertificate: true,
      deviceChecksTransactionBinding: true,
    },
    privacy: {
      applicationStorage: false,
      ethereumRequest: ['chainId', 'contract', 'selector', 'calldataLength'],
      solanaRequest: ['unsigned transaction', 'reviewed catalog id'],
      note: 'Solana sends the unsigned transaction for exact reviewed-shape matching. Lookup-table transactions fail closed because this keyless service cannot create a transaction-bound account proof. No seed, private key, PIN, passphrase, or device signature is sent.',
    },
    catalogEntries: reviewedCatalog().length,
    provisioning: state.issues,
    distribution: { mode: 'offline-presigned', onlineSigningKey: false },
    provenance: PROVENANCE,
  }
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

function home(env: Env, origin: string): Response {
  const status = publicStatus(env, origin)
  const ready = status.status === 'ready'
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SERVICE}</title><style>body{margin:0;background:#0b0d10;color:#eef2f5;font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:820px;margin:0 auto;padding:56px 24px}h1{font-size:28px;margin:0 0 8px}.muted{color:#929aa5}.card{border:1px solid #29313a;background:#11151a;border-radius:14px;padding:20px;margin:18px 0}.pill{display:inline-block;border:1px solid ${ready ? '#42d392' : '#e7b84b'};color:${ready ? '#42d392' : '#e7b84b'};border-radius:999px;padding:3px 10px;font-size:12px}dt{color:#929aa5}dd{margin:0 0 10px;word-break:break-all}a{color:#7dd3fc}code{color:#d9b75f}</style></head>
<body><main><span class="pill">${escapeHtml(status.status)}</span><h1>KeepKey ClearSign</h1><p class="muted">Human-readable transaction details, authenticated by the KeepKey in your hand.</p>
<section class="card"><h2>What happens</h2><p>${escapeHtml(status.message)}</p><p>The service recognizes a reviewed protocol action and returns an offline-signed description. It has no signing key. Your KeepKey independently checks the root certificate, signer fingerprint, program or contract, decoded fields, and the exact transaction binding. You still approve the final transaction on the device.</p></section>
<section class="card"><h2>Trust status</h2><dl><dt>Device label</dt><dd>${escapeHtml(status.trust.label)}</dd><dt>Signer</dt><dd>${escapeHtml(status.trust.signerAlias)} · ${escapeHtml(status.trust.signerFingerprint)}</dd><dt>Ethereum</dt><dd>${escapeHtml(status.scopes.ethereum)}</dd><dt>Solana</dt><dd>${escapeHtml(status.scopes.solana)}</dd><dt>Earliest certificate expiry</dt><dd>${escapeHtml(status.trust.certificateExpiresAt || 'Pending')}</dd></dl></section>
<section class="card"><h2>Reviewed protocols</h2><p><strong>Relay</strong> · Ethereum and Solana deposits for cross-chain swaps.</p><p><strong>Portals</strong> · Native ETH swaps through the verified Ethereum router. KeepKey reads the output token, minimum output, recipient, and input amount from the transaction itself.</p><p>Only exact catalog matches are certified. Unknown programs, contracts, selectors, instruction sizes, or lookup-table accounts are refused.</p><a href="/v1/catalog">View the machine-readable catalog</a></section>
<section class="card"><h2>Privacy and provenance</h2><p>Ethereum requests contain only transaction shape. Solana requests contain the unsigned transaction for exact shape matching; lookup-table transactions are refused because this service cannot sign their resolved accounts. Wallet seeds, private keys, PINs, passphrases, and device signatures never leave your KeepKey. This service writes no transaction database.</p><p><a href="${PROVENANCE.protocol}">How Relay works</a> · <a href="${PROVENANCE.protocolSecurity}">Relay security</a> · <a href="${PROVENANCE.portals}">Portals documentation</a> · <a href="${PROVENANCE.portalsRouter}">Verified Portals router</a> · <a href="${PROVENANCE.firmware}">KeepKey firmware</a> · <a href="${PROVENANCE.vault}">Vault source</a></p></section>
</main></body></html>`
  return new Response(html, {
    headers: {
      ...commonHeaders,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    },
  })
}

async function readJson(request: Request): Promise<any> {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (!Number.isFinite(contentLength) || contentLength > REQUEST_LIMIT) throw new Error('request too large')
  const text = await request.text()
  if (text.length > REQUEST_LIMIT) throw new Error('request too large')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('invalid JSON')
  }
}

function decodeCanonicalBase64(value: unknown): Buffer {
  const encoded = String(value || '')
  if (!encoded || encoded.length > REQUEST_LIMIT || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('rawTx must be canonical base64')
  }
  const decoded = Buffer.from(encoded, 'base64')
  if (!decoded.length || decoded.toString('base64') !== encoded) throw new Error('rawTx must be canonical base64')
  return decoded
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: commonHeaders })
    if (request.method === 'GET' && url.pathname === '/') return home(env, url.origin)
    if (request.method === 'GET' && url.pathname === '/health') {
      const state = loadArtifacts(env)
      return json({ ok: true, ready: state.ready, service: 'keepkey-clearsign', fingerprint: ALPHA_DELEGATE_FINGERPRINT })
    }
    if (request.method === 'GET' && (url.pathname === '/ready' || url.pathname === '/v1/status')) {
      const status = publicStatus(env, url.origin)
      return json(status, url.pathname === '/ready' && status.status !== 'ready' ? 503 : 200)
    }
    if (request.method === 'GET' && url.pathname === '/v1/catalog') {
      return json({ version: 1, entries: reviewedCatalog(), provenance: PROVENANCE }, 200, 'public, max-age=300')
    }
    if (request.method === 'GET' && url.pathname === '/signer') {
      const status = publicStatus(env, url.origin)
      return json({ status: status.status, alias: status.trust.signerAlias, fingerprint: ALPHA_DELEGATE_FINGERPRINT, publicKeyHex: ALPHA_DELEGATE_PUBLIC_KEY, keyId: CERTIFIED_METADATA_KEY_ID, scopes: status.scopes, certificateExpiresAt: status.trust.certificateExpiresAt })
    }

    if (request.method === 'POST' && (url.pathname === '/v1/evm/schema' || url.pathname === '/sign')) {
      let body: any
      try { body = await readJson(request) } catch (error: any) {
        return json({ error: error.message }, error.message === 'request too large' ? 413 : 400)
      }
      const spec = findCertifiedEvmSchemaByShape(Number(body?.chainId), String(body?.contract || body?.to || ''), String(body?.selector || ''), Number(body?.calldataLength))
      if (!spec) return json({ classification: 'OPAQUE', error: 'contract, selector, or calldata shape is not in the reviewed catalog' }, 422)
      const state = loadArtifacts(env)
      const id = `${spec.chainId}:${spec.contract.toLowerCase()}:${spec.selector.toLowerCase()}`
      const artifact = state.evm.get(id)
      if (!artifact) return json({ classification: 'UNAVAILABLE', error: 'No active offline-signed Ethereum artifact for this reviewed shape' }, 503)
      return json({
        success: true, classification: 'VERIFIED', version: 3,
        signedPayload: artifact.signedPayload, keyId: CERTIFIED_METADATA_KEY_ID,
        fingerprint: ALPHA_DELEGATE_FINGERPRINT, alias: artifact.certificate.alias,
        method: spec.method, chainId: spec.chainId, contract: spec.contract,
        selector: spec.selector, expectedCalldataLength: spec.expectedCalldataLength,
        decoder: spec.decoder, provenance: spec.provenance || PROVENANCE,
      })
    }

    if (request.method === 'POST' && url.pathname === '/v1/solana/certify') {
      let body: any
      try { body = await readJson(request) } catch (error: any) {
        return json({ error: error.message }, error.message === 'request too large' ? 413 : 400)
      }
      const catalogKey = String(body?.catalogKey || '')
      const spec = CERTIFIED_SOLANA_CATALOG[catalogKey]
      if (!spec) return json({ classification: 'OPAQUE', error: 'catalogKey is not in the reviewed catalog' }, 422)

      let fullTx: Buffer
      let messageBytes: Uint8Array
      let message: ReturnType<typeof parseSolanaMessage>
      try {
        fullTx = decodeCanonicalBase64(body?.rawTx)
        const parsedTx = parseSolanaTx(fullTx)
        messageBytes = solanaMessageSlice(fullTx, parsedTx)
        message = parseSolanaMessage(messageBytes)
      } catch (error: any) {
        return json({ classification: 'OPAQUE', error: error?.message || 'malformed Solana transaction' }, 422)
      }

      const programBytes = Buffer.from(bs58.decode(spec.programId))
      const expectedLength = solanaSchemaCoverage(spec)
      const matchesInstruction = message.instructions.some((instruction) => {
        const programKey = message.staticAccounts[instruction.programIdIndex]
        if (!programKey || !Buffer.from(programKey).equals(programBytes)) return false
        if ((spec.accounts || []).some((account) => account.index >= instruction.accountIndices.length)) return false
        const data = Buffer.from(instruction.data)
        return data.length === expectedLength && data.subarray(0, spec.discriminator.length).equals(spec.discriminator)
      })
      if (!matchesInstruction) {
        return json({ classification: 'OPAQUE', error: `catalog entry ${catalogKey} does not exactly match an instruction in this transaction` }, 422)
      }

      const state = loadArtifacts(env)
      const artifact = state.solana.get(catalogKey)
      if (!artifact) return json({ classification: 'UNAVAILABLE', error: 'No active offline-signed Solana artifact for this reviewed shape' }, 503)
      if (message.altEntries.length > 0) return json({
        classification: 'UNAVAILABLE',
        error: 'Lookup-table transactions require a transaction-bound account proof; the static artifact service has no online signing key',
      }, 503)
      return json({
        success: true, classification: 'VERIFIED', schema: artifact.schema,
        certificate: artifact.certificate, alias: artifact.certificateInfo.alias,
        fingerprint: ALPHA_DELEGATE_FINGERPRINT, transactionShape: message.version,
        lookupTableCount: 0, provenance: PROVENANCE,
      })
    }
    return json({ error: 'not found' }, 404)
  },
}
