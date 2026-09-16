/** Sign-only BTC-origin THORChain audit. The input is a nonexistent synthetic
 * outpoint; historical vault output, memo, and fee come from a private
 * Esplora transaction fixture. Signed bytes are discarded, never broadcast. */
const fs = require('node:fs')
const { randomBytes } = require('node:crypto')
const { run } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_BTC_FIXTURE) {
  console.log('SKIP live historical BTC swap case')
  process.exit(0)
}
const { history, transaction } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_BTC_FIXTURE, 'utf8'))
const mutation = process.env.KEEPKEY_MUTATION || ''
const outputs = transaction.vout
const memo = history.memo
const memoParts = memo.split(':')
if (mutation === 'min-zero') memoParts[3] = '0'
else if (mutation === 'destination-substitution') memoParts[2] = '0x1111111111111111111111111111111111111111'
else if (mutation === 'affiliate-fee-1000') memoParts[5] = '1000'
else if (mutation === 'vault-substitution' || mutation === 'input-amount-tenfold') {} // output-level mutations below
else if (mutation) throw Error(`Unsupported BTC swap mutation: ${mutation}`)
const signedMemo = memoParts.join(':')
const originalScript = outputs.at(-1).scriptpubkey
const originalFee = transaction.vin.reduce((sum, input) => sum + input.prevout.value, 0)
  - outputs.reduce((sum, output) => sum + output.value, 0)
run('historical THORChain BTC-origin swap — display audit', async (getSdk, assert) => {
  assert('historical BTC transaction has one input', transaction.vin.length === 1)
  assert('historical BTC transaction has vault and OP_RETURN outputs, with optional change', outputs.length === 2 || outputs.length === 3)
  assert('historical vault address is first output', outputs[0].scriptpubkey_address === history.inbound_address)
  assert('historical OP_RETURN contains the exact swap memo', originalScript.includes(Buffer.from(memo).toString('hex')))
  assert('historical fee is positive', originalFee > 0)
  if (outputs.length !== 2 && outputs.length !== 3) throw Error('This pass supports two- or three-output fixtures only')

  const path = [0x80000054, 0x80000000, 0x80000000, 0, 0]
  const changePath = [0x80000054, 0x80000000, 0x80000000, 1, 0]
  const vaultAddress = mutation === 'vault-substitution' ? '1BitcoinEaterAddressDontSendf59kuE' : history.inbound_address
  const vaultAmount = mutation === 'input-amount-tenfold' ? outputs[0].value * 10 : outputs[0].value
  const tx = {
    coin: 'Bitcoin', version: transaction.version, locktime: transaction.locktime,
    vaultAddress,
    inputs: [{ txid: randomBytes(32).toString('hex'), vout: 0, addressNList: path,
      amount: String(vaultAmount + outputs.slice(1, -1).reduce((sum, output) => sum + output.value, 0) + originalFee),
      scriptType: 'p2wpkh', sequence: 0xfffffffd }],
    outputs: [
      { address: vaultAddress, amount: String(vaultAmount), addressType: 'spend', scriptType: mutation === 'vault-substitution' ? 'p2pkh' : 'p2wpkh' },
      ...(outputs.length === 3 ? [{ amount: String(outputs[1].value), addressNList: changePath, addressType: 'change', scriptType: 'p2wpkh', isChange: true }] : []),
      { amount: '0', addressType: 'spend', opReturnData: Buffer.from(signedMemo, 'utf8').toString('base64') },
    ],
  }
  console.log(`  INTENT: Swap ${outputs[0].value} sat BTC for ${history.to_symbol} on ${history.to_chain_id}; fee ${originalFee} sat.`)
  if (mutation) console.log(`  ADVERSARIAL MUTATION: ${mutation}; reject when the signed memo differs from the claimed intent.`)
  console.log('  Synthetic prevout cannot broadcast. Review vault destination, BTC amount, fee, and OP_RETURN swap terms on every screen.')
  let signed = null, rejected = false
  try { signed = await (await getSdk()).btc.btcSignTransaction(tx) }
  catch (error) {
    rejected = /User cancelled signing on device|Signing rejected by user|Transaction rejected by user on emulator/i.test(String(error?.message || error))
    if (!rejected) throw error
  }
  if (mutation || process.env.KEEPKEY_EXPECT_REJECT === '1')
    assert('human rejected unreadable or mismatched screen; no signature', rejected && !signed)
  else assert('sign-only request returned signed bytes', !!signed?.serializedTx)
})
