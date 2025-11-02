/**
 * THORChain Supported Pools Configuration
 *
 * Auto-generated from THORChain Midgard API
 * Generated: 2025-10-23T05:25:56.844Z
 *
 * This file contains all active THORChain pools mapped to CAIP format.
 * DO NOT EDIT MANUALLY - regenerate using: node scripts/fetch-thorchain-pools.js
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
  /** Icon URL */
  icon: string;
  /** CAIP identifier */
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
 * Total: 30 pools
 */
export const THORCHAIN_POOLS: ThorchainPool[] = [
  {
    "asset": "AVAX.AVAX",
    "chain": "AVAX",
    "symbol": "AVAX",
    "name": "Avalanche",
    "icon": "https://pioneers.dev/coins/avalanche.png",
    "caip": "eip155:43114/slip44:60",
    "networkId": "eip155:43114",
    "isNative": true
  },
  {
    "asset": "AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F",
    "chain": "AVAX",
    "symbol": "SOL",
    "name": "SOL (Avalanche)",
    "icon": "https://pioneers.dev/coins/avalanche.png",
    "caip": "eip155:43114/erc20:0xfe6b19286885a4f7f55adad09c3cd1f906d2478f",
    "networkId": "eip155:43114",
    "isNative": false,
    "contract": "0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F"
  },
  {
    "asset": "AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E",
    "chain": "AVAX",
    "symbol": "USDC",
    "name": "USDC (Avalanche)",
    "icon": "https://pioneers.dev/coins/avalanche.png",
    "caip": "eip155:43114/erc20:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    "networkId": "eip155:43114",
    "isNative": false,
    "contract": "0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E"
  },
  {
    "asset": "AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7",
    "chain": "AVAX",
    "symbol": "USDT",
    "name": "USDT (Avalanche)",
    "icon": "https://pioneers.dev/coins/avalanche.png",
    "caip": "eip155:43114/erc20:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
    "networkId": "eip155:43114",
    "isNative": false,
    "contract": "0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7"
  },
  {
    "asset": "BCH.BCH",
    "chain": "BCH",
    "symbol": "BCH",
    "name": "Bitcoin Cash",
    "icon": "https://pioneers.dev/coins/bitcoincash.png",
    "caip": "bip122:000000000000000000651ef99cb9fcbe/slip44:145",
    "networkId": "bip122:000000000000000000651ef99cb9fcbe",
    "isNative": true
  },
  {
    "asset": "BSC.BNB",
    "chain": "BSC",
    "symbol": "BNB",
    "name": "BNB Chain",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/slip44:60",
    "networkId": "eip155:56",
    "isNative": true
  },
  {
    "asset": "BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C",
    "chain": "BSC",
    "symbol": "BTCB",
    "name": "BTCB (BNB Chain)",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/erc20:0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c",
    "networkId": "eip155:56",
    "isNative": false,
    "contract": "0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C"
  },
  {
    "asset": "BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56",
    "chain": "BSC",
    "symbol": "BUSD",
    "name": "BUSD (BNB Chain)",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/erc20:0xe9e7cea3dedca5984780bafc599bd69add087d56",
    "networkId": "eip155:56",
    "isNative": false,
    "contract": "0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56"
  },
  {
    "asset": "BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8",
    "chain": "BSC",
    "symbol": "ETH",
    "name": "ETH (BNB Chain)",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/erc20:0x2170ed0880ac9a755fd29b2688956bd959f933f8",
    "networkId": "eip155:56",
    "isNative": false,
    "contract": "0X2170ED0880AC9A755FD29B2688956BD959F933F8"
  },
  {
    "asset": "BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003",
    "chain": "BSC",
    "symbol": "TWT",
    "name": "TWT (BNB Chain)",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/erc20:0x4b0f1812e5df2a09796481ff14017e6005508003",
    "networkId": "eip155:56",
    "isNative": false,
    "contract": "0X4B0F1812E5DF2A09796481FF14017E6005508003"
  },
  {
    "asset": "BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D",
    "chain": "BSC",
    "symbol": "USDC",
    "name": "USDC (BNB Chain)",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "networkId": "eip155:56",
    "isNative": false,
    "contract": "0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D"
  },
  {
    "asset": "BSC.USDT-0X55D398326F99059FF775485246999027B3197955",
    "chain": "BSC",
    "symbol": "USDT",
    "name": "USDT (BNB Chain)",
    "icon": "https://pioneers.dev/coins/binance.png",
    "caip": "eip155:56/erc20:0x55d398326f99059ff775485246999027b3197955",
    "networkId": "eip155:56",
    "isNative": false,
    "contract": "0X55D398326F99059FF775485246999027B3197955"
  },
  {
    "asset": "BTC.BTC",
    "chain": "BTC",
    "symbol": "BTC",
    "name": "Bitcoin",
    "icon": "https://pioneers.dev/coins/bitcoin.png",
    "caip": "bip122:000000000019d6689c085ae165831e93/slip44:0",
    "networkId": "bip122:000000000019d6689c085ae165831e93",
    "isNative": true
  },
  {
    "asset": "DOGE.DOGE",
    "chain": "DOGE",
    "symbol": "DOGE",
    "name": "Dogecoin",
    "icon": "https://pioneers.dev/coins/dogecoin.png",
    "caip": "bip122:000000000000000000000000000000001/slip44:3",
    "networkId": "bip122:000000000000000000000000000000001",
    "isNative": true
  },
  {
    "asset": "ETH.ETH",
    "chain": "ETH",
    "symbol": "ETH",
    "name": "Ethereum",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/slip44:60",
    "networkId": "eip155:1",
    "isNative": true
  },
  {
    "asset": "ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9",
    "chain": "ETH",
    "symbol": "AAVE",
    "name": "AAVE (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9"
  },
  {
    "asset": "ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F",
    "chain": "ETH",
    "symbol": "DAI",
    "name": "DAI (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X6B175474E89094C44DA98B954EEDEAC495271D0F"
  },
  {
    "asset": "ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B",
    "chain": "ETH",
    "symbol": "DPI",
    "name": "DPI (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B"
  },
  {
    "asset": "ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D",
    "chain": "ETH",
    "symbol": "FOX",
    "name": "FOX (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0xc770eefad204b5180df6a14ee197d99d808ee52d",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0XC770EEFAD204B5180DF6A14EE197D99D808EE52D"
  },
  {
    "asset": "ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD",
    "chain": "ETH",
    "symbol": "GUSD",
    "name": "GUSD (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x056fd409e1d7a124bd7017459dfea2f387b6d5cd",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD"
  },
  {
    "asset": "ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA",
    "chain": "ETH",
    "symbol": "LINK",
    "name": "LINK (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x514910771af9ca656af840dff83e8264ecf986ca",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X514910771AF9CA656AF840DFF83E8264ECF986CA"
  },
  {
    "asset": "ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0",
    "chain": "ETH",
    "symbol": "LUSD",
    "name": "LUSD (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x5f98805a4e8be255a32880fdec7f6728c6568ba0",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0"
  },
  {
    "asset": "ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48",
    "chain": "ETH",
    "symbol": "USDC",
    "name": "USDC (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48"
  },
  {
    "asset": "ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1",
    "chain": "ETH",
    "symbol": "USDP",
    "name": "USDP (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x8e870d67f660d95d5be530380d0ec0bd388289e1",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X8E870D67F660D95D5BE530380D0EC0BD388289E1"
  },
  {
    "asset": "ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7",
    "chain": "ETH",
    "symbol": "USDT",
    "name": "USDT (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0XDAC17F958D2EE523A2206206994597C13D831EC7"
  },
  {
    "asset": "ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599",
    "chain": "ETH",
    "symbol": "WBTC",
    "name": "WBTC (Ethereum)",
    "icon": "https://pioneers.dev/coins/ethereum.png",
    "caip": "eip155:1/erc20:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "networkId": "eip155:1",
    "isNative": false,
    "contract": "0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599"
  },
  {
    "asset": "GAIA.ATOM",
    "chain": "GAIA",
    "symbol": "ATOM",
    "name": "Cosmos",
    "icon": "https://pioneers.dev/coins/cosmos.png",
    "caip": "cosmos:cosmoshub-4/slip44:118",
    "networkId": "cosmos:cosmoshub-4",
    "isNative": true
  },
  {
    "asset": "LTC.LTC",
    "chain": "LTC",
    "symbol": "LTC",
    "name": "Litecoin",
    "icon": "https://pioneers.dev/coins/litecoin.png",
    "caip": "bip122:00000000000000000000000000000000/slip44:2",
    "networkId": "bip122:00000000000000000000000000000000",
    "isNative": true
  },
  {
    "asset": "THOR.RUJI",
    "chain": "THOR",
    "symbol": "RUJI",
    "name": "THORChain",
    "icon": "https://pioneers.dev/coins/thorchain.png",
    "caip": "cosmos:thorchain-mainnet-v1/slip44:931",
    "networkId": "cosmos:thorchain-mainnet-v1",
    "isNative": true
  },
  {
    "asset": "THOR.TCY",
    "chain": "THOR",
    "symbol": "TCY",
    "name": "THORChain",
    "icon": "https://pioneers.dev/coins/thorchain.png",
    "caip": "cosmos:thorchain-mainnet-v1/slip44:931",
    "networkId": "cosmos:thorchain-mainnet-v1",
    "isNative": true
  }
];

/**
 * Get pool by symbol
 * Prioritizes native assets over tokens (e.g., ETH.ETH over BSC.ETH)
 */
export function getPoolBySymbol(symbol: string, preferNative: boolean = true): ThorchainPool | undefined {
  if (preferNative) {
    // First try to find native asset
    const nativePool = THORCHAIN_POOLS.find(pool => pool.symbol === symbol && pool.isNative);
    if (nativePool) return nativePool;
  }
  // Fall back to any matching symbol
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
