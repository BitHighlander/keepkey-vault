/** Sign-only historical Litecoin THORChain deposit review. The input is a
 * fresh synthetic outpoint; the outputs/fee come from a private Esplora GET. */
const fs=require('node:fs')
const {randomBytes}=require('node:crypto')
const {run}=require('../_helpers')
if(process.env.KEEPKEY_REDTEAM_LIVE!=='1'||!process.env.KEEPKEY_LTC_FIXTURE){console.log('SKIP live LTC historical case');process.exit(0)}
const {history,transaction:t}=JSON.parse(fs.readFileSync(process.env.KEEPKEY_LTC_FIXTURE,'utf8'))
run('historical Litecoin-origin THORChain swap display audit',async(getSdk,assert)=>{
 assert('historical Litecoin transaction has one input and two outputs',t.vin.length===1&&t.vout.length===2)
 assert('historical first output is the recorded vault',t.vout[0].scriptpubkey_address===history.inbound_address)
 assert('historical second output contains exact swap memo',t.vout[1].scriptpubkey.includes(Buffer.from(history.memo).toString('hex')))
 assert('historical fee is positive',t.fee>0)
 const path=[0x80000054,0x80000002,0x80000000,0,0]
 const tx={coin:'Litecoin',version:t.version,locktime:t.locktime,
  inputs:[{txid:randomBytes(32).toString('hex'),vout:0,addressNList:path,amount:String(t.vout[0].value+t.fee),scriptType:'p2wpkh',sequence:0xfffffffd}],
  outputs:[{address:history.inbound_address,amount:String(t.vout[0].value),addressType:'spend',scriptType:'p2wpkh'},
   {amount:'0',addressType:'spend',opReturnData:Buffer.from(history.memo).toString('base64')}],
 }
 console.log(`  HOST CLAIM: swap ${history.from_amount} LTC for ${history.to_symbol}; on-chain vault output is ${t.vout[0].value} litoshi, fee ${t.fee} litoshi.`)
 console.log('  Synthetic outpoint, sign-only; review the actual Litecoin send and memo, reject any mismatch. No broadcast.')
 let signed=null,rejected=false
 try{signed=await(await getSdk()).btc.btcSignTransaction(tx)}
 catch(error){rejected=/User cancelled|rejected by user|Transaction rejected by user on emulator/i.test(String(error?.message||error));if(!rejected)throw error}
 if(process.env.KEEPKEY_EXPECT_REJECT==='1')assert('human rejected mismatched host claim; no signature',rejected&&!signed)
 else assert('sign-only request returned signed bytes',!!signed?.serializedTx)
})
