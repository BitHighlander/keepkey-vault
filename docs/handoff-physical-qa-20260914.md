# Physical QA intake — 2026-09-14

The connected USB device identifies as `KeepKey - newer` (`2b24:0002`). A
direct WebUSB `GetFeatures` returned firmware `7.14.2`, initialized, label
`newer`, with PIN and passphrase protection off. Vault remained connected to
the separate 7.16.0 emulator; no emulator result is counted as physical QA.

A direct python-keepkey/WebUSB `SignMessage` request on Bitcoin path
`m/44'/0'/0'/0/0` asked the device to sign:

> KeepKey physical QA 2026-09-14: sign-only, no transaction

The device returned a `MessageSignature` with 65 signature bytes. This
establishes a working physical USB signing round trip on installed 7.14.2.
The host has no camera/OLED capture, so this does **not** attest to the exact
physical screen text; a human reading of that text remains requested.

The full 7.14.3 application artifact from CI run `34895287978` / source head
`4125e1c7409b1cb7b08ba595bc408e3128fc24ca` was downloaded only for
intake. The image SHA-256 is
`317b3ad0e0d3fdf17fe90a44f4d51a430795fee8d4397b86c91f41417db1be9f`,
matching `arm-build-manifest.json`. The repository's
`scripts/release/verify-signatures.py` reports `sig_index1 = 0` and
`NOT VERIFIED`: this is an unsigned CI draft, not a signed release artifact.
At intake, neither a bootloader nor application image had been flashed. Before using
this unsigned draft on the initialized device, confirm its seed is backed up
and the device is disposable for a potential wipe. Keep the release gates and
the no-bootloader-change limit in force; a successful QA flash would not by
itself make the release merge-ready.

## Update after test-device authorization

The owner confirmed this is a backed-up disposable device. It entered its
existing bootloader (`2.1.4`), and python-keepkey uploaded **only** the full
7.14.3 application image above. `firmware_update()` returned `True`; a direct
`GetFeatures` then reported `7.14.3`, normal mode, and `initialized=false`.
The unsigned update wiped the prior wallet. Pre-update BTC/ETH addresses were
hashed for continuity checking, but the wipe makes that comparison
inapplicable; no storage-retention claim is made. No bootloader image was sent.

The matching CI emulator dylib, SHA-256
`22fbf94caed62bbf7182ab864f1b7827897f125ebdfe88016c713eb9bfa7bdc5`,
passed 100 deterministic malformed HID/protobuf-frame crash-smoke cases with
zero process crashes, timeouts, or lost `GetFeatures` replies. The reusable driver is
`projects/keepkey-sdk/tests/emulator-malformed-frames.py`; it checks parser
resilience only, not semantic signing or coverage-guided fuzzing. Loading a
public disposable test seed on hardware is pending device confirmation so the
post-flash signing smoke can run.

The same 100-case driver also passed against the 7.15 candidate dylib from
CI run `34895896789` / source head
`d33f1711c3b2b205f64c5dc35fdec02926a6dc63`, SHA-256
`748f28a343a6d073e82ee5454a5b4c5332c05bd3a379dc655bb8044c5ae2080e`,
with zero crashes, timeouts, or lost `GetFeatures` replies.
