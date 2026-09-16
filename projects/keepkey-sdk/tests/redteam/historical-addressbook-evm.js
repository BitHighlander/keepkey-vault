/** Sign-only replay of a real address-book Ethereum payment. The original
 * recipient, token contract, amount and gas are retained; nonce is synthetic
 * for the connected emulator signer. No broadcast endpoint is used. */
const fs = require('node:fs')
const { run, ETH_PATH } = require('../_helpers')
if (process.env.KEEPKEY_REDTEAM_LIVE !== '1' || !process.env.KEEPKEY_EVM_PAYMENT_FIXTURE) {
  console.log('SKIP live historical address-book payment'); process.exit(0)
}
const { addressbook: a, transaction: t } = JSON.parse(fs.readFileSync(process.env.KEEPKEY_EVM_PAYMENT_FIXTURE, 'utf8'))
run('historical address-book Ethereum payment display audit', async (getSdk, assert) => {
  assert('on-chain transaction ID equals address-book record', t.hash.toLowerCase() === a.txid.toLowerCase())
  assert('Ethereum mainnet and legacy transaction', Number(BigInt(t.chainId)) === 1 && Number(BigInt(t.type)) === 0)
  assert('recorded sender equals on-chain sender', !a.from_address || a.from_address.toLowerCase() === t.from.toLowerCase())
  const known = {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  }
  let recipient, rawAmount
  if (a.symbol === 'ETH') {
    assert('plain ETH payment has no calldata', t.input === '0x')
    recipient = t.to
    rawAmount = BigInt(t.value)
  } else {
    assert('known token contract', t.to.toLowerCase() === known[a.symbol])
    assert('canonical ERC-20 transfer calldata', /^0xa9059cbb[0-9a-fA-F]{128}$/.test(t.input))
    const word = t.input.slice(10, 74)
    assert('canonical recipient word', /^0{24}[0-9a-fA-F]{40}$/.test(word))
    recipient = '0x' + word.slice(24)
    rawAmount = BigInt('0x' + t.input.slice(74))
    assert('ERC-20 transfer has no native ETH value', BigInt(t.value) === 0n)
  }
  const decimals = a.symbol === 'ETH' ? 18 : 6
  const [whole, fraction = ''] = a.amount.replace(/^\./, '0.').split('.')
  assert('on-chain amount equals recorded human amount', rawAmount === BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0')))
  const mutation = process.env.KEEPKEY_EVM_PAYMENT_MUTATION || ''
  const tx = { addressNList: ETH_PATH, to: t.to, value: t.value, data: t.input,
    nonce: '0x0', gasLimit: t.gas, gasPrice: t.gasPrice, chainId: 1 }
  if (mutation === 'recipient-substitution') {
    const attacker = '0x1111111111111111111111111111111111111111'
    if (a.symbol === 'ETH') tx.to = attacker
    else tx.data = t.input.slice(0, 34) + attacker.slice(2) + t.input.slice(74)
  } else if (mutation === 'amount-tenfold') {
    const tenfold = rawAmount * 10n
    if (a.symbol === 'ETH') tx.value = '0x' + tenfold.toString(16)
    else tx.data = t.input.slice(0, 74) + tenfold.toString(16).padStart(64, '0')
  } else if (mutation === 'gas-price-100x') {
    tx.gasPrice = '0x' + (BigInt(t.gasPrice) * 100n).toString(16)
  } else if (mutation) throw Error('Unknown payment mutation')
  if (mutation) assert('mutation changes signed transaction fields',
    tx.to !== t.to || tx.value !== t.value || tx.data !== t.input || tx.gasPrice !== t.gasPrice)
  console.log(`  INTENT: send ${a.amount} ${a.symbol} to ${recipient} on Ethereum mainnet. Mutation: ${mutation||'none'}.`)
  console.log('  Historical on-chain transfer, synthetic nonce and signer, sign-only; review Vault and OLED before approval.')
  let signed = null, rejected = false
  try { signed = await (await getSdk()).eth.ethSignTransaction(tx) }
  catch (e) { rejected = /cancelled|rejected/i.test(String(e?.message || e)); if (!rejected) throw e }
  if (process.env.KEEPKEY_EXPECT_REJECT === '1') assert('human rejected; no signature', rejected && !signed)
  else assert('sign-only signature returned', !!(signed?.serializedTx || signed?.v !== undefined))
})
