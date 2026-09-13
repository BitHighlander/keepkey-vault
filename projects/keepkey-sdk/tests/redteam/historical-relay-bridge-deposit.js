/** Live, sign-only review of a completed Ethereum-origin Relay swap. The
 * fixture contains the actual on-chain bridgeDeposit transaction and private
 * wallet history. No broadcast endpoint is called; rejected runs return no
 * signature. The output route is deliberately not inferred from orderId. */
const fs = require('node:fs')
const { run, ETH_PATH } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_RELAY_FIXTURE) {
  console.log('SKIP live Relay history case (set KEEPKEY_REDTEAM_LIVE and KEEPKEY_RELAY_FIXTURE)')
  process.exit(0)
}
const { history, transaction: tx } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_RELAY_FIXTURE, 'utf8'))
const CONTRACT = '0x4cd00e387622c35bddb9b4c962c136462338bc31'
const SELECTOR = '0x49290c1c'
const SERVICE = process.env.CLEARSIGN_SERVICE_URL || 'https://keepkey-clearsign.bithighlander.workers.dev'
const amountWei = (s) => {
  const [whole, fraction = ''] = s.split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 18) throw Error('Invalid ETH amount')
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}

run('historical Relay bridgeDeposit — output-route audit', async (getSdk, assert) => {
  assert('actual on-chain call is Relay bridgeDeposit', tx.to?.toLowerCase() === CONTRACT && tx.input?.slice(0, 10) === SELECTOR && tx.input.length === 2 + 68 * 2)
  assert('on-chain depositor matches sender', (`0x${tx.input.slice(34, 74)}`).toLowerCase() === tx.from.toLowerCase())
  assert('on-chain ETH value equals recorded swap amount', BigInt(tx.value) === amountWei(history.from_amount))
  const response = await fetch(`${SERVICE}/v1/evm/schema`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chainId: 1, contract: CONTRACT, selector: SELECTOR, calldataLength: 68 }),
  })
  const envelope = await response.json()
  assert('service returned a certified Relay schema', response.ok && envelope.classification === 'VERIFIED' && envelope.version === 3 && !!envelope.signedPayload)
  console.log(`  CLAIMED INTENT: Historical ETH→${history.to_symbol} swap on ${history.to_chain_id} via Relay.`)
  console.log('  SIGNED EFFECT: ETH bridgeDeposit with depositor and opaque orderId; output terms are not encoded in this call.')
  console.log('  Decision: reject if the Vault and device cannot verify output chain, asset, destination, and minimum.')
  let result = null, rejected = false
  try {
    result = await (await getSdk()).eth.ethSignTransaction({
      addressNList: ETH_PATH, to: tx.to, data: tx.input, value: tx.value,
      nonce: '0x0', gasLimit: '0x1d4c0', gasPrice: '0x3b9aca00', chainId: 1,
      txMetadata: { signedPayload: envelope.signedPayload, keyId: envelope.keyId },
    })
  } catch (error) {
    rejected = /User cancelled signing on device|Signing rejected by user/i.test(String(error?.message || error))
    if (!rejected) throw error
  }
  if (process.env.KEEPKEY_EXPECT_REJECT === '1')
    assert('reviewer rejected the unverifiable swap output; no signature', rejected && !result)
  else assert('sign-only request returned a signature', !!result)
})
