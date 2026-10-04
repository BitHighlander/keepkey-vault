# KeepKey ClearSign Worker

Production-facing 7.16 certified-description service for reviewed Relay and
Portals actions on Ethereum and Solana. It publishes status and provenance,
refuses unknown transaction shapes, and signs only with Cloudflare encrypted
secrets.

The delegate private key never belongs in this repository, `wrangler.toml`, a
command argument, or a Worker variable. The two public certificates are also
stored as secrets so provisioning is atomic and consistent across deployments.

## What leaves Vault

- Ethereum sends `chainId`, contract, selector, and calldata length. It does
  not send transaction arguments or calldata. KeepKey decodes the real values;
  the service cannot supply them.
- One exception: for an ERC-20 `approve` of a reviewed token, the request may
  include `spender`, the address in the calldata's first word. It is used to
  pick the description:
  - If `spender` is Uniswap Permit2 (`0x000000000022d473030f116ddee9f6b43ac78ba3`),
    the service returns the Uniswap entry. That schema pins Permit2 by
    address (argument format 6).
  - If `spender` is any other address, or is absent, the service returns the
    generic "Token approval" entry.

  The spender address therefore leaves the host for approvals only. No
  amount or other argument does. The value must be the real calldata
  spender. A pinned schema whose address differs from the calldata does not
  match on the device, and a failed certified claim is refused, not
  downgraded.
- Solana sends the unsigned transaction and, optionally, a reviewed catalog
  id. Without one, the service finds the single catalog entry whose program,
  discriminator, and exact instruction length match, and certifies it only
  when the firmware's certified rule applies (at most 8 instructions, and
  every other instruction a ComputeBudget, Memo, or static System transfer);
  anything else gets 422 and stays on the opaque path. It parses the
  transaction, resolves its lookup-table accounts from Solana RPC, and signs a
  binding to the exact message. For each token amount the matched schema
  shows, it attests the mint's immutable on-chain symbol and decimals when the
  mint is eligible; otherwise KeepKey shows the raw amount and full mint. Seeds, private keys, PINs,
  passphrases, and device signatures never leave KeepKey.

## Not covered yet

- Uniswap swaps (Universal Router `execute`) are not certified. Firmware no
  longer decodes the Universal Router, and 7.16 refuses a certified decoder
  entry (inner version 0x07), so the service offers none and a swap stays on
  the AdvancedMode path. Planned: certified per-transaction descriptions.
  The Permit2 approve entry and the Universal Router names (`/v1/evm/name`)
  are unaffected.

`GET /v1/catalog` lists, for every EVM entry, its `title`, `template`, and
the `screens` KeepKey shows, in device order. `EXPECTED-SCREENS.md` has the
same screens for owner review.

The Worker writes no transaction database. Cloudflare's platform-level
request and security telemetry remains governed by the account configuration.

## Verification and deployment

```sh
bun test clearsign-worker/src/index.test.ts
npx wrangler deploy --config clearsign-worker/wrangler.toml
```

Provision these encrypted secrets through stdin:

```sh
npx wrangler secret put CLEARSIGN_DELEGATE_PRIVATE_KEY --config clearsign-worker/wrangler.toml
npx wrangler secret put CLEARSIGN_CERTIFICATE_HEX --config clearsign-worker/wrangler.toml
npx wrangler secret put CLEARSIGN_SOLANA_CERTIFICATE_HEX --config clearsign-worker/wrangler.toml
```

`/ready` returns 200 when the delegate key matches fingerprint `a9531b9d` and
at least one root-signed, scope-correct certificate is active. `/v1/status`
reports Ethereum and Solana readiness separately; an unprovisioned scope always
fails closed. Before pointing Vault at a new deployment, test exact positive
routes and tampered chain, contract, selector, instruction length, program,
lookup table, certificate, and signature cases.
