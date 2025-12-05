/**
 * Asset Icon Utilities
 *
 * Generates correct CDN URLs for asset icons using:
 * - SFO3 DigitalOcean CDN (keepkey.sfo3.cdn.digitaloceanspaces.com)
 * - Base64-encoded CAIP identifiers as filenames
 */

/**
 * Get the correct icon URL for an asset using KeepKey CDN
 *
 * @param caip - The CAIP identifier for the asset
 * @param fallbackIcon - Optional fallback icon URL from asset data
 * @returns The fallback icon URL if provided, otherwise generates CDN URL
 */
export const getAssetIconUrl = (caip: string, fallbackIcon?: string): string => {
  // If fallback icon is provided from asset data, use it first
  if (fallbackIcon && fallbackIcon.trim() !== '') {
    return fallbackIcon;
  }

  if (!caip) return '';

  // Convert CAIP to base64 for KeepKey CDN
  // This ensures correct filename format and avoids URL encoding issues
  try {
    const base64Caip = btoa(caip);
    // Use SFO3 CDN directly
    return `https://keepkey.sfo3.cdn.digitaloceanspaces.com/coins/${base64Caip}.png`;
  } catch (error) {
    console.error('❌ [AssetIcons] Error encoding CAIP to base64:', error);
    return '';
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
    return '';
  }
};
