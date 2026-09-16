/**
 * Sign-only clear-sign audit based on a completed ETH -> USDT THORChain swap.
 * The wallet-specific route/memo lives in KEEPKEY_HISTORY_FIXTURE, never in
 * the public test. This script does not call any broadcast endpoint and does
 * not print the signed transaction.
 */
const fs = require('node:fs')
const { run, ETH_PATH, CHAINS, toHex } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_HISTORY_FIXTURE) {
  console.log('SKIP live historical swap case (set KEEPKEY_REDTEAM_LIVE=1 and KEEPKEY_HISTORY_FIXTURE)')
  process.exit(0)
}

const history = JSON.parse(fs.readFileSync(process.env.KEEPKEY_HISTORY_FIXTURE, 'utf8'))
const outputSymbol = history.to_symbol || 'USDT'
const outputChain = history.memo?.split(':')[1]?.split('.')[0]
const mutation = process.env.KEEPKEY_MUTATION || ''
const memoParts = history.memo.split(':')
if (mutation === 'min-zero') memoParts[3] = '0'
else if (mutation === 'min-scientific') memoParts[3] = '1e8'
else if (mutation === 'min-streaming') memoParts[3] = '1e8/1/0'
else if (mutation === 'streaming-99') memoParts[3] += '/1/99'
else if (mutation === 'output-asset-eth') memoParts[1] = 'ETH.ETH'
else if (mutation === 'output-contract-fake') memoParts[1] = `${outputChain}.${outputSymbol}-0x1111111111111111111111111111111111111111`
else if (mutation === 'output-chain-eth') memoParts[1] = `ETH.${memoParts[1].split('.')[1]}`
else if (mutation === 'destination-substitution') memoParts[2] = '0x1111111111111111111111111111111111111111'
else if (mutation === 'affiliate-fee-1000') memoParts[5] = '1000'
else if (mutation) throw new Error(`Unknown KEEPKEY_MUTATION: ${mutation}`)
const actualMemo = memoParts.join(':')
const ZERO = '0x0000000000000000000000000000000000000000'
const word = (n) => BigInt(n).toString(16).padStart(64, '0')
const addressWord = (a) => a.slice(2).toLowerCase().padStart(64, '0')
const amountWei = (decimal) => {
  const [whole, fraction = ''] = decimal.split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 18) throw Error('Invalid ETH amount')
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}
const amount1e8 = (decimal) => {
  const [whole, fraction = ''] = decimal.split('.')
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > 8) throw Error('Invalid THORChain 1e8 amount')
  return BigInt(whole) * 10n ** 8n + BigInt(fraction.padEnd(8, '0'))
}

function encodeDeposit(vault, amount, memo, expiry) {
  const bytes = Buffer.from(memo, 'utf8')
  return '0x44bc937b' + addressWord(vault) + addressWord(ZERO) + word(amount)
    + word(160) + word(expiry) + word(bytes.length)
    + bytes.toString('hex').padEnd(Math.ceil(bytes.length / 32) * 64, '0')
}

run(`historical THORChain ETH to ${outputSymbol} — clear-sign audit`, async (getSdk, assert) => {
  assert('historical router is the Ethereum THORChain router', history.router?.toLowerCase() === '0xd37bbe5744d730a1d98d8dc97c42f0ca46ad7146')
  assert('historical vault address is present', /^0x[0-9a-fA-F]{40}$/.test(history.inbound_address))
  assert(`historical memo names ${outputSymbol} output on ${outputChain}`, history.memo?.toUpperCase().includes(`${outputChain}.${outputSymbol}`))
  assert('historical memo limit equals the recorded minimum output', history.memo?.split(':')[3] === amount1e8(history.minimum_output).toString())
  const amount = amountWei(history.from_amount)
  const expiry = Math.floor(Date.now() / 1000) + 3600
  const data = encodeDeposit(history.inbound_address, amount, actualMemo, expiry)
  assert('router calldata is depositWithExpiry', data.startsWith('0x44bc937b'))
  assert('ETH value equals router deposit amount', BigInt(`0x${data.slice(138, 202)}`) === amount)

  console.log(`  INTENT: Swap ${history.from_amount} ETH for ${outputSymbol} on ${outputChain} via THORChain; historical minimum ${history.minimum_output} ${outputSymbol}; maximum Ethereum gas fee 0.00016 ETH`)
  if (mutation) console.log(`  ADVERSARIAL MUTATION: ${mutation}; compare the signed memo against that intent and REJECT.`)
  console.log('  Review Vault and EVERY emulator page for asset, amount, destination, memo, and minimum output.')
  console.log('  Approve only if the on-screen effect matches. No broadcast; signed bytes are discarded.')
  const tx = {
    addressNList: ETH_PATH,
    to: history.router,
    value: toHex(amount),
    data,
    nonce: '0x0',
    gasLimit: toHex(160000),
    gasPrice: toHex(1000000000),
    chainId: CHAINS.ETH,
  }
  let signed = null
  let rejected = false
  try {
    signed = await (await getSdk()).eth.ethSignTransaction(tx)
  } catch (error) {
    rejected = /User cancelled signing on device|Signing rejected by user/i.test(String(error?.message || error))
    if (!rejected) throw error
  }
  if (mutation || process.env.KEEPKEY_EXPECT_REJECT === '1') {
    assert('operator rejected during display audit; no signature returned', rejected && !signed)
  } else {
    assert('signing completed without broadcast', !!signed && (!!signed.serializedTx || signed.v !== undefined))
  }
})
