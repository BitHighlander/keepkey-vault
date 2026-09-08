import { describe, expect, test } from 'bun:test'
import bs58 from 'bs58'
import { requiresSolanaBlindSigningConsent, solanaSigningRequirements } from '../src/bun/solana-consent'
import { signSolanaWireTransaction } from '../src/bun/solana-signing'
import { SolanaSignRequest } from '../src/bun/schemas'

const SIGNER_0 = Buffer.alloc(32, 0x11)
const SIGNER_1 = Buffer.alloc(32, 0x22)
const NOT_A_SIGNER = Buffer.alloc(32, 0x33)
const ADDRESS_N = [0x8000002c, 0x800001f5, 0x80000000, 0x80000000]

function solanaMessage(signers: Buffer[], versioned = false, instructionCount = 0): Buffer {
  return Buffer.concat([
    ...(versioned ? [Buffer.from([0x80])] : []),
    Buffer.from([signers.length, 0, 0]), // header
    Buffer.from([signers.length]),       // static account count
    ...signers,
    Buffer.alloc(32, 0x44),              // recent blockhash
    Buffer.from([instructionCount]),
    ...Array.from({ length: instructionCount }, () => Buffer.from([0, 0, 0])),
    ...(versioned ? [Buffer.from([0])] : []), // zero ALT entries
  ])
}

function wireTransaction(
  signers = [SIGNER_0],
  options: { versioned?: boolean; signatures?: Buffer[]; instructionCount?: number } = {},
): { rawTx: string; message: Buffer } {
  const message = solanaMessage(signers, options.versioned, options.instructionCount)
  const signatures = options.signatures
    ?? signers.map(() => Buffer.alloc(64))
  return {
    rawTx: Buffer.concat([
      Buffer.from([signers.length]),
      ...signatures,
      message,
    ]).toString('base64'),
    message,
  }
}

describe('Solana transaction signing route', () => {
  test('REST schema preserves a complete descriptor but strips caller-asserted blind consent', () => {
    const lutProof = {
      accounts: [Buffer.alloc(32, 5).toString('base64')],
      signature: Buffer.alloc(64, 1).toString('base64'),
      signerKeyId: 3,
    }
    const parsed = SolanaSignRequest.parse({
      raw_tx: wireTransaction().rawTx,
      addressNList: ADDRESS_N,
      lutProof,
      allowBlindSigning: true,
    })
    expect(parsed.lutProof).toEqual(lutProof)
    expect('allowBlindSigning' in parsed).toBe(false)
  })

  test('REST schema rejects partial, out-of-range, or over-cap descriptors', () => {
    expect(() => SolanaSignRequest.parse({
      raw_tx: wireTransaction().rawTx,
      lutProof: { accounts: ['S0tTT0xTVzE='], signerKeyId: 3 },
    })).toThrow()
    expect(() => SolanaSignRequest.parse({
      raw_tx: wireTransaction().rawTx,
      lutProof: { accounts: ['S0tTT0xTVzE='], signature: 'AA==', signerKeyId: 4 },
    })).toThrow()
    expect(() => SolanaSignRequest.parse({
      raw_tx: wireTransaction().rawTx,
      lutProof: { accounts: Array.from({ length: 9 }, () => 'S0tTT0xTVzE='), signature: 'AA==', signerKeyId: 0 },
    })).toThrow()
    expect(() => SolanaSignRequest.parse({
      raw_tx: wireTransaction().rawTx,
      lutProof: { accounts: ['S0tTT0xTVzE='], signature: 'AA==', signerKeyId: 0x80 }, // certified but no certificate
    })).toThrow()
  })

  test('opaque REST policy requires UI consent unless transaction-bound metadata is present', () => {
    const systemTransfer = {
      version: 'legacy',
      staticAccountCount: 3,
      instructions: [{
        status: 'known',
        programId: '11111111111111111111111111111111',
        programName: 'System Program',
        instructionName: 'transfer',
        args: [],
        accounts: [{ pubkey: 'source' }, { pubkey: 'destination' }],
      }],
      altPubkeys: [],
    } as const
    expect(requiresSolanaBlindSigningConsent(undefined, false)).toBe(true)
    expect(requiresSolanaBlindSigningConsent({
      ...systemTransfer,
      instructions: [{ ...systemTransfer.instructions[0], status: 'unknown-program' }],
    }, false)).toBe(true)
    expect(requiresSolanaBlindSigningConsent(systemTransfer, false)).toBe(false)
    expect(solanaSigningRequirements(systemTransfer, {}, '7.16.0')).toEqual({
      requiresAdvancedMode: false, requiresBlindSigningConsent: false,
    })
    expect(requiresSolanaBlindSigningConsent({
      ...systemTransfer,
      instructions: [{
        ...systemTransfer.instructions[0],
        instructionName: 'createAccount',
      }],
    }, false)).toBe(true)
    expect(requiresSolanaBlindSigningConsent({
      ...systemTransfer,
      instructions: [{
        ...systemTransfer.instructions[0],
        programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        programName: 'SPL Token',
        instructionName: 'transfer',
      }],
    }, false)).toBe(true)
    expect(requiresSolanaBlindSigningConsent({
      ...systemTransfer,
      version: 'v0',
      altPubkeys: ['lookup-table'],
    }, false)).toBe(true)
    expect(requiresSolanaBlindSigningConsent(undefined, true)).toBe(false)
  })

  test('routes v0 through SolanaSignTx, preserves metadata, and keeps host consent off the wire', async () => {
    let deviceRequest: any
    let messageCalls = 0
    const signature = Uint8Array.from({ length: 64 }, (_, i) => i)
    const wallet = {
      solanaSignTx: async (request: any) => {
        deviceRequest = request
        return { signature }
      },
      solanaSignMessage: async () => {
        messageCalls++
        throw new Error('v0 transaction must not use message signing')
      },
    }
    const lutProof = {
      accounts: [Buffer.alloc(32, 5).toString('base64')],
      signature: Buffer.alloc(64, 1).toString('base64'),
      signerKeyId: 1,
    }
    const wire = wireTransaction([SIGNER_0], { versioned: true })
    const unsignedTx = {
      addressNList: ADDRESS_N,
      rawTx: wire.rawTx,
      allowBlindSigning: true,
      lutProof,
    }
    const result = await signSolanaWireTransaction(
      unsignedTx,
      (request) => wallet.solanaSignTx(request),
      async () => bs58.encode(SIGNER_0),
    )

    expect(messageCalls).toBe(0)
    expect(Buffer.from(deviceRequest.rawTx, 'base64')).toEqual(wire.message)
    expect(deviceRequest.allowBlindSigning).toBeUndefined()
    expect(deviceRequest.lutProof).toEqual(lutProof)
    expect(Buffer.from(result.signature)).toEqual(Buffer.from(signature))
    expect(Buffer.from(result.serializedTx, 'base64').subarray(1, 65)).toEqual(Buffer.from(signature))
  })

  test('routes legacy transactions through the same transaction API', async () => {
    let deviceRequest: any
    const wallet = {
      solanaSignTx: async (request: any) => {
        deviceRequest = request
        return { signature: Buffer.alloc(64, 0x7f) }
      },
    }
    const wire = wireTransaction()
    await signSolanaWireTransaction({
      addressNList: ADDRESS_N,
      rawTx: wire.rawTx,
    }, (request) => wallet.solanaSignTx(request), async () => bs58.encode(SIGNER_0))
    expect(Buffer.from(deviceRequest.rawTx, 'base64')).toEqual(wire.message)
  })

  test.each([
    {},
    { lutProof: { accounts: ['account'], signature: 'sig', signerKeyId: 1 } },
    { schema: { payload: 'schema', signature: 'sig', signerKeyId: 1 } },
    { schema: { payload: 'schema', signature: 'sig', signerKeyId: 0x80 } },
  ])('opaque approval requires both device policy and host consent, including uncertified metadata (%j)', metadata => {
    expect(solanaSigningRequirements(undefined, metadata, '7.16.0')).toEqual({
      requiresAdvancedMode: true, requiresBlindSigningConsent: true,
    })
  })

  test('only complete root-certified metadata on supported firmware avoids blind-signing approval', () => {
    const metadata = { schema: { payload: 'schema', signature: 'sig', signerKeyId: 0x80 }, certificate: 'cert' }
    expect(solanaSigningRequirements(undefined, metadata, '7.16.0')).toEqual({
      requiresAdvancedMode: false, requiresBlindSigningConsent: false,
    })
    expect(solanaSigningRequirements(undefined, metadata, '7.14.2')).toEqual({
      requiresAdvancedMode: true, requiresBlindSigningConsent: true,
    })
  })

  test('device policy rejection explains why host consent alone is insufficient', async () => {
    const wire = wireTransaction([SIGNER_0], { versioned: true, instructionCount: 9 })
    const deviceError = { message: { code: 9, message: 'Enable AdvancedMode to blind-sign' } }
    let attempts = 0
    const failure = await signSolanaWireTransaction({
      addressNList: ADDRESS_N, rawTx: wire.rawTx, allowBlindSigning: true,
    }, async (request) => {
      attempts++
      expect(request.allowBlindSigning).toBeUndefined()
      throw deviceError
    }, async () => bs58.encode(SIGNER_0)).catch(err => err)
    expect(attempts).toBe(1)
    expect(failure.status).toBe(409)
    expect(failure.details.code).toBe('SOLANA_ADVANCED_MODE_REQUIRED')
    expect(failure.message).toContain('Allow once approves only this request in Vault')
    expect(failure.cause).toBe(deviceError)
  })

  test.each([
    { code: 3, message: 'Malformed Solana transaction' },
    { message: { code: 3, message: 'Malformed Solana transaction' } },
  ])('explains the 7.14.2 v0 instruction bug after a device rejection (%j)', async (deviceError) => {
    const wire = wireTransaction([SIGNER_0], { versioned: true, instructionCount: 9 })
    let signCalls = 0
    const failure = await signSolanaWireTransaction({
      addressNList: ADDRESS_N, rawTx: wire.rawTx, allowBlindSigning: true,
    }, async (request) => {
      signCalls++
      expect(Buffer.from(request.rawTx, 'base64')).toEqual(wire.message)
      throw deviceError
    }, async () => bs58.encode(SIGNER_0), 'test', () => '7.14.2').catch(err => err)

    expect(signCalls).toBe(1)
    expect(failure.status).toBe(422)
    expect(failure.details).toEqual({
      code: 'SOLANA_FIRMWARE_INSTRUCTION_LIMIT', firmwareVersion: '7.14.2',
      instructionCount: 9, deviceCode: 3,
    })
    expect(failure.message).toContain('Advanced Mode cannot resolve it')
    expect(failure.cause).toBe(deviceError)
  })

  test.each([
    { versioned: true, count: 8, firmware: '7.14.2', code: 3 },
    { versioned: false, count: 9, firmware: '7.14.2', code: 3 },
    { versioned: true, count: 9, firmware: '7.15.0', code: 3 },
    { versioned: true, count: 9, firmware: undefined, code: 3 },
    { versioned: true, count: 9, firmware: '7.14.2', code: 4 },
  ])('preserves unrelated device failures (%j)', async ({ versioned, count, firmware, code }) => {
    const wire = wireTransaction([SIGNER_0], { versioned, instructionCount: count })
    const deviceError = { code, message: 'Malformed Solana transaction' }
    const failure = await signSolanaWireTransaction({
      addressNList: ADDRESS_N, rawTx: wire.rawTx,
    }, async () => { throw deviceError }, async () => bs58.encode(SIGNER_0),
    'test', () => firmware).catch(err => err)
    expect(failure).toBe(deviceError)
  })

  test('allows patched firmware with the same version to sign the unchanged nine-instruction message', async () => {
    const wire = wireTransaction([SIGNER_0], { versioned: true, instructionCount: 9 })
    const signature = Buffer.alloc(64, 0x5a)
    const result = await signSolanaWireTransaction({
      addressNList: ADDRESS_N, rawTx: wire.rawTx,
    }, async (request) => {
      expect(Buffer.from(request.rawTx, 'base64')).toEqual(wire.message)
      return { signature }
    }, async () => bs58.encode(SIGNER_0), 'test', () => '7.14.2')
    expect(Buffer.from(result.serializedTx, 'base64')).toEqual(Buffer.concat([
      Buffer.from([1]), signature, wire.message,
    ]))
  })

  test('multisig signing writes the derived wallet slot and preserves an existing cosigner', async () => {
    const cosignerSignature = Buffer.alloc(64, 0xa5)
    const walletSignature = Buffer.alloc(64, 0x5a)
    const wire = wireTransaction([SIGNER_0, SIGNER_1], {
      signatures: [cosignerSignature, Buffer.alloc(64)],
    })

    const result = await signSolanaWireTransaction({
      addressNList: ADDRESS_N,
      rawTx: wire.rawTx,
    }, async () => ({ signature: walletSignature }), async () => bs58.encode(SIGNER_1))

    const signed = Buffer.from(result.serializedTx, 'base64')
    expect(signed.subarray(1, 65)).toEqual(cosignerSignature)
    expect(signed.subarray(65, 129)).toEqual(walletSignature)
  })

  test('refuses to sign when the derived wallet is not a required signer', async () => {
    let signCalls = 0
    const wire = wireTransaction([SIGNER_0, SIGNER_1])
    await expect(signSolanaWireTransaction({
      addressNList: ADDRESS_N,
      rawTx: wire.rawTx,
    }, async () => {
      signCalls++
      return { signature: Buffer.alloc(64) }
    }, async () => bs58.encode(NOT_A_SIGNER))).rejects.toThrow('not a required transaction signer')
    expect(signCalls).toBe(0)
  })
})
