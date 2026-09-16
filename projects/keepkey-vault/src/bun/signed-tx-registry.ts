/**
 * Which txs this vault signed over REST, and in which wallet session.
 *
 * /api/v2/tx/broadcast lists a broadcast as wallet activity only for a tx
 * signed HERE in the CURRENT session: a hidden-session tx broadcast after
 * switching to the standard wallet — or a tx the device never signed, relayed
 * through this port — must not land in that wallet's history (activity rows
 * are never pruned).
 */
const MAX_ENTRIES = 200
// A signed tx and a signature are both >= 64 bytes; shorter strings are noise.
const MIN_HEX = 128

function toHex(v: unknown): string | undefined {
  if (v instanceof Uint8Array) return Buffer.from(v).toString('hex')
  if (typeof v !== 'string' || !v) return undefined
  const hex = v.replace(/^0x/i, '')
  if (/^[0-9a-f]+$/i.test(hex)) return hex.toLowerCase()
  if (/^[A-Za-z0-9+/_-]+=*$/.test(v)) return Buffer.from(v, 'base64').toString('hex')
  return undefined
}

export function createSignedTxRegistry() {
  const txs = new Map<string, number | undefined>()  // serialized tx (hex) → session
  const sigs = new Map<string, number | undefined>() // signature (hex) → session
  const put = (m: Map<string, number | undefined>, key: string | undefined, session: number | undefined) => {
    if (!key || key.length < MIN_HEX) return
    m.delete(key) // re-insert = newest
    m.set(key, session)
    if (m.size > MAX_ENTRIES) m.delete(m.keys().next().value!)
  }
  return {
    /** Record a signing route's response. Signed OUTPUT fields only — never
     *  request echoes (cosmos returns the whole sign doc, memo included, as `signed`). */
    remember(data: any, session: number | undefined): void {
      const xrp = data?.value?.signatures?.[0] // hdwallet XRP StdTx
      for (const tx of [data?.serialized, data?.serializedTx, data?.serialized_tx, data?.signedTx, xrp?.serializedTx]) put(txs, toHex(tx), session)
      // TRON / TON clients assemble the broadcast envelope themselves: only the
      // signature is common to what we signed and what they broadcast.
      for (const sig of [data?.signature, xrp?.signature]) put(sigs, toHex(sig), session)
    },
    /** Did this vault sign `serialized` — or the signature inside it — in `session`? */
    signedIn(serialized: string, session: number | undefined): boolean {
      const hex = toHex(serialized)
      if (hex && txs.has(hex) && txs.get(hex) === session) return true
      const hay = `${serialized.toLowerCase()}|${hex ?? ''}`
      for (const [sig, s] of sigs) if (s === session && hay.includes(sig)) return true
      return false
    },
  }
}
