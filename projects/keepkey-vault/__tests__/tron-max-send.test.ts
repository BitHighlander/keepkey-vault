import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { buildTx } from '../src/bun/txbuilder'
import { CHAINS } from '../src/shared/chains'

const tron = CHAINS.find(c => c.id === 'tron')!
const tronAddress = 'TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax'
const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let originalFetch: typeof fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('TRON max send', () => {
  test('native TRX max sends balance minus the fee reserve', async () => {
    let transactionRequest: any

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/wallet/getaccount')) {
        return jsonResponse({ balance: 12_345_678 })
      }
      if (url.endsWith('/wallet/createtransaction')) {
        transactionRequest = JSON.parse(String(init?.body ?? '{}'))
        return jsonResponse({
          txID: 'native-max',
          raw_data: {},
          raw_data_hex: '0a00',
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const result = await buildTx({}, tron, {
      chainId: 'tron',
      to: tronAddress,
      amount: '0',
      isMax: true,
      fromAddress: tronAddress,
    })

    expect(transactionRequest.amount).toBe(11_245_678)
    expect(result.unsignedTx.amount).toBe('11245678')
    expect(result.fee).toBe('1.1')
  })

  test('TRC-20 max reserves one token base unit before encoding transfer amount', async () => {
    let contractRequest: any

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/wallet/triggersmartcontract')) {
        contractRequest = JSON.parse(String(init?.body ?? '{}'))
        return jsonResponse({
          transaction: {
            txID: 'trc20-max',
            raw_data: {},
            raw_data_hex: '0a00',
          },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const result = await buildTx({}, tron, {
      chainId: 'tron',
      to: tronAddress,
      amount: '0',
      isMax: true,
      fromAddress: tronAddress,
      caip: `tron:0x2b6653dc/trc20:${usdtContract}`,
      tokenBalance: '123.45',
      tokenDecimals: 6,
    })

    expect(contractRequest.contract_address).toBe(usdtContract)
    expect(contractRequest.function_selector).toBe('transfer(address,uint256)')
    expect(BigInt(`0x${contractRequest.parameter.slice(64)}`)).toBe(123_449_999n)
    expect(result.unsignedTx.tronGridTx.txID).toBe('trc20-max')
    expect(result.fee).toBe('100')
  })

  test('recovers the exact USDT contract from the legacy lowercased CAIP', async () => {
    let contractRequest: any
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/wallet/triggersmartcontract')) {
        contractRequest = JSON.parse(String(init?.body ?? '{}'))
        return jsonResponse({ transaction: { txID: 'lowercase-usdt', raw_data: {}, raw_data_hex: '0a00' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    await buildTx({}, tron, {
      chainId: 'tron', to: tronAddress, amount: '50', fromAddress: tronAddress,
      caip: 'tron:0x2b6653dc/token:tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t', tokenDecimals: 6,
    })

    expect(contractRequest.contract_address).toBe(usdtContract)
    expect(contractRequest.function_selector).toBe('transfer(address,uint256)')
    expect(BigInt(`0x${contractRequest.parameter.slice(64)}`)).toBe(50_000_000n)
  })

  test('never falls back to native TRX for an unresolvable token CAIP', async () => {
    globalThis.fetch = (async () => { throw new Error('network must not be reached') }) as typeof fetch
    await expect(buildTx({}, tron, {
      chainId: 'tron', to: tronAddress, amount: '50', fromAddress: tronAddress,
      caip: 'tron:0x2b6653dc/token:tinvalidlowercasecontract0000000000', tokenDecimals: 6,
    })).rejects.toThrow(/case-sensitive TRON token contract/)
  })
})
