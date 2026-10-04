# State of the system

What is true now, per subsystem, and what not to re-propose. Decisions and
their history are in `docs/DECISIONS.md`; update both when anything changes.
Last updated 2026-10-04.

Status words: **code** (written) · **wired** (reachable from the real entry
point) · **deployed** (live or flashed) · **verified** (passed on hardware in
a real user journey).

## Signing policy

- The one rule (D-007): native decode signs; 7.15 needs AdvancedMode for
  anything else; 7.16 signs KeepKey-certified payloads without AdvancedMode.
  AdvancedMode is session-only, cleared at boot and lock.
- Unlimited `approve` is reviewed, not refused (D-010). Open: unlimited
  EIP-2612/DAI permits are still refused.
- Do not re-propose: a per-gate decision list; asking a user to enable
  AdvancedMode as a workaround.

## ClearSign

- Model (D-018): no live signing. Recipes, names, token identities and
  Uniswap decoder entries are signed offline and served as static files;
  the device decodes the values. Desktop shows a richer host-side preview
  as advice.
- Trust chain (D-004): offline root on a KeepKey → per-chain delegate
  certificate (Ethereum, Solana, Base 8453, Arbitrum 42161; expiry
  2026-12-31) → delegate `a9531b9d` on the ClearSign worker.
- Formats on the device (7.16): v2 and 0x05 schemas (device-decoded),
  0x06 names, KKSOLSC1 Solana schemas. 0x07 Uniswap decoder: being restored
  with clean-up and split routes (D-018). Per-transaction v1 stays out of
  the certified tier.
- Live service: `https://keepkey-clearsign.bithighlander.workers.dev`
  (`projects/keepkey-vault/clearsign-worker`). Deploy only from a pushed
  commit (`make clearsign-worker-deploy`).
- Next: offline ceremony signing of the catalog; delegate key off
  Cloudflare (D-018).
- Do not re-propose: persisting signers to flash (D-003); an online
  per-transaction signer for the certified tier (D-018).

## Firmware size and memory (7.16 test line)

- Flash limit 655,321 bytes (D-013). After the integer printf (D-012) and
  removing the decoder: about 23 KB free (measured 632,284 B before the
  removal).
- SRAM reserve minimum 16,384 B; the CI budget allows at most +256 B per
  change without review.
- Next: token table to stablecoins plus the tokens the coins table and
  tests require (D-014).
- Do not re-propose: `nano.specs` (no `%lld`); removing the ed25519 base
  table; merging the AES implementations.

## Releases and branches

- Firmware: develop flow on the fork; block PRs onto develop; canonical pins
  python-keepkey #197 head and device-protocol #112 head (D-017).
- Never commit test keys, the test-key swap or test images. Keys live in
  `~/.keepkey-testkeys`, images in `~/keepkey-test-images`.

## User journeys

| Journey | Status | Notes |
|---|---|---|
| Uniswap on Base: approve to Permit2 | verified 2026-10-03 | certified approve, no AdvancedMode |
| Uniswap on Base: Permit2 signature | verified 2026-10-03 | after hdwallet fix `401068f4` |
| Uniswap on Base: swap | blocked | waits on the restored decoder (D-018) |
| Pump.fun buy/sell (PumpSwap) | verified 2026-10-02 | |
| Relay ETH ⇄ Solana | verified 2026-07-28 | |
| PIN unlock after idle | verified 2026-10-03 | D-011 |
