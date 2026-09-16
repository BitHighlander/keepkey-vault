/**
 * Pending-tx watcher: a broadcast is followed through the indexer until it
 * reaches its confirmation target, the balance resync fires exactly once when
 * it lands in a block, and nothing keeps polling after it settles.
 */
import { describe, test, expect } from 'bun:test'
import { createTxWatch, RESCAN_DELAYS_MS, UNSEEN_GIVE_UP_MS } from '../src/bun/tx-watch'
import type { RecentActivity } from '../src/shared/types'

const row = (txid: string, confirmations?: number): RecentActivity => ({
  id: txid, txid, chain: 'BTC', chainId: 'bitcoin', type: 'send', source: 'scan', status: 'broadcast', createdAt: 0, confirmations,
})

type Timer = { fn: () => void; due: number; cleared?: boolean }

function harness(scanChain: (chainId: string) => Promise<RecentActivity[]>) {
  let clock = 0
  const timers: Timer[] = []
  const confirmed: string[] = []
  const w = createTxWatch({
    scanChain,
    onConfirmed: (chainId, txid) => confirmed.push(`${chainId}:${txid}`),
    requiredConfs: () => 6,
    setTimer: (fn, ms) => { const t: Timer = { fn, due: clock + ms }; timers.push(t); return t },
    clearTimer: (t) => { (t as Timer).cleared = true },
    now: () => clock,
  })
  const flush = () => new Promise(r => setTimeout(r, 0))
  /** Fire the earliest live timer and let its scan settle; returns its delay, or null when idle. */
  async function tick(): Promise<number | null> {
    const next = timers.filter(t => !t.cleared).sort((a, b) => a.due - b.due)[0]
    if (!next) return null
    next.cleared = true
    const delay = next.due - clock
    clock = Math.max(clock, next.due) // a test may have advanced past it
    next.fn()
    await flush()
    return delay
  }
  return { w, tick, flush, confirmed, advance: (ms: number) => { clock += ms } }
}

function scripted(results: Array<RecentActivity[] | Error>) {
  return async () => {
    const r = results.shift()
    if (r instanceof Error) throw r
    return r ?? []
  }
}

describe('tx-watch', () => {
  test('follows a broadcast unseen → mempool → block → target, then stops', async () => {
    const h = harness(scripted([[], [row('a', 0)], [row('a', 1)], [row('a', 6)]]))
    h.w.watch('bitcoin', 'a')
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[0]) // unseen
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[1]) // mempool, 0 confs
    expect(h.confirmed).toEqual([])
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[2]) // in a block
    expect(h.confirmed).toEqual(['bitcoin:a'])
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[3]) // reached target
    expect(h.confirmed).toEqual(['bitcoin:a']) // balance resync fired once, not per confirmation
    expect(h.w.size()).toBe(0)
    expect(await h.tick()).toBeNull() // no more polling
  })

  test('history without confirmation data counts as final on first sighting', async () => {
    const h = harness(scripted([[row('b', undefined)]]))
    h.w.watch('bitcoin', 'b')
    await h.tick()
    expect(h.confirmed).toEqual(['bitcoin:b'])
    expect(h.w.size()).toBe(0)
    expect(await h.tick()).toBeNull()
  })

  test('gives up on a tx that never shows up in history', async () => {
    const h = harness(scripted([]))
    h.w.watch('bitcoin', 'c')
    await h.tick()
    expect(h.w.size()).toBe(1)
    h.advance(UNSEEN_GIVE_UP_MS)
    await h.tick()
    expect(h.w.size()).toBe(0)
    expect(await h.tick()).toBeNull()
  })

  test('a failed scan backs off and retries', async () => {
    const h = harness(scripted([new Error('pioneer down'), [row('d', 6)]]))
    h.w.watch('bitcoin', 'd')
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[0])
    expect(h.w.size()).toBe(1)
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[1])
    expect(h.confirmed).toEqual(['bitcoin:d'])
    expect(h.w.size()).toBe(0)
  })

  test('clear() discards a scan still in flight and schedules nothing', async () => {
    let release!: (rows: RecentActivity[]) => void
    const h = harness(() => new Promise(r => { release = r }))
    h.w.watch('bitcoin', 'e')
    const firing = h.tick()
    h.w.clear() // disconnect / wallet switch mid-scan
    release([row('e', 1)])
    await firing
    await h.flush()
    expect(h.confirmed).toEqual([])
    expect(h.w.size()).toBe(0)
    expect(await h.tick()).toBeNull()
  })

  test('a tx watched while a pre-clear() scan still holds the chain is not stranded', async () => {
    const pending: Array<(rows: RecentActivity[]) => void> = []
    const h = harness(() => new Promise(r => { pending.push(r) }))
    h.w.watch('bitcoin', 'old')
    const stale = h.tick()        // S1 in flight
    h.w.clear()                   // unplug / passphrase switch
    h.w.watch('bitcoin', 'new')   // new session sends on the same chain
    await h.tick()                // its timer fires while S1 still runs → folded into a rerun
    pending[0]([])                // S1 finally resolves
    await stale
    await h.flush()
    expect(await h.tick()).toBe(0) // rerun scheduled immediately instead of lost
    pending[1]([row('new', 6)])
    await h.flush()
    expect(h.confirmed).toEqual(['bitcoin:new'])
    expect(h.w.size()).toBe(0)
  })

  test('a new tx pulls a slow queued rescan forward', async () => {
    const h = harness(scripted([]))
    h.w.watch('bitcoin', 'f')
    await h.tick() // unseen → next scan queued at +15s
    h.w.watch('bitcoin', 'g')
    expect(await h.tick()).toBe(RESCAN_DELAYS_MS[0])
  })
})
