/**
 * Risk level for a signing request, in plain English, derived ONLY from facts
 * in the payload.
 *
 * Purpose: stop "every request is red" desensitization. A text login, a
 * fee-only game move and a transaction that can move your SOL must not look
 * the same. Every level comes with the sentences that produced it, so the bar
 * is never a black box.
 *
 * Rules for future inputs (simulation, Pioneer reputation, AI review): they may
 * RAISE the level or add reasons; they must never lower a level set here.
 *
 * This runs on the host. It is "checked on this computer", not "verified" —
 * the device screen stays the authority.
 */
import type { SigningRequestInfo, SolanaTxDecodedInstruction } from './types'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export interface RiskReason { level: RiskLevel; text: string }
export interface RiskAssessment { level: RiskLevel; headline: string; reasons: RiskReason[] }

const ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical']
const HEADLINE: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Check before you sign',
  high: 'High risk: only sign if you trust this site',
  critical: 'Danger: reject unless you are certain',
}
const U64_MAX = (1n << 64n) - 1n

export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a)

function units(raw: string, decimals: number): string {
  const v = BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${(v / base).toLocaleString('en-US')}${frac ? `.${frac}` : ''}`
}

const arg = (ix: SolanaTxDecodedInstruction, name: string) => ix.args.find((a) => a.name === name)?.value
const acct = (ix: SolanaTxDecodedInstruction, label: string) => ix.accounts.find((a) => a.label === label)?.pubkey

/** Plain sentence for an instruction KeepKey fully understands, or null. */
function describeKnown(ix: SolanaTxDecodedInstruction): RiskReason | null {
  const name = ix.instructionName
  if (ix.programName === 'System Program' && name === 'transfer') {
    const to = acct(ix, 'destination')
    return { level: 'low', text: `Sends ${units(arg(ix, 'lamports') ?? '0', 9)} SOL${to ? ` to ${shortAddr(to)}` : ''}.` }
  }
  if (name === 'transfer' || name === 'transferChecked') {
    const dec = arg(ix, 'decimals')
    const amount = dec ? units(arg(ix, 'amount') ?? '0', Number(dec)) : 'tokens'
    const mint = acct(ix, 'mint')
    return { level: 'low', text: `Sends ${amount}${dec && mint ? ` of token ${shortAddr(mint)}` : ''}.` }
  }
  if (name === 'approve' || name === 'approveChecked') {
    const raw = arg(ix, 'amount') ?? '0'
    const dec = arg(ix, 'decimals')
    const howMuch = BigInt(raw) === U64_MAX ? 'ALL of' : dec ? `up to ${units(raw, Number(dec))} of` : 'some of'
    const who = acct(ix, 'delegate')
    return { level: 'critical', text: `Lets ${who ? shortAddr(who) : 'another account'} spend ${howMuch} your tokens, now and later, without asking you again.` }
  }
  return null
}

/** null = no assessment for this request type yet (bar hidden). */
export function assessSigningRisk(req: SigningRequestInfo): RiskAssessment | null {
  const reasons: RiskReason[] = []
  const add = (level: RiskLevel, text: string) => reasons.push({ level, text })

  if (req.solanaMessageDecoded) {
    const c = req.solanaMessageDecoded.classification
    if (c === 'solana-transaction' || c === 'solana-transaction-message') {
      add('critical', 'This "message" is really a transaction. Signing it could move your money.')
    } else if (c === 'binary-message') {
      add('medium', 'You are signing data that is not readable text. Only the site knows what it means.')
    } else {
      add('low', 'You are signing a text message. It cannot move your money by itself.')
    }
  } else if (req.solanaDecoded) {
    const d = req.solanaDecoded
    const assets = d.assetPrograms ?? []
    const unknown = d.instructions.filter((i) => i.status === 'unknown-program')

    for (const ix of d.instructions) {
      if (ix.status === 'known') {
        const r = describeKnown(ix)
        if (r) reasons.push(r)
      } else if (ix.status === 'known-program-unknown-ix' && assets.includes(ix.programName)) {
        add('high', `Uses a ${ix.programName} action KeepKey does not recognize. It could move your funds or hand over control of them.`)
      }
    }
    for (const key of d.fundedKeysGivenToUnknownProgram ?? []) {
      add('high', `Gives ${shortAddr(key)} permission to act for you in this app. That address can then send transactions without your KeepKey.`)
    }
    if (unknown.length > 0) {
      const apps = [...new Set(unknown.map((i) => i.programName))].join(', ')
      if (assets.length > 0 || d.altResolutionIncomplete) {
        add('high', `Runs app code KeepKey cannot read (${apps}). That code is able to move your SOL or tokens, and nobody can show you how much before you sign.`)
      } else {
        add('medium', `Runs app code KeepKey cannot read (${apps}), but it cannot move your SOL or tokens. You only pay the network fee.`)
      }
    }
    if (d.altResolutionIncomplete) {
      add('high', 'Part of this transaction is hidden and could not be looked up.')
    }
    if (reasons.length === 0) add('low', 'KeepKey can read every step of this transaction.')
  } else if (req.solanaDecodeError || /^\/solana\/sign-(transaction|and-send)/.test(req.method)) {
    add('high', 'KeepKey cannot read this transaction at all. You would be signing blind.')
  } else {
    return null
  }

  const level = reasons.reduce<RiskLevel>(
    (max, r) => (ORDER.indexOf(r.level) > ORDER.indexOf(max) ? r.level : max), 'low')
  // Riskiest sentence first — it is the one the user must not skim past.
  reasons.sort((a, b) => ORDER.indexOf(b.level) - ORDER.indexOf(a.level))
  return { level, headline: HEADLINE[level], reasons }
}
