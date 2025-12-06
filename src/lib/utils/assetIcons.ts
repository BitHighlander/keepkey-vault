/**
 * Asset Icon Utilities
 *
 * Generates correct CDN URLs for asset icons using:
 * - KeepKey API (api.keepkey.info) which redirects to CDN
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
    // Use api.keepkey.info which handles CDN redirect and permissions
    return `https://api.keepkey.info/coins/${base64Caip}.png`;
  } catch (error) {
    console.error('❌ [AssetIcons] Error encoding CAIP to base64:', error);
    return '';
  }
};

