/**
 * Feature flags configuration
 * All feature flags should default to OFF (false) unless explicitly enabled
 */

interface FeatureFlags {
  enableSwaps: boolean;
  // Add more feature flags here as needed
}

/**
 * Get feature flags from environment variables or local storage
 * All flags default to false unless explicitly enabled
 */
export const getFeatureFlags = (): FeatureFlags => {
  return {
    enableSwaps: false, // Forced OFF - swaps are disabled
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