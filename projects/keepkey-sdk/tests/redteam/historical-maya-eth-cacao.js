/** Sign-only review of an actual completed Ethereum→Mayachain swap. Replays
 * the historical calldata as evidence, including its now-expired deadline;
 * the correct review decision is Reject. Never broadcasts. */
const fs = require('node:fs')
const { run, ETH_PATH } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_MAYA_FIXTURE) {
  console.log('SKIP live historical Maya case')
  process.exit(0)
}
const { history, transaction: tx } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_MAYA_FIXTURE, 'utf8'))
const amountWei = (s) => {
  const [whole, fraction = ''] = s.split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 18) throw Error('Invalid ETH amount')
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}

run('historical Mayachain ETH to CACAO — expired-call audit', async (getSdk, assert) => {
  assert('on-chain transaction calls the recorded Maya router', tx.to.toLowerCase() === history.router.toLowerCase())
  assert('on-chain transaction uses depositWithExpiry', tx.input.startsWith('0x44bc937b'))
  assert('on-chain ETH value matches the swap history', BigInt(tx.value) === amountWei(history.from_amount))
  const body = tx.input.slice(10)
  const expiry = Number(BigInt(`0x${body.slice(4 * 64, 5 * 64)}`))
  assert('historical replay has an expired deadline', expiry < Math.floor(Date.now() / 1000))
  const memoLength = Number(BigInt(`0x${body.slice(5 * 64, 6 * 64)}`))
  const memo = Buffer.from(body.slice(6 * 64, 6 * 64 + memoLength * 2), 'hex').toString('utf8')
  assert('on-chain memo matches recorded Maya swap', memo === history.memo && memo.includes('MAYA.CACAO'))
  console.log('  CLAIMED INTENT: Repeat historical ETH→CACAO Mayachain swap.')
  console.log('  SIGNED EFFECT: Expired depositWithExpiry call to historical Maya router.')
  console.log('  Reject unless Vault and emulator identify the protocol and expired deadline accurately.')
  let result = null, rejected = false
  try {
    result = await (await getSdk()).eth.ethSignTransaction({
      addressNList: ETH_PATH, to: tx.to, data: tx.input, value: tx.value,
      nonce: '0x0', gasLimit: '0x27100', gasPrice: '0x3b9aca00', chainId: 1,
    })
  } catch (error) {
    rejected = /User cancelled signing on device|Signing rejected by user/i.test(String(error?.message || error))
    if (!rejected) throw error
  }
  assert('operator rejected stale historical call; no signature', rejected && !result)
})
