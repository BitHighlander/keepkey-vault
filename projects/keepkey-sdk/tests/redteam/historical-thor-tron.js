/** Sign-only historical TRON-origin THORChain deposit. The original memo,
 * transfer and recipient remain byte-identical; only the owner key is changed
 * to this emulator wallet because the historical signer is unavailable. */
const fs = require('node:fs')
const bs58 = require('bs58')
const { run } = require('../_helpers')
if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_TRON_FIXTURE) {
  console.log('SKIP live historical TRON case'); process.exit(0)
}
const { history: h, transaction: t } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_TRON_FIXTURE, 'utf8'))
const path = [0x8000002c, 0x800000c3, 0x80000000, 0, 0]
run('historical TRON-origin THORChain swap display audit', async (getSdk, assert) => {
  assert('on-chain tx ID equals history', t.txID.toLowerCase() === h.txid.toLowerCase())
  assert('signed on-chain memo equals history', Buffer.from(t.raw_data.data, 'hex').toString('utf8') === h.memo)
  const contract = t.raw_data.contract[0]
  const originalOwner = contract.parameter.value.owner_address.toLowerCase()
  let onchainAmount, onchainRecipient
  if (contract.type === 'TransferContract') {
    onchainAmount = BigInt(contract.parameter.value.amount)
    onchainRecipient = contract.parameter.value.to_address.toLowerCase()
    assert('on-chain TRX input equals history', onchainAmount === BigInt(h.from_amount.replace('.', '')))
  } else if (contract.type === 'TriggerSmartContract') {
    const data = contract.parameter.value.data.toLowerCase()
    assert('TRC-20 transfer selector and length', /^a9059cbb[0-9a-f]{128}$/.test(data))
    onchainAmount = BigInt('0x' + data.slice(-64))
    onchainRecipient = '41' + data.slice(32, 72)
    assert('on-chain USDT input equals history', onchainAmount === BigInt(h.from_amount.replace('.', '')))
  } else throw Error('Unsupported on-chain TRON contract')
  assert('on-chain recipient is historical THORChain vault', onchainRecipient === '4103545a905ff162b46bea4b9388a14554702f3393')
  const sdk = await getSdk()
  const own = await sdk.address.tronGetAddress({ address_n: path, show_display: false })
  const owner = Buffer.from(bs58.decode(own.address)).subarray(0, 21).toString('hex')
  const raw = t.raw_data_hex.toLowerCase()
  assert('historical owner occurs exactly once in signed bytes', raw.split(originalOwner).length === 2)
  const mutation = process.env.KEEPKEY_TRON_MUTATION || ''
  let syntheticRaw = raw.replace(originalOwner, owner)
  if (mutation === 'minimum-zero') {
    const original = Buffer.from(h.memo, 'utf8').toString('hex')
    const changedMemo = h.memo.replace(/:\d+:keep:30$/, m => ':' + '0'.repeat(m.split(':')[1].length) + ':keep:30')
    const changed = Buffer.from(changedMemo, 'utf8').toString('hex')
    assert('minimum mutation changes signed memo at same byte length', changed !== original && changed.length === original.length)
    assert('historical memo occurs once in signed bytes', syntheticRaw.split(original).length === 2)
    syntheticRaw = syntheticRaw.replace(original, changed)
  } else if (mutation === 'fake-usdt-contract') {
    assert('fake-token case starts from historical TRC-20 USDT', contract.type === 'TriggerSmartContract')
    const real = contract.parameter.value.contract_address.toLowerCase()
    const fake = real.slice(0, -2) + (real.endsWith('3c') ? '3d' : '3c')
    assert('historical token contract occurs once in signed bytes', syntheticRaw.split(real).length === 2)
    syntheticRaw = syntheticRaw.replace(real, fake)
  } else if (mutation) throw Error('Unknown TRON mutation')
  if (mutation) assert('adversarial signed bytes differ from clear replay', syntheticRaw !== raw.replace(originalOwner, owner))
  assert('sign-only raw bytes retain historical length', syntheticRaw.length === raw.length && syntheticRaw !== raw)
  console.log(`  INTENT: ${h.from_amount} ${h.from_symbol} for >= ${h.minimum_output} ${h.to_symbol}; output ${h.to_chain_id}. Mutation: ${mutation||'none'}.`)
  console.log('  Historical transfer/memo with synthetic owner and stated mutation. Sign-only; never broadcast. Review Vault and all OLED pages.')
  let signed = null, rejected = false
  try { signed = await sdk.tron.tronSignTransaction({ addressNList: path, raw_tx: syntheticRaw }) }
  catch (e) { rejected = /cancelled|rejected/i.test(String(e?.message || e)); if (!rejected) throw e }
  if (process.env.KEEPKEY_EXPECT_REJECT === '1') assert('human rejected; no signature', rejected && !signed)
  else assert('sign-only TRON signature returned', !!signed?.signature)
})
