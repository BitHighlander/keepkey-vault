/** Preview the signed MsgDeposit fields. Memo swap terms are claims made by
 * the transaction, not independent proof of settlement or route safety. */
export interface CosmosDepositPreview {
  chain: string
  signer?: string
  inputAsset: string
  inputAmount: string
  memo: string
  outputAsset?: string
  destination?: string
  minimum?: string
  affiliateFee?: string
  warning: string
}
const amount = (raw: unknown, decimals = 8): string | undefined => {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return undefined
  const units = BigInt(raw), scale = 10n ** BigInt(decimals)
  return `${units / scale}.${(units % scale).toString().padStart(decimals,'0')}`
}

export function cosmosDepositPreview(payload: unknown, chain: 'THORChain'|'Maya'): CosmosDepositPreview | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const signDoc = (payload as any).signDoc
  const messages = signDoc?.msgs
  if (!Array.isArray(messages) || messages.length !== 1) return undefined
  const message = messages[0]
  const expectedType = chain === 'THORChain' ? 'thorchain/MsgDeposit' : 'mayachain/MsgDeposit'
  if (message?.type !== expectedType || !Array.isArray(message?.value?.coins) || message.value.coins.length !== 1) return undefined
  const coin = message.value.coins[0]
  // MAYAChain's native CACAO amount uses 1e10 base units; THORChain assets
  // use 1e8. The swap memo minimum remains its own 1e8 convention.
  const inputAmount = amount(coin?.amount, chain === 'Maya' ? 10 : 8)
  if (!inputAmount || typeof coin?.asset !== 'string') return undefined
  const memo = message.value.memo
  if (typeof memo !== 'string') return undefined
  const preview: CosmosDepositPreview = {
    chain, signer: typeof message.value.signer === 'string' ? message.value.signer : undefined,
    inputAsset: coin.asset, inputAmount, memo,
    warning: signDoc.memo !== memo
      ? 'The transaction memo and deposit memo differ. Review both raw fields before signing.'
      : 'Swap terms come from the signed memo. The destination and settlement outcome are not independently verified here.',
  }
  const parts = memo.split(':')
  if ((parts[0] === '=' || parts[0] === 'SWAP') && parts[1] && parts[2]) {
    preview.outputAsset = parts[1]
    preview.destination = parts[2]
    if (parts[3]) {
      const symbol = parts[1].split('.')[1] || parts[1]
      preview.minimum = `${amount(parts[3]) ?? `${parts[3]} (raw memo units)`} ${symbol}`
    } else preview.minimum = 'NO MINIMUM IN SIGNED MEMO'
    if (parts[5] && /^\d+$/.test(parts[5])) preview.affiliateFee = `${(Number(parts[5]) / 100).toFixed(2)}%`
  }
  return preview
}
