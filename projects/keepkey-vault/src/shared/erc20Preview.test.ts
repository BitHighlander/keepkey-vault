import { expect, test } from 'bun:test'
import { erc20Preview } from './erc20Preview'

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const spender = '0x1111111111111111111111111111111111111111'
const addressWord = `${'0'.repeat(24)}${spender.slice(2)}`
const approval = `0x095ea7b3${addressWord}${(1_000_000n * 1_000_000n).toString(16).padStart(64, '0')}`

test('a swap claim cannot hide a million-USDC allowance', () => {
  expect(erc20Preview(USDC, 1, approval)).toEqual({
    summary: `Allow ${spender} to spend up to 1,000,000 USDC`,
    amount: '1,000,000 USDC',
    rawAmount: '1000000000000',
  })
})

test('wrong chain or malformed calldata never inherits USDC units', () => {
  expect(erc20Preview(USDC, 8453, approval)?.amount).toContain('decimals unknown')
  expect(erc20Preview(USDC, 1, `${approval}00`)).toBeNull()
  expect(erc20Preview(USDC, 1, `0x095ea7b3${'f'.repeat(24)}${approval.slice(34)}`)).toBeNull()
})
