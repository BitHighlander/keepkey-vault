/** Sign-only audit of a completed THORChain-native MsgDeposit. The message,
 * amount, asset, and memo come from a privately saved THORNode GET response.
 * Account number and sequence are synthetic; signed bytes are discarded. */
const fs = require('node:fs')
const { run } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_THOR_NATIVE_FIXTURE) {
  console.log('SKIP live THORChain-native historical swap case')
  process.exit(0)
}
const { history, transaction } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_THOR_NATIVE_FIXTURE, 'utf8'))
const onchain = transaction.tx
const original = onchain.body.messages[0]
const mutation = process.env.KEEPKEY_MUTATION || ''
const msg = JSON.parse(JSON.stringify(original))
if (mutation === 'min-zero') msg.memo = msg.memo.split(':').map((x,i)=>i===3?'0':x).join(':')
else if (mutation === 'destination-substitution') msg.memo = msg.memo.split(':').map((x,i)=>i===2?'thor1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq':x).join(':')
else if (mutation === 'input-amount-tenfold') msg.coins[0].amount = String(BigInt(msg.coins[0].amount)*10n)
else if (mutation === 'history-amount-mismatch') {} // signed on-chain amount intentionally differs from recorded host claim
else if (mutation) throw Error(`Unsupported THORChain-native mutation: ${mutation}`)

run('historical THORChain-native swap — MsgDeposit display audit', async (getSdk, assert) => {
  assert('historical transaction is one MsgDeposit', onchain.body.messages.length===1 && original['@type']==='/types.MsgDeposit')
  assert('history memo equals on-chain memo', original.memo===history.memo && onchain.body.memo===history.memo)
  assert('on-chain asset equals recorded input asset', original.coins.length===1 && original.coins[0].asset===history.from_asset)
  assert('on-chain deposit amount is positive', BigInt(original.coins[0].amount)>0n)
  const sdk=await getSdk()
  const path=[0x8000002c,0x800003a3,0x80000000,0,0]
  const derived=await sdk.address.thorchainGetAddress({address_n:path,show_display:false})
  const signer=derived?.address
  assert('live signer is a THORChain address',typeof signer==='string'&&signer.startsWith('thor1'))
  if(!signer?.startsWith('thor1'))throw Error('Live THORChain signer unavailable')
  if(signer!==original.signer)console.log('  SIGNER SUBSTITUTION: live emulator signer differs from historical owner; economic terms remain history-derived.')
  const signDoc={fee:{gas:'500000000',amount:[{denom:'rune',amount:'0'}]},msgs:[{
    type:'thorchain/MsgDeposit',value:{coins:msg.coins,memo:msg.memo,signer},
  }],memo:msg.memo,sequence:'0',chain_id:'thorchain-1',account_number:'0'}
  console.log(`  INTENT: Deposit ${original.coins[0].amount} base units of ${history.from_asset} for ${history.to_symbol} on ${history.to_chain_id}; historical minimum ${history.minimum_output}.`)
  if(mutation==='history-amount-mismatch')console.log(`  HOST CLAIM: history recorded ${history.from_amount} ${history.from_symbol}, while the on-chain MsgDeposit spends ${Number(original.coins[0].amount)/1e8} ${history.from_symbol}.`)
  if(mutation)console.log(`  ADVERSARIAL MUTATION: ${mutation}; reject when the signed effect differs from the intent.`)
  console.log('  Sign-only synthetic account/sequence; no broadcast endpoint is called.')
  let signed=null,rejected=false
  try{signed=await sdk.thorchain.thorchainSignAminoDeposit({signDoc,signerAddress:signer})}
  catch(error){rejected=/User cancelled|rejected by user|Transaction rejected by user on emulator/i.test(String(error?.message||error));if(!rejected)throw error}
  if(mutation||process.env.KEEPKEY_EXPECT_REJECT==='1')assert('human rejected mismatch; no signature',rejected&&!signed)
  else assert('sign-only request returned signature',!!(signed?.signature||signed?.serialized||signed?.serializedTx))
})
