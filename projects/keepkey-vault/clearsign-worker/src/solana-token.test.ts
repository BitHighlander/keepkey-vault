import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { utils } from 'ethers'
import { certifyPumpToken, inspectPumpToken, pumpTokenPreimage, TOKEN_2022 } from './solana-token'

const mint = '4nCmpwne7hCoWTSpAd54uENmCgHJrHTyn4DMPCEMpump'
function account() {
  return { executable: false, owner: TOKEN_2022, data: { program: 'spl-token-2022', parsed: { type: 'mint', info: {
    isInitialized: true, decimals: 6, extensions: [
      { extension: 'metadataPointer', state: { authority: null, metadataAddress: mint } },
      { extension: 'tokenMetadata', state: { mint, symbol: 'SDICE', updateAuthority: null } },
    ],
  } } } }
}
test('attests immutable on-chain identity, including program and amount scale', async () => {
  const value = account()
  const key = '11'.repeat(32) // public test key; never a production credential
  const fetcher = (async (_url: any, init: any) => {
    expect(JSON.parse(init.body).params).toEqual([[mint], { encoding: 'jsonParsed', commitment: 'confirmed' }])
    return Response.json({ result: { value: [value] } })
  }) as typeof fetch
  const token = await certifyPumpToken({ CLEARSIGN_SOLANA_RPC_ENDPOINT: 'https://rpc.example' }, mint, key, fetcher)
  expect(token?.symbol).toBe('SDICE'); expect(token?.decimals).toBe(6); expect(token?.signerKeyId).toBe(128)
  const digest = createHash('sha256').update(pumpTokenPreimage(token!)).digest('hex')
  const signature = new utils.SigningKey(`0x${key}`).signDigest(`0x${digest}`)
  expect(token?.signature).toBe(signature.r.slice(2) + signature.s.slice(2))
  expect(pumpTokenPreimage({ ...token!, decimals: 9 })).not.toEqual(pumpTokenPreimage(token!))
})
test('cannot certify site labels, another mint, mutable metadata or transfer-affecting extensions', () => {
  expect(inspectPumpToken(null, mint)).toBeUndefined()
  for (const mutate of [
    (a: any) => a.owner = 'attacker',
    (a: any) => a.data.parsed.type = 'account',
    (a: any) => a.data.parsed.info.decimals = 10,
    (a: any) => a.data.parsed.info.extensions[0].state.metadataAddress = 'anotherMint',
    (a: any) => a.data.parsed.info.extensions[1].state.mint = 'anotherMint',
    (a: any) => a.data.parsed.info.extensions[1].state.updateAuthority = mint,
    (a: any) => a.data.parsed.info.extensions[1].state.symbol = 'USD\nAPPROVED',
    (a: any) => a.data.parsed.info.extensions.push({ extension: 'transferFeeConfig' }),
    (a: any) => a.data.parsed.info.extensions.push({ extension: 'transferHook' }),
  ]) {
    const a = account(); mutate(a); expect(inspectPumpToken(a, mint)).toBeUndefined()
  }
})
