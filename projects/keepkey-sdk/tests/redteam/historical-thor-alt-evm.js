/** Sign-only historical THORChain deposit from Avalanche C-Chain or Base.
 * On-chain calldata/value are retained; only expired router deadline is
 * refreshed. Nonce is synthetic and signed bytes are discarded. */
const fs=require('node:fs')
const {run,ETH_PATH}=require('../_helpers')
if(process.env.KEEPKEY_REDTEAM_LIVE!=='1'||!process.env.KEEPKEY_ALT_EVM_FIXTURE){console.log('SKIP live alt-EVM historical case');process.exit(0)}
const {history:h,transaction:t}=JSON.parse(fs.readFileSync(process.env.KEEPKEY_ALT_EVM_FIXTURE,'utf8'))
run('historical alternate-EVM THORChain swap display audit',async(getSdk,assert)=>{
 const data=t.input,body=data.slice(10),word=i=>body.slice(i*64,(i+1)*64)
 const memoLength=Number(BigInt('0x'+word(5)))
 const memo=Buffer.from(body.slice(6*64,6*64+memoLength*2),'hex').toString('utf8')
 assert('on-chain transaction calls recorded THORChain router',t.to.toLowerCase()===h.router.toLowerCase())
 assert('on-chain method is depositWithExpiry',data.startsWith('0x44bc937b'))
 assert('on-chain memo equals history memo',memo===h.memo)
 assert('deposit amount equals transaction native value',BigInt('0x'+word(2))===BigInt(t.value))
 assert('router deposit asset is native coin',BigInt('0x'+word(1))===0n)
 const chainId=Number(BigInt(t.chainId))
 assert('chain ID matches historical origin',chainId===(h.from_chain_id==='avalanche'?43114:8453))
 const mutation=process.env.KEEPKEY_ALT_EVM_MUTATION||''
 if(mutation)assert('Base-only mutation uses the verified Base fixture',chainId===8453&&h.id==='d6b204e0-1892-4e80-80c0-60149ff221aa')
 const mutatedMemo=mutation==='min-zero' ? memo.replace(':77976223954:keep:30',':00000000000:keep:30')
  :mutation==='destination-substitution' ? memo.replace(/:0x[0-9a-fA-F]{40}:/,':0x1111111111111111111111111111111111111111:')
  :mutation==='output-contract-fake' ? memo.replace(/USDC-0x[0-9a-fA-F]{40}/i,'USDC-0x1111111111111111111111111111111111111111')
  :memo
 if(mutation&&!['min-zero','destination-substitution','output-contract-fake'].includes(mutation))throw Error('Unknown mutation')
 if(mutation)assert('signed memo differs from historical transaction',mutatedMemo!==memo)
 assert('mutation preserves ABI memo byte length',Buffer.byteLength(mutatedMemo)===memoLength)
 const expiry=Math.floor(Date.now()/1000)+3600
 const refreshed=data.slice(0,10+4*64)+BigInt(expiry).toString(16).padStart(64,'0')+data.slice(10+5*64,10+6*64)
  +Buffer.from(mutatedMemo,'utf8').toString('hex')+data.slice(10+6*64+memoLength*2)
 const tx={addressNList:ETH_PATH,to:t.to,value:t.value,data:refreshed,nonce:'0x0',
  gasLimit:t.gas,gasPrice:t.gasPrice||'0x3b9aca00',chainId}
 console.log(`  INTENT: swap ${h.from_amount} ${h.from_symbol} for ${h.to_symbol} on ${h.to_chain_id}; historical minimum ${h.minimum_output}. Mutation: ${mutation||'none'}.`)
 console.log('  Historical calldata with refreshed expiry; synthetic nonce; sign-only, no broadcast. Review all device pages.')
 let signed=null,rejected=false
 try{signed=await(await getSdk()).eth.ethSignTransaction(tx)}
 catch(error){rejected=/User cancelled|rejected by user|Transaction rejected by user on emulator/i.test(String(error?.message||error));if(!rejected)throw error}
 if(process.env.KEEPKEY_EXPECT_REJECT==='1')assert('human rejected; no signature',rejected&&!signed)
 else assert('sign-only request returned signed bytes',!!(signed?.serializedTx||signed?.v!==undefined))
})
