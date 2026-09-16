import { describe, expect, test } from 'bun:test'
import { cosmosDepositPreview } from './cosmosDepositPreview'

describe('native swap MsgDeposit preview', () => {
  const memo = '=:THOR.RUNE:thor1destination:4595288943:kk:30'
  const payload = {signDoc:{memo,msgs:[{type:'thorchain/MsgDeposit',value:{
    coins:[{asset:'THOR.TCY',amount:'19076905663'}],memo,signer:'thor1signer',
  }}]}}
  test('shows signed input and memo terms without claiming settlement verification', () => {
    const result = cosmosDepositPreview(payload,'THORChain')
    expect(result?.inputAmount).toBe('190.76905663')
    expect(result?.inputAsset).toBe('THOR.TCY')
    expect(result?.outputAsset).toBe('THOR.RUNE')
    expect(result?.destination).toBe('thor1destination')
    expect(result?.minimum).toBe('45.95288943 RUNE')
    expect(result?.affiliateFee).toBe('0.30%')
    expect(result?.warning).toContain('not independently verified')
  })
  test('warns when the two signed memo fields disagree', () => {
    expect(cosmosDepositPreview({signDoc:{...payload.signDoc,memo:'different'}},'THORChain')?.warning).toContain('differ')
  })
  test('does not treat another message type as a deposit', () => {
    expect(cosmosDepositPreview(payload,'Maya')).toBeUndefined()
  })
  test('makes a short swap memo with no signed minimum explicit', () => {
    const short = '=:z:t1recipient::keep:30'
    const input = {signDoc:{memo:short,msgs:[{type:'thorchain/MsgDeposit',value:{
      coins:[{asset:'THOR.RUNE',amount:'100000000'}],memo:short,signer:'thor1signer',
    }}]}}
    expect(cosmosDepositPreview(input,'THORChain')?.minimum).toBe('NO MINIMUM IN SIGNED MEMO')
  })
  test('formats Maya CACAO input with 1e10 base units', () => {
    const maya = {signDoc:{memo:'=:ETH.ETH:0xrecipient:100000000',msgs:[{type:'mayachain/MsgDeposit',value:{
      coins:[{asset:'MAYA.CACAO',amount:'123456789012'}],memo:'=:ETH.ETH:0xrecipient:100000000',signer:'maya1signer',
    }}]}}
    expect(cosmosDepositPreview(maya,'Maya')?.inputAmount).toBe('12.3456789012')
    expect(cosmosDepositPreview(maya,'Maya')?.minimum).toBe('1.00000000 ETH')
  })
})
