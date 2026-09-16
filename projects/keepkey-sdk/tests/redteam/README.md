# Live swap signing audit

Work in self-contained batches by transaction family. For each batch, first
validate the historical on-chain destination, amount, memo, and fee against
the private fixture. Then run its clear-sign and adversarial sign-only cases
through the live Vault and emulator, capture every Vault/OLED page, and make
the approve/reject decision from the displayed terms. Close the batch with
one evidence index listing each distinct case, the decision, SDK result,
signature status, broadcast-route audit, and any display gap. Count only
fully reviewed cases; keep interrupted or unreadable runs separate. Resume
from the index rather than repeating completed cases.

The BTC-origin THORChain batch uses `historical-thor-btc.js`. Its private
fixture contains a completed BTC deposit and OP_RETURN memo, while the
sign-only request uses a fresh synthetic input outpoint. The swap memo must
be an explicit third output with base64 `opReturnData`: the Vault REST schema
does not pass through a top-level `opReturnData` field. Review all device
pages; the first page is the BTC vault send, followed by the decoded memo
asset, destination, minimum, affiliate fee, and final amount including fee.
Vault now displays the BTC output, change, network fee, memo, and decoded
terms, with an explicit warning that it has not authenticated the vault or
the swap outcome. The first fully reviewed BTC clear-sign case and a
zero-minimum rejection are in the private `thor-btc-history` evidence folder.
`live-btc-driver.ts` runs further BTC cases against the live app, records the
exact REST payload, Vault text, each OLED PNG and OCR, the SDK result, and
all SDK API routes. It rejects unexpected screens and any unrecognized
amount. If Vision OCR misreads the tiny final fee, set
`KEEPKEY_MANUAL_FINAL=1`; the driver pauses for a bounded review of the
saved final image and reads `final-decision.txt` before pressing the emulator.
Two-output BTC deposits (vault plus OP_RETURN, no change) are covered too.
The private BTC reports record each counted decision and its broadcast audit.

THORChain-native `MsgDeposit` cases use on-chain transactions fetched from
THORNode's Cosmos transaction endpoint, as documented by
[Cosmos](https://docs.cosmos.network/sdk/v0.50/learn/advanced/transactions)
and [THORChain](https://dev.thorchain.org/concepts/connecting-to-thorchain.html).
The live emulator signer and account sequence are substituted; the on-chain
input asset, amount, and memo are retained. `live-thor-native-driver.ts`
captures the Vault payload and all eleven device pages. Four matched-input
cases and three more cases whose history amount exceeds the on-chain input
by 0.04 RUNE have been approved after using the on-chain amount as the
claimed intent. Three memo/amount mutations and one large real history
amount mismatch were rejected. The live RUNE→ZEC short-memo probe is a
separate gap: the history records a minimum, but the signed `=:z:` memo has
no minimum, and the emulator shows raw memo text. Vault explicitly says
`NO MINIMUM IN SIGNED MEMO`.

Maya-native `MsgDeposit` transactions were fetched from the
[MAYANode endpoint](https://docs.mayaprotocol.com/mayachain-dev-docs/concepts/connecting-to-mayachain).
CACAO uses 1e10 base units per the [Maya CLI documentation](https://docs.mayaprotocol.com/mayachain-dev-docs/cli/multisig);
Vault now formats that input correctly. Both historical Maya-origin swap
memos omit a signed minimum. One was rejected live after Vault disclosed the
absence and the emulator showed only raw memo text; it is a gap, not a
clear-sign count. At that checkpoint, the private ledgers contained 35
clear-sign and 35 adversarial cases; the latest totals are in the batch
closeout below.

Run cases against Vault and the emulator with an existing SDK pairing. These
scripts call signing endpoints only; they never call broadcast endpoints. Keep
wallet-specific transaction details and OLED captures in a private evidence
directory, not in committed fixtures.

Each case counts only when its evidence record contains the host's claimed
intent, the exact transaction effect, the Vault preview, every device page,
the human approve/reject decision, the SDK result, and confirmation that no
signature was returned for a rejected case. A timeout, a firmware refusal
before a readable screen, or a generic API error alone does not prove that a
person could detect the deception. On a device rejection, Vault must not open
a new pairing or repeat the signing request.

The current wallet contains 101 recorded swaps: 47 Thorchain, 29 NEAR
Intents, 21 Relay, and 4 Mayachain. Prioritize ETH/USDT, BTC/ETH,
SOL/ETH, ETH/SOL, and cross-chain cases from those routes. Derive test
patterns from history, but use sign-only requests and redact wallet-specific
details from public fixtures.

`erc20-approval-disguised-as-swap.js` is the first live adversarial case. The
host claims a 1 USDC swap while calldata grants a 1,000,000 USDC allowance
to an unrelated spender. The emulator visibly identifies the allowance, so
the correct human decision is Reject. Vault currently displays the raw
`1000000000000` amount without the USDC unit or decimal conversion in the
first capture. The rebuilt live app now shows an explicit allowance summary,
the formatted USDC amount, and the raw amount; the rerun was rejected on the
emulator with no signature.
The private evidence record is at
`~/.keepkey/qa-evidence/swap-claim-million-usdc-approval/report.json`.

`historical-thor-eth-usdt.js` reads a private fixture derived from an actual
completed ETH→USDT THORChain swap. Its first live audit found that firmware
showed the 1e8 memo minimum as `8309278435`, leaving a person unable to read
the 83.09278435 USDT minimum. The firmware now formats plain numeric limits
as output-asset units; the rebuilt emulator showed the corrected minimum and
completed a sign-only run with no broadcast. Vault now shows the decoded
output minimum, destination, affiliate fee, and exact memo too. The record is
at `~/.keepkey/qa-evidence/historical-thor-eth-usdt-report.json`. Vault keeps
the raw transaction value on the right as an audit field.

Three adversarial mutations of that historical swap have also been exercised
in the live app and rejected on the emulator: output destination substitution,
zero minimum output, and a 10% affiliate fee. Their private reports are
`historical-thor-destination-substitution-report.json`,
`historical-thor-min-zero-report.json`, and
`historical-thor-affiliate-fee-report.json` in `~/.keepkey/qa-evidence/`.
The fee case prompted a firmware and Vault change from raw `1000 bps` to a
visible `10.00%`; its report retains before and after device captures.
Scientific notation is another live-verified adversarial case: changing the
historical minimum to `1e8` would allow 1 USDT output. Vault and firmware now
show that effective `1 USDT` minimum, and the emulator rejection returned no
signature. The private evidence is
`~/.keepkey/qa-evidence/historical-thor-scientific-limit-report.json`.
The `1e8/1/0` streaming variant is also live-verified: both screens now show
the 1 USDT minimum and the one-block interval with network-selected swap
count. Its private evidence is
`~/.keepkey/qa-evidence/historical-thor-streaming-limit-report.json`.

For a self-contained THORChain pass, run from the SDK root:

```sh
bun tests/redteam/live-reject-driver.ts min-streaming
KEEPKEY_HISTORY_FIXTURE="$HOME/.keepkey/qa-evidence/historical-thor-fixtures/00.json" bun tests/redteam/live-reject-driver.ts clear
```

The driver uses the existing Vault pairing, checks the live Vault preview,
captures and OCRs each OLED page, advances only through recognized THORChain
pages, rejects on the named mismatch, and writes a private JSON report with
screen hashes, SDK result, and route audit. It fails if a screen repeats, a
page is unexpected, signing is not refused once, or any broadcast route
appears. Supported mutations are `min-zero`, `min-scientific`,
`min-streaming`, `destination-substitution`, `affiliate-fee-1000`,
`output-asset-eth`, and `streaming-99`.
The history-derived signer also accepts `output-contract-fake` with an ETH→USDC
fixture; it substitutes an unrelated contract while keeping the USDC ticker.
For `clear`, it compares the history fixture with Vault's exact memo, input,
minimum, output destination, and router; it requires the expected OLED terms
before confirming the final transaction. The returned signature is discarded.
Review the saved images and text before counting a case as human-readable.

Eleven distinct completed ETH→USDT THORChain swaps from the current wallet
have been exercised with `clear`, including the original approved case. The
private per-fixture evidence index is
`~/.keepkey/qa-evidence/thor-eth-usdt-clear-ledger.json`. Each indexed run
has a successful sign-only SDK result, Vault text, every OLED capture, and
an API route audit with no broadcast. These cases share a route and output
asset; further clear-sign coverage should span the other historical routes.
Three additional completed ETH→USDC swaps and five ETH-origin cross-chain
swaps (to BTC, TRON, THORChain, Cosmos, and Base) have been run with `clear`.
All 19 distinct clear-sign fixtures were rerun with an explicit 0.00016 ETH
maximum gas-fee intent. The saved final OLED images were visually checked;
the private per-case index is
`~/.keepkey/qa-evidence/thor-eth-clear-ledger-20260913.json`.
The earlier 0.0032 ETH fee runs are retained as evidence but excluded from
this fee-reviewed ledger. The current Vault approval dialog now shows the
maximum network fee from the exact signing request; its live display was
verified in `driver-output-contract-fake-1789281506183/report.json`.

The fake-USDC-contract mutation exposed a misleading Vault headline: it
called the swap USDC even though the memo named `0x111…111` instead of
Circle's Ethereum USDC contract. Vault now repeats an **UNVERIFIED USDC token
contract** warning in the headline and details. The rebuilt live app and OLED
were checked, the emulator was rejected, and one 403 signing call with no
broadcast is recorded at
`~/.keepkey/qa-evidence/driver-output-contract-fake-1789280532365/report.json`.
The known Ethereum USDC and USDT addresses in Vault's preview are pinned from
[Circle's USDC contract list](https://developers.circle.com/stablecoins/usdc-contract-addresses)
and [Tether's supported protocols](https://tether.to/ru/supported-protocols/);
all other output contracts still need independent verification.

Cross-chain adversarial coverage now includes a zero BTC minimum, a fake Base
USDC contract, a Base→Ethereum output-chain substitution, a 10% TRON affiliate
fee, a one-RUNE minimum, and 99 streaming swaps for ATOM. Each was checked in
the live Vault and emulator, rejected on the named screen, and audited for a
single 403 signing call with no broadcast. The private index for all 15
distinct adversarial cases is
`~/.keepkey/qa-evidence/adversarial-ledger-20260913.json`; the clear-sign
ledger contains 19 distinct history-derived cases. OCR occasionally reads
small OLED characters incorrectly, so a driver pass alone is never counted
without reviewing the saved PNG.

The first real Relay review used an on-chain `bridgeDeposit` from a completed
ETH→SOL swap. Its certified schema identifies the method, depositor, and
order ID, but the signed calldata has no SOL output chain, recipient, or
minimum. The seven OLED pages likewise cannot prove the swap outcome. It was
rejected on the final device page and is **not counted as clear-sign**. Vault
now labels the badge “Call schema verified” and warns that Relay output is
not verified by this signature. The live before/after record is private at
`~/.keepkey/qa-evidence/relay-bridge-real-output-gap-report.json`. The SDK
case is `historical-relay-bridge-deposit.js`, fed from a private on-chain
transaction fixture; it calls signing only and never broadcasts.
Relay's [quote API](https://docs.relay.link/references/api/get-quote-v2)
describes destination terms in the quote response, separate from the
`bridgeDeposit` transaction. A certified argument schema authenticates the
on-chain call shape; it cannot reconstruct those quote terms from an opaque
order ID.

The first real Mayachain review replayed the exact calldata of a completed
ETH→CACAO swap after its deadline. Vault correctly required Advanced Mode, so
the reviewer rejected before any emulator signing screen. The first preview
incorrectly called the router THORChain and presented an empty memo limit as
`0 CACAO`. The rebuilt Vault now uses router identity to label Mayachain and
shows **NO MINIMUM** and **EXPIRED** in the action, with an explicit expiry
field. The current ETH router address was checked against
[MAYANode inbound addresses](https://mayanode.mayachain.info/mayachain/inbound_addresses).
The sign-only result was one 403 with no broadcast. Private evidence is
`~/.keepkey/qa-evidence/maya-expired-replay-report.json`. This is a blocked
gap finding, not a counted clear-sign or emulator-screen adversarial case.

Five completed Ethereum token-input THORChain swaps (USDT/USDC→ETH, SOL,
USDC, and Base ETH) are now audited in the live app. The first pass found
Vault presenting `999999999 raw token units` while the firmware correctly
showed `999.999999 USDT`. Vault now formats only exact pinned Ethereum USDC and
USDT contracts using six decimals, retaining the address and verification
label; unknown token contracts keep raw units and an explicit warning. All
five were rerun as sign-only approvals with reviewed OLED input/final screens,
one successful signing route each, and no broadcast. Their private reports
are indexed alongside the earlier cases in
`~/.keepkey/qa-evidence/clear-ledger-20260913.json` (24 distinct clear-sign
cases total). The SDK case is `historical-thor-erc20.js`; its fixture contains
the completed on-chain transaction, with only expiry refreshed for signing.
Five token-input red-team mutations were then exercised against the real
USDT→SOL fixture: substitute USDC input, increase the USDT input tenfold,
remove the SOL minimum, substitute the output address, and raise the affiliate
fee to 10%. Vault and OLED displayed each changed term; each was rejected on
device with one 403 signing route and no broadcast. The private adversarial
index is now `~/.keepkey/qa-evidence/adversarial-ledger-20260913-v2.json`
(20 distinct cases).

The first real NEAR Intents 1Click review used a completed USDT→SOL swap.
The signed Ethereum call is a plain ERC-20 transfer. Vault and OLED correctly
show the USDT amount and recipient, but cannot prove SOL, its Solana recipient,
or the output minimum; these terms are in the 1Click quote, not in the signed
transfer. In this historical row, `swap_history.inbound_address` is the USDT
contract and `swap_history.router` matches the transfer's deposit recipient.
That authenticates the recorded deposit address for this completed swap, but
does not prove output terms for a new signing request. The reviewer rejected on-device,
one 403 was logged and no broadcast occurred. Private evidence is
`~/.keepkey/qa-evidence/near-intents-usdt-sol-output-gap-report.json`.
This is an output-verification gap, not a counted clear-sign or adversarial
success. The sign-only SDK case is `historical-near-intents-deposit.js`.

Four more token-input attacks used distinct completed swap rows: USDT→Base ETH
changed to USDC input, USDT→ETH increased input tenfold, USDT→USDC removed the
minimum, and USDC→ETH raised the affiliate fee to 10%. Each change was visible
in Vault and on the saved emulator screen; each was rejected with one 403 and
no broadcast. The private adversarial index is
`~/.keepkey/qa-evidence/adversarial-ledger-20260913-v3.json` (24 cases).

The output-asset substitution and 99-swap streaming cases have now been
reviewed in the live app. The former changes the intended USDT output to ETH;
the latter keeps the USDT minimum but changes a one-shot swap into 99 swaps.
Vault and OLED show the changed terms, the emulator was rejected, and both
reports show a single 403 signing request with no broadcast. Reports are in
`~/.keepkey/qa-evidence/driver-output-asset-eth-1789279519503/` and
`~/.keepkey/qa-evidence/driver-streaming-99-1789279584185/`. The first
streaming attempt stopped safely because Vision OCR read the tiny “99 swaps”
as “9S SWaDS”; the second run accepted that known OCR variant and the saved
OLED image was manually checked. Only the second run counts.

## Batch closeout: alternate EVM origins

The private ledgers now contain **50 distinct clear-sign cases and 50 adversarial
cases**. Avalanche and Base historical THORChain deposits were replayed through
`historical-thor-alt-evm.js` with their on-chain router, value, asset, and memo;
only the expired deadline and nonce were refreshed. Both were approved after
Vault and every OLED page showed the intended input, output asset/chain,
destination, minimum, affiliate fee, and gas. Signatures were discarded and
the SDK API log had one successful sign request per approved case and no
broadcast. Evidence is in `~/.keepkey/qa-evidence/evm-alt-origin/`.

The first Base probe hit the blind-sign gate. Base chain ID 8453 is now pinned
to the same THORChain router address as Avalanche in both firmware and Vault;
the pair `(chain ID, address)` is checked so another chain cannot borrow the
clear-sign display. The Base native input is shown as ETH on Base. The rebuilt
emulator library and Vault app passed a full live sign-only review. A first
completed Base review was rejected because Vision OCR inserted false leading
digits into the final gas fee. Full-resolution image inspection showed
`0.00000234785 ETH`, matching Vault; the second complete run was approved and
only that run is counted. The image, not OCR alone, is authoritative for any
amount or address discrepancy.

For subsequent overnight batches, keep one report per transaction family with
the source transaction and exact signed bytes/allowed freshness changes, all
Vault and OLED evidence, the human intent-versus-signed-effect decision,
signature disposition, API sign/broadcast check, and a ledger update only after
the review passes. Report counts and gaps at batch close rather than after
each screen. A timeout, ambiguous image, or unverified output remains a gap;
it does not enter either success count.

The Base adversarial batch changed three signed terms of that completed swap:
minimum output to zero, output destination to `0x1111…1111`, and the output
USDC contract to `0x1111…1111`. Vault and the saved OLED page exposed each
change. Each was rejected on-device, produced one HTTP 403 sign request, and
had no broadcast. Private reports are `live-base-*-report.json` under the
same evidence directory. An earlier fake-contract attempt did **not** change
the memo because its replacement missed uppercase `0X`; it was rejected but
excluded from the ledger. The SDK script now asserts that every mutation
changes the signed memo before presenting a request.

## TRON-origin THORChain swaps

Two completed TRON-origin swaps were retrieved from the official
[`gettransactionbyid` API](https://developers.tron.network/reference/wallet-gettransactionbyid):
257.033375 TRX→ETH and 34.421641 USDT→ETH. Their `raw_data.data` memo,
transfer amount, vault recipient, and contract were matched to the wallet's
swap history. The sign-only replay changed only the 21-byte historical owner
address to the connected emulator's derived address; its historical TAPOS and
expiration remain stale, so this proves display and signing behavior, not a
broadcastable transaction. Reports and all OLED pages are private under
`~/.keepkey/qa-evidence/tron-history/`.

The first live TRX pass was rejected because the device showed only the raw
swap memo. Firmware now displays labeled THORChain asset, destination,
minimum, and affiliate-fee pages from the signed `raw_data.data`, then the
complete raw memo. Vault now parses the signed TRON protobuf instead of using
the request's optional, unauthenticated amount and recipient hints. The
first USDT pass was rejected because the device showed 34,421,641 base units;
firmware now formats 34.421641 USDT only when the signed token contract equals
[Tether's published TRON USD₮ deployment](https://tether.to/ru/supported-protocols/).
Unknown contracts remain raw units. Both final live passes were approved
after all pages were reviewed, signatures discarded, and API logs showed no
broadcast. Native firmware TRON tests and focused Vault parser tests pass.

Two TRON adversarial cases are also audited. One changes the signed TRC-20
contract by one byte while preserving the transfer and memo: Vault and device
drop the USDT label and expose raw base units and the changed contract. The
other changes a signed TRX→ETH memo minimum from 0.04388992 ETH to zero;
both surfaces show zero. Each was rejected on-device, returned no signature,
and has no broadcast route. Their private reports are `live-fake-usdt-contract-report.json`
and `live-minimum-zero-report.json` in the same evidence directory. A separate
trial with malformed optional display hints failed before an emulator prompt
and is excluded from the ledger.

## Historical Ethereum payments and final count

Eight distinct non-swap Ethereum address-book payments were verified against
on-chain `eth_getTransactionByHash` responses, then replayed sign-only with a
synthetic nonce and the connected emulator signer. The signed recipient,
asset, value/calldata, gas limit, and gas price matched each historical
payment. Vault and both OLED pages were reviewed before approval. A first
3.5 ETH attempt was rejected because Vault showed the native value only as
hex; Vault now formats native EVM value in ETH or AVAX according to chain ID.
Only the rerun is counted. The eight payment reports are private under
`~/.keepkey/qa-evidence/evm-addressbook-history/live-*-report.json`.

Nine payment attacks used those real on-chain transactions as the intended
baseline and changed exactly one signed field: four recipient substitutions,
three tenfold amount increases, and two 100× gas-price increases. Each changed
field appeared in Vault and on the OLED; each was rejected with an HTTP 403,
no signature, and no broadcast. Reports are `attack-*-report.json` in the
same private directory. These are payments, explicitly separate from the 42
swap clear-sign cases and the 41 earlier swap-focused adversarial cases.

The final private ledgers contain 50/50 audited cases. Four additional real
swap probes remain excluded as gaps: Relay bridgeDeposit and NEAR Intents
deposits do not sign the quoted output terms; a THOR-native RUNE→ZEC memo and
a Maya-native CACAO swap memo omit a signed minimum. The separate Mayachain
ETH→CACAO replay is also blocked by the firmware blind-sign gate. Their
report paths and exact limitations are documented above. Do not present those
quotes or swap settlements as proven by a device signature.
