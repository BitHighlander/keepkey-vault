import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

// ERC-20 approve signing must go through ctx.wrapSign, not the wallet directly.
// On the emulator wrapSign is what raises the Confirm/Reject buttons and writes
// the DebugLinkDecision; a bare wallet.ethSignTx() leaves the firmware blocked
// in confirm_helper with no clickable approve button.
describe('swap ERC-20 approve confirm gate', () => {
  const src = readFileSync(new URL('./swap.ts', import.meta.url), 'utf8')

  test('never calls wallet.ethSignTx outside wrapSign', () => {
    expect(src).not.toMatch(/(?<!\(\) => )wallet\.ethSignTx\(/)
  })

  test('both approve sites tag the op so the emulator labels the prompt', () => {
    expect(src.match(/operation: 'erc20Approve'/g)?.length).toBe(2)
  })
})
