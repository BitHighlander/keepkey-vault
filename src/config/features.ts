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
  // Check environment variable first (for build-time configuration)
  const envSwapsEnabled = process.env.NEXT_PUBLIC_ENABLE_SWAPS === 'true';
  
  // Check localStorage for runtime overrides (only in browser)
  let localSwapsEnabled = false;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('feature_swaps_enabled');
    localSwapsEnabled = stored === 'true';
  }
  
  return {
    enableSwaps: envSwapsEnabled || localSwapsEnabled,
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