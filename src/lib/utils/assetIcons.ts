/**
 * Asset Icon Utilities
 *
 * Generates correct CDN URLs for asset icons using:
 * - Correct CDN region (SFO3, not NYC3)
 * - Base64-encoded CAIP identifiers as filenames
 */

/**
 * Get the correct icon URL for an asset using KeepKey CDN
 *
 * @param caip - The CAIP identifier for the asset
 * @param fallbackIcon - Optional fallback icon URL
 * @returns The correct CDN URL with base64-encoded CAIP
 */
export const getAssetIconUrl = (caip: string, fallbackIcon?: string): string => {
  if (!caip) return fallbackIcon || 'https://pioneers.dev/coins/pioneer.png';

  // Convert CAIP to base64 for keepkey.info CDN
  // This ensures correct filename format and avoids URL encoding issues
  try {
    const base64Caip = btoa(caip);
    // Use api.keepkey.info which routes to the correct SFO3 CDN
    return `https://api.keepkey.info/coins/${base64Caip}.png`;
  } catch (error) {
    console.error('❌ [AssetIcons] Error encoding CAIP to base64:', error);
    return fallbackIcon || 'https://pioneers.dev/coins/pioneer.png';
  }
};

/**
 * Get localhost fallback URL for development
 *
 * @param caip - The CAIP identifier for the asset
 * @returns Localhost URL for the asset icon with base64-encoded CAIP
 */
export const getLocalIconUrl = (caip: string): string => {
  try {
    const base64Caip = btoa(caip);
    return `http://localhost:9001/coins/${base64Caip}.png`;
  } catch (error) {
    console.error('❌ [AssetIcons] Error encoding CAIP for localhost URL:', error);
    return 'http://localhost:9001/coins/pioneer.png';
  }
};
