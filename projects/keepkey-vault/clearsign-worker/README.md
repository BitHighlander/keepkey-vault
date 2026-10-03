# KeepKey ClearSign service

**Live at:** `https://keepkey-clearsign.bithighlander.workers.dev` (Cloudflare Worker `keepkey-clearsign`).
There is no custom domain yet; KeepKey Desktop has this URL built in
(`DEFAULT_CLEARSIGN_SERVICE_URL`, `src/bun/solana-certified-registry.ts`).

## What this is

A KeepKey can only show you what a transaction does if it understands the contract. For contracts it
does not know, it falls back to raw data and blocks unless AdvancedMode is on.

This service closes that gap without asking you to trust it blindly. For a transaction *shape* that
KeepKey has reviewed (a chain, a contract, a function, an exact calldata size), it returns a small
**signed description**: what each argument means, how to show it, and a one-line summary. Your KeepKey
checks the signature, then decodes the **real values from the transaction it is about to sign**, and
shows them as "certified by KeepKey". The service never supplies amounts or addresses; it cannot make
the device show something the transaction does not do.

If the service does not know a transaction, it says so (`422`, `OPAQUE`) and nothing changes: the
device uses its normal review.

## How trust works

```
Root key (offline, on a marked KeepKey)
   └─ signs a per-chain certificate:  "delegate a9531b9d may describe chain X until 2026-12-31"
        └─ delegate key (Cloudflare secret, used by this service)
             └─ signs a description for one transaction shape
                  └─ KeepKey firmware 7.16 checks: certificate → description → this exact transaction
```

- Root public key `02de9231…dae7` is built into 7.16 firmware. Its private key never leaves the root KeepKey.
- Delegate `0342f5f9…50cf`, fingerprint `a9531b9d`, alias "KeepKey Alpha 716", firmware key id `0x80`.
- **A certificate is per chain.** A chain without one cannot be certified, whatever the catalog says.
- Revocation: certificates expire (`2026-12-31`); firmware can raise its minimum expiry in a release.

## What it covers today

| Chain | Certificate | Certified transactions |
|---|---|---|
| Ethereum (1) | yes | Relay `bridgeDeposit`; Portals swap |
| Solana | yes | Pump AMM buy/sell; Relay deposits; SoltoshiDICE (session, tables, tournaments, Cee-lo) |
| Base, Arbitrum, others | **no** | nothing |

Name records (`/v1/evm/name`) cover Uniswap Universal Router addresses on Ethereum and Arbitrum.
`GET /v1/catalog` is the authoritative list.

### Being added (2026-10)

- Certificates for Base (8453) and other EVM chains (root ceremony on the root KeepKey).
- ERC-20 `approve` / `transfer` / `transferFrom` for listed tokens on every certified chain, with
  plain-language summaries such as "Allow Permit2 to spend up to UNLIMITED USDC".
- Uniswap Universal Router swaps (a description bound to the exact transaction).
- KeepKey Desktop asking this service for dapp transactions, not only its own swap screen.

## What leaves your computer

- **Ethereum:** chain id, contract address, function selector, calldata length. Never the arguments.
- **Solana:** the unsigned transaction (needed to resolve lookup tables and match the one reviewed
  instruction). Never keys, seeds, PINs, passphrases or signatures.
- The service stores no transaction database.

## API

All responses are JSON. CORS is open. Requests over the size limit get `413`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Human-readable status page |
| GET | `/health` | Liveness + readiness summary |
| GET | `/ready` | `200` when ready, `503` otherwise |
| GET | `/v1/status` | Full status: scopes, trust anchors, privacy, endpoints |
| GET | `/v1/catalog` | Every reviewed entry (cached 5 min) |
| GET | `/signer` | Delegate key, fingerprint, key id, scopes, certificate expiry |
| POST | `/v1/evm/schema` | Signed description for an EVM transaction shape (`/sign` is an alias) |
| POST | `/v1/evm/name` | Signed name for a reviewed EVM address |
| POST | `/v1/solana/certify` | Signed description (+ lookup-table proof, token identities) for a Solana transaction |

### Classifications

| `classification` | HTTP | Meaning |
|---|---|---|
| `VERIFIED` | 200 | Signed description returned; the device verifies it. |
| `OPAQUE` | 422 | Not in the reviewed catalog. Not an error: use the normal review. |
| `UNAVAILABLE` | 503 / 422 | The scope is not provisioned (no certificate or key), or a dependency (Solana RPC) failed. |

### `GET /signer`

```json
{"status":"ready","alias":"KeepKey Alpha 716","fingerprint":"a9531b9d",
 "publicKeyHex":"0342f5f9704494b3f9bd72295eecaf29d783d23ea02b2dc9f48abcd2e46d4850cf",
 "keyId":128,"scopes":{"ethereum":"ready","solana":"ready"},
 "certificateExpiresAt":"2026-12-31T00:00:00.000Z"}
```

### `POST /v1/evm/schema`

Request: only the transaction's shape.

```sh
curl -X POST https://keepkey-clearsign.bithighlander.workers.dev/v1/evm/schema \
  -H 'content-type: application/json' \
  -d '{"chainId":8453,"contract":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","selector":"0x095ea7b3","calldataLength":68}'
```

Not reviewed (today's answer for USDC approve on Base):

```json
{"classification":"OPAQUE","error":"contract, selector, or calldata shape is not in the reviewed catalog"}
```

Reviewed: `200` with `classification: "VERIFIED"`, `signedPayload` (hex, starts `03`), `keyId` (`128`),
`fingerprint`, and the matched `method`, `chainId`, `contract`, `selector`, `expectedCalldataLength`.
KeepKey Desktop passes `signedPayload` to the device as the transaction's metadata.

### `POST /v1/evm/name`

Request `{"chainId": 1, "address": "0x…"}`. Returns a signed name (`version: 6`) for a reviewed
address, or `422 OPAQUE`.

### `POST /v1/solana/certify`

Request `{"rawTx": "<base64 unsigned transaction>", "catalogKey": "<optional>"}`. Without
`catalogKey` the service finds the single reviewed instruction the transaction contains, and certifies
it only if the firmware's rule applies (at most 8 instructions; the others ComputeBudget, Memo or a
plain System transfer). Response: `schema` (payload, signature, signer key id), `certificate`,
`alias`, `fingerprint`, and when the transaction uses lookup tables, `lutProof` with the resolved
accounts.

## Operating it

```sh
bun test clearsign-worker/src/index.test.ts
npx wrangler deploy --config clearsign-worker/wrangler.toml
```

Secrets (set through stdin, never in this repo or `wrangler.toml`): `CLEARSIGN_DELEGATE_PRIVATE_KEY`,
`CLEARSIGN_CERTIFICATE_HEX` (Ethereum mainnet) and `CLEARSIGN_SOLANA_CERTIFICATE_HEX`. This worker
reads one EVM certificate; certificates for other EVM chains are part of the 2026-10 expansion.

`/ready` is `200` only when the delegate key matches `a9531b9d` and at least one root-signed,
scope-correct certificate is active. Before pointing KeepKey Desktop at a new deployment, test the
positive routes and the tampered ones (chain, contract, selector, length, program, lookup table,
certificate, signature).

Source: this folder plus the shared catalog and signing code in `src/bun/` —
`evm-certified-schema.ts` (EVM catalog + names), `solana-certified-schema.ts` (Solana catalog),
`clearsign-alpha-ceremony.ts` (root, delegate, certificates).
