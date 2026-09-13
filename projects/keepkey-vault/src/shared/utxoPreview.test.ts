import { describe, expect, test } from 'bun:test'
import { utxoPreview } from './utxoPreview'

describe('UTXO signing preview', () => {
  test('shows all economic effects and signed swap memo without claiming vault verification', () => {
    const memo = '=:ETH.ETH:0x1111111111111111111111111111111111111111:198939164:keep:30'
    const preview = utxoPreview({ coin: 'Bitcoin',
      inputs: [{ amount: '100002712' }], outputs: [
        { address: 'bc1vault', amount: '6000000' },
        { addressType: 'change', isChange: true, amount: '94000000' },
        { amount: '0', opReturnData: btoa(memo) },
      ] })
    expect(preview?.sends).toEqual([{ address: 'bc1vault', amount: '0.06000000 BTC' }])
    expect(preview?.change).toEqual(['0.94000000 BTC'])
    expect(preview?.fee).toBe('0.00002712 BTC')
    expect(preview?.swap?.minimum).toBe('1.98939164 ETH')
    expect(preview?.swap?.affiliate).toBe('0.30%')
    expect(preview?.warning).toContain('not independently verified')
  })

  test('does not invent a fee or readable memo from missing or binary input', () => {
    const preview = utxoPreview({ coin: 'Bitcoin', inputs: [{}], outputs: [
      { address: 'bc1vault', amount: '1' }, { amount: '0', opReturnData: btoa('\x00\x01') },
    ] })
    expect(preview?.fee).toBeUndefined()
    expect(preview?.memo).toBeUndefined()
    expect(preview?.warning).toContain('cannot be shown')
  })
  test('uses Litecoin units for a two-output vault deposit', () => {
    const memo = '=:ETH.ETH:0x1111111111111111111111111111111111111111:100000000'
    const preview = utxoPreview({coin:'Litecoin',inputs:[{amount:'12001152'}],outputs:[
      {address:'ltc1vault',amount:'12000000'},
      {amount:'0',opReturnData:btoa(memo)},
    ]})
    expect(preview?.coin).toBe('Litecoin')
    expect(preview?.sends[0].amount).toBe('0.12000000 LTC')
    expect(preview?.fee).toBe('0.00001152 LTC')
    expect(preview?.warning).toContain('LTC vault address')
  })
})
