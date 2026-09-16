/** Sign-only MAYAChain-native MsgDeposit from an on-chain historical fixture.
 * Economic terms are historical; live emulator signer/account are substituted.
 * No broadcast call is made and signed bytes are discarded. */
const fs=require('node:fs')
const {run}=require('../_helpers')
if(process.env.KEEPKEY_REDTEAM_LIVE!=='1'||!process.env.KEEPKEY_MAYA_NATIVE_FIXTURE){console.log('SKIP live Maya historical case');process.exit(0)}
const {history,transaction}=JSON.parse(fs.readFileSync(process.env.KEEPKEY_MAYA_NATIVE_FIXTURE,'utf8'))
const onchain=transaction.tx,m=onchain.body.messages[0]
run('historical MAYAChain-native MsgDeposit display audit',async(getSdk,assert)=>{
 assert('historical transaction is one MsgDeposit',onchain.body.messages.length===1&&m['@type']==='/types.MsgDeposit')
 assert('history memo matches on-chain message and body',history.memo===m.memo&&history.memo===onchain.body.memo)
 assert('on-chain input is CACAO',m.coins.length===1&&m.coins[0].asset==='MAYA.CACAO')
 assert('on-chain input amount is positive',BigInt(m.coins[0].amount)>0n)
 const sdk=await getSdk();const path=[0x8000002c,0x800003a3,0x80000000,0,0]
 const signer=(await sdk.address.mayachainGetAddress({address_n:path,show_display:false}))?.address
 assert('live signer is a Maya address',typeof signer==='string'&&signer.startsWith('maya1'))
 if(!signer?.startsWith('maya1'))throw Error('Live Maya signer unavailable')
 if(signer!==m.signer)console.log('  SIGNER SUBSTITUTION: current emulator signer differs from historical owner.')
 const signDoc={fee:{gas:'500000000',amount:[{denom:'cacao',amount:'0'}]},msgs:[{
  type:'mayachain/MsgDeposit',value:{coins:m.coins,memo:m.memo,signer},
 }],memo:m.memo,sequence:'0',chain_id:'mayachain-mainnet-v1',account_number:'0'}
 console.log(`  INTENT: Deposit ${m.coins[0].amount} CACAO base units for ${history.to_symbol} on ${history.to_chain_id}; historical minimum ${history.minimum_output}.`)
 console.log('  Synthetic account and sequence; sign-only, no broadcast.')
 let signed=null,rejected=false
 try{signed=await sdk.mayachain.mayachainSignAminoDeposit({signDoc,signerAddress:signer})}
 catch(error){rejected=/User cancelled|rejected by user|Transaction rejected by user on emulator/i.test(String(error?.message||error));if(!rejected)throw error}
 if(process.env.KEEPKEY_EXPECT_REJECT==='1')assert('human rejected; no signature',rejected&&!signed)
 else assert('sign-only request returned signature',!!(signed?.signature||signed?.serialized||signed?.serializedTx))
})
