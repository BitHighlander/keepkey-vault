/**
 * Feature flags configuration
 * All feature flags should default to OFF (false) unless explicitly enabled
 */

interface FeatureFlags {
  enableSwaps: boolean;
  enableZcash: boolean;
  enablePioneerV2: boolean; // Enable Pioneer SDK v2 APIs (sync, refresh, dashboard)
  // Add more feature flags here as needed
}

/**
 * Get feature flags from environment variables or local storage
 * All flags default to false unless explicitly enabled
 */
export const getFeatureFlags = (): FeatureFlags => {
  // Check environment variable first, then localStorage override
  const envSwapsEnabled = process.env.NEXT_PUBLIC_ENABLE_SWAPS === 'true';
  const envZcashEnabled = process.env.NEXT_PUBLIC_ENABLE_ZCASH === 'true';
  const envPioneerV2Enabled = process.env.NEXT_PUBLIC_ENABLE_PIONEER_V2 === 'true';

  // Check localStorage for runtime overrides (only on client side)
  let swapsOverride: boolean | null = null;
  let zcashOverride: boolean | null = null;
  let pioneerV2Override: boolean | null = null;

  if (typeof window !== 'undefined') {
    const storedSwaps = localStorage.getItem('feature_enable_swaps');
    if (storedSwaps !== null) {
      swapsOverride = storedSwaps === 'true';
    }

    const storedZcash = localStorage.getItem('feature_enable_zcash');
    if (storedZcash !== null) {
      zcashOverride = storedZcash === 'true';
    }

    const storedPioneerV2 = localStorage.getItem('feature_enable_pioneer_v2');
    if (storedPioneerV2 !== null) {
      pioneerV2Override = storedPioneerV2 === 'true';
    }
  }

  return {
    enableSwaps: swapsOverride !== null ? swapsOverride : envSwapsEnabled,
    enableZcash: zcashOverride !== null ? zcashOverride : envZcashEnabled,
    enablePioneerV2: pioneerV2Override !== null ? pioneerV2Override : envPioneerV2Enabled,
  };
};

/**
 * Set a feature flag in localStorage for runtime configuration
 */
export const setFeatureFlag = (flag: keyof FeatureFlags, enabled: boolean): void => {
  if (typeof window !== 'undefined') {
    const key = `feature_${flag.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
    localStorage.setItem(key, enabled.toString());
  }
};

/**
 * Check if a specific feature is enabled
 */
export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  const flags = getFeatureFlags();
  return flags[flag] || false;
};

/**
 * ZCash network identifiers
 */
export const ZCASH_NETWORK_ID = 'bip122:00040fe8ec8471911baa1db1266ea15d';
export const ZCASH_CHAIN = 'zcash';

/**
 * Check if ZCash support is enabled
 */
export const isZcashEnabled = (): boolean => {
  return isFeatureEnabled('enableZcash');
};

/**
 * Filter out ZCash from network IDs if feature is disabled
 */
export const filterZcashNetworkId = (networkId: string): boolean => {
  if (networkId === ZCASH_NETWORK_ID) {
    return isZcashEnabled();
  }
  return true;
};

/**
 * Filter out ZCash from chain names if feature is disabled
 */
export const filterZcashChain = (chain: string): boolean => {
  if (chain.toLowerCase() === ZCASH_CHAIN) {
    return isZcashEnabled();
  }
  return true;
};

/**
 * Check if Pioneer SDK v2 APIs are enabled
 * V2 APIs include: sync(), refresh(), dashboard property
 * These are NOT available in v1 desktop app, only in v2
 */
export const isPioneerV2Enabled = (): boolean => {
  return isFeatureEnabled('enablePioneerV2');
};