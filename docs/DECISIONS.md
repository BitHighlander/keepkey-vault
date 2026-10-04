# Decisions

Append-only log of product and architecture decisions for KeepKey firmware,
KeepKey Desktop and the ClearSign service. A decision is never edited away:
when it changes, add a new entry and mark the old one
`SUPERSEDED by D-xxx`. `docs/STATE.md` summarises the decisions that are
active now.

Before proposing a design, search this file for the topic, quote the active
decision, and say why the proposal does not reopen a superseded or rejected
one.

Peer comparison for these decisions (Trezor, Ledger):
`docs/research/hw-wallet-comparison-20261004.md`.

Format: `D-NNN` · date · status · decision · why · evidence.

---

## ClearSign

**D-001** · 2026-06-29 · SUPERSEDED by D-002, then reinstated as D-009
Per-transaction descriptions ("Insight", metadata v1): the host sends a
signed description bound to the transaction hash; the device checks the hash
against the digest it signs (`signed_metadata_enforce`). Runtime signers
only, behind AdvancedMode, additive (the raw review still follows).
Evidence: firmware PR #257; hardware-verified 2026-08-15 with a provider's
live server.

**D-002** · 2026-07-03 · SUPERSEDED by D-004
KeepKey runs no hot per-transaction signer for everyone's traffic. Reusable
schemas (v2), signed offline, where the device decodes each argument from the
calldata it signs. Pioneer `/descriptors/sign` was removed.
Clarified by D-004: this never meant "no per-transaction signing anywhere".

**D-003** · 2026-07-28 · ACTIVE
Never persist ClearSign signers to flash. Loaded signers are RAM-only and
need a device confirmation each session. A rogue persisted signer would
suppress the raw-data review. (Firmware PR #322 closed.)

**D-004** · 2026-08-15 · ACTIVE
Trust chain: an offline root key on a KeepKey certifies per-chain delegate
keys; a delegate signs descriptions. A provider may live-sign its own
transactions under its own certified key. Custody of the root is 1-of-1
(decisions #376 D1); no freshness anchor in 7.15 (D2).
Evidence: `docs/spec-clearsign-certificate-chains.md` (firmware), roadmap
#369, decisions #376.

**D-005** · 2026-08-21 · SUPERSEDED by D-009
Firmware `e44e4999d`: refuse v1 inside the certified envelope (a delegate
could label any calldata). Made without a decision entry and contrary to the
D-004 roadmap ("delegation exists for per-transaction v1"). The ClearSign
server kept building certified per-transaction descriptions on this basis
(keepkey-clearsign-server `14ad811`, 2026-09-25) that every 7.16 build
refused.

**D-006** · 2026-10-02 · ACTIVE
Human-readable review standard for every certified entry: who, what, why,
limit. Text classes: FACT (decoded by the device), VOUCHED (signed by
KeepKey), CLAIMED (the provider's words). No certified entry ships without
its expected screens reviewed first (`clearsign-worker/EXPECTED-SCREENS.md`).

**D-007** · 2026-10-03 · ACTIVE · the one signing rule
1. Firmware decodes it natively: sign, no AdvancedMode.
2. 7.15 (no KeepKey trust root): everything else needs AdvancedMode; with it
   on, a provider's description is shown together with the blind-sign
   information.
3. 7.16: a KeepKey-certified payload that verifies: no AdvancedMode.
   Anything else behaves as 7.15.
A refusal with no AdvancedMode path is a bug. Never ask a user to enable
AdvancedMode as a workaround for a missing clear-sign entry.

**D-008** · 2026-10-03 · SUPERSEDED by D-009
On-device Uniswap Universal Router decoder (metadata 0x07,
`uniswap_ur.c`). Built without reference to D-001/D-004/D-005. Each new
app shape (clean-up sweeps, split routes, V4) needed new firmware, and 7.16
had no flash left. Code kept in firmware history at `5c6b81c04`.

**D-009** · 2026-10-04 · ACTIVE (owner-confirmed; firmware `b59c909c0`)
Dapp descriptions are authored off-device by the ClearSign service and
streamed to the device; the device does not grow a decoder per dapp.
- Remove the 0x07 decoder (done: firmware `8bfa4ca16`).
- Admit certified per-transaction descriptions (v1 in the 0x03 envelope),
  bound to the transaction hash. Any ETH the transaction moves keeps the
  device's own amount screen.
- Trade-off accepted: v1 values are the delegate's words, not decoded facts.
  A stolen delegate key could mislabel a transaction it signs; expiry is the
  certificate's (2026-12-31).
- Supersedes SRS-7.16 R-1.4 and §5 ("per-transaction text in 7.17") on this
  point. The SRS lives on the firmware fork's `alpha` branch and needs a
  matching amendment.
- Serving: the certified per-transaction route from keepkey-clearsign-server
  `14ad811` moves into the canonical ClearSign worker, using its full
  Universal Router decoder (incl. V4); anything not fully explained is
  declined (422 OPAQUE).

## Signing policy

**D-010** · 2026-10-03 · ACTIVE
Unlimited ERC-20 `approve` is reviewed ("an UNLIMITED amount"), not
refused. Dapps such as Uniswap's Permit2 approve offer no cap.
Open inconsistency: unlimited EIP-2612/DAI permits are still refused in the
streamed EIP-712 path (7.16 exempts canonical Permit2 only). Trezor and
Ledger show "Unlimited" and allow it.

**D-011** · 2026-10-03 · ACTIVE
An accepted PIN renews the idle deadline (firmware `note_pin_accepted`).
Host traffic alone never renews it. Issue #946.

## Firmware size

**D-012** · 2026-08-04 · ACTIVE (dropped by the develop re-author, restored
2026-10-04)
Device builds route `snprintf` to newlib's integer-only engine
(`-Dsnprintf=sniprintf -Dvsnprintf=vsniprintf`, about −22 KB). `%llu` works.
Distinct from `nano.specs`, which lacks `%lld` and stays rejected.
Firmware `f166150c0`, restored on the 7.16 line as `bfa30f97b`.

**D-013** · 2026-10-03 · ACTIVE
Link firmware against the size bootloader 2.1.4 actually installs:
655,321 bytes (upload frame = 38-byte prefix + image, must be < 0xA0000).
Firmware `2ebc75cc6`.

**D-014** · 2026-10-04 · ACTIVE
ERC-20 token table: stablecoins, plus the tokens the coins table and test
fixtures still require (owner: "leave whatever tokens needed"). The majors
list and the address-order filler go; everything else is described by
signed ClearSign metadata (the direction of
`docs/security/token-table-retirement.md`, firmware, 2026-08-14).
Supersedes the 500-row budget of `token_policy.py`.

**D-015** · 2026-10-04 · ACTIVE
Zcash Orchard stays in the default firmware image (`KK_ZCASH_PRIVACY` on).

## Process

**D-016** · 2026-10-04 · ACTIVE
`docs/STATE.md` and this file are the single source of truth. Every session
reads them before designing and updates them when a decision changes. A
re-author or backport lists the fixes it must carry and checks each one
landed (D-012 was lost this way).

**D-017** · standing · ACTIVE
Never delete branches after merging; PRs stay open as history; every PR pins
the HEAD of the single canonical upstream PR (python-keepkey #197,
device-protocol #112); upstream merges and pushes to canonical branches need
the owner's explicit OK.
