const assert = require('node:assert/strict')
const { VaultClient, SdkError } = require('../lib/client')

async function main() {
  const originalFetch = global.fetch
  try {
    const calls = []
    global.fetch = async (url) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ error: 'User cancelled signing on device' }), { status: 403 })
    }
    const client = new VaultClient('http://vault.test', 'existing-key', 'SDK Tests')
    await assert.rejects(
      client.post('/eth/sign-transaction', { value: '0x0' }),
      (error) => error instanceof SdkError && error.status === 403,
    )
    assert.deepEqual(calls, ['http://vault.test/eth/sign-transaction'], 'a rejected signing request must never be replayed')

    calls.length = 0
    global.fetch = async (url) => {
      calls.push(String(url))
      if (calls.length === 1) return new Response('Unauthorized', { status: 401 })
      if (calls.length === 2) return new Response(JSON.stringify({ apiKey: 'fresh-key' }), { status: 200 })
      return new Response(JSON.stringify({ signed: true }), { status: 200 })
    }
    const result = await client.post('/eth/sign-transaction', { value: '0x0' })
    assert.deepEqual(result, { signed: true })
    assert.deepEqual(calls, [
      'http://vault.test/eth/sign-transaction',
      'http://vault.test/auth/pair',
      'http://vault.test/eth/sign-transaction',
    ])
    assert.equal(client.getApiKey(), 'fresh-key')
    console.log('client auth: 403 refusal is terminal; 401 re-pairs and retries')
  } finally {
    global.fetch = originalFetch
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
