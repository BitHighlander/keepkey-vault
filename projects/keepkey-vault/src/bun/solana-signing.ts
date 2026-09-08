import bs58 from 'bs58'
import {
  parseSolanaMessage,
  parseSolanaTx,
  solanaMessageSlice,
  SolanaTxParseError,
} from './solana-tx'
import { prepareSolanaX402DeviceMetadata } from './solana-x402'

export type SolanaDeviceSigner = (params: any) => Promise<any>
export type SolanaAddressDeriver = (addressNList: number[]) => Promise<string>

class SolanaFirmwareInstructionLimitError extends Error {
  readonly status = 422
  readonly details: { code: string; firmwareVersion: string; instructionCount: number; deviceCode: number }

  constructor(firmwareVersion: string, instructionCount: number, cause: unknown) {
    super(
      `KeepKey firmware ${firmwareVersion} rejected this v0 Solana transaction with ${instructionCount} instructions. ` +
      'This matches a firmware parser bug affecting transactions with more than 8 instructions. ' +
      'Advanced Mode cannot resolve it. Install firmware containing the Solana instruction-parser fix, then request a fresh transaction.',
      { cause },
    )
    this.name = 'SolanaFirmwareInstructionLimitError'
    this.details = { code: 'SOLANA_FIRMWARE_INSTRUCTION_LIMIT', firmwareVersion, instructionCount, deviceCode: 3 }
  }
}

/**
 * Route a serialized Solana transaction through the transaction-specific
 * firmware message and splice the returned signature into the original wire
 * transaction. The device receives the exact legacy/v0 message bytes, while
 * metadata is forwarded unchanged. Host consent never overrides device policy.
 */
export async function signSolanaWireTransaction(
  unsignedTx: any,
  signWithDevice: SolanaDeviceSigner,
  deriveSignerAddress: SolanaAddressDeriver,
  logPrefix = 'signTx:solana',
  getFirmwareVersion?: () => string | undefined | Promise<string | undefined>,
): Promise<any> {
  const fullTx = Buffer.from(
    typeof unsignedTx.rawTx === 'string'
      ? unsignedTx.rawTx
      : Buffer.from(unsignedTx.rawTx).toString('base64'),
    'base64',
  )

  let parsed
  try {
    parsed = parseSolanaTx(fullTx)
  } catch (err) {
    if (err instanceof SolanaTxParseError) throw new Error(`[${logPrefix}] ${err.message}`)
    throw err
  }

  const messageBytes = solanaMessageSlice(fullTx, parsed)
  const message = parseSolanaMessage(messageBytes)
  if (message.header.numRequiredSignatures !== parsed.sigCount) {
    throw new Error(
      `[${logPrefix}] Signature count mismatch: wrapper declares ${parsed.sigCount}, ` +
      `message requires ${message.header.numRequiredSignatures}`,
    )
  }

  const addressNList = unsignedTx.addressNList || unsignedTx.address_n
  if (!Array.isArray(addressNList)) {
    throw new Error(`[${logPrefix}] addressNList is required to select the signer slot`)
  }
  const signerAddress = await deriveSignerAddress(addressNList)
  let signerPublicKey: Uint8Array
  try {
    signerPublicKey = bs58.decode(signerAddress)
  } catch {
    throw new Error(`[${logPrefix}] Invalid derived signer address`)
  }
  if (signerPublicKey.length !== 32) {
    throw new Error(
      `[${logPrefix}] Invalid derived signer address length ${signerPublicKey.length} (expected 32)`,
    )
  }

  // Required signers are the first N static message accounts. Find the slot
  // belonging to this address before asking the device to sign; slot zero may
  // already contain a cosigner signature in a multisig transaction.
  const signerIndex = message.staticAccounts
    .slice(0, message.header.numRequiredSignatures)
    .findIndex((account) => Buffer.from(account).equals(Buffer.from(signerPublicKey)))
  if (signerIndex < 0) {
    throw new Error(
      `[${logPrefix}] Derived wallet account ${signerAddress} is not a required transaction signer`,
    )
  }

  const x402Metadata = unsignedTx.x402
    ? prepareSolanaX402DeviceMetadata(message, unsignedTx.x402, signerPublicKey)
    : undefined
  const { allowBlindSigning: _hostConsent, ...transactionParams } = unsignedTx
  const deviceParams = {
    ...transactionParams,
    ...(x402Metadata || {}),
    rawTx: Buffer.from(messageBytes).toString('base64'),
  }
  console.info(
    `[${logPrefix}] routing ${parsed.isVersioned ? 'v0' : 'legacy'} transaction ` +
    `through SolanaSignTx (${messageBytes.length}B message, ` +
    `${message.instructions.length} instructions, ${message.altEntries.length} lookup tables)`,
  )

  let result
  try {
    result = await signWithDevice(deviceParams)
  } catch (cause: any) {
    const deviceMessage = cause?.message?.message ?? cause?.message
    const deviceCode = cause?.message?.code ?? cause?.code
    if (deviceCode === 9 && deviceMessage === 'Enable AdvancedMode to blind-sign') {
      throw Object.assign(new Error(
        'Advanced Mode is off on the selected KeepKey or emulator. Enable it in Vault and confirm on the device, ' +
        'then retry. Allow once approves only this request in Vault.',
        { cause },
      ), { status: 409, details: { code: 'SOLANA_ADVANCED_MODE_REQUIRED', deviceCode: 9 } })
    }
    // Diagnose only after the device rejects a host-parsed message. Patched
    // firmware using the same version string must still be allowed to sign.
    // Keep this specific to the reproduced no-LUT, <=32-account 7.14.2 case;
    // other malformed responses may have unrelated causes.
    if (deviceCode === 3 && deviceMessage === 'Malformed Solana transaction' &&
        message.version === 'v0' && message.instructions.length > 8 &&
        message.staticAccounts.length <= 32 && message.altEntries.length === 0) {
      let firmwareVersion: string | undefined
      try { firmwareVersion = await getFirmwareVersion?.() } catch { /* preserve original failure */ }
      if (firmwareVersion && /^v?7\.14\.2(?:[-+].*)?$/.test(firmwareVersion)) {
        throw new SolanaFirmwareInstructionLimitError(firmwareVersion, message.instructions.length, cause)
      }
    }
    throw cause
  }
  if (!result?.signature) return result

  const sigBytes: Uint8Array = result.signature instanceof Uint8Array
    ? result.signature
    : Buffer.from(result.signature, 'base64')
  if (sigBytes.length !== 64) {
    throw new Error(`[${logPrefix}] Unexpected signature length ${sigBytes.length}`)
  }

  const rawBytes = Buffer.from(fullTx)
  const slotOffset = parsed.sigStart + signerIndex * 64
  if (rawBytes.length < slotOffset + 64) {
    throw new Error(`[${logPrefix}] Raw tx too short to hold signer slot ${signerIndex}`)
  }
  for (let i = 0; i < 64; i++) rawBytes[slotOffset + i] = sigBytes[i]

  console.info(`[${logPrefix}] signed transaction assembled (${rawBytes.length}B); returning to caller for broadcast`)

  return {
    signature: sigBytes,
    serializedTx: rawBytes.toString('base64'),
  }
}
