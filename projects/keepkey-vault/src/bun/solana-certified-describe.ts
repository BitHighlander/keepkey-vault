/**
 * Read back, in human terms, the ONE instruction a certified ClearSign
 * envelope describes.
 *
 * WHAT THE SIGNATURE COVERS, exactly: the delegate signs a KKSOLSC1 payload —
 * a program id, a discriminator, a program name, an instruction name, and the
 * ordered list of argument types and labels. Nothing else. The values below are
 * read out of the transaction's own bytes at the offsets that layout fixes, so
 * they are the same values the device reads and shows. What the program then
 * DOES with them, and which accounts it moves funds between, is not in the
 * schema and must never be presented as if it were.
 *
 * The description is built from the LOCAL catalog entry and only after the
 * envelope's schema payload is confirmed to be that entry's exact
 * serialization — so what the vault renders is what was signed, not what a
 * service said.
 */
import bs58 from 'bs58'

import { certifiedSolanaSchemaApplies, findLocalCertifiedSolanaMatch } from './solana-certified-match'
import {
  ARG_DURATION,
  ARG_LAMPORTS,
  ARG_PUBKEY,
  ARG_TOKEN_AMOUNT,
  ARG_U64,
  ARG_U8,
  ARG_WIDTH,
  serializeSolanaSchema,
  type SolanaSchemaArg,
} from './solana-certified-schema'
import type { CertifiedSolanaProof } from './solana-certified-registry'
import { parseSolanaMessage, parseSolanaTx, solanaMessageSlice, type ParsedSolanaMessage } from './solana-tx'
import type { SolanaCertifiedArg, SolanaCertifiedDescription } from '../shared/types'

/** The account at an expanded index: static keys first, then the trusted LUT
 *  proof's keys — the order the firmware indexes them in. */
function accountAt(message: ParsedSolanaMessage, proof: CertifiedSolanaProof, index: number): string | undefined {
  const statics = message.staticAccounts
  if (index < statics.length) return bs58.encode(statics[index])
  const lut = proof.lutProof?.accounts[index - statics.length]
  return lut ? bs58.encode(Uint8Array.from(Buffer.from(lut, 'base64'))) : undefined
}

function readArg(
  data: Buffer,
  offset: number,
  arg: SolanaSchemaArg,
  accounts: (position: number) => string | undefined,
  proof: CertifiedSolanaProof,
): SolanaCertifiedArg {
  const base = { label: arg.label }
  switch (arg.type) {
    case ARG_U8:
      return { ...base, kind: 'number', raw: String(data.readUInt8(offset)) }
    case ARG_U64:
      return { ...base, kind: 'number', raw: data.readBigUInt64LE(offset).toString() }
    case ARG_LAMPORTS:
      return { ...base, kind: 'sol', raw: data.readBigUInt64LE(offset).toString() }
    case ARG_DURATION:
      return { ...base, kind: 'duration', raw: data.readBigUInt64LE(offset).toString() }
    case ARG_PUBKEY:
      return { ...base, kind: 'pubkey', raw: bs58.encode(Uint8Array.from(data.subarray(offset, offset + 32))) }
    case ARG_TOKEN_AMOUNT: {
      const mint = accounts(arg.mintAccount!)
      // Identity only from the delegate's own token attestation for this exact
      // mint. A ticker from anywhere else is how a fake token gets a trusted
      // name, so without one the amount stays in raw base units.
      const attested = mint ? proof.tokenInfo?.find((t) => t.mint === mint) : undefined
      return {
        ...base,
        kind: 'token',
        raw: data.readBigUInt64LE(offset).toString(),
        ...(mint ? { mint } : {}),
        ...(attested ? { symbol: attested.symbol, decimals: attested.decimals } : {}),
      }
    }
    default:
      return { ...base, kind: 'opaque', raw: data.subarray(offset, offset + ARG_WIDTH[arg.type]).toString('hex') }
  }
}

/**
 * The certified description of `rawTxBase64` under `proof`, or undefined when
 * this vault cannot show that the two belong together.
 *
 * Returns nothing rather than a guess: no local catalog match, a schema payload
 * that is not that entry's serialization, or an envelope the firmware's own
 * rule would not apply all mean there is nothing certified to show.
 */
export function describeCertifiedSolanaTransaction(
  rawTxBase64: string,
  proof: CertifiedSolanaProof,
): SolanaCertifiedDescription | undefined {
  let message: ParsedSolanaMessage
  try {
    const fullTx = Uint8Array.from(Buffer.from(rawTxBase64, 'base64'))
    message = parseSolanaMessage(solanaMessageSlice(fullTx, parseSolanaTx(fullTx)))
  } catch {
    return undefined
  }
  const match = findLocalCertifiedSolanaMatch(message)
  if (!match) return undefined
  const { spec } = match
  if (proof.schema.payload.toLowerCase() !== serializeSolanaSchema(spec).toString('hex')) return undefined

  // The instruction the DEVICE will describe, under the same rule and the same
  // LUT proof it will be handed — not the one a proofless local match picked.
  const index = certifiedSolanaSchemaApplies(message, spec, proof.lutProof?.accounts.length ?? 0)
  if (index === undefined) return undefined
  const instruction = message.instructions[index]
  const data = Buffer.from(instruction.data)

  const args: SolanaCertifiedArg[] = []
  let offset = spec.discriminator.length
  for (const arg of spec.args ?? []) {
    args.push(readArg(data, offset, arg,
      (position) => accountAt(message, proof, instruction.accountIndices[position]), proof))
    offset += ARG_WIDTH[arg.type]
  }

  return {
    programId: spec.programId,
    programName: spec.programName,
    instructionName: spec.instructionName,
    args,
  }
}
