#!/usr/bin/env node
/**
 * THORChain Pool Fetcher
 *
 * ⚠️ DEPRECATED: This script is being phased out in favor of Pioneer API
 * Migration Date: 2025-12-29
 * New Source: Pioneer server /api/v1/swap/available-assets endpoint
 *
 * Fetches all active pools from THORChain Midgard API and transforms them into
 * CAIP format with proper networkIds for use in the swap interface.
 *
 * Usage: node scripts/fetch-thorchain-pools.js
 * Output: src/config/thorchain-pools.ts
 *
 * NOTE: Kept for reference and emergency fallback purposes only.
 * Do not use for production configuration.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MIDGARD_URL = 'https://midgard.ninerealms.com';
const THORNODE_URL = 'https://thornode.ninerealms.com';

/**
 * Chain to CAIP networkId mapping
 * Based on CAIP-2 standard: https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
 */
const CHAIN_TO_NETWORK_ID = {
  // Bitcoin chains (BIP-122)
  'BTC': 'bip122:000000000019d6689c085ae165831e93',
  'BCH': 'bip122:000000000000000000651ef99cb9fcbe',
  'LTC': 'bip122:00000000000000000000000000000000',
  'DOGE': 'bip122:000000000000000000000000000000001',

  // Ethereum chains (EIP-155)
  'ETH': 'eip155:1',
  'AVAX': 'eip155:43114',
  'BSC': 'eip155:56',

  // Cosmos chains
  'GAIA': 'cosmos:cosmoshub-4',
  'THOR': 'cosmos:thorchain-mainnet-v1',
  'MAYA': 'cosmos:mayachain-mainnet-v1',

  // XRP Ledger
  'XRP': 'ripple:4109c6f2045fc7eff4cde8f9905d19c2',
};

/**
 * Chain to slip44 coin type mapping
 * Based on SLIP-44: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
 */
const CHAIN_TO_SLIP44 = {
  'BTC': '0',
  'BCH': '145',
  'LTC': '2',
  'DOGE': '3',
  'ETH': '60',
  'AVAX': '60',
  'BSC': '60',
  'GAIA': '118',
  'THOR': '931',
  'MAYA': '931',
  'XRP': '144',
};

/**
 * Chain display names and icons
 */
const CHAIN_METADATA = {
  'BTC': { name: 'Bitcoin', icon: 'https://pioneers.dev/coins/bitcoin.png' },
  'BCH': { name: 'Bitcoin Cash', icon: 'https://pioneers.dev/coins/bitcoincash.png' },
  'LTC': { name: 'Litecoin', icon: 'https://pioneers.dev/coins/litecoin.png' },
  'DOGE': { name: 'Dogecoin', icon: 'https://pioneers.dev/coins/dogecoin.png' },
  'ETH': { name: 'Ethereum', icon: 'https://pioneers.dev/coins/ethereum.png' },
  'AVAX': { name: 'Avalanche', icon: 'https://pioneers.dev/coins/avalanche.png' },
  'BSC': { name: 'BNB Chain', icon: 'https://pioneers.dev/coins/binance.png' },
  'GAIA': { name: 'Cosmos', icon: 'https://pioneers.dev/coins/cosmos.png' },
  'THOR': { name: 'THORChain', icon: 'https://pioneers.dev/coins/thorchain.png' },
  'MAYA': { name: 'Maya Protocol', icon: 'https://pioneers.dev/coins/mayaprotocol.png' },
  'XRP': { name: 'XRP', icon: 'https://pioneers.dev/coins/ripple.png' },
};

/**
 * Token symbol overrides (for tokens with contract addresses)
 */
const TOKEN_SYMBOL_OVERRIDES = {
  'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7': 'USDT',
  'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'USDC',
  'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F': 'DAI',
  'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 'USDT',
  'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 'USDC',
  'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56': 'BUSD',
};

/**
 * Blocklist for competitor tokens that should be excluded from the app
 * These tokens are filtered out even if available on THORChain
 */
const BLOCKED_ASSETS = [
  'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325',   // THORSwap governance token (competitor)
  'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044',  // THORSwap token (competitor)
  'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D', // VeChain THOR (competitor)
  'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C', // THORChain-related competitor token
  'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E',   // Yearn Finance (competitor)
];

/**
 * Fetch data from URL using https
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Transform THORChain pool asset notation to CAIP format
 * Example: BTC.BTC -> { chain: 'BTC', ticker: 'BTC', contract: null }
 * Example: ETH.USDT-0xdac17f958d2ee523a2206206994597c13d831ec7 -> { chain: 'ETH', ticker: 'USDT', contract: '0xdac17f958d2ee523a2206206994597c13d831ec7' }
 */
function parsePoolAsset(asset) {
  const parts = asset.split('.');
  if (parts.length !== 2) {
    console.warn(`⚠️  Skipping invalid asset format: ${asset}`);
    return null;
  }

  const chain = parts[0];
  const assetPart = parts[1];

  // Check if this is a token with contract address
  const tokenParts = assetPart.split('-');
  const ticker = tokenParts[0];
  const contract = tokenParts.length > 1 ? tokenParts[1] : null;

  return { chain, ticker, contract, original: asset };
}

/**
 * Build CAIP identifier from pool asset
 */
function buildCAIP(parsed) {
  if (!parsed) return null;

  const networkId = CHAIN_TO_NETWORK_ID[parsed.chain];
  const slip44 = CHAIN_TO_SLIP44[parsed.chain];

  if (!networkId || !slip44) {
    console.warn(`⚠️  No CAIP mapping for chain: ${parsed.chain}`);
    return null;
  }

  // For native assets (no contract), use slip44 notation
  if (!parsed.contract) {
    return `${networkId}/slip44:${slip44}`;
  }

  // For tokens, use EIP-155 asset reference (ERC20 contract address)
  if (parsed.chain === 'ETH' || parsed.chain === 'AVAX' || parsed.chain === 'BSC') {
    return `${networkId}/erc20:${parsed.contract.toLowerCase()}`;
  }

  // Fallback for other token types
  console.warn(`⚠️  Token type not yet supported for CAIP: ${parsed.original}`);
  return `${networkId}/slip44:${slip44}`;
}

/**
 * Get clean symbol for display
 */
function getSymbol(parsed) {
  if (!parsed) return null;

  // Check for override first (for tokens)
  const override = TOKEN_SYMBOL_OVERRIDES[parsed.original.toUpperCase()];
  if (override) return override;

  // For native assets, use ticker
  return parsed.ticker;
}

/**
 * Main function to fetch and transform pools
 */
async function fetchAndTransformPools() {
  console.log('🔍 Fetching pools from THORChain Midgard API...\n');

  try {
    // Fetch pools from Midgard
    const poolsUrl = `${MIDGARD_URL}/v2/pools`;
    console.log(`📡 GET ${poolsUrl}`);
    const pools = await fetchJson(poolsUrl);

    if (!Array.isArray(pools)) {
      throw new Error('Expected pools to be an array');
    }

    console.log(`✅ Fetched ${pools.length} total pools\n`);

    // Filter for active pools only
    const activePools = pools.filter(pool => pool.status === 'available');
    console.log(`✅ Found ${activePools.length} active pools\n`);

    // Transform to CAIP format
    const transformed = [];
    const skipped = [];
    const blocked = [];

    for (const pool of activePools) {
      // Skip blocked assets (competitors)
      if (BLOCKED_ASSETS.includes(pool.asset)) {
        blocked.push(pool.asset);
        continue;
      }

      const parsed = parsePoolAsset(pool.asset);
      if (!parsed) {
        skipped.push(pool.asset);
        continue;
      }

      const caip = buildCAIP(parsed);
      if (!caip) {
        skipped.push(pool.asset);
        continue;
      }

      const symbol = getSymbol(parsed);
      const metadata = CHAIN_METADATA[parsed.chain];

      if (!metadata) {
        console.warn(`⚠️  No metadata for chain: ${parsed.chain}`);
        skipped.push(pool.asset);
        continue;
      }

      // DO NOT include icon - icons come from Pioneer SDK assetData
      const item = {
        asset: pool.asset, // THORChain format (e.g., "BTC.BTC")
        chain: parsed.chain,
        symbol,
        name: parsed.contract ? `${symbol} (${metadata.name})` : metadata.name,
        // icon removed - use Pioneer SDK assetData instead
        caip,
        networkId: CHAIN_TO_NETWORK_ID[parsed.chain],
        isNative: !parsed.contract,
        contract: parsed.contract || undefined,
      };

      transformed.push(item);
    }

    // Sort by chain, then by native first, then by symbol
    transformed.sort((a, b) => {
      if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
      if (a.isNative !== b.isNative) return a.isNative ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    });

    console.log(`\n✅ Successfully transformed ${transformed.length} pools`);
    if (blocked.length > 0) {
      console.log(`🚫 Blocked ${blocked.length} competitor tokens: ${blocked.join(', ')}`);
    }
    console.log(`⚠️  Skipped ${skipped.length} pools: ${skipped.join(', ')}\n`);

    // Group by chain for display
    const byChain = transformed.reduce((acc, pool) => {
      if (!acc[pool.chain]) acc[pool.chain] = [];
      acc[pool.chain].push(pool);
      return acc;
    }, {});

    console.log('📊 Pools by chain:');
    Object.entries(byChain).forEach(([chain, pools]) => {
      const natives = pools.filter(p => p.isNative).length;
      const tokens = pools.filter(p => !p.isNative).length;
      console.log(`   ${chain}: ${pools.length} total (${natives} native, ${tokens} tokens)`);
    });

    return transformed;

  } catch (error) {
    console.error('❌ Error fetching pools:', error.message);
    throw error;
  }
}

/**
 * Generate TypeScript config file
 */
function generateConfigFile(pools) {
  const timestamp = new Date().toISOString();

  const content = `/**
 * THORChain Supported Pools Configuration
 *
 * Auto-generated from THORChain Midgard API
 * Generated: ${timestamp}
 *
 * This file contains all active THORChain pools mapped to CAIP format.
 * DO NOT EDIT MANUALLY - regenerate using: node scripts/fetch-thorchain-pools.js
 * 
 * NOTE: Icons are NOT stored here. Use Pioneer SDK assetData for icon URLs.
 */

export interface ThorchainPool {
  /** THORChain asset notation (e.g., "BTC.BTC", "ETH.USDT-0xdac...") */
  asset: string;
  /** Chain identifier (e.g., "BTC", "ETH") */
  chain: string;
  /** Asset symbol (e.g., "BTC", "USDT") */
  symbol: string;
  /** Display name */
  name: string;
  /** CAIP identifier - use this to lookup icons in Pioneer SDK assetData */
  caip: string;
  /** Network ID (CAIP-2 format) */
  networkId: string;
  /** Whether this is a native chain asset */
  isNative: boolean;
  /** Token contract address (if applicable) */
  contract?: string;
}

/**
 * All supported THORChain pools
 * Total: ${pools.length} pools
 */
export const THORCHAIN_POOLS: ThorchainPool[] = ${JSON.stringify(pools, null, 2)};

/**
 * Get pool by symbol
 */
export function getPoolBySymbol(symbol: string): ThorchainPool | undefined {
  return THORCHAIN_POOLS.find(pool => pool.symbol === symbol);
}

/**
 * Get pool by THORChain asset notation
 */
export function getPoolByAsset(asset: string): ThorchainPool | undefined {
  return THORCHAIN_POOLS.find(pool => pool.asset === asset);
}

/**
 * Get pool by CAIP
 */
export function getPoolByCAIP(caip: string): ThorchainPool | undefined {
  return THORCHAIN_POOLS.find(pool => pool.caip === caip);
}

/**
 * Get all pools for a specific chain
 */
export function getPoolsByChain(chain: string): ThorchainPool[] {
  return THORCHAIN_POOLS.filter(pool => pool.chain === chain);
}

/**
 * Get all native pools (no contract address)
 */
export function getNativePools(): ThorchainPool[] {
  return THORCHAIN_POOLS.filter(pool => pool.isNative);
}

/**
 * Get all token pools (with contract address)
 */
export function getTokenPools(): ThorchainPool[] {
  return THORCHAIN_POOLS.filter(pool => !pool.isNative);
}
`;

  return content;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  THORChain Pool Fetcher & Transformer  ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Fetch and transform pools
    const pools = await fetchAndTransformPools();

    // Generate config file
    console.log('\n📝 Generating TypeScript config file...');
    const configContent = generateConfigFile(pools);

    // Write to file
    const outputPath = path.join(__dirname, '..', 'src', 'config', 'thorchain-pools.ts');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, configContent, 'utf8');

    console.log(`✅ Config file written to: ${outputPath}`);
    console.log(`\n✨ Done! Generated config with ${pools.length} pools\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchAndTransformPools, generateConfigFile };
