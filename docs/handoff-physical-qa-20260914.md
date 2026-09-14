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
No bootloader image and no application image has been flashed. Before using
this unsigned draft on the initialized device, confirm its seed is backed up
and the device is disposable for a potential wipe. Keep the release gates and
the no-bootloader-change limit in force; a successful QA flash would not by
itself make the release merge-ready.
