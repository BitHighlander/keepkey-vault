/** SDK boundary regressions for the Sep-2026 TRON, Arbitrum, and TON incidents. */
const assert = require('node:assert/strict')
const { KeepKeySdk } = require('../lib')

async function main() {
  const calls = []
  const fakeClient = {
    signingTimeoutMs: 600000,
    post: async (path, body, timeoutMs) => {
      calls.push({ path, body, timeoutMs })
      if (path === '/tron/sign-transaction') return { signature: '11'.repeat(65) }
      if (path === '/eth/sign-transaction') return { serializedTx: 'deadbeef' }
      if (path === '/ton/build-transfer') return {
        bodyHash: '22'.repeat(32), rawTx: '22'.repeat(32), seqno: 4,
        expireAt: 2_000_000_000, needsDeploy: false, feeEstimate: '0.005',
        build: { ...body, toAddress: body.toAddress, _internal: { amountNano: body.amountNano } },
      }
      if (path === '/ton/finalize-transfer') return { boc: 'te6ccgEBAQEA', txid: '33'.repeat(32), broadcasted: false }
      if (path === '/api/v2/tx/broadcast') return { txid: '0x' + '44'.repeat(32) }
      throw new Error(`unexpected endpoint: ${path}`)
    },
  }
  const sdk = new KeepKeySdk(fakeClient)

  const tronRaw = '0a02abcd5a00'
  await sdk.tron.tronSignTransaction({ addressNList: [1, 2, 3], raw_tx: tronRaw })
  const tron = calls.find(call => call.path === '/tron/sign-transaction')
  assert.equal(tron.body.raw_tx, tronRaw, 'SDK must preserve authoritative TRON raw_data')
  assert.equal(tron.timeoutMs, fakeClient.signingTimeoutMs)

  await sdk.eth.ethSignTransaction({
    addressNList: [1, 2, 3], chainId: 42161, nonce: '0x04',
    gasLimit: '0x7530', gasPrice: '0x3b9aca00', value: '0x01',
    to: '0x24899a19342620092781d6d2182991229deab1e7', data: '0x',
  })
  const arbitrum = calls.find(call => call.path === '/eth/sign-transaction')
  assert.equal(arbitrum.body.chainId, 42161)
  assert.equal(arbitrum.body.gasLimit, '0x7530', 'SDK must not replace the Vault-selected L2 gas limit')

  const tonRequest = {
    fromAddress: '0:' + '11'.repeat(32),
    toAddress: '0:' + '22'.repeat(32),
    amountNano: '1000000000',
  }
  const built = await sdk.ton.tonBuildTransfer(tonRequest)
  const tonBuild = calls.find(call => call.path === '/ton/build-transfer')
  assert.equal(tonBuild.body.amountNano, '1000000000', 'SDK must preserve nanoTON as an integer string')
  assert.equal(built.build._internal.amountNano, '1000000000')

  await sdk.ton.tonFinalizeTransfer({ build: built.build, signature: '55'.repeat(64), broadcast: false })
  const tonFinalize = calls.find(call => call.path === '/ton/finalize-transfer')
  assert.strictEqual(tonFinalize.body.build, built.build, 'SDK must echo the verified build object without rebuilding it')
  assert.equal(tonFinalize.body.broadcast, false)

  await sdk.chain.broadcast({ networkId: 'eip155:42161', serialized: '0xdeadbeef' })
  const broadcast = calls.find(call => call.path === '/api/v2/tx/broadcast')
  assert.equal(broadcast.body.networkId, 'eip155:42161')
  assert.equal(broadcast.body.serialized, '0xdeadbeef')

  console.log('Transaction regression SDK contracts: passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
