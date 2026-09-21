# KeepKey ClearSign Worker

**Deployment note (2026-09-21 UTC):** this directory's keyless implementation is
not the currently deployed online signer. Production is based on `6a6985133` plus
the reviewed USDT catalog patch saved at
`../../../docs/clearsign-case-studies/uniswap-usdt/production-signer.patch`.
Current version: `d92f0031-a12f-4eeb-95dd-0ab52f38de3c`. Deploying this directory
directly would replace existing live Solana signing behavior and require an
artifact manifest that production does not currently use. See
`../../../docs/HANDOFF-UNISWAP-USDT-DEVICE-UNKN.md` before deployment.

Production-facing 7.16 certified-description service for reviewed Relay and
Portals actions on Ethereum and Solana. It publishes status and provenance,
refuses unknown transaction shapes, and serves only artifacts produced by the
offline ClearSign ceremony.

The delegate private key never belongs in this repository, `wrangler.toml`, a
command argument, a Worker variable, or Cloudflare. The Worker has no signing
API: it verifies each configured artifact against the root certificate,
delegate signature, scope, expiry, and hardcoded reviewed catalog, then serves
the original bytes unchanged.

## What leaves Vault

- Ethereum sends `chainId`, contract, selector, and calldata length. It does
  not send transaction arguments or calldata. KeepKey decodes the real values;
  the service cannot supply them.
- Solana sends the unsigned transaction and reviewed catalog id so the Worker
  can exact-match the program, discriminator, length, and account indices.
  Transactions using address lookup tables fail closed: their account list
  needs a transaction-bound signature, which this keyless service cannot make.
  Seeds, private keys, PINs, passphrases, and device signatures never leave
  KeepKey.

The Worker writes no transaction database. Cloudflare's platform-level
request and security telemetry remains governed by the account configuration.

## Verification and deployment

```sh
bun test clearsign-worker/src/index.test.ts
npx wrangler deploy --config clearsign-worker/wrangler.toml
```

Provision one artifact manifest through stdin:

```sh
npx wrangler secret put CLEARSIGN_ARTIFACTS_JSON --config clearsign-worker/wrangler.toml
```

Manifest format:

```json
{
  "version": 1,
  "evm": {
    "1:0xcontract:0xselector": "03...complete certified envelope..."
  },
  "solana": {
    "relayDepositNative": {
      "schema": { "payload": "0x...", "signature": "0x...", "signerKeyId": 128 },
      "certificate": "0x..."
    }
  },
  "revoked": ["1:0xcontract:0xselector", "solana:relayDepositNative"]
}
```

`/ready` returns 200 only when at least one artifact independently verifies.
`/v1/status` reports Ethereum and Solana readiness separately and exposes
`onlineSigningKey: false`; an invalid, expired, revoked, substituted, or
unprovisioned artifact always fails closed. Before pointing Vault at a new
deployment, test exact positive routes and tampered chain, contract, selector,
instruction length, program, certificate, signature, and revocation cases.
