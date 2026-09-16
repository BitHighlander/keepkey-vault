/** Sign-only review of a completed NEAR Intents 1Click ERC-20 deposit.
 * The source-chain transfer cannot prove its off-chain destination quote.
 * Private fixture contains the actual on-chain transaction and swap history;
 * no broadcast endpoint is called. */
const fs = require('node:fs')
const { run, ETH_PATH } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_NEAR_FIXTURE) {
  console.log('SKIP live historical NEAR Intents deposit')
  process.exit(0)
}
const { history, transaction: tx } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_NEAR_FIXTURE, 'utf8'))
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const amount6 = (s) => {
  const [whole, fraction = ''] = s.split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 6) throw Error('Invalid token amount')
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))
}

run('historical NEAR Intents USDT deposit — output-route audit', async (getSdk, assert) => {
  const data = tx.input
  const recipient = `0x${data.slice(34, 74)}`
  const rawAmount = BigInt(`0x${data.slice(74, 138)}`)
  assert('real transaction calls Ethereum USDT', tx.to.toLowerCase() === USDT)
  assert('real transaction is ERC-20 transfer', data.startsWith('0xa9059cbb') && data.length === 138)
  assert('history records token contract and separate deposit recipient',
    history.inbound_address.toLowerCase() === tx.to.toLowerCase() &&
    history.router.toLowerCase() === recipient.toLowerCase())
  assert('transfer amount equals recorded swap input', rawAmount === amount6(history.from_amount))
  console.log(`  CLAIMED INTENT: Swap ${history.from_amount} USDT for ${history.to_symbol} on ${history.to_chain_id} via NEAR Intents.`)
  console.log('  SIGNED EFFECT: Transfer USDT to the historical deposit recipient; output terms remain outside the signed transfer.')
  console.log('  Reject if Vault or device claims that the 1Click swap outcome is verified by this transfer.')
  let result = null, rejected = false
  try {
    result = await (await getSdk()).eth.ethSignTransaction({
      addressNList: ETH_PATH, to: tx.to, data, value: '0x0',
      nonce: '0x0', gasLimit: '0x186a0', gasPrice: '0x3b9aca00', chainId: 1,
    })
  } catch (error) {
    rejected = /User cancelled signing on device|Signing rejected by user/i.test(String(error?.message || error))
    if (!rejected) throw error
  }
  assert('reviewer rejected unverifiable output; no signature', rejected && !result)
})
