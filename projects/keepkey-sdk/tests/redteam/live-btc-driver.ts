/** Live BTC-origin THORChain sign-only reviewer. Every decision is bounded
 * by the historical fixture and named OLED screens; unexpected pages reject.
 * Evidence and exact REST payload stay private under ~/.keepkey/qa-evidence. */
import { Database } from 'bun:sqlite'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const mode = process.argv[2]
const fixture = process.env.KEEPKEY_BTC_FIXTURE
if (!fixture || !['clear', 'min-zero', 'destination-substitution', 'affiliate-fee-1000', 'vault-substitution', 'input-amount-tenfold'].includes(mode))
  throw Error('Usage: KEEPKEY_BTC_FIXTURE=private.json bun tests/redteam/live-btc-driver.ts clear|min-zero|destination-substitution|affiliate-fee-1000|vault-substitution|input-amount-tenfold')
const { history, transaction } = JSON.parse(readFileSync(fixture, 'utf8'))
const vout = transaction.vout as Array<{value:number;scriptpubkey_address?:string}>
if (![2,3].includes(vout.length) || history.from_symbol !== 'BTC') throw Error('Expected a 2- or 3-output historical BTC fixture')
const parts = history.memo.split(':')
const originalMinimum = `${BigInt(parts[3]) / 100000000n}.${(BigInt(parts[3]) % 100000000n).toString().padStart(8,'0')}`
const targetMinimum = mode === 'min-zero' ? '0' : originalMinimum
const targetDestination = mode === 'destination-substitution' ? '0x1111111111111111111111111111111111111111' : parts[2]
const targetFee = mode === 'affiliate-fee-1000' ? '10.00%' : '0.30%'
const btc = (n: number) => `${Math.floor(n / 100000000)}.${String(n % 100000000).padStart(8, '0')} BTC`
const inputSats = vout[0].value
const targetInputSats = mode==='input-amount-tenfold' ? inputSats*10 : inputSats
const targetVaultAddress = mode==='vault-substitution' ? '1BitcoinEaterAddressDontSendf59kuE' : history.inbound_address
const feeSats = transaction.vin.reduce((n: number, x: any) => n + x.prevout.value, 0) - vout.reduce((n, x) => n + x.value, 0)
const totalSats = targetInputSats + feeSats
const ocrSats = (value:string) => {const m=/^(\d+)\.(\d{1,8})$/.exec(value);return m?BigInt(m[1])*100000000n+BigInt(m[2].padEnd(8,'0')):null}
const dir = join(homedir(), '.keepkey/qa-evidence', `btc-${mode}-${Date.now()}`)
mkdirSync(dir, { recursive: true })
const sdkDir = resolve(import.meta.dir, '../..')
const db = new Database(join(homedir(), 'Library/Application Support/com.keepkey.vault/dev/vault.db'), { readonly: true })
const pairing = db.query("SELECT api_key FROM paired_apps WHERE name='KeepKey SDK Tests' ORDER BY last_used_on DESC LIMIT 1").get() as {api_key?:string}|null
if (!pairing?.api_key) throw Error('SDK pairing unavailable')
const bearer = pairing.api_key
const pid = Number(execFileSync('lsof', ['-tiTCP:1646', '-sTCP:LISTEN'], {encoding:'utf8'}).trim())
const ax = join(import.meta.dir, 'ax-ui.swift-source')
const ocr = join(import.meta.dir, 'ocr-oled.swift-source')
const swift = (source:string, args:string[]) => execFileSync('swift', ['-', ...args], {input:readFileSync(source), encoding:'utf8'})
const axCall = (title:string, button:string, action:string) => swift(ax, [String(pid), title, button, action])
const vault = () => axCall('KeepKey Vault v1.5.4', '*', 'dumptext')
const press = (title:string, button:string) => axCall(title, button, 'press')
const sleep = (ms:number) => new Promise(r => setTimeout(r,ms))
const normalized = (s:string) => s.replace(/[^a-z0-9]/gi,'').toLowerCase()
const minRegex = new RegExp(`Minimum output\\s+${targetMinimum.replace('.','[.,]?').replace(/0+$/,'0*')}\\s+${parts[1].split('.')[1]}`, 'i')
const pages: Array<{image:string;sha256:string;ocr:string}> = []
let vaultText = '', output = '', decision = '', error = ''
let code = -1
const started = Date.now()
if (!vault().includes('connected') || vault().includes('ACTION REQUIRED')) throw Error('Emulator is not idle')
const child = spawn('node', ['tests/redteam/historical-thor-btc.js'], {cwd:sdkDir,
  env:{...process.env, KEEPKEY_REDTEAM_LIVE:'1', KEEPKEY_BTC_FIXTURE:fixture,
    KEEPKEY_MUTATION:mode==='clear'?'':mode,KEEPKEY_API_KEY:bearer,KEEPKEY_URL:'http://127.0.0.1:1646'},
  stdio:['ignore','pipe','pipe']})
child.stdout.on('data', x => output += String(x))
child.stderr.on('data', x => output += String(x))
const done = new Promise<number>(r => child.on('exit', x => r(x ?? 1)))

async function capture(i:number) {
  const image = join(dir,`page-${String(i).padStart(2,'0')}.png`)
  for (let attempt=0;attempt<12;attempt++) {
    const response = await fetch('http://127.0.0.1:1646/emulator/capture', {
      method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:'{}'})
    if (!response.ok) throw Error(`capture HTTP ${response.status}`)
    const body = await response.json() as {dataUrl:string}
    const bytes = Buffer.from(body.dataUrl.split(',')[1] || '', 'base64')
    writeFileSync(image, bytes)
    const text = swift(ocr,[image]).trim()
    const sha256=createHash('sha256').update(bytes).digest('hex')
    if (/(?:Send|THORCHAIN|TRANSACTION|WARNING|Confirm OP_RETURN)/i.test(text)
      && sha256!==pages.at(-1)?.sha256)
      return {image,sha256,ocr:text}
    await sleep(150)
  }
  throw Error(`unreadable OLED page ${i}`)
}

try {
  for(let i=0;i<120;i++) {vaultText=vault();if(vaultText.includes('ACTION REQUIRED'))break;await sleep(150)}
  if(!vaultText.includes('ACTION REQUIRED'))throw Error('Vault approval did not appear')
  const expected = [btc(targetInputSats),targetVaultAddress,btc(feeSats),parts[1],targetDestination,targetMinimum,targetFee]
  if(expected.some(x=>!vaultText.toLowerCase().includes(x.toLowerCase())))throw Error('Vault omitted expected BTC or memo term')
  writeFileSync(join(dir,'vault.txt'),vaultText)
  press('KeepKey Vault v1.5.4','Approve')
  const seen = new Set<string>()
  for(let i=0;i<6;i++) {
    const page=await capture(i);pages.push(page)
    if(seen.has(page.sha256))throw Error(`OLED repeated page ${i}`)
    seen.add(page.sha256)
    const text=page.ocr
    if(i===0 && (!/Send/i.test(text)||ocrSats(/Send\s+(\d+\.\d+)\s+BTC/i.exec(text)?.[1]||'')!==BigInt(targetInputSats)))throw Error('BTC vault-send screen mismatch')
    if(i===1 && (!/THORCHAIN SWAP/i.test(text)||!text.includes('on chain '+parts[1].split('.')[0])))throw Error('Output asset screen mismatch')
    if(i===2 && (!/Confirm to/i.test(text)||!normalized(text).includes(normalized(targetDestination).slice(0,12))))throw Error('Destination screen mismatch')
    if(i===3 && !minRegex.test(text))throw Error('Minimum output screen mismatch')
    if(i===4 && (!/Affiliate fee/i.test(text)||!text.replace(',','.').includes(targetFee)))throw Error('Affiliate fee screen mismatch')
    if(i===5 && (!/^TRANSACTION/i.test(text)||!text.includes(btc(totalSats).replace(' BTC',''))||!text.includes(btc(feeSats).replace(' BTC','')))) {
      if(process.env.KEEPKEY_MANUAL_FINAL!=='1')throw Error('Final BTC fee screen mismatch')
      const decisionFile=join(dir,'final-decision.txt')
      writeFileSync(join(dir,'review-pending.json'),JSON.stringify({image:page.image,expectedSend:btc(totalSats),expectedFee:btc(feeSats),decisionFile},null,2))
      console.log(JSON.stringify({manualFinalReview:true,image:page.image,expectedSend:btc(totalSats),expectedFee:btc(feeSats),decisionFile}))
      for(let attempt=0;attempt<480&&!existsSync(decisionFile);attempt++)await sleep(250)
      if(!existsSync(decisionFile)||readFileSync(decisionFile,'utf8').trim()!=='approve')throw Error('Final screen not approved by image review')
    }
    if(((mode==='vault-substitution'||mode==='input-amount-tenfold')&&i===0)||(mode==='min-zero'&&i===3)||(mode==='destination-substitution'&&i===2)||(mode==='affiliate-fee-1000'&&i===4)) {
      press('KeepKey Emulator','Reject');decision='reject';break
    }
    if(mode==='clear'&&i===5) {press('KeepKey Emulator','Confirm');decision='approve';break}
    press('KeepKey Emulator','Confirm');await sleep(300)
  }
  if(!decision)throw Error('No decision screen reached')
} catch(cause) {
  error=String(cause)
  try{press('KeepKey Emulator','Reject')}catch{}
  try{press('KeepKey Vault v1.5.4','Reject')}catch{}
}
code=await Promise.race([done,sleep(10000).then(()=>-1)])
if(code===-1)child.kill('SIGTERM')
const rows=db.query("SELECT timestamp,route,status,activity_type,request_body FROM api_log WHERE timestamp>=? AND app_name='KeepKey SDK Tests' ORDER BY timestamp").all(started) as Array<{timestamp:number;route:string;status:number;activity_type:string|null;request_body:string|null}>
const sign=rows.filter(r=>r.route==='/utxo/sign-transaction')
const broadcast=rows.some(r=>/broadcast|sign-and-send/i.test(r.route)||r.activity_type==='broadcast')
const payload=sign[0]?.request_body||''
if(payload)writeFileSync(join(dir,'payload.json'),JSON.stringify(JSON.parse(payload),null,2))
const pass=!error&&code===0&&/6 passed, 0 failed/.test(output)&&!broadcast&&sign.length===1&&
  (mode==='clear'?decision==='approve'&&sign[0].status===200:decision==='reject'&&sign[0].status!==200)
const report={fixture,fixtureId:history.id,mode,pass,decision,error,vaultText,pages,sdkResult:output,
  payloadFile:payload?join(dir,'payload.json'):null,payloadSha256:payload?createHash('sha256').update(payload).digest('hex'):null,
  routes:rows.map(({timestamp,route,status,activity_type})=>({timestamp,route,status,activity_type})),broadcast}
writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2))
db.close()
console.log(JSON.stringify({mode,pass,decision,pages:pages.length,broadcast,report:join(dir,'report.json'),error}))
if(!pass)process.exitCode=1
