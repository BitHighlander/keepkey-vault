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
- 00:xx W3 audits launched (5 agents: b0/#475, b1, b2+b6, b3, b4+b5) -> scratchpad/audits/*.md.
- 00:xx W1 launched: pyk fork branch caps/715-716-split-20261005 (token profile default = pre-D-014 table; 7.16 opts in via --profile priority-only; 7.15 refusal tests restored under requires_firmware_below("7.16.0"); 7.16 tests version+capability gated).
- 00:xx W2: fork base branch release/715-stack-up-b0 = upstream #475 head e476580a0 (CI runs PRs into release/715-stack-*). Open question Q-1: upstream develop/#475 have no capability ledger, so b1's upstream PR would fail generate-test-report's waiver-authority gate ("candidate adds waivers absent from immutable authority") unless the ledger is accepted first (like fork #952) or the gate bootstraps when the base has no ledger.
- 01:xx W1 DONE (fork only): pyk `fork/caps/715-716-split-20261005` = 881dd4ce6 + `21477c8` (token profile: default `fill` restores the pre-D-014 table byte-identically — eth b23bcbee… 350 rows / uni b8fbccf7… 150 rows; `--profile priority-only` = D-014, byte-identical to 881dd4ce6; unlimited-approve refusal tests restored under requires_firmware_below("7.16.0"), sign tests need 7.16.0 + `erc20-unlimited-approve-review`; F-D permit tests need 7.16.0) + `c6babad` (version-gates Permit2 tests; pre-existing gap). Firmware `fork/caps/716-token-profile-20261005` on F-A: CMake passes `--profile priority-only` (`08cd1b6cb`), pin c6babad (`c5a91bae7`). Validation (native kkemu over UDP, Docker unavailable): 7.15 (b6 tree) 144 pass/14 version-skips/0 fail with and without env; 7.16 (F-D) 154/4/0. 7.15 blocks need NO ledger additions (version gates). 7.16 rehearsal blocks b9, b11–b15 and fork develop report 7.16.0 but still refuse unlimited approve → must list `erc20-unlimited-approve-review`.
  -> P-1 resolution for owner: fast-forward #197 to c6babad (D-017 OK), then 7.15 blocks pin c6babad (token table unchanged for 7.15).
- 01:xx Vault follow-ups DONE: feature-clearsign `bfb7adf4f..fd4f3ab95` (V-A Permit2 0x07 entry + token names; "Shared approval" wording [needs re-signing]; USDT0 provenance; SIGNED badge verifies firmware signatures; address-book claims only on "Contact verified" + probe-based certify; THORChain approve lookup; risk bar uses reviewed tokens). 977 unit pass / 5 known.
- 01:xx BLOCKER (owner): disk full (~600 MB free of 1.8 TB). Cause: 190 stale Chrome code-sign clones, ~268 GB, in /var/folders/7j/sqyjkcqx24b0s4qv9dbs0yx80000gn/X/com.google.Chrome.code_sign_clone/ (known Chrome-on-macOS bug; running Chrome maps only code_sign_clone.CDIaox). Auto-removal was denied by the safety classifier. Owner fix: quit Chrome, delete that folder, reopen Chrome. Until then local Docker (containerd read-only) is unavailable; validation moves to GitHub CI.
- 01:xx W2: upstream-shaped stack on the fork as DRAFT PRs (do not merge): b1 #953 (13,541 = rehearsal 13,529 + 12-line secret-scan commit), b2 #954 (7,955), b3 #955 (11,262), b4 #956 (7,455), b5 #957 (5,622), b6 #958 (561); bases chain from release/715-stack-up-b0 (#475 head). Heads = rehearsal heads, pins python-keepkey 2b2b218e8 (practice pin c6babad is not in keepkey/python-keepkey yet, so CI could not fetch it). CI running.
- 03:xx W3 audits DONE — all units NOT ACCEPTED as audited (reports: claude scratchpad audits/*.md). No memory-safety or display≠signed defect found in b2/b3/b6 signing paths. Release-blocking: pin gate (P-1, all blocks); b1-003 waiver bootstrap (Q-1); b1-004 BIP-85 unpaged renderer (fix only in b6); b0-001 release.yml at #475 can't find evidence (fixed by b1 — #475 must not be tagged alone). Medium: b0-003 PIN relock #946 (fix only on 7.16); b45-002 Zcash first screen shows unverified host total_amount; b1-005 ci.yml reverts upstream #474. Process: every block > 5k authored-line target with no recorded exception; #475 21,042 > 20k (split options A/B in b0 report).
- 03:xx W3b remediation started on up-stack copies (#953–#958 only; rehearsal stack/715-* and #475 untouched): block-owned fixes in owning block, then restack. Owner-decision items left alone: P-1, Q-1, b1-009 dice threshold, b2-002 (7.15 refuses unlimited approve — by design, D-010 is 7.16), size exceptions, Hive scope (b45-008/009), #475 split.
- 04:xx F-A #947 (c35aee50c): every build/unit/integration job green; only generate-test-report → release-evidence-gate → CI gate fail. Cause = audit finding b1-007 (report-gate unit test `test_candidate_can_narrow_immutable_ledger` is not hermetic: it reads the real PR base from the CI event and expects `osmosis-wire-guards` in that base's ledger; fork develop has since narrowed it). Same test ships in 7.15 b1, so upstream b1 would hit it too. Making the test hermetic (fixed authority via mock) was blocked by the safety classifier as a CI-gate change → OWNER DECISION Q-2: approve a hermetic-test fix (PR to fork develop + same change in b1), or another approach. F-A merge waits on it.
