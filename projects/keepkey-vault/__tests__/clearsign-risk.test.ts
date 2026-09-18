/**
 * Risk bar levels, driven by REAL payloads from a live session
 * (soltoshidice.wtf, 2026-09-17, Vault api_log ids 108386/108402/108426).
 * Expected levels are anchored to what the transactions actually did on
 * mainnet, not to what this code produces:
 *   tx1 4CUN7Bii… — unknown program, System Program present; user paid
 *                   0.00264152 SOL into a new account.
 *   tx2 5ibnS5og… — unknown program (RegisterPokerTournament), no System or
 *                   Token program in the account list; fee only.
 * See docs/clearsign-case-studies/2026-09-17-solana-signmessage-login.md.
 */
import { describe, expect, test } from 'bun:test'
import { buildSolanaDecodedInfo } from '../src/bun/solana-clearsign'
import { buildSolanaMessageDecodedInfo } from '../src/bun/solana-message-preview'
import { parseSolanaTx, solanaMessageSlice } from '../src/bun/solana-tx'
import { assessSigningRisk } from '../src/shared/clearsign-risk'
import type { SigningRequestInfo } from '../src/shared/types'

const LOGIN_MESSAGE_B64 = 'U29sdG9zaGlESUNFIHdhbGxldApOZXR3b3JrOiBtYWlubmV0LWJldGE6Q3VUTHA3cERtTkdrRmdpNGFvaDhFZjFZU2pjMkJ6RUNRUkx6WXFhb1ZXQlI6NG5DbXB3bmU3aENvV1RTcEFkNTR1RU5tQ2dISnJIVHluNERNUENFTXB1bXAKU2Vzc2lvbjogY2E1ZWQ3YTgtNWRmMS00MWJmLTkxY2EtYzNkZTRjMWM1NmY2Ck5vbmNlOiAzN2M0MDY2Ny01NzZkLTQwNTQtOTA2NC02MTg2MTRhYjg4YzE='
const TX1_B64 = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAYJ7Dl5pNxrQBvQRRcaGJ8mhW+rnqt1VgIU+XKy7cFkMA+LZzzaLik+AiCrPgHStY7QVcnBsnYt1RVhKxDKzW40NrgTPK+soJctzdQsxyxkxmokWe10HSLNM0pp7sZO3eosAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAg+JYP7kag/aX3JhxSBLr/9dbITv9zclr5W8RVNHvjowF02rdo/npIS0+fAcrrAThIR97VGw7P8fmeJwQ9+Dk5hH08KOLLv/nnxPfLbW1x5bwW1Qqm7U/+OurmoNbG6qQDBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAALDgivSk/PrRPvj8/Z3HCXXrb8LgSnx2YRVApRzV257QTQBKpt9xx9nI6TgJCP4k4JahDgt0ODAlVydCDyS4WCcCBwAFAjBXBQAIBwAGBAECBQMDE2tr'
const TX2_B64 = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAMF7Dl5pNxrQBvQRRcaGJ8mhW+rnqt1VgIU+XKy7cFkMA+SBSuyLMLvVQz9EGEI1MlPMqG9kd7zy9ZhLt6hHKwPl6Y7uSvSGri0hA8PAemDek6VnFE/45RVFzBlG83Ut0blAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAAD6i7mj/GndyNFb30gki6saw6J1Z/S55kobvO8xLhIbY4xiSIqbqZbckuOiNYzUip23axu1Rxj1/Xqq2y+NQrHuAgMABQLgkwQAAgMABAEIkVzQjkYeoSY='

// Hash Holdem session 2 (api_log 108760 / 108799 / 108805), on-chain outcomes:
//   ENTER   4fdHkmL7… EnterPokerTournament: −10,000 4nCm…pump via CPI TransferChecked
//   SESSION 3XwHPEnT… AuthorizeSession: 0.02 SOL → 6TD5…; 6TD5 then signed game moves alone
//   READY   5q6Aexqe… SetReady: fee only
const ENTER_B64 = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAYL7Dl5pNxrQBvQRRcaGJ8mhW+rnqt1VgIU+XKy7cFkMA8SheB/xXMu5ZIC8NnZz6PE5cL0+ZboF2OXndzp9GPOtJIFK7Iswu9VDP0QYQjUyU8yob2R3vPL1mEu3qEcrA+X6yS/JFhi7aS1IbKNRnwmCKpETc+wyjkUFJMCjqvQl2j8TaJY12piqmoMZB00zvwzyX8LlCTBZ44m7iW0xJt72jgngkHaA8cN0PyIX3rSEjutMrM6VAI0BzmviuXYTKzvRi7VYPgikW++mwY+JAw5bCiMBVvWRcLHmh4LrZ31YmSmO7kr0hq4tIQPDwHpg3pOlZxRP+OUVRcwZRvN1LdG5dYGiIfcl1ZePr3GpIuh3EgIlrbRUzOqy1dSV0dvC54T+ou5o/xp3cjRW99IJIurGsOidWf0ueZKG7zvMS4SG2MG3fbh7nWP3hhCXbzkbM3athr8TYO5DSf+vfko2KGL/GWIlmkQQYD34Y0ANKH4kE4xYcyCyUjyuaArBaJfEJHtAQcKAAkCCAEGAwQFCgmyTrrkDy0EBAA='
const SESSION_B64 = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAMG7Dl5pNxrQBvQRRcaGJ8mhW+rnqt1VgIU+XKy7cFkMA9RAS+mwyauUGfLcy++uAwgs1bYRKJcf0Ul/jg7aZzXI5+gozL5nAZjETjChwnAUfAQmnWnB1NncdEPZ4EYu/l3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmO7kr0hq4tIQPDwHpg3pOlZxRP+OUVRcwZRvN1LdG5dYGiIfcl1ZePr3GpIuh3EgIlrbRUzOqy1dSV0dvC54Tm/IE1cN/Wie7R6ETBuu5G3aXCkSSpSQSChjc6ttOfFECAwIAAQwCAAAAAC0xAQAAAAAEBAAFAgMwu9r7oWMoIiJRAS+mwyauUGfLcy++uAwgs1bYRKJcf0Ul/jg7aZzXI3KcrGoAAAAA'
const READY_B64 = 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAQG7Dl5pNxrQBvQRRcaGJ8mhW+rnqt1VgIU+XKy7cFkMA8SheB/xXMu5ZIC8NnZz6PE5cL0+ZboF2OXndzp9GPOtEYu1WD4IpFvvpsGPiQMOWwojAVb1kXCx5oeC62d9WJkpju5K9IauLSEDw8B6YN6TpWcUT/jlFUXMGUbzdS3RuXWBoiH3JdWXj69xqSLodxICJa20VMzqstXUldHbwueE/qLuaP8ad3I0VvfSCSLqxrDonVn9LnmShu87zEuEhtjKPzWlP+OgoVuVH+GwdxwvA5SdGHTJ55mQY2p9/07oeABAwUABAECBQlpTgeitae6KwE='

const noAlts = async () => { throw new Error('legacy tx must not fetch ALTs') }

async function txRequest(rawB64: string): Promise<SigningRequestInfo> {
  return {
    method: '/solana/sign-transaction',
    solanaDecoded: await buildSolanaDecodedInfo(rawB64, noAlts),
  } as SigningRequestInfo
}

function messageRequest(message: string): SigningRequestInfo {
  return {
    method: '/solana/sign-message',
    solanaMessageDecoded: buildSolanaMessageDecodedInfo(message, { encoding: 'base64' }),
  } as SigningRequestInfo
}

describe('assessSigningRisk — live session payloads', () => {
  test('text login message is LOW: provably not a transaction', () => {
    const r = assessSigningRisk(messageRequest(LOGIN_MESSAGE_B64))!
    expect(r.level).toBe('low')
  })

  test('tx1: unknown program + System Program present is HIGH', async () => {
    const r = assessSigningRisk(await txRequest(TX1_B64))!
    expect(r.level).toBe('high')
    expect(r.reasons[0].text).toContain('able to move your SOL or tokens')
  })

  test('tx2: unknown program, no asset program is MEDIUM', async () => {
    const r = assessSigningRisk(await txRequest(TX2_B64))!
    expect(r.level).toBe('medium')
  })

  test('EnterPokerTournament (took 10,000 tokens via CPI) is HIGH', async () => {
    const r = assessSigningRisk(await txRequest(ENTER_B64))!
    expect(r.level).toBe('high')
    expect(r.reasons[0].text).toContain('nobody can show you how much')
  })

  test('AuthorizeSession: names the amount AND the delegated key', async () => {
    const r = assessSigningRisk(await txRequest(SESSION_B64))!
    expect(r.level).toBe('high')
    const text = r.reasons.map((x) => x.text).join('\n')
    expect(text).toContain('Sends 0.02 SOL to 6TD5…T6kr.')
    expect(text).toContain('Gives 6TD5…T6kr permission to act for you')
  })

  test('SetReady (fee only) is MEDIUM and says so', async () => {
    const r = assessSigningRisk(await txRequest(READY_B64))!
    expect(r.level).toBe('medium')
    expect(r.reasons[0].text).toContain('You only pay the network fee')
  })

  test('tx message bytes submitted as a "message" are CRITICAL', () => {
    const full = Buffer.from(TX2_B64, 'base64')
    const msg = Buffer.from(solanaMessageSlice(full, parseSolanaTx(full))).toString('base64')
    expect(assessSigningRisk(messageRequest(msg))!.level).toBe('critical')
  })
})

describe('assessSigningRisk — rules', () => {
  const base = { method: '/solana/sign-transaction' } as SigningRequestInfo

  test('decode failure is HIGH, never low', () => {
    expect(assessSigningRisk({ ...base, solanaDecodeError: 'SolanaTxParseError: x' })!.level).toBe('high')
  })

  test('token approve is CRITICAL even when fully decoded', () => {
    const r = assessSigningRisk({
      ...base,
      solanaDecoded: {
        version: 'legacy', staticAccountCount: 3, altPubkeys: [],
        assetPrograms: ['SPL Token'],
        instructions: [{
          status: 'known', programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          programName: 'SPL Token', instructionName: 'approve', args: [], accounts: [],
        }],
      },
    })!
    expect(r.level).toBe('critical')
    expect(r.reasons[0].text).toContain('spend some of your tokens')
  })

  test('unlimited approve says ALL', () => {
    const r = assessSigningRisk({
      ...base,
      solanaDecoded: {
        version: 'legacy', staticAccountCount: 3, altPubkeys: [], assetPrograms: ['SPL Token'],
        instructions: [{
          status: 'known', programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', programName: 'SPL Token',
          instructionName: 'approve', args: [{ name: 'amount', type: 'u64', value: '18446744073709551615' }],
          accounts: [{ label: 'delegate', pubkey: 'Hs2VtY9dYU1RsXPn7aJt49pF2MiVh4KAzQq8Eu82BmWa' }],
        }],
      },
    })!
    expect(r.reasons[0].text).toBe('Lets Hs2V…BmWa spend ALL of your tokens, now and later, without asking you again.')
  })

  test('unrecognized instruction on an asset program is HIGH', () => {
    const r = assessSigningRisk({
      ...base,
      solanaDecoded: {
        version: 'legacy', staticAccountCount: 2, altPubkeys: [],
        assetPrograms: ['System Program'],
        instructions: [{
          status: 'known-program-unknown-ix', programId: '11111111111111111111111111111111',
          programName: 'System Program', args: [], accounts: [],
        }],
      },
    })!
    expect(r.level).toBe('high')
  })

  test('unresolved lookup tables are HIGH (hidden accounts)', () => {
    const r = assessSigningRisk({
      ...base,
      solanaDecoded: {
        version: 'v0', staticAccountCount: 2, altPubkeys: ['x'], altResolutionIncomplete: true,
        assetPrograms: [], instructions: [],
      },
    })!
    expect(r.level).toBe('high')
  })

  test('non-Solana requests get no bar yet', () => {
    expect(assessSigningRisk({ method: '/eth/sign-transaction' } as SigningRequestInfo)).toBeNull()
  })
})
