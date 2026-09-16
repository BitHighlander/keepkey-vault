import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { bundledEmulatorCandidates, emulatorBuildFlashName, emulatorBuildPath, emulatorLibFilename, listEmulatorBuilds, resolveEmulatorLibPath, selectEmulatorBuild } from './emulator-library'

describe('emulator release library resolution', () => {
  test('uses the correct platform filenames', () => {
    expect(emulatorLibFilename('darwin')).toBe('libkkemu.dylib')
    expect(emulatorLibFilename('win32')).toBe('libkkemu.dll')
  })

  test('finds a library copied to Resources/app/emulator', () => {
    const candidates = bundledEmulatorCandidates('/app/Contents/Resources/app/bun', '/unused', 'darwin')
    const bundled = '/app/Contents/Resources/app/emulator/libkkemu.dylib'
    expect(candidates).toContain(bundled)
    expect(resolveEmulatorLibPath({
      importDir: '/app/Contents/Resources/app/bun',
      cwd: '/unused',
      home: '/home/test',
      platform: 'darwin',
      exists: path => path === bundled,
    })).toBe(bundled)
  })

  test('keeps a user-installed library as an explicit override', () => {
    const override = '/home/test/.keepkey/emulator/libkkemu.dll'
    expect(resolveEmulatorLibPath({
      importDir: 'C:/app/Resources/app/bun',
      cwd: 'C:/app',
      home: '/home/test',
      platform: 'win32',
      exists: path => path === override || path.endsWith('/emulator/libkkemu.dll'),
    })).toBe(override)
  })

  test('selects installed builds by content ID and refuses a missing selected build', () => {
    const home = mkdtempSync(join(tmpdir(), 'kk-emu-builds-'))
    const first = 'a'.repeat(64)
    const second = 'b'.repeat(64)
    try {
      const firstPath = emulatorBuildPath(first, 'darwin', home)
      const secondPath = emulatorBuildPath(second, 'darwin', home)
      mkdirSync(join(home, '.keepkey', 'emulator', 'builds'), { recursive: true })
      writeFileSync(firstPath, 'first')
      writeFileSync(secondPath, 'second')
      selectEmulatorBuild(second, home)
      expect(emulatorBuildFlashName(second)).toBe(`build-${'b'.repeat(16)}`)
      expect(listEmulatorBuilds('darwin', home).map(b => [b.id, b.selected])).toEqual([[first, false], [second, true]])
      expect(resolveEmulatorLibPath({ importDir: '/unused', home, platform: 'darwin' })).toBe(secondPath)
      rmSync(secondPath)
      expect(resolveEmulatorLibPath({ importDir: '/unused', home, platform: 'darwin' })).toBeNull()
    } finally { rmSync(home, { recursive: true, force: true }) }
  })
})
