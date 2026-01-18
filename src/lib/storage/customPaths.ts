/**
 * Custom Paths Storage Utility
 *
 * Manages persistence of user-defined derivation paths in localStorage.
 * Custom paths are loaded during Pioneer SDK initialization and added
 * to the default paths.
 */

import type { ScriptType, CurveType, PubKeyType } from '@pioneer-platform/pioneer-coins';

const CUSTOM_PATHS_KEY = 'keepkey-custom-paths';

export interface CustomPath {
  note: string;
  type: PubKeyType;
  addressNList: number[];
  addressNListMaster: number[];
  curve: CurveType;
  script_type: ScriptType;
  showDisplay: boolean;
  networks: string[];
  // Optional fields
  blockchain?: string;
  symbol?: string;
  symbolSwapKit?: string;
  available_scripts_types?: ScriptType[];
  // Metadata
  createdAt: number; // Timestamp when path was added
  id: string; // Unique identifier
}

/**
 * Get all custom paths from localStorage
 */
export const getCustomPaths = (): CustomPath[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_PATHS_KEY);
    if (!stored) return [];

    const paths = JSON.parse(stored) as CustomPath[];
    //console.log('📂 [CustomPaths] Loaded custom paths from storage:', paths.length);
    return Array.isArray(paths) ? paths : [];
  } catch (error) {
    console.error('❌ [CustomPaths] Error loading custom paths:', error);
    return [];
  }
};

/**
 * Save a new custom path to localStorage
 */
export const saveCustomPath = (path: Omit<CustomPath, 'createdAt' | 'id'>): CustomPath => {
  try {
    const existingPaths = getCustomPaths();

    // Create new path with metadata
    const newPath: CustomPath = {
      ...path,
      createdAt: Date.now(),
      id: `custom-path-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };

    // Add to existing paths
    const updatedPaths = [...existingPaths, newPath];

    // Save to localStorage
    localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(updatedPaths));

    //console.log('✅ [CustomPaths] Saved custom path:', newPath);
    return newPath;
  } catch (error) {
    console.error('❌ [CustomPaths] Error saving custom path:', error);
    throw new Error('Failed to save custom path to localStorage');
  }
};

/**
 * Delete a custom path by ID
 */
export const deleteCustomPath = (id: string): void => {
  try {
    const existingPaths = getCustomPaths();
    const updatedPaths = existingPaths.filter(path => path.id !== id);

    localStorage.setItem(CUSTOM_PATHS_KEY, JSON.stringify(updatedPaths));
    //console.log('🗑️ [CustomPaths] Deleted custom path:', id);
  } catch (error) {
    console.error('❌ [CustomPaths] Error deleting custom path:', error);
    throw new Error('Failed to delete custom path from localStorage');
  }
};

/**
 * Clear all custom paths
 */
export const clearCustomPaths = (): void => {
  try {
    localStorage.removeItem(CUSTOM_PATHS_KEY);
    //console.log('🗑️ [CustomPaths] Cleared all custom paths');
  } catch (error) {
    console.error('❌ [CustomPaths] Error clearing custom paths:', error);
  }
};

/**
 * Check if a path already exists (by comparing addressNList)
 * @param addressNList - The addressNList array to check
 * @param appPubkeys - Optional array of existing pubkeys from Pioneer SDK (includes both default and custom paths)
 */
export const isPathDuplicate = (addressNList: number[], appPubkeys?: any[]): boolean => {
  // Check against custom paths in localStorage
  const existingPaths = getCustomPaths();
  const isDuplicateCustom = existingPaths.some(path =>
    JSON.stringify(path.addressNList) === JSON.stringify(addressNList)
  );

  if (isDuplicateCustom) return true;

  // Check against ALL existing pubkeys (includes default paths from pioneer-coins)
  if (appPubkeys && Array.isArray(appPubkeys)) {
    const isDuplicateInApp = appPubkeys.some(pubkey => {
      // Convert both to strings for comparison
      const pubkeyPath = pubkey.addressNList || pubkey.path;
      if (!pubkeyPath) return false;

      // Handle both array and string path formats
      if (Array.isArray(pubkeyPath)) {
        return JSON.stringify(pubkeyPath) === JSON.stringify(addressNList);
      }

      // If path is a string like "m/84'/0'/0'/0/0", convert addressNList to string for comparison
      if (typeof pubkeyPath === 'string') {
        const pathStr = convertAddressNListToPath(addressNList);
        return pubkeyPath === pathStr;
      }

      return false;
    });

    if (isDuplicateInApp) return true;
  }

  return false;
};

/**
 * Convert addressNList array to BIP44 path string
 * Example: [0x80000054, 0x80000000, 0x80000000, 0, 0] => "m/84'/0'/0'/0/0"
 */
function convertAddressNListToPath(addressNList: number[]): string {
  if (!Array.isArray(addressNList) || addressNList.length === 0) return '';

  const parts = addressNList.map((num, index) => {
    // Check if hardened (bit 31 is set)
    const isHardened = (num & 0x80000000) !== 0;
    // Remove hardening bit to get actual value
    const value = num & 0x7FFFFFFF;

    // First 3 components are typically hardened
    return isHardened ? `${value}'` : `${value}`;
  });

  return `m/${parts.join('/')}`;
}

/**
 * Get custom paths for a specific network
 */
export const getCustomPathsForNetwork = (networkId: string): CustomPath[] => {
  const allPaths = getCustomPaths();
  return allPaths.filter(path =>
    path.networks.includes(networkId)
  );
};
