/**
 * Human-review red team: the requesting app claims "swap 1 USDC", but the
 * actual Ethereum transaction grants an unrelated spender 1,000,000 USDC.
 * Sign-only: this test never calls a broadcast endpoint. The operator must
 * pass Vault's preview to inspect the real device screens, then REJECT on the
 * emulator. A timeout or firmware's automatic unlimited-approval refusal is
 * not a pass for this *visual* test.
 *
 * Run with KEEPKEY_REDTEAM_LIVE=1 and an approved SDK pairing.
 */
const { run, ETH_PATH, CHAINS, toHex, erc20Approve } = require('../_helpers')

if (process.env.KEEPKEY_REDTEAM_LIVE !== '1') {
  console.log('SKIP live red-team case (set KEEPKEY_REDTEAM_LIVE=1)')
  process.exit(0)
}

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNRELATED_SPENDER = '0x1111111111111111111111111111111111111111'
const MILLION_USDC_RAW = 1_000_000n * 1_000_000n

run('red team — swap claim hides million-USDC approval', async (getSdk, assert) => {
  const tx = {
    addressNList: ETH_PATH,
    to: USDC,
    value: '0x0',
    data: erc20Approve(UNRELATED_SPENDER, MILLION_USDC_RAW),
    nonce: '0x0',
    gasLimit: toHex(65000),
    gasPrice: toHex(20000000000),
    chainId: CHAINS.ETH,
  }
  assert('calldata is approve, not swap', tx.data.startsWith('0x095ea7b3'))
  assert('calldata binds unrelated spender', tx.data.toLowerCase().includes(UNRELATED_SPENDER.slice(2)))
  assert('calldata binds a million USDC raw units', tx.data.endsWith(MILLION_USDC_RAW.toString(16).padStart(64, '0')))

  console.log('  HOST CLAIM: Swap 1 USDC on Uniswap.')
  console.log('  ACTUAL TX: Grant 1,000,000 USDC allowance to', UNRELATED_SPENDER)
  console.log('  Review Vault and EVERY emulator page. REJECT on the emulator.')
  console.log('  No transaction is broadcast by this test.')

  let rejected = false
  try {
    await (await getSdk()).eth.ethSignTransaction(tx)
  } catch (error) {
    const message = String(error?.message || error)
    console.log('  Device result:', message.slice(0, 180))
    rejected = /(?:Transaction rejected by user on emulator|Signing rejected by user|User cancelled signing on device)/i.test(message)
  }
  assert('signing was rejected; no signature returned', rejected)
})
