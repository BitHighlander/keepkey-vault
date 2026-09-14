#!/usr/bin/env python3
"""Bounded malformed-frame crash smoke for a CI libkkemu artifact.

Usage: python3 tests/emulator-malformed-frames.py /path/to/libkkemu.dylib
Each case runs in a fresh process: a C crash or hang cannot poison later cases.
No seed, network, physical device, or broadcast path is involved. This is a
parser resilience smoke, not coverage-guided fuzzing or a signing assertion.
"""
import ctypes
import hashlib
import os
import random
import subprocess
import sys


def worker(path, seed):
    rng = random.Random(seed)
    lib = ctypes.CDLL(path)
    lib.kkemu_init.argtypes = (ctypes.c_void_p, ctypes.c_size_t)
    lib.kkemu_init.restype = ctypes.c_int
    lib.kkemu_write.argtypes = (ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int)
    lib.kkemu_write.restype = ctypes.c_int
    lib.kkemu_poll.restype = ctypes.c_int
    lib.kkemu_shutdown.restype = None
    flash = (ctypes.c_uint8 * (1 << 20))()
    ctypes.memset(flash, 0xff, len(flash))
    assert lib.kkemu_init(flash, len(flash)) == 0
    for _ in range(8):
        lib.kkemu_poll()

    # SignMessage (38) and EthereumSignTx (58) are intentionally sent with
    # invalid protobuf tags/lengths, alongside malformed generic framing.
    # Use one HID report only, never claim a payload longer than this report.
    kind = seed % 4
    msg_type = (38, 58, 0, 0xffff)[kind]
    payload = bytes([0xff]) + rng.randbytes(rng.randrange(0, 24))
    declared = len(payload) if kind != 3 else 0xffffffff
    report = b'?##' + msg_type.to_bytes(2, 'big') + declared.to_bytes(4, 'big') + payload
    report = report.ljust(64, b'\0')[:64]
    frame = (ctypes.c_uint8 * 64).from_buffer_copy(report)
    rc = lib.kkemu_write(frame, 64, 0)
    assert rc == 0, f'write returned {rc}'
    for _ in range(100):
        lib.kkemu_poll()
    lib.kkemu_shutdown()


def main(path):
    with open(path, 'rb') as source:
        digest = hashlib.sha256(source.read()).hexdigest()
    failures = []
    for seed in range(100):
        cmd = [sys.executable, __file__, '--worker', path, str(seed)]
        try:
            result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=3)
            if result.returncode:
                failures.append((seed, f'exit {result.returncode}: {result.stderr[-160:].decode(errors="replace")}'))
        except subprocess.TimeoutExpired:
            failures.append((seed, 'timeout'))
    print(f'libkkemu sha256={digest} cases=100 failures={len(failures)}')
    for seed, reason in failures[:10]:
        print(f'seed={seed} {reason}')
    return 1 if failures else 0


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--worker':
        worker(sys.argv[2], int(sys.argv[3]))
    elif len(sys.argv) == 2 and os.path.isfile(sys.argv[1]):
        sys.exit(main(sys.argv[1]))
    else:
        sys.exit(f'usage: {sys.argv[0]} /path/to/libkkemu.dylib')
