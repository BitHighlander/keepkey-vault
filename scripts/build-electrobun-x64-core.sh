#!/usr/bin/env bash
set -euo pipefail

# Cross-compile Electrobun core binaries for macOS x86_64 (Intel) from ARM64.
# Produces: electrobun-core-darwin-x64.tar.gz containing:
#   launcher, bun, libNativeWrapper.dylib, libasar.dylib
#
# Targets macOS 13.0+ (Ventura) from the exact release-pinned Electrobun source.
#
# Prerequisites (on ARM64 Mac):
#   - Zig 0.13.0 vendored in modules/electrobun/package/vendors/zig/
#   - CEF headers + wrapper lib in modules/electrobun/package/vendors/cef/
#   - libasar-x64.dylib in modules/electrobun/package/vendors/zig-asar/
#   Run `cd modules/electrobun/package && bun install && bun build.ts` once to vendor deps.
#
# Usage:
#   ./scripts/build-electrobun-x64-core.sh
#   make build-electrobun-x64-core

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTROBUN_PKG="$REPO_ROOT/modules/electrobun/package"
ZIG="$ELECTROBUN_PKG/vendors/zig/zig"
BUN_X64_VERSION="1.3.13"
MACOS_TARGET="13.0"
OUTPUT_DIR="$REPO_ROOT/artifacts"
TARBALL="$OUTPUT_DIR/electrobun-core-darwin-x64.tar.gz"

echo "=== Building Electrobun x64 core (pinned source, macOS $MACOS_TARGET+) ==="

# Verify prerequisites
for F in "$ZIG" \
         "$ELECTROBUN_PKG/src/launcher/build.zig" \
         "$ELECTROBUN_PKG/src/extractor/build.zig" \
         "$ELECTROBUN_PKG/src/native/macos/nativeWrapper.mm" \
         "$ELECTROBUN_PKG/vendors/cef/include"; do
  if [ ! -e "$F" ]; then
    echo "ERROR: Missing prerequisite: $F"
    echo "Run: cd modules/electrobun/package && bun install && bun build.ts"
    exit 1
  fi
done

# Rebuild CEF wrapper for x86_64 if needed
CEF_WRAPPER_X64="$ELECTROBUN_PKG/vendors/cef/build-x64/libcef_dll_wrapper/libcef_dll_wrapper.a"
if [ ! -f "$CEF_WRAPPER_X64" ]; then
  echo "--- Building CEF wrapper for x86_64 ---"
  mkdir -p "$ELECTROBUN_PKG/vendors/cef/build-x64"
  CMAKE_BIN=$(command -v cmake 2>/dev/null || echo "$ELECTROBUN_PKG/vendors/cmake/cmake")
  (cd "$ELECTROBUN_PKG/vendors/cef/build-x64" && \
    "$CMAKE_BIN" \
      -DPROJECT_ARCH=x86_64 \
      -DCMAKE_OSX_ARCHITECTURES=x86_64 \
      -DCMAKE_BUILD_TYPE=Release \
      .. && \
    make -j8 libcef_dll_wrapper)
else
  echo "CEF wrapper (x64) already built"
fi

# Staging directory for output
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT
mkdir -p "$STAGING/core"

echo "--- Building native helpers from pinned upstream source ---"
HELPER_ROOT=$(mktemp -d)
git clone --quiet --depth 1 --branch v0.2.2 \
  https://github.com/blackboardsh/zig-asar.git "$HELPER_ROOT/zig-asar"
(cd "$HELPER_ROOT/zig-asar" && \
  "$ZIG" build -Dtarget=x86_64-macos.${MACOS_TARGET} -Dcpu=baseline -Doptimize=ReleaseFast)
cp "$HELPER_ROOT/zig-asar/zig-out/bin/zig-asar" "$STAGING/core/zig-asar"
cp "$HELPER_ROOT/zig-asar/zig-out/lib/libasar.dylib" "$STAGING/core/libasar.dylib"

git clone --quiet --recurse-submodules --shallow-submodules --depth 1 --branch v0.1.3 \
  https://github.com/blackboardsh/zig-zstd.git "$HELPER_ROOT/zig-zstd"
(cd "$HELPER_ROOT/zig-zstd" && \
  "$ZIG" build -Dtarget=x86_64-macos.${MACOS_TARGET} -Dcpu=baseline -Doptimize=ReleaseFast)
cp "$HELPER_ROOT/zig-zstd/zig-out/bin/zig-zstd" "$STAGING/core/zig-zstd"

git clone --quiet --recurse-submodules --shallow-submodules --depth 1 --branch v0.1.20 \
  https://github.com/blackboardsh/zig-bsdiff.git "$HELPER_ROOT/zig-bsdiff"
(cd "$HELPER_ROOT/zig-bsdiff" && \
  node scripts/setup.js && \
  "$ZIG" build -Dtarget=x86_64-macos.${MACOS_TARGET} -Dcpu=baseline -Doptimize=ReleaseFast)
cp "$HELPER_ROOT/zig-bsdiff/zig-out/bin/bsdiff" "$STAGING/core/bsdiff"
cp "$HELPER_ROOT/zig-bsdiff/zig-out/bin/bspatch" "$STAGING/core/bspatch"
rm -rf "$HELPER_ROOT"

# 1. Build launcher for x86_64
echo "--- Building launcher (x86_64-macos.${MACOS_TARGET}) ---"
# Zig 0.13 repeatedly miscompiles stdlib process setup for Intel macOS. Build
# the equivalent native supervisor with the host Apple clang instead.
clang \
  -arch x86_64 \
  -mmacosx-version-min=${MACOS_TARGET} \
  -Os \
  "$REPO_ROOT/scripts/electrobun-launcher-macos.c" \
  -o "$STAGING/core/launcher"
echo "  launcher: $(lipo -archs "$STAGING/core/launcher")"

# 2. Build extractor for x86_64 (needed for self-extracting archives)
echo "--- Building extractor (x86_64-macos.${MACOS_TARGET}) ---"
(cd "$ELECTROBUN_PKG/src/extractor" && \
  rm -rf zig-out .zig-cache && \
  "../../vendors/zig/zig" build \
    -Dtarget=x86_64-macos.${MACOS_TARGET} \
    -Doptimize=ReleaseSmall)
cp "$ELECTROBUN_PKG/src/extractor/zig-out/bin/extractor" "$STAGING/core/extractor"
echo "  extractor: $(lipo -archs "$STAGING/core/extractor")"

# 3. Cross-compile libNativeWrapper.dylib for x86_64
echo "--- Building libNativeWrapper.dylib (x86_64, macOS ${MACOS_TARGET}) ---"
OBJ_DIR="$ELECTROBUN_PKG/src/native/macos/build-x64"
mkdir -p "$OBJ_DIR"

# Check for wgpu include dir (headers are arch-independent, prefer x64 but fall back to arm64)
WGPU_INC="$ELECTROBUN_PKG/vendors/wgpu/macos-x64/include"
[ -d "$WGPU_INC" ] || WGPU_INC="$ELECTROBUN_PKG/vendors/wgpu/macos-arm64/include"
WGPU_FLAG=""
if [ -d "$WGPU_INC" ]; then
  WGPU_FLAG="-I$WGPU_INC"
fi

# Compile ObjC++ source for x86_64
clang++ \
  -arch x86_64 \
  -mmacosx-version-min=${MACOS_TARGET} \
  -c "$ELECTROBUN_PKG/src/native/macos/nativeWrapper.mm" \
  -o "$OBJ_DIR/nativeWrapper.o" \
  -fobjc-arc \
  -fno-objc-msgsend-selector-stubs \
  -I"$ELECTROBUN_PKG/vendors/cef" \
  $WGPU_FLAG \
  -std=c++20

# Link into dylib using x64 libasar and x64 CEF wrapper
clang++ \
  -arch x86_64 \
  -mmacosx-version-min=${MACOS_TARGET} \
  -o "$STAGING/core/libNativeWrapper.dylib" \
  "$OBJ_DIR/nativeWrapper.o" \
  "$STAGING/core/libasar.dylib" \
  -framework Cocoa \
  -framework WebKit \
  -framework QuartzCore \
  -framework Metal \
  -framework MetalKit \
  -framework UserNotifications \
  -F"$ELECTROBUN_PKG/vendors/cef/Release" \
  -weak_framework 'Chromium Embedded Framework' \
  -L"$ELECTROBUN_PKG/vendors/cef/build-x64/libcef_dll_wrapper" \
  -lcef_dll_wrapper \
  -stdlib=libc++ \
  -shared \
  -install_name @executable_path/libNativeWrapper.dylib \
  -Wl,-rpath,@executable_path

echo "  libNativeWrapper.dylib: $(lipo -archs "$STAGING/core/libNativeWrapper.dylib")"

# 4. libasar.dylib was rebuilt from pinned source above.
echo "  libasar.dylib: $(lipo -archs "$STAGING/core/libasar.dylib")"

# 5. Download the Bun version declared by the pinned Electrobun release.
echo "--- Downloading bun $BUN_X64_VERSION for darwin-x64 ---"
BUN_ZIP="$STAGING/bun.zip"
curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_X64_VERSION}/bun-darwin-x64.zip" \
  -o "$BUN_ZIP"
(cd "$STAGING" && unzip -q "$BUN_ZIP")
cp "$STAGING/bun-darwin-x64/bun" "$STAGING/core/bun"
rm -rf "$STAGING/bun-darwin-x64" "$BUN_ZIP"
echo "  bun: $(lipo -archs "$STAGING/core/bun") (v$BUN_X64_VERSION)"

# 6. Update helpers were rebuilt from pinned source above.

# Ad-hoc sign x64 binaries — matches arm64 behavior where linker auto-adds adhoc signature.
# Without this, sign-release-intel cannot Developer-ID-sign them
# ("code object is not signed at all" → notarization fails).
echo ""
echo "=== Ad-hoc signing x64 binaries ==="
for BIN in launcher extractor libNativeWrapper.dylib libasar.dylib bun zig-asar zig-zstd bsdiff bspatch; do
  if [ -f "$STAGING/core/$BIN" ]; then
    codesign --force --sign - "$STAGING/core/$BIN"
    echo "  $BIN: adhoc-signed"
  fi
done

# Verify all core binaries are x86_64 and honor the declared OS floor.
echo ""
echo "=== Verifying all binaries ==="
FAIL=0
for BIN in launcher extractor bun libNativeWrapper.dylib libasar.dylib zig-asar zig-zstd bsdiff bspatch; do
  ACTUAL=$(lipo -archs "$STAGING/core/$BIN" 2>/dev/null)
  echo "  $BIN: $ACTUAL"
  if [ "$ACTUAL" != "x86_64" ]; then
    echo "  ERROR: Expected x86_64, got $ACTUAL"
    FAIL=1
  fi
  MINOS_VALUES=$(otool -l "$STAGING/core/$BIN" 2>/dev/null | awk '
    $1 == "cmd" { command = $2 }
    (command == "LC_BUILD_VERSION" && $1 == "minos") ||
    (command == "LC_VERSION_MIN_MACOSX" && $1 == "version") { print $2 }
  ')
  if [ -z "$MINOS_VALUES" ]; then
    echo "  ERROR: $BIN has no readable macOS deployment target"
    FAIL=1
  fi
  while IFS= read -r MINOS; do
    [ -n "$MINOS" ] || continue
    if awk -v left="$MINOS" -v right="$MACOS_TARGET" 'BEGIN {
      split(left, a, "."); split(right, b, ".")
      for (i = 1; i <= 3; i++) {
        av = (a[i] == "" ? 0 : a[i]) + 0; bv = (b[i] == "" ? 0 : b[i]) + 0
        if (av > bv) exit 0; if (av < bv) exit 1
      }
      exit 1
    }'; then
      echo "  ERROR: $BIN requires macOS $MINOS (ceiling is $MACOS_TARGET)"
      FAIL=1
    fi
  done <<EOF
$MINOS_VALUES
EOF
  # Also verify signature is present (adhoc at minimum)
  SIG_OUT=$(codesign -dvv "$STAGING/core/$BIN" 2>&1)
  if ! echo "$SIG_OUT" | grep -q "Signature"; then
    echo "  ERROR: $BIN is not signed — sign-release-intel will fail"
    echo "  codesign output: $SIG_OUT"
    FAIL=1
  fi
done
if [ "$FAIL" = "1" ]; then
  echo "ERROR: Architecture/signature verification failed"
  exit 1
fi

# Also verify libNativeWrapper does NOT contain resign swizzle (the whole point of this!)
echo ""
echo "=== Verifying no resign-swizzle symbols ==="
if nm "$STAGING/core/libNativeWrapper.dylib" 2>/dev/null | grep -q "resignKeyWindow"; then
  echo "ERROR: libNativeWrapper.dylib contains resignKeyWindow symbols!"
  echo "This binary contains resign-swizzle — was it built from upstream?"
  nm "$STAGING/core/libNativeWrapper.dylib" | grep resignKeyWindow
  exit 1
fi
echo "  No resign-swizzle symbols found (correct)"

# Package as tarball
mkdir -p "$OUTPUT_DIR"
echo ""
echo "=== Packaging ==="
(cd "$STAGING/core" && tar czf "$TARBALL" .)
echo "Created: $TARBALL ($(du -h "$TARBALL" | cut -f1))"
echo ""
echo "Contents:"
tar tzf "$TARBALL"
echo ""
echo "=== Done ==="
echo "Next steps:"
echo "  1. Publish:  make publish-electrobun-x64-core"
echo "  2. Update .github/workflows/build.yml X64_CORE_TAG if you changed ELECTROBUN_X64_TAG"
