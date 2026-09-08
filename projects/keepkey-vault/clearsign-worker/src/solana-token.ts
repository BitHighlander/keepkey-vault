import { createHash } from 'node:crypto'
import { utils } from 'ethers'
import bs58 from 'bs58'
import { createResilientSolanaAccountFetcher, type SolanaRpcConfig } from './solana-rpc'

export const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

/** Version 2 is a compact-review eligibility attestation, not merely a label.
 * The certified delegate checks the actual mint owner, scale and immutable
 * on-chain symbol, and excludes extensions that could change transfer amounts
 * or invoke other programs. No dapp text or off-chain URI is trusted/fetched.
 * Firmware binds the token program and mint again against the signed buy.
 */
export function inspectPumpToken(value: any, mint: string) {
  if (value === null) return undefined
  if (!value || value.executable || value.owner !== TOKEN_2022
    || value.data?.program !== 'spl-token-2022' || value.data?.parsed?.type !== 'mint') return undefined
  const info = value.data.parsed.info
  if (!info?.isInitialized || !Number.isInteger(info.decimals) || info.decimals < 0 || info.decimals > 9) return undefined
  const extensions = info.extensions
  if (!Array.isArray(extensions) || extensions.length !== 2) return undefined
  const pointer = extensions.find(e => e.extension === 'metadataPointer')?.state
  const metadata = extensions.find(e => e.extension === 'tokenMetadata')?.state
  if (!pointer || pointer.authority !== null || pointer.metadataAddress !== mint
    || !metadata || metadata.mint !== mint || metadata.updateAuthority !== null
    || typeof metadata.symbol !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/.test(metadata.symbol)) return undefined
  return { mint, tokenProgram: TOKEN_2022, symbol: metadata.symbol as string, decimals: info.decimals as number }
}

export function pumpTokenPreimage(token: { mint: string; tokenProgram: string; symbol: string; decimals: number }): Buffer {
  const decimals = Buffer.alloc(4); decimals.writeUInt32LE(token.decimals)
  return Buffer.concat([Buffer.from('KeepKeySolanaTokenDef/2'), Buffer.from(bs58.decode(token.mint)),
    Buffer.from(bs58.decode(token.tokenProgram)), decimals, Buffer.from(token.symbol, 'ascii')])
}

export async function certifyPumpToken(env: SolanaRpcConfig, mint: string, delegateKey: string, fetcher: typeof fetch = fetch) {
  const [token] = await createResilientSolanaAccountFetcher(env, 'jsonParsed', inspectPumpToken, fetcher)([mint])
  if (!token) return undefined
  const digest = createHash('sha256').update(pumpTokenPreimage(token)).digest('hex')
  const signed = new utils.SigningKey(`0x${delegateKey}`).signDigest(`0x${digest}`)
  return { ...token, signature: signed.r.slice(2) + signed.s.slice(2), signerKeyId: 0x80 }
}
