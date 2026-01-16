/**
 * Platform Detection Utilities
 *
 * Detects whether the vault is running in mobile app, web browser, or other contexts
 */

export interface PlatformInfo {
  isMobileApp: boolean;
  isWebBrowser: boolean;
  isStandalone: boolean;
  userAgent: string;
}

/**
 * Check if running in KeepKey Mobile app
 *
 * The mobile app sets a localStorage flag when injecting wallet data
 * See: projects/keepkey-mobile-expo/src/screens/VaultWebViewScreen.js (line 101)
 */
export function isMobileApp(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    // Check the flag set by mobile app WebView injection
    return localStorage.getItem('keepkey_mobile_mode') === 'true';
  } catch (error) {
    console.error('[Platform Detection] Error checking mobile mode:', error);
    return false;
  }
}

/**
 * Check if running in a regular web browser (not mobile app)
 */
export function isWebBrowser(): boolean {
  return !isMobileApp();
}

/**
 * Check if running in standalone mode (PWA, installed app)
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check various PWA standalone indicators
  const isStandalonePWA =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any)?.standalone === true ||
    document.referrer.includes('android-app://');

  return isStandalonePWA;
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const isMobile = isMobileApp();
  const isWeb = isWebBrowser();
  const standalone = isStandalone();

  return {
    isMobileApp: isMobile,
    isWebBrowser: isWeb,
    isStandalone: standalone,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  };
}

/**
 * Get platform display name for UI
 */
export function getPlatformDisplayName(): string {
  if (isMobileApp()) {
    return 'KeepKey Mobile App';
  }

  if (isStandalone()) {
    return 'KeepKey Vault (Installed)';
  }

  return 'KeepKey Vault (Browser)';
}

/**
 * Check if the current platform supports hardware wallet connection
 *
 * Mobile app is watch-only and cannot connect to hardware wallets
 */
export function supportsHardwareWallet(): boolean {
  return isWebBrowser();
}
