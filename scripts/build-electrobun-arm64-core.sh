#!/usr/bin/env bash
set -euo pipefail

# Rebuild the ARM64 Electrobun components whose upstream release binaries inherit
# the build host's macOS floor. The release bundle supports macOS 13+, so every
# replacement is compiled from pinned upstream tags with that explicit target.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$REPO_ROOT/modules/electrobun/package"
ZIG="$PKG/vendors/zig/zig"
MACOS_TARGET="${MACOS_TARGET:-13.0}"
OUTPUT="$REPO_ROOT/artifacts/electrobun-core-darwin-arm64.tar.gz"
export MACOSX_DEPLOYMENT_TARGET="$MACOS_TARGET"

for path in "$ZIG" "$PKG/src/native/macos/nativeWrapper.mm" \
  "$PKG/vendors/cef/include" \
  "$PKG/vendors/cef/build/libcef_dll_wrapper/libcef_dll_wrapper.a"; do
  [ -e "$path" ] || { echo "ERROR: missing prerequisite: $path"; exit 1; }
done

stage="$(mktemp -d)"
helpers="$(mktemp -d)"
trap 'rm -rf "$stage" "$helpers"' EXIT
mkdir -p "$stage/core"

git clone --quiet --depth 1 --branch v0.2.2 \
  https://github.com/blackboardsh/zig-asar.git "$helpers/zig-asar"
(cd "$helpers/zig-asar" && "$ZIG" build \
  -Dtarget=aarch64-macos."$MACOS_TARGET" -Dcpu=baseline -Doptimize=ReleaseFast)
cp "$helpers/zig-asar/zig-out/lib/libasar.dylib" "$stage/core/libasar.dylib"

git clone --quiet --recurse-submodules --shallow-submodules --depth 1 --branch v0.1.3 \
  https://github.com/blackboardsh/zig-zstd.git "$helpers/zig-zstd"
(cd "$helpers/zig-zstd" && "$ZIG" build \
  -Dtarget=aarch64-macos."$MACOS_TARGET" -Dcpu=baseline -Doptimize=ReleaseFast)
cp "$helpers/zig-zstd/zig-out/bin/zig-zstd" "$stage/core/zig-zstd"

git clone --quiet --recurse-submodules --shallow-submodules --depth 1 --branch v0.1.20 \
  https://github.com/blackboardsh/zig-bsdiff.git "$helpers/zig-bsdiff"
(cd "$helpers/zig-bsdiff" && node scripts/setup.js && "$ZIG" build \
  -Dtarget=aarch64-macos."$MACOS_TARGET" -Dcpu=baseline -Doptimize=ReleaseFast)
cp "$helpers/zig-bsdiff/zig-out/bin/bspatch" "$stage/core/bspatch"

obj="$stage/nativeWrapper.o"
wgpu="$PKG/vendors/wgpu/macos-arm64/include"
wgpu_flags=()
[ ! -d "$wgpu" ] || wgpu_flags=(-I"$wgpu")
clang++ -arch arm64 -mmacosx-version-min="$MACOS_TARGET" \
  -c "$PKG/src/native/macos/nativeWrapper.mm" -o "$obj" \
  -fobjc-arc -fno-objc-msgsend-selector-stubs \
  -I"$PKG/vendors/cef" "${wgpu_flags[@]}" -std=c++20
clang++ -arch arm64 -mmacosx-version-min="$MACOS_TARGET" \
  -o "$stage/core/libNativeWrapper.dylib" "$obj" "$stage/core/libasar.dylib" \
  -framework Cocoa -framework WebKit -framework QuartzCore -framework Metal \
  -framework MetalKit -framework UserNotifications \
  -F"$PKG/vendors/cef/Release" -weak_framework 'Chromium Embedded Framework' \
  -L"$PKG/vendors/cef/build/libcef_dll_wrapper" -lcef_dll_wrapper \
  -stdlib=libc++ -shared -install_name @executable_path/libNativeWrapper.dylib \
  -Wl,-rpath,@executable_path

for binary in libasar.dylib zig-zstd bspatch libNativeWrapper.dylib; do
  file="$stage/core/$binary"
  codesign --force --sign - "$file"
  [ "$(lipo -archs "$file")" = arm64 ] || { echo "ERROR: $binary is not arm64"; exit 1; }
  minos="$(otool -l "$file" | awk '
    $1 == "cmd" { command = $2 }
    (command == "LC_BUILD_VERSION" && $1 == "minos") ||
    (command == "LC_VERSION_MIN_MACOSX" && $1 == "version") { print $2; exit }
  ')"
  awk -v actual="$minos" -v ceiling="$MACOS_TARGET" 'BEGIN {
    split(actual, a, "."); split(ceiling, b, ".")
    for (i = 1; i <= 3; i++) {
      av = (a[i] == "" ? 0 : a[i]) + 0; bv = (b[i] == "" ? 0 : b[i]) + 0
      if (av > bv) exit 1; if (av < bv) exit 0
    }
    exit 0
  }' || { echo "ERROR: $binary requires macOS $minos"; exit 1; }
  echo "$binary: arm64, macOS $minos"
done

mkdir -p "$(dirname "$OUTPUT")"
(cd "$stage/core" && tar czf "$OUTPUT" .)
echo "Created $OUTPUT"
