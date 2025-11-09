/**
 * System-Grounded Capabilities using Pioneer SDK
 *
 * This module provides REAL capability data from Pioneer packages instead of hardcoded values.
 * Uses @pioneer-platform/pioneer-coins and @pioneer-platform/pioneer-caip for ground truth.
 */

import { FunctionResult } from './functions';
// @ts-ignore - Pioneer packages may not have full types
import { getPaths, blockchains } from '@pioneer-platform/pioneer-coins';
// @ts-ignore
import { ChainToCaip, networkIdToCaip } from '@pioneer-platform/pioneer-caip';

// ============================================================================
// Dynamic Capability Functions (using Pioneer SDK data)
// ============================================================================

/**
 * Get ALL supported chains from Pioneer SDK (not hardcoded!)
 */
export async function getSupportedChainsFromSDK(app: any): Promise<FunctionResult> {
  try {
    // Get supported blockchains from Pioneer SDK
    const supportedBlockchains = blockchains || [];

    // Also get from app context if available (user's actual configured chains)
    const userChains = app?.dashboard?.networks || [];

    // Combine and deduplicate
    const allChains = [...new Set([...supportedBlockchains, ...userChains.map((n: any) => n.networkId)])];

    let message = `**Supported Blockchains** (${allChains.length} total)\n\n`;

    const chainDetails = allChains.map(caip => {
      const network = userChains.find((n: any) => n.networkId === caip);
      const symbol = network?.gasAssetSymbol || caip.split(':')[0].toUpperCase();
      const name = network?.gasAssetName || symbol;

      return {
        caip,
        symbol,
        name,
        hasBalance: !!network
      };
    });

    // Show chains with balances first
    chainDetails.sort((a, b) => (b.hasBalance ? 1 : 0) - (a.hasBalance ? 1 : 0));

    chainDetails.forEach(chain => {
      const indicator = chain.hasBalance ? '✅' : '⚪';
      message += `${indicator} **${chain.symbol}** - ${chain.name}\n  CAIP: \`${chain.caip}\`\n\n`;
    });

    return {
      success: true,
      message,
      data: { chains: chainDetails, count: allChains.length }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get supported chains: ${error.message}`
    };
  }
}

/**
 * Get CAIP using Pioneer SDK (not hardcoded!)
 */
export async function getCAIPFromSDK(assetQuery: string, app: any): Promise<FunctionResult> {
  try {
    const queryLower = assetQuery.toLowerCase().trim();

    // First try to find in current balances (most accurate)
    const asset = app?.balances?.find((b: any) =>
      b.symbol?.toLowerCase() === queryLower ||
      b.name?.toLowerCase() === queryLower
    );

    if (asset) {
      return {
        success: true,
        message: `**${asset.name} (${asset.symbol})**\n\nCAIP: \`${asset.caip}\`\nNetwork: ${asset.networkName}`,
        data: { caip: asset.caip, asset }
      };
    }

    // Fallback to Pioneer SDK ChainToCaip mapping
    const chainSymbol = assetQuery.toUpperCase();
    const caip = ChainToCaip[chainSymbol];

    if (caip) {
      return {
        success: true,
        message: `**${assetQuery} CAIP Identifier**\n\nCAIP: \`${caip}\`\n\n*Note: This asset is not in your current portfolio*`,
        data: { caip, symbol: chainSymbol }
      };
    }

    return {
      success: false,
      message: `❓ I don't have CAIP information for "${assetQuery}".\n\nThis might not be a supported chain, or it's not in your current portfolio.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get CAIP info: ${error.message}`
    };
  }
}

/**
 * Get ALL paths from Pioneer SDK for a blockchain
 */
export async function getPathsForBlockchain(blockchain: string, app: any): Promise<FunctionResult> {
  try {
    const blockchainCAIP = blockchain.includes(':') ? blockchain : null;

    if (!blockchainCAIP) {
      return {
        success: false,
        message: `Please provide a valid blockchain CAIP (e.g., "bip122:000000000019d6689c085ae165831e93" for Bitcoin)`
      };
    }

    // Get paths from Pioneer SDK
    const paths = getPaths([blockchainCAIP], false);

    if (!paths || paths.length === 0) {
      return {
        success: true,
        message: `No standard paths configured for ${blockchain}`,
        data: { paths: [], count: 0 }
      };
    }

    let message = `**Available Paths for ${blockchain}** (${paths.length} paths)\n\n`;

    paths.forEach((path: any, index: number) => {
      const pathStr = path.addressNList.map((n: number) => {
        const hardened = n >= 0x80000000;
        const value = hardened ? n - 0x80000000 : n;
        return `${value}${hardened ? "'" : ''}`;
      }).join('/');

      message += `${index + 1}. **${path.note || 'Path ' + (index + 1)}**\n`;
      message += `   Path: m/${pathStr}\n`;
      message += `   Script: ${path.script_type}\n`;
      message += `   Type: ${path.type}\n\n`;
    });

    return {
      success: true,
      message,
      data: { paths, count: paths.length, blockchain }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get paths: ${error.message}`
    };
  }
}

/**
 * List user's configured paths (pubkeys)
 */
export async function listConfiguredPaths(blockchain?: string, app?: any): Promise<FunctionResult> {
  try {
    if (!app?.balances || app.balances.length === 0) {
      return {
        success: false,
        message: '❌ No balances loaded yet. Please wait for portfolio to sync.'
      };
    }

    // Get all unique pubkeys from balances
    const allPubkeys = new Map<string, any>();

    app.balances.forEach((balance: any) => {
      if (balance.pubkeys && Array.isArray(balance.pubkeys)) {
        balance.pubkeys.forEach((pubkey: any) => {
          const key = `${balance.networkId}:${pubkey.master || pubkey.address}`;
          if (!allPubkeys.has(key)) {
            allPubkeys.set(key, {
              ...pubkey,
              networkId: balance.networkId,
              networkName: balance.networkName,
              symbol: balance.symbol
            });
          }
        });
      }
    });

    const pubkeys = Array.from(allPubkeys.values());

    // Filter by blockchain if specified
    let filteredPubkeys = pubkeys;
    if (blockchain) {
      filteredPubkeys = pubkeys.filter(p => p.networkId === blockchain);
    }

    if (filteredPubkeys.length === 0) {
      return {
        success: true,
        message: blockchain
          ? `No configured paths found for ${blockchain}`
          : 'No configured paths found',
        data: { paths: [], count: 0 }
      };
    }

    let message = `**Configured Paths** (${filteredPubkeys.length} total)\n\n`;

    // Group by network
    const byNetwork = filteredPubkeys.reduce((acc: any, pubkey: any) => {
      const net = pubkey.networkName || pubkey.networkId;
      if (!acc[net]) acc[net] = [];
      acc[net].push(pubkey);
      return acc;
    }, {});

    Object.entries(byNetwork).forEach(([network, paths]: [string, any]) => {
      message += `**${network}** (${paths.length} paths)\n`;
      paths.forEach((pubkey: any, index: number) => {
        const pathStr = pubkey.path || pubkey.pathDisplay || 'Unknown path';
        const scriptType = pubkey.script_type || 'Unknown';
        const address = pubkey.address || pubkey.master || 'Not available';

        message += `  ${index + 1}. ${pathStr} (${scriptType})\n`;
        message += `     Address: ${address.substring(0, 20)}...\n`;
      });
      message += '\n';
    });

    return {
      success: true,
      message,
      data: { paths: filteredPubkeys, count: filteredPubkeys.length, byNetwork }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to list paths: ${error.message}`
    };
  }
}

/**
 * Get path information from Pioneer SDK
 */
export async function getPathInfo(pathDescription: string, app: any): Promise<FunctionResult> {
  try {
    // Parse path description (e.g., "m/84'/0'/0'" or "bitcoin native segwit")
    const pathMatch = pathDescription.match(/m\/(\d+'?\/\d+'?\/\d+'?)/);

    if (!pathMatch) {
      // Try to match by description
      if (pathDescription.toLowerCase().includes('bitcoin')) {
        const allPaths = getPaths(['bip122:000000000019d6689c085ae165831e93'], false);

        let matchedPath;
        if (pathDescription.toLowerCase().includes('legacy')) {
          matchedPath = allPaths.find((p: any) => p.script_type === 'p2pkh');
        } else if (pathDescription.toLowerCase().includes('segwit') && !pathDescription.toLowerCase().includes('native')) {
          matchedPath = allPaths.find((p: any) => p.script_type === 'p2sh-p2wpkh');
        } else if (pathDescription.toLowerCase().includes('native') || pathDescription.toLowerCase().includes('bech32')) {
          matchedPath = allPaths.find((p: any) => p.script_type === 'p2wpkh');
        }

        if (matchedPath) {
          const pathStr = matchedPath.addressNList.map((n: number) => {
            const hardened = n >= 0x80000000;
            const value = hardened ? n - 0x80000000 : n;
            return `${value}${hardened ? "'" : ''}`;
          }).join('/');

          return {
            success: true,
            message: `**${matchedPath.note}**\n\nPath: m/${pathStr}\nScript Type: ${matchedPath.script_type}\nPubkey Type: ${matchedPath.type}\nCurve: ${matchedPath.curve}`,
            data: { path: matchedPath }
          };
        }
      }

      return {
        success: false,
        message: `Could not parse path "${pathDescription}". Try "m/84'/0'/0'" format or descriptions like "bitcoin native segwit"`
      };
    }

    return {
      success: true,
      message: `Path parsing not yet fully implemented for custom paths`,
      data: { pathDescription }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get path info: ${error.message}`
    };
  }
}

/**
 * Helper to fill "Add New Path" form with intelligent suggestions
 */
export async function suggestPathForBlockchain(blockchain: string, accountNumber: number = 0): Promise<FunctionResult> {
  try {
    const blockchainCAIP = blockchain.includes(':') ? blockchain : null;

    if (!blockchainCAIP) {
      return {
        success: false,
        message: `Please provide a valid blockchain CAIP`
      };
    }

    // Get standard paths for this blockchain
    const paths = getPaths([blockchainCAIP], false);

    if (!paths || paths.length === 0) {
      return {
        success: false,
        message: `No standard paths available for ${blockchain}`
      };
    }

    // Get the path for the requested account number (default to first path with account 0)
    const suggestedPath = paths.find((p: any) => {
      const accountIndex = p.addressNList[2];
      const accountNum = accountIndex >= 0x80000000 ? accountIndex - 0x80000000 : accountIndex;
      return accountNum === accountNumber;
    }) || paths[0];

    const pathStr = suggestedPath.addressNList.map((n: number) => {
      const hardened = n >= 0x80000000;
      const value = hardened ? n - 0x80000000 : n;
      return `${value}${hardened ? "'" : ''}`;
    }).join('/');

    return {
      success: true,
      message: `**Suggested Path for ${blockchain}**\n\n` +
        `📝 **Form Values:**\n` +
        `Blockchain: ${blockchainCAIP}\n` +
        `Script Type: ${suggestedPath.script_type}\n` +
        `Account: ${accountNumber}\n` +
        `Path: m/${pathStr}\n` +
        `Pubkey Type: ${suggestedPath.type}\n` +
        `Curve: ${suggestedPath.curve}\n\n` +
        `Note: ${suggestedPath.note}`,
      data: {
        blockchain: blockchainCAIP,
        scriptType: suggestedPath.script_type,
        accountNumber,
        addressNList: suggestedPath.addressNList,
        type: suggestedPath.type,
        curve: suggestedPath.curve,
        note: suggestedPath.note
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to suggest path: ${error.message}`
    };
  }
}
