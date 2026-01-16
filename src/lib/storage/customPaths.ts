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
 */
export const isPathDuplicate = (addressNList: number[]): boolean => {
  const existingPaths = getCustomPaths();
  return existingPaths.some(path =>
    JSON.stringify(path.addressNList) === JSON.stringify(addressNList)
  );
};

/**
 * Get custom paths for a specific network
 */
export const getCustomPathsForNetwork = (networkId: string): CustomPath[] => {
  const allPaths = getCustomPaths();
  return allPaths.filter(path =>
    path.networks.includes(networkId)
  );
};
