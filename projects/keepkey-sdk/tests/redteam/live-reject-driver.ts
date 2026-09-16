/** macOS-only, sign-only live QA driver for the historical THORChain mutations.
 * It advances only to a named mismatch, captures every preceding OLED page,
 * and rejects on-device. It never calls a broadcast endpoint. Evidence stays
 * under ~/.keepkey/qa-evidence. Run with Bun from the SDK directory. */
import { Database } from 'bun:sqlite'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const mutation = process.argv[2]
const clearSign = mutation === 'clear'
const targets: Record<string, { vault: string; device: RegExp }> = {
  'min-streaming': { vault: 'Every 1 block; network chooses swap count', device: /Network chooses swap count/i },
  // Vision confuses the OLED's tiny "99 swaps" glyphs as "9S SWaDS";
  // the PNG is retained for the required human review.
  'streaming-99': { vault: 'Every 1 block; 99 swaps', device: /THORCHAIN STREAMING[\s\S]*Every 1 block[\s\S]*(?:99 swaps|9S SWaDS)/i },
  'output-asset-eth': { vault: 'ETH.ETH', device: /Confirm swap asset[\s\S]*ETH\s+on chain ETH/i },
  'output-contract-fake': { vault: 'USDC-0x1111111111111111111111111111111111111111', device: /USDC-0X111111/i },
  'output-chain-eth': { vault: 'Output chain\nETH', device: /on chain ETH/i },
  'destination-substitution': { vault: '0x1111111111111111111111111111111111111111', device: /Confirm to 0x1111/i },
  'affiliate-fee-1000': { vault: '10.00% (1000 bps)', device: /Affiliate fee 10\.00%/i },
}

const sdkDir = resolve(import.meta.dir, '../..')
const ax = join(import.meta.dir, 'ax-ui.swift-source')
const ocr = join(import.meta.dir, 'ocr-oled.swift-source')
const swift = (source: string, args: string[]) => execFileSync('swift', ['-', ...args], { input: readFileSync(source), encoding: 'utf8' })
const fixture = process.env.KEEPKEY_HISTORY_FIXTURE || join(homedir(), '.keepkey/qa-evidence/historical-thor-eth-usdt.json')
const fixtureDoc = JSON.parse(readFileSync(fixture, 'utf8'))
const erc20Input = !!fixtureDoc.transaction && ['USDC', 'USDT'].includes(fixtureDoc.history?.from_symbol)
const history = (erc20Input ? fixtureDoc.history : fixtureDoc) as { id: string; from_symbol?: string; from_amount: string; minimum_output: string; memo: string; router: string; inbound_address: string }
const memoParts = history.memo.split(':')
const displayAmount = history.from_amount.includes('.')
  ? history.from_amount.replace(/0+$/, '').replace(/\.$/, '') : history.from_amount
const outputParts = /^([A-Z0-9]+)\.([A-Z0-9]+)/.exec(memoParts[1] || '')
const outputChain = outputParts?.[1]
const outputSymbol = outputParts?.[2]
if (!outputChain || !outputSymbol || !/^0x[\da-f]{40}$/i.test(history.router) || !/^0x[\da-f]{40}$/i.test(history.inbound_address))
  throw new Error('Fixture is not a supported Ethereum THORChain swap')
if (erc20Input) {
  const escaped = displayAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  targets['input-token-usdc'] = { vault: `Input amount\n${displayAmount} USDC`, device: new RegExp(`Confirm sending ${escaped} USDC`, 'i') }
  const [whole, fraction = ''] = history.from_amount.split('.')
  const micro = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))
  const tenfold = micro * 10n
  const amount = `${tenfold / 1000000n}.${(tenfold % 1000000n).toString().padStart(6, '0')}`.replace(/\.?0+$/, '')
  targets['input-amount-tenfold'] = { vault: `Input amount\n${amount} ${history.from_symbol}`, device: new RegExp(`Confirm sending ${amount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ${history.from_symbol}`, 'i') }
  targets['destination-system'] = { vault: 'Output destination\n11111111111111111111111111111111', device: /Confirm to[\s\S]*1111111111/i }
}
targets['min-zero'] = { vault: `Minimum output\n0 ${outputSymbol}`, device: new RegExp(`Minimum output 0 ${outputSymbol}`, 'i') }
targets['min-scientific'] = { vault: `Minimum output\n1 ${outputSymbol}`, device: new RegExp(`Minimum output 1 ${outputSymbol}`, 'i') }
if (!clearSign && !targets[mutation]) throw new Error('Use clear or one of: ' + Object.keys(targets).join(', '))
const evidenceDir = join(homedir(), '.keepkey/qa-evidence', `driver-${mutation}-${Date.now()}`)
mkdirSync(evidenceDir, { recursive: true })
const db = new Database(process.env.KEEPKEY_VAULT_DB || join(homedir(), 'Library/Application Support/com.keepkey.vault/dev/vault.db'), { readonly: true })
const pairing = db.query('SELECT api_key FROM paired_apps WHERE name = ? ORDER BY last_used_on DESC LIMIT 1').get('KeepKey SDK Tests') as { api_key?: string } | null
if (!pairing?.api_key) throw new Error('Existing SDK pairing unavailable')
const bearer = pairing.api_key
const pid = Number(execFileSync('lsof', ['-tiTCP:1646', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim())
if (!Number.isInteger(pid)) throw new Error('Vault REST listener not found')
const axCall = (title: string, button: string, action: string) => swift(ax, [String(pid), title, button, action])
const vault = () => axCall('KeepKey Vault v1.5.6', '*', 'dumptext')
const press = (title: string, button: string) => axCall(title, button, 'press')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

if (!vault().includes('connected') || vault().includes('ACTION REQUIRED')) throw new Error('Emulator is not idle and connected')
const started = Date.now()
const child = spawn('node', [erc20Input ? 'tests/redteam/historical-thor-erc20.js' : 'tests/redteam/historical-thor-eth-usdt.js'], {
  cwd: sdkDir,
  env: { ...process.env, KEEPKEY_REDTEAM_LIVE: '1', KEEPKEY_MUTATION: clearSign ? '' : mutation,
    KEEPKEY_HISTORY_FIXTURE: fixture, KEEPKEY_ERC20_FIXTURE: erc20Input ? fixture : '',
    KEEPKEY_API_KEY: bearer, KEEPKEY_URL: 'http://127.0.0.1:1646' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', chunk => { output += String(chunk) })
child.stderr.on('data', chunk => { output += String(chunk) })
const done = new Promise<number>(resolve => child.on('exit', code => resolve(code ?? 1)))
const pages: Array<{ image: string; sha256: string; ocr: string }> = []
const seenScreens = new Set<string>()
let vaultText = ''
let rejected = false
let approved = false
let error = ''

async function capturePage(index: number) {
  const path = join(evidenceDir, `page-${String(index).padStart(2, '0')}.png`)
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch('http://127.0.0.1:1646/emulator/capture', {
      method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: '{}',
    })
    if (!response.ok) throw new Error(`OLED capture HTTP ${response.status}`)
    const dataUrl = (await response.json() as { dataUrl: string }).dataUrl
    const png = Buffer.from(dataUrl.split(',')[1] || '', 'base64')
    writeFileSync(path, png)
    const seen = swift(ocr, [path]).trim()
    if (seen.split('\n').length >= 2 && !/^THOR\s*$/i.test(seen)) {
      return { image: path, sha256: createHash('sha256').update(png).digest('hex'), ocr: seen }
    }
    await sleep(120)
  }
  throw new Error(`OLED page ${index} could not be read`)
}

try {
  for (let i = 0; i < 120; i++) {
    vaultText = vault()
    if (vaultText.includes('ACTION REQUIRED')) break
    await sleep(150)
  }
  if (!vaultText.includes('ACTION REQUIRED')) throw new Error('Vault signing preview never appeared')
  const expectedVault = clearSign
    ? [`Input amount\n${displayAmount} ${erc20Input ? history.from_symbol : 'ETH'}`, `Output chain\n${outputChain}`, `Minimum output\n${history.minimum_output} ${outputSymbol}`,
      `Output destination\n${memoParts[2]}`, `Memo (exact)\n${history.memo}`, `To\n${history.router}`]
    : [targets[mutation].vault]
  if (!vaultText.includes('THORChain') || expectedVault.some(s => !vaultText.toLowerCase().includes(s.toLowerCase()))) {
    throw new Error('Vault preview did not show the expected mutated terms')
  }
  press('KeepKey Vault v1.5.6', 'Approve')
  await sleep(350)
  for (let page = 0; page < 16; page++) {
    const seen = await capturePage(page)
    if (seenScreens.has(seen.sha256)) throw new Error('OLED did not advance to a new page')
    seenScreens.add(seen.sha256)
    pages.push(seen)
    if (!clearSign && targets[mutation].device.test(seen.ocr)) {
      press('KeepKey Emulator', 'Reject')
      rejected = true
      break
    }
    if (clearSign && /^TRANSACTION\b/i.test(seen.ocr)) {
      const all = pages.map(p => p.ocr).join('\n')
      const required = [
        /Routing through Thorchain router/i, /Using Asgard vault/i,
        new RegExp(`Confirm sending ${displayAmount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ${erc20Input ? history.from_symbol : 'ETH'}`, 'i'),
        /Confirm swap asset/i, new RegExp(`on chain ${outputChain}`, 'i'), /Confirm to/i,
        new RegExp(`Minimum output ${history.minimum_output.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ${outputSymbol}`, 'i'),
        /MEMO\b/i, erc20Input ? /Send the message from your wallet/i : /Send .*ETH\s*from your/i,
      ]
      if (required.some(pattern => !pattern.test(all))) throw new Error('OLED omitted an expected clear-sign term')
      press('KeepKey Emulator', 'Confirm')
      approved = true
      break
    }
    if (!/^THORCHAIN (?:DATA|SWAP|STREAMING)\b|^MEMO\b/i.test(seen.ocr))
      throw new Error('Unexpected OLED page before the mismatch; refusing to advance')
    press('KeepKey Emulator', 'Confirm')
    await sleep(300)
  }
  if (!rejected && !approved) throw new Error('Decision page was not reached')
} catch (cause) {
  error = String(cause)
  try { press('KeepKey Emulator', 'Reject'); rejected = true } catch {}
  try { press('KeepKey Vault v1.5.6', 'Reject') } catch {}
}
const code = await Promise.race([done, sleep(10_000).then(() => -1)])
if (code === -1) child.kill('SIGTERM')
const routes = db.query('SELECT route, status, COUNT(*) AS count FROM api_log WHERE timestamp >= ? AND app_name = ? GROUP BY route, status').all(started, 'KeepKey SDK Tests') as Array<{route:string;status:number;count:number}>
const broadcast = routes.some(r => /broadcast|sign-and-send/i.test(r.route))
const signingRefused = routes.some(r => r.route === '/eth/sign-transaction' && r.status === 403 && r.count === 1)
const signingSucceeded = routes.some(r => r.route === '/eth/sign-transaction' && r.status === 200 && r.count === 1)
const pass = !error && code === 0 && /7 passed, 0 failed/.test(output) && !broadcast &&
  (clearSign ? approved && signingSucceeded : rejected && signingRefused)
writeFileSync(join(evidenceDir, 'report.json'), JSON.stringify({ fixtureId: history.id, mutation, pass, error, vaultText, pages, sdkResult: output, routes, signingRefused, signingSucceeded, broadcast }, null, 2))
db.close()
console.log(JSON.stringify({ mutation, pass, pages: pages.length, broadcast, report: join(evidenceDir, 'report.json'), error }))
if (!pass) process.exitCode = 1
