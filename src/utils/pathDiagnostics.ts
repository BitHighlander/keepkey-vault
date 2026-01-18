/**
 * Path Diagnostics Utility
 *
 * Helps identify duplicate derivation paths that may be causing balance double-counting
 */

import { getCustomPaths } from '@/lib/storage/customPaths';

interface PathInfo {
  path: string;
  addressNList: number[];
  pubkey?: string;
  address?: string;
  source: 'custom' | 'default';
  note?: string;
}

/**
 * Convert addressNList array to BIP44 path string
 */
function convertAddressNListToPath(addressNList: number[]): string {
  if (!Array.isArray(addressNList) || addressNList.length === 0) return '';

  const parts = addressNList.map((num) => {
    const isHardened = (num & 0x80000000) !== 0;
    const value = num & 0x7FFFFFFF;
    return isHardened ? `${value}'` : `${value}`;
  });

  return `m/${parts.join('/')}`;
}

/**
 * Analyze all paths for a given network and identify duplicates
 */
export function analyzePaths(appPubkeys: any[], networkId?: string): {
  allPaths: PathInfo[];
  duplicates: PathInfo[][];
  summary: string;
} {
  const customPaths = getCustomPaths();
  const allPaths: PathInfo[] = [];

  // Add custom paths
  customPaths.forEach(path => {
    if (!networkId || path.networks.includes(networkId)) {
      allPaths.push({
        path: convertAddressNListToPath(path.addressNList),
        addressNList: path.addressNList,
        source: 'custom',
        note: path.note,
      });
    }
  });

  // Add default paths from app.pubkeys
  if (appPubkeys && Array.isArray(appPubkeys)) {
    appPubkeys.forEach(pubkey => {
      if (!networkId || pubkey.networks?.includes(networkId)) {
        const addressNList = pubkey.addressNList || [];
        const pathStr = typeof pubkey.path === 'string'
          ? pubkey.path
          : convertAddressNListToPath(addressNList);

        // Check if this is a custom path (has matching addressNList in customPaths)
        const isCustom = customPaths.some(cp =>
          JSON.stringify(cp.addressNList) === JSON.stringify(addressNList)
        );

        if (!isCustom) {
          allPaths.push({
            path: pathStr,
            addressNList,
            pubkey: pubkey.pubkey,
            address: pubkey.address,
            source: 'default',
            note: pubkey.note || pubkey.context,
          });
        }
      }
    });
  }

  // Find duplicates by path string
  const pathMap = new Map<string, PathInfo[]>();
  allPaths.forEach(pathInfo => {
    const existing = pathMap.get(pathInfo.path) || [];
    existing.push(pathInfo);
    pathMap.set(pathInfo.path, existing);
  });

  const duplicates = Array.from(pathMap.values()).filter(group => group.length > 1);

  // Generate summary
  let summary = `\n${'='.repeat(80)}\n`;
  summary += `PATH ANALYSIS ${networkId ? `FOR ${networkId}` : '(ALL NETWORKS)'}\n`;
  summary += `${'='.repeat(80)}\n\n`;
  summary += `Total paths: ${allPaths.length}\n`;
  summary += `  - Custom paths: ${allPaths.filter(p => p.source === 'custom').length}\n`;
  summary += `  - Default paths: ${allPaths.filter(p => p.source === 'default').length}\n\n`;

  if (duplicates.length > 0) {
    summary += `⚠️  DUPLICATES FOUND: ${duplicates.length} duplicate path(s)\n\n`;

    duplicates.forEach((group, index) => {
      summary += `Duplicate #${index + 1}: ${group[0].path}\n`;
      group.forEach(pathInfo => {
        summary += `  - Source: ${pathInfo.source}`;
        if (pathInfo.note) summary += ` | Note: "${pathInfo.note}"`;
        if (pathInfo.address) summary += ` | Address: ${pathInfo.address.substring(0, 16)}...`;
        summary += '\n';
      });
      summary += '\n';
    });

    summary += `\n${'='.repeat(80)}\n`;
    summary += `⚠️  DUPLICATE PATHS WILL CAUSE DOUBLE-COUNTED BALANCES!\n`;
    summary += `\nTo fix this issue:\n`;
    summary += `1. Remove duplicate custom paths from Settings\n`;
    summary += `2. Or use the clearCustomPaths() utility to remove all custom paths\n`;
    summary += `3. Refresh the page to reload balances\n`;
    summary += `${'='.repeat(80)}\n`;
  } else {
    summary += `✅ No duplicates found\n`;
    summary += `${'='.repeat(80)}\n`;
  }

  return { allPaths, duplicates, summary };
}

/**
 * Log path analysis to console (for debugging)
 */
export function logPathAnalysis(appPubkeys: any[], networkId?: string): void {
  const { summary } = analyzePaths(appPubkeys, networkId);
  console.log(summary);
}

/**
 * Check if there are any duplicate paths
 */
export function hasDuplicatePaths(appPubkeys: any[], networkId?: string): boolean {
  const { duplicates } = analyzePaths(appPubkeys, networkId);
  return duplicates.length > 0;
}
