/** Sign-only live THORChain MsgDeposit audit from a private on-chain fixture.
 * Requires OLED review before every approval; no broadcast API is called. */
import { Database } from 'bun:sqlite'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const mode=process.argv[2]
const fixture=process.env.KEEPKEY_THOR_NATIVE_FIXTURE
if(!fixture||!['clear','min-zero','input-amount-tenfold','history-amount-mismatch'].includes(mode))throw Error('Set KEEPKEY_THOR_NATIVE_FIXTURE and use clear|min-zero|input-amount-tenfold|history-amount-mismatch')
const source=JSON.parse(readFileSync(fixture,'utf8'))
const h=source.history,m=source.transaction.tx.body.messages[0]
if(m['@type']!=='/types.MsgDeposit'||m.memo!==h.memo||m.coins.length!==1||m.coins[0].asset!==h.from_asset)throw Error('On-chain fixture mismatch')
const parts=m.memo.split(':')
const rawAmount=BigInt(m.coins[0].amount)
const [historyWhole,historyFraction='']=h.from_amount.split('.')
const historyUnits=BigInt(historyWhole)*100000000n+BigInt(historyFraction.padEnd(8,'0'))
if(mode==='history-amount-mismatch'){
 if(rawAmount-historyUnits<100000000n)throw Error('Fixture does not contain a >1-unit on-chain amount mismatch')
}
const amount=mode==='input-amount-tenfold'?rawAmount*10n:rawAmount
const display=(raw:bigint)=>`${raw/100000000n}.${(raw%100000000n).toString().padStart(8,'0')}`
const ocrUnits=(value:string)=>{const match=/^(\d+)(?:\.(\d{1,8}))?$/.exec(value);return match?BigInt(match[1])*100000000n+BigInt((match[2]||'').padEnd(8,'0')):null}
const minimum=mode==='min-zero'?'0':display(BigInt(parts[3]))
const output=parts[1].split('.')
const fee=parts[5]&&/^\d+$/.test(parts[5])?`${(Number(parts[5])/100).toFixed(2)}%`:''
const dir=join(homedir(),'.keepkey/qa-evidence',`thor-native-${mode}-${Date.now()}`)
mkdirSync(dir,{recursive:true})
const db=new Database(join(homedir(),'Library/Application Support/com.keepkey.vault/dev/vault.db'),{readonly:true})
const row=db.query("SELECT api_key FROM paired_apps WHERE name='KeepKey SDK Tests' ORDER BY last_used_on DESC LIMIT 1").get() as {api_key?:string}|null
if(!row?.api_key)throw Error('SDK pairing missing')
const bearer=row.api_key
const pid=Number(execFileSync('lsof',['-tiTCP:1646','-sTCP:LISTEN'],{encoding:'utf8'}).trim())
const sdkDir=resolve(import.meta.dir,'../..'),ax=join(import.meta.dir,'ax-ui.swift-source'),ocr=join(import.meta.dir,'ocr-oled.swift-source')
const swift=(sourcePath:string,args:string[])=>execFileSync('swift',['-',...args],{input:readFileSync(sourcePath),encoding:'utf8'})
const call=(title:string,button:string,action:string)=>swift(ax,[String(pid),title,button,action])
const vault=()=>call('KeepKey Vault v1.5.6','*','dumptext')
const press=(title:string,button:string)=>call(title,button,'press')
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
const pages:Array<{image:string;sha256:string;ocr:string}>=[]
let vaultText='',outputText='',decision='',error=''
if(!vault().includes('connected')||vault().includes('ACTION REQUIRED'))throw Error('Emulator unavailable or busy')
const started=Date.now()
const child=spawn('node',['tests/redteam/historical-thor-native.js'],{cwd:sdkDir,
 env:{...process.env,KEEPKEY_REDTEAM_LIVE:'1',KEEPKEY_THOR_NATIVE_FIXTURE:fixture,
 KEEPKEY_MUTATION:mode==='clear'?'':mode,KEEPKEY_API_KEY:bearer,KEEPKEY_URL:'http://127.0.0.1:1646'},stdio:['ignore','pipe','pipe']})
child.stdout.on('data',x=>outputText+=String(x));child.stderr.on('data',x=>outputText+=String(x))
const done=new Promise<number>(r=>child.on('exit',x=>r(x??1)))

async function capture(i:number){
 const image=join(dir,`page-${String(i).padStart(2,'0')}.png`)
 for(let attempt=0;attempt<15;attempt++){
  const response=await fetch('http://127.0.0.1:1646/emulator/capture',{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:'{}'})
  if(!response.ok)throw Error(`capture HTTP ${response.status}`)
  const body=await response.json() as {dataUrl:string};const bytes=Buffer.from(body.dataUrl.split(',')[1]||'','base64')
  writeFileSync(image,bytes);const text=swift(ocr,[image]).trim()
  const sha256=createHash('sha256').update(bytes).digest('hex')
  if(/(?:THORChain Account|Send |THORCHAIN SWAP|THORCHAIN ACCOUNT)/i.test(text)&&sha256!==pages.at(-1)?.sha256)
   return {image,sha256,ocr:text}
  await sleep(150)
 }
 throw Error(`OLED page ${i} unreadable or repeated`)
}
async function screenCheck(ok:boolean,page:{image:string},expected:string){
 if(ok)return
 const path=join(dir,'screen-decision.txt')
 writeFileSync(join(dir,'review-pending.json'),JSON.stringify({image:page.image,expected,decisionFile:path},null,2))
 console.log(JSON.stringify({manualScreenReview:true,image:page.image,expected,decisionFile:path}))
 for(let i=0;i<480&&!existsSync(path);i++)await sleep(250)
 if(!existsSync(path)||readFileSync(path,'utf8').trim()!=='approve')throw Error(`Unapproved OLED mismatch: ${expected}`)
 // One decision is bound to one page. Later OCR failures must pause again.
 writeFileSync(path+'.used',readFileSync(path));unlinkSync(path)
}

try{
 for(let i=0;i<120;i++){vaultText=vault();if(vaultText.includes('ACTION REQUIRED'))break;await sleep(150)}
 if(!vaultText.includes('ACTION REQUIRED'))throw Error('Vault approval not shown')
 const required=[`${display(amount)} ${h.from_asset}`,parts[1],parts[2],`${minimum} ${output[1]}`,fee,mode==='clear'?m.memo:'']
 if(required.some(s=>s&&!vaultText.toLowerCase().includes(s.toLowerCase())))throw Error('Vault omitted signed deposit term')
 writeFileSync(join(dir,'vault.txt'),vaultText)
 press('KeepKey Vault v1.5.6','Approve')
 const expectedKinds=['account','send','asset','destination','minimum','fee','asset','destination','minimum','fee','final']
 for(let i=0;i<expectedKinds.length;i++){
  const page=await capture(i);pages.push(page);const text=page.ocr.replace(/,/g,'.')
  const kind=expectedKinds[i]
  if(kind==='account')await screenCheck(/THORChain Account/i.test(text),page,'THORChain account')
  if(kind==='send')await screenCheck(ocrUnits(/Send\s+(\d+(?:\.\d+)?)\s+/i.exec(text)?.[1]||'')===amount&&text.includes(h.from_asset),page,`Send ${display(amount)} ${h.from_asset}`)
  if(kind==='asset')await screenCheck(/THORCHAIN SWAP/i.test(text)&&text.includes(output[1])&&text.includes(`chain ${output[0]}`),page,`Swap asset ${parts[1]}`)
  if(kind==='destination'){
   // Vision reads the numeral 1 in bech32 as lowercase l. Bech32 excludes l,
   // so normalize that one OCR ambiguity while still matching the prefix.
   const visual=text.toLowerCase().replace(/l/g,'1')
   await screenCheck(/Confirm to/i.test(text)&&visual.includes(parts[2].slice(0,12).toLowerCase()),page,`Destination ${parts[2]}`)
  }
  if(kind==='minimum')await screenCheck(ocrUnits(/Minimum output\s+(\d+(?:\.\d+)?)/i.exec(text)?.[1]||'')===(mode==='min-zero'?0n:BigInt(parts[3]))&&text.includes(output[1]),page,`Minimum ${minimum} ${output[1]}`)
  if(kind==='fee')await screenCheck(/Affiliate fee/i.test(text)&&text.includes(fee),page,`Affiliate ${fee}`)
  if(kind==='final')await screenCheck(/THORCHAIN ACCOUNT/i.test(text)&&/Sign this RUNE transaction/i.test(text),page,'Final THORChain transaction')
  if(((mode==='input-amount-tenfold'||mode==='history-amount-mismatch')&&i===1)||(mode==='min-zero'&&i===4)){
   press('KeepKey Emulator','Reject');decision='reject';break
  }
  if(mode==='clear'&&i===10){press('KeepKey Emulator','Confirm');decision='approve';break}
  press('KeepKey Emulator','Confirm');await sleep(300)
 }
 if(!decision)throw Error('Decision not reached')
}catch(cause){error=String(cause);try{press('KeepKey Emulator','Reject')}catch{};try{press('KeepKey Vault v1.5.6','Reject')}catch{}}
const code=await Promise.race([done,sleep(10000).then(()=>-1)]);if(code===-1)child.kill('SIGTERM')
const rows=db.query("SELECT timestamp,route,status,activity_type,request_body FROM api_log WHERE timestamp>=? AND app_name='KeepKey SDK Tests' ORDER BY timestamp").all(started) as Array<{timestamp:number;route:string;status:number;activity_type:string|null;request_body:string|null}>
const sign=rows.filter(r=>r.route==='/thorchain/sign-amino-deposit')
const broadcast=rows.some(r=>/broadcast|sign-and-send/i.test(r.route)||r.activity_type==='broadcast')
const payload=sign[0]?.request_body||'';if(payload)writeFileSync(join(dir,'payload.json'),JSON.stringify(JSON.parse(payload),null,2))
const pass=!error&&code===0&&/6 passed, 0 failed/.test(outputText)&&!broadcast&&sign.length===1&&
 (mode==='clear'?decision==='approve'&&sign[0].status===200:decision==='reject'&&sign[0].status!==200)
const report={fixture,fixtureId:h.id,sourceUrl:source.source_url,mode,pass,decision,error,vaultText,pages,sdkResult:outputText,
 historyAmountMatchesOnchain:historyUnits===rawAmount,historyAmountDeltaBaseUnits:(rawAmount-historyUnits).toString(),
 signerSubstituted:outputText.includes('SIGNER SUBSTITUTION'),
 payloadFile:payload?join(dir,'payload.json'):null,payloadSha256:payload?createHash('sha256').update(payload).digest('hex'):null,
 routes:rows.map(({timestamp,route,status,activity_type})=>({timestamp,route,status,activity_type})),broadcast}
writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2));db.close()
console.log(JSON.stringify({mode,pass,decision,pages:pages.length,broadcast,report:join(dir,'report.json'),error}))
if(!pass)process.exitCode=1
