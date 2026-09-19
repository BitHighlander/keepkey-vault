/**
 * Host mirror of the firmware's certified Solana schema rule.
 *
 * On the certified path the device has no blind-sign fallback: an envelope
 * whose schema does not apply fails with "Certified Solana schema does not
 * match transaction", even when the opaque path (one-shot consent plus
 * AdvancedMode) could have signed the same bytes. Vault and the ClearSign
 * Worker therefore certify a transaction only when this rule holds, and
 * otherwise leave it on the opaque path.
 *
 * Mirrors keepkey-firmware lib/firmware/solana.c (feat/solana-schema-v2):
 * parse_instruction_section, schema_applies(certified = true),
 * solana_schemaCompanionIsInert, and the account bounds solana_parseLegacyTx
 * and solana_parseVersionedTx enforce under a trusted LUT. Keep them in sync.
 * schema_applies also skips instructions the firmware decodes natively; no
 * catalog program is one of those (System, SPL Token, Token-2022, Stake,
 * Vote, ATA, ComputeBudget, Memo).
 */
import bs58 from 'bs58'

import {
  ARG_TOKEN_AMOUNT,
  solanaSchemaCoverage,
  type SolanaSchemaSpec,
} from './solana-certified-schema'
import type { ParsedSolanaMessage, SolanaInstruction } from './solana-tx'

/** SOL_MAX_INSTRUCTIONS: a longer message parses with no instructions at all. */
const SOL_MAX_INSTRUCTIONS = 8
/** SOL_MAX_ACCOUNTS (static plus trusted LUT keys) and SOL_MAX_LUT_ACCOUNTS. */
const SOL_MAX_ACCOUNTS = 32
const SOL_MAX_LUT_ACCOUNTS = 8

const SYSTEM_PROGRAM = bs58.decode('11111111111111111111111111111111')
const COMPUTE_BUDGET_PROGRAM = bs58.decode('ComputeBudget111111111111111111111111111111')
const MEMO_PROGRAM = bs58.decode('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const SYS_TRANSFER = 2

/** Byte equality over anything indexable, so a Buffer and a Uint8Array compare. */
function sameBytes(a: ArrayLike<number> | undefined, b: ArrayLike<number>): boolean {
  if (a === undefined || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * The instruction shape a schema describes: its program, discriminator, exact
 * data length (no uncovered bytes), and every displayed account and every
 * TOKEN_AMOUNT mint account present in the instruction.
 */
export function solanaInstructionMatchesSchema(
  message: ParsedSolanaMessage,
  instruction: SolanaInstruction,
  spec: SolanaSchemaSpec,
): boolean {
  const data = instruction.data
  const accounts = instruction.accountIndices.length
  return sameBytes(message.staticAccounts[instruction.programIdIndex], bs58.decode(spec.programId))
    && data.length === solanaSchemaCoverage(spec)
    && sameBytes(data.subarray(0, spec.discriminator.length), spec.discriminator)
    && (spec.accounts || []).every((account) => account.index < accounts)
    && (spec.args || []).every((arg) => arg.type !== ARG_TOKEN_AMOUNT || arg.mintAccount! < accounts)
}

/**
 * An instruction the certified review allows beside the described one:
 * ComputeBudget RequestHeapFrame (1), SetComputeUnitLimit (2), or
 * SetLoadedAccountsDataSizeLimit (4) with 5 bytes, SetComputeUnitPrice (3)
 * with 9 bytes, any Memo, or an exact System Transfer (u32 tag 2, 12 bytes,
 * 2 accounts) whose accounts are static message accounts, never LUT-resolved.
 * The certified review screens that transfer in full.
 */
function isCertifiedCompanion(message: ParsedSolanaMessage, instruction: SolanaInstruction): boolean {
  const program = message.staticAccounts[instruction.programIdIndex]
  const data = Buffer.from(instruction.data)
  if (sameBytes(program, COMPUTE_BUDGET_PROGRAM)) {
    return (data.length === 5 && [1, 2, 4].includes(data[0])) || (data.length === 9 && data[0] === 3)
  }
  if (sameBytes(program, MEMO_PROGRAM)) return true
  if (sameBytes(program, SYSTEM_PROGRAM)) {
    return data.length === 12
      && data.readUInt32LE(0) === SYS_TRANSFER
      && instruction.accountIndices.length === 2
      && instruction.accountIndices.every((index) => index < message.staticAccounts.length)
  }
  return false
}

/** The device indexes the static accounts, then one key per serialized LUT index. */
function withinCertifiedAccountBounds(message: ParsedSolanaMessage): boolean {
  const lutAccounts = message.altEntries.reduce(
    (count, entry) => count + entry.writableIndices.length + entry.readonlyIndices.length, 0)
  const total = message.staticAccounts.length + lutAccounts
  if (total > SOL_MAX_ACCOUNTS || lutAccounts > SOL_MAX_LUT_ACCOUNTS) return false
  // Lookup tables require a nonempty certified LUT proof.
  if (message.altEntries.length > 0 && lutAccounts === 0) return false
  return message.instructions.every((instruction) =>
    instruction.programIdIndex < total && instruction.accountIndices.every((index) => index < total))
}

/**
 * Firmware's certified rule for one schema: the index of the single
 * instruction `spec` describes when the device will apply it to this message,
 * else undefined. At most 8 instructions, exactly one match, and every other
 * instruction a certified companion.
 */
export function certifiedSolanaSchemaApplies(
  message: ParsedSolanaMessage,
  spec: SolanaSchemaSpec,
): number | undefined {
  if (message.instructions.length > SOL_MAX_INSTRUCTIONS || !withinCertifiedAccountBounds(message)) {
    return undefined
  }
  const matches = message.instructions.flatMap((instruction, index) =>
    solanaInstructionMatchesSchema(message, instruction, spec) ? [index] : [])
  if (matches.length !== 1) return undefined
  const [match] = matches
  return message.instructions.every((instruction, index) =>
    index === match || isCertifiedCompanion(message, instruction))
    ? match
    : undefined
}
