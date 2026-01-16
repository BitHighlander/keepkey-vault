/**
 * Pubkey Storage Service
 *
 * Manages storing and retrieving KeepKey device pubkeys in localStorage.
 * This enables view-only mode when the vault is unavailable.
 */

const STORAGE_KEYS = {
  PUBKEYS: 'keepkey_vault_pubkeys',
  DEVICE_INFO: 'keepkey_vault_device_info',
  LAST_PAIRED: 'keepkey_vault_last_paired',
  VERSION: 'keepkey_vault_storage_version',
  CACHE_ENABLED: 'keepkey_vault_cache_enabled',
} as const;

const STORAGE_VERSION = '1.0.0';

export interface DeviceInfo {
  label: string;
  model?: string;
  deviceId?: string;
  features?: any;
}

export interface StoredPubkeys {
  pubkeys: any[];
  deviceInfo: DeviceInfo;
  timestamp: number;
  version: string;
}

/**
 * Check if cache is enabled (default: true)
 */
export function isCacheEnabled(): boolean {
  try {
    const enabled = localStorage.getItem(STORAGE_KEYS.CACHE_ENABLED);
    // Default to true if not set
    return enabled === null ? true : enabled === 'true';
  } catch (error) {
    console.error('❌ [PubkeyStorage] Failed to check cache enabled:', error);
    return true; // Default to enabled
  }
}

/**
 * Set cache enabled/disabled
 */
export function setCacheEnabled(enabled: boolean): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.CACHE_ENABLED, String(enabled));
    //console.log(`✅ [PubkeyStorage] Cache ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error) {
    console.error('❌ [PubkeyStorage] Failed to set cache enabled:', error);
    return false;
  }
}

/**
 * Save pubkeys and device info to localStorage after successful pairing
 */
export function savePubkeys(pubkeys: any[], deviceInfo: DeviceInfo): boolean {
  // Check if cache is enabled before saving
  if (!isCacheEnabled()) {
    //console.log('ℹ️ [PubkeyStorage] Cache disabled - skipping save');
    return false;
  }

  try {
    const data: StoredPubkeys = {
      pubkeys,
      deviceInfo,
      timestamp: Date.now(),
      version: STORAGE_VERSION,
    };

    localStorage.setItem(STORAGE_KEYS.PUBKEYS, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(deviceInfo));
    localStorage.setItem(STORAGE_KEYS.LAST_PAIRED, String(Date.now()));
    localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);

    // console.log('✅ [PubkeyStorage] Saved pubkeys to localStorage:', {
    //   count: pubkeys.length,
    //   device: deviceInfo.label || 'Unknown',
    //   timestamp: new Date().toISOString(),
    // });

    return true;
  } catch (error) {
    console.error('❌ [PubkeyStorage] Failed to save pubkeys:', error);
    return false;
  }
}

/**
 * Load stored pubkeys from localStorage
 */
export function loadPubkeys(): StoredPubkeys | null {
  try {
    const dataStr = localStorage.getItem(STORAGE_KEYS.PUBKEYS);
    if (!dataStr) {
      console.log('ℹ️ [PubkeyStorage] No stored pubkeys found');
      return null;
    }

    const data: StoredPubkeys = JSON.parse(dataStr);

    // Validate version compatibility
    if (data.version !== STORAGE_VERSION) {
      console.warn('⚠️ [PubkeyStorage] Storage version mismatch:', {
        stored: data.version,
        current: STORAGE_VERSION,
      });
      // For now, still try to use it
    }

    console.log('✅ [PubkeyStorage] Loaded pubkeys from localStorage:', {
      count: data.pubkeys?.length || 0,
      device: data.deviceInfo?.label || 'Unknown',
      age: Math.round((Date.now() - data.timestamp) / 1000 / 60), // minutes
    });

    return data;
  } catch (error) {
    console.error('❌ [PubkeyStorage] Failed to load pubkeys:', error);
    return null;
  }
}

/**
 * Check if we have stored pubkeys available for view-only mode
 */
export function hasStoredPubkeys(): boolean {
  const dataStr = localStorage.getItem(STORAGE_KEYS.PUBKEYS);
  return !!dataStr;
}

/**
 * Get device info without loading full pubkey data
 */
export function getDeviceInfo(): DeviceInfo | null {
  try {
    const deviceStr = localStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
    if (!deviceStr) return null;

    return JSON.parse(deviceStr);
  } catch (error) {
    console.error('❌ [PubkeyStorage] Failed to load device info:', error);
    return null;
  }
}

/**
 * Clear all stored pubkey data
 */
export function clearPubkeys(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEYS.PUBKEYS);
    localStorage.removeItem(STORAGE_KEYS.DEVICE_INFO);
    localStorage.removeItem(STORAGE_KEYS.LAST_PAIRED);

    console.log('✅ [PubkeyStorage] Cleared all stored pubkeys');
    return true;
  } catch (error) {
    console.error('❌ [PubkeyStorage] Failed to clear pubkeys:', error);
    return false;
  }
}

/**
 * Get last paired timestamp
 */
export function getLastPairedTime(): number | null {
  try {
    const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_PAIRED);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Migrate from old storage format if needed
 */
export function migrateFromMobileStorage(): boolean {
  try {
    // Check if we have mobile mode data but no vault data
    const hasMobilePubkeys = localStorage.getItem('keepkey_mobile_pubkeys');
    const hasMobileDevice = localStorage.getItem('keepkey_mobile_device');
    const hasVaultPubkeys = localStorage.getItem(STORAGE_KEYS.PUBKEYS);

    if (hasMobilePubkeys && !hasVaultPubkeys) {
      console.log('🔄 [PubkeyStorage] Migrating from mobile storage...');

      const mobilePubkeys = JSON.parse(hasMobilePubkeys);
      const mobileDevice = hasMobileDevice ? JSON.parse(hasMobileDevice) : { label: 'KeepKey' };

      return savePubkeys(mobilePubkeys, mobileDevice);
    }

    return false;
  } catch (error) {
    console.error('❌ [PubkeyStorage] Migration failed:', error);
    return false;
  }
}
