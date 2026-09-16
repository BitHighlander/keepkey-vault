/** Sign-only review of a real Ethereum ERC-20-origin THORChain swap. The
 * private fixture contains its completed on-chain deposit. Only expiry is
 * refreshed, so the historical token, amount, vault and memo remain exact.
 * No broadcast endpoint is called. */
const fs = require('node:fs')
const { run, ETH_PATH } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_ERC20_FIXTURE) {
  console.log('SKIP live historical ERC-20 swap case')
  process.exit(0)
}
const { history, transaction: tx } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_ERC20_FIXTURE, 'utf8'))
const mutation = process.env.KEEPKEY_MUTATION || ''
const tokens = {
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
}
const amount6 = (s) => {
  const [whole, fraction = ''] = s.split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 6) throw Error('Invalid token amount')
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))
}

run(`historical THORChain ${history.from_symbol} to ${history.to_symbol} — token-input audit`, async (getSdk, assert) => {
  const data = tx.input
  const body = data.slice(10)
  const word = n => body.slice(n * 64, (n + 1) * 64)
  const token = `0x${word(1).slice(24)}`
  const rawAmount = BigInt(`0x${word(2)}`)
  const memoLength = Number(BigInt(`0x${word(5)}`))
  const memo = Buffer.from(body.slice(6 * 64, 6 * 64 + memoLength * 2), 'hex').toString('utf8')
  assert('historical transaction calls THORChain router', tx.to.toLowerCase() === history.router.toLowerCase())
  assert('historical transaction is depositWithExpiry', data.startsWith('0x44bc937b'))
  assert('input token is the published Ethereum contract', token.toLowerCase() === tokens[history.from_symbol])
  assert('token raw units equal historical amount', rawAmount === amount6(history.from_amount))
  assert('on-chain memo matches swap history', memo === history.memo)
  assert('no native ETH leaves as swap input', BigInt(tx.value) === 0n)
  const refreshedExpiry = Math.floor(Date.now() / 1000) + 3600
  let refreshed = data.slice(0, 10 + 4 * 64) + BigInt(refreshedExpiry).toString(16).padStart(64, '0') + data.slice(10 + 5 * 64)
  if (mutation === 'input-token-usdc' && history.from_symbol === 'USDT') {
    refreshed = refreshed.slice(0, 10 + 64) + tokens.USDC.slice(2).padStart(64, '0') + refreshed.slice(10 + 2 * 64)
  } else if (mutation === 'input-amount-tenfold') {
    refreshed = refreshed.slice(0, 10 + 2 * 64) + (rawAmount * 10n).toString(16).padStart(64, '0') + refreshed.slice(10 + 3 * 64)
  } else if (['min-zero', 'destination-system', 'affiliate-fee-1000'].includes(mutation)) {
    const parts = memo.split(':')
    if (mutation === 'min-zero') parts[3] = '0'
    if (mutation === 'destination-system') parts[2] = '11111111111111111111111111111111'
    if (mutation === 'affiliate-fee-1000') parts[5] = '1000'
    const changed = Buffer.from(parts.join(':'), 'utf8')
    refreshed = refreshed.slice(0, 10 + 5 * 64) + BigInt(changed.length).toString(16).padStart(64, '0')
      + changed.toString('hex').padEnd(Math.ceil(changed.length / 32) * 64, '0')
  } else if (mutation) throw new Error(`Unsupported ERC-20 mutation: ${mutation}`)
  console.log(`  INTENT: Swap ${history.from_amount} ${history.from_symbol} for ${history.to_symbol} on ${history.to_chain_id}; historical minimum ${history.minimum_output} ${history.to_symbol}.`)
  if (mutation) console.log(`  ADVERSARIAL MUTATION: ${mutation}; compare actual input token and amount with intent, then reject.`)
  console.log('  Review input token/amount in human units, output chain/destination/minimum, fee and exact memo.')
  let result = null, rejected = false
  try {
    result = await (await getSdk()).eth.ethSignTransaction({
      addressNList: ETH_PATH, to: tx.to, data: refreshed, value: '0x0',
      nonce: '0x0', gasLimit: '0x27100', gasPrice: '0x3b9aca00', chainId: 1,
    })
  } catch (error) {
    rejected = /User cancelled signing on device|Signing rejected by user/i.test(String(error?.message || error))
    if (!rejected) throw error
  }
  if (mutation || process.env.KEEPKEY_EXPECT_REJECT === '1')
    assert('reviewer rejected the unreadable token-input screen; no signature', rejected && !result)
  else assert('sign-only request returned a signature', !!result)
})
