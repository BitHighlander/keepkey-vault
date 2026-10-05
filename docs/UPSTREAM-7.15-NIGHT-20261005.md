# 7.15 upstream blocks — overnight preparation (2026-10-05)

Goal (owner, /goal): a fully audited set of release blocks, per the SOP, ready to
upstream after the owner's morning review. D-022: upstream 7.15 only, blocks
<= 20k changed lines, each Copilot-clean before human review (D-022 is the
owner's Copilot authorization for these frozen, upstream-shaped units).
SOP: firmware `docs/release/REHEARSAL-SOP.md` ("Measured definition of done for
one block", "Copilot only at the late external checkpoint", "Final upstream
SOP") on fork branch `docs/rehearsal-sop-canonical-pins-20261003`.

## Upstream sequence (verified)
Upstream `develop` = `fc1e93746`, an ancestor of the block base.

| # | Unit | Fork PR (rehearsal) | Adjacent lines | Head | Note |
|---|---|---|---|---|---|
| 0 | 7.14.3 release = upstream #475 (OPEN) | #938 | 21,042 vs upstream develop | `e476580a0` | over 20k: split proposal for owner |
| 1 | b1 core-ci (+ `4f9f2f36b` secret-scan allowance) | #894 | 13,529 | `30cd3859b` | |
| 2 | b2 evm | #895 | 7,955 | `4100df871` | |
| 3 | b3 erc7730 | #896 | 11,262 | `4f75bd28a` | |
| 4 | b4 chains | #897 | 7,455 | `e168f2f8d` | |
| 5 | b5 zcash | #898 | 5,622 | `829c7bbfd` | |
| 6 | b6 gaps | #899 | 561 | `a27c673fb` | |

## Findings so far
- P-1 (blocking, owner): python-keepkey #197 head `881dd4ce6` (pushed 2026-10-05 for
  7.16) carries 7.16-only behaviour that would change 7.15: the D-014 stablecoin token
  table (firmware builds its table from the pinned pyk) and ungated
  unlimited-approve-reviewed tests (7.15 refuses unlimited approve). The 7.15 blocks pin
  the previous head `2b2b218e8`. SOP-consistent fix: capability-select the token policy
  per firmware line and gate the approve tests; prepared on a fork branch, pushed to #197
  only with owner OK (D-017).

## Workstreams
- W1 python-keepkey capability split (fork branch, not #197 until OK).
- W2 upstream-shaped fork stack: frozen branches/PRs mirroring the upstream sequence,
  re-pinned to the canonical head, CI per head.
- W3 independent audit per unit (findings ledger: ID, severity, disposition, evidence).
- W4 Copilot on the frozen fork PRs (D-022), triage, fix, record review IDs.
- W5 morning receipt: per-unit scorecard + open decisions.

## Log
