/**
 * Payment Notification System - Asset Icon Service
 *
 * Uses REAL asset data from @pioneer-platform/pioneer-discovery with:
 * - LRU cache (100 entries, 1-hour TTL)
 * - Direct lookup from pioneer-discovery assetData
 * - Batch preloading for common assets
 * - SSR-safe implementation
 *
 * NO MOCKING - All data comes from pioneer-discovery package
 */

import type { IconCache, IconCacheEntry } from '@/types/events'
// @ts-expect-error - pioneer-discovery doesn't have TypeScript declarations
import { assetData } from '@pioneer-platform/pioneer-discovery'

const ICON_CACHE_KEY = 'payment_icon_cache'
const MAX_CACHE_SIZE = 100
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Common assets to preload on initialization
 */
const COMMON_ASSETS = [
  'eip155:1/slip44:60', // Ethereum
  'bip122:000000000019d6689c085ae165831e93/slip44:0', // Bitcoin
  'cosmos:cosmoshub-4/slip44:118', // Cosmos
  'eip155:56/slip44:60', // BSC
]

/**
 * AssetIconService - Singleton service for managing asset icons
 *
 * Features:
 * - LRU cache with TTL
 * - SSR-safe (checks for fetch API availability)
 * - Automatic cache pruning
 * - Batch preloading
 */
class AssetIconService {
  private static instance: AssetIconService | null = null
  private cache: Map<string, IconCacheEntry> = new Map()
  private isBrowser: boolean
  private isInitialized: boolean = false

  private constructor() {
    // Check if we're in a browser environment
    this.isBrowser =
      typeof window !== 'undefined' &&
      typeof fetch !== 'undefined' &&
      typeof localStorage !== 'undefined'

    // Load cache from localStorage
    this.loadCache()

    console.log('[AssetIconService] Initialized:', {
      browser: this.isBrowser,
      cached: this.cache.size,
    })
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AssetIconService {
    if (!AssetIconService.instance) {
      AssetIconService.instance = new AssetIconService()
    }
    return AssetIconService.instance
  }

  /**
   * Initialize service (preload common assets)
   */
  public async init(): Promise<void> {
    if (!this.isBrowser || this.isInitialized) {
      return
    }

    try {
      // Preload common assets in background
      this.preloadAssets(COMMON_ASSETS)
      this.isInitialized = true
      console.log('[AssetIconService] Preloading common assets')
    } catch (error) {
      console.error('[AssetIconService] Error during init:', error)
    }
  }

  /**
   * Get icon URL for a CAIP identifier
   *
   * @param caip - CAIP identifier (e.g., 'eip155:1/slip44:60')
   * @returns Icon URL or null if unavailable
   */
  public async getIconUrl(caip: string): Promise<string | null> {
    if (!this.isBrowser) {
      return null
    }

    // Check cache first
    const cached = this.getCachedIcon(caip)
    if (cached) {
      // Update access count for LRU
      cached.accessCount++
      this.cache.set(caip, cached)
      this.saveCache()
      return cached.url
    }

    // Fetch from API
    try {
      const url = await this.fetchIconFromApi(caip)
      if (url) {
        this.cacheIcon(caip, url)
        return url
      }
    } catch (error) {
      console.error(`[AssetIconService] Error fetching icon for ${caip}:`, error)
    }

    return null
  }

  /**
   * Get cached icon if available and not expired
   */
  private getCachedIcon(caip: string): IconCacheEntry | null {
    const entry = this.cache.get(caip)
    if (!entry) {
      return null
    }

    // Check if expired
    const now = Date.now()
    const age = now - entry.cachedAt
    if (age > CACHE_TTL_MS) {
      // Expired, remove from cache
      this.cache.delete(caip)
      this.saveCache()
      return null
    }

    return entry
  }

  /**
   * Fetch icon URL from pioneer-discovery assetData (NO API CALL)
   * Uses REAL data directly from the package - NO MOCKING
   */
  private async fetchIconFromApi(caip: string): Promise<string | null> {
    try {
      // Look up asset in pioneer-discovery data
      const asset = (assetData as any)[caip]

      if (!asset) {
        console.log(`[AssetIconService] Asset not found in pioneer-discovery for ${caip}`)
        return null
      }

      // Return the icon URL directly from assetData
      const iconUrl = asset.icon
      if (!iconUrl) {
        console.log(`[AssetIconService] No icon URL available for ${caip}`)
        return null
      }

      console.log(`[AssetIconService] Found icon for ${caip}: ${iconUrl}`)
      return iconUrl
    } catch (error) {
      console.error(`[AssetIconService] Error looking up ${caip}:`, error)
      return null
    }
  }

  /**
   * Cache an icon URL
   */
  private cacheIcon(caip: string, url: string): void {
    const entry: IconCacheEntry = {
      url,
      cachedAt: Date.now(),
      accessCount: 1,
    }

    this.cache.set(caip, entry)

    // Prune cache if it exceeds max size
    if (this.cache.size > MAX_CACHE_SIZE) {
      this.pruneCache()
    }

    this.saveCache()
  }

  /**
   * Prune cache using LRU strategy (remove least recently used)
   */
  private pruneCache(): void {
    // Convert to array and sort by access count (ascending)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.accessCount - b.accessCount
    )

    // Remove bottom 20% of entries
    const removeCount = Math.ceil(this.cache.size * 0.2)
    for (let i = 0; i < removeCount; i++) {
      const [caip] = entries[i]
      this.cache.delete(caip)
    }

    console.log(
      `[AssetIconService] Pruned ${removeCount} entries, ${this.cache.size} remaining`
    )
  }

  /**
   * Preload icons for common assets in background
   */
  private async preloadAssets(caips: string[]): Promise<void> {
    const promises = caips.map((caip) => this.getIconUrl(caip))
    await Promise.allSettled(promises)
    console.log(`[AssetIconService] Preloaded ${caips.length} common assets`)
  }

  /**
   * Load cache from localStorage
   */
  private loadCache(): void {
    if (!this.isBrowser) {
      return
    }

    try {
      const stored = localStorage.getItem(ICON_CACHE_KEY)
      if (!stored) {
        return
      }

      const parsed: Array<[string, IconCacheEntry]> = JSON.parse(stored)
      this.cache = new Map(parsed)

      // Clean up expired entries on load
      const now = Date.now()
      let cleaned = 0
      for (const [caip, entry] of this.cache.entries()) {
        const age = now - entry.cachedAt
        if (age > CACHE_TTL_MS) {
          this.cache.delete(caip)
          cleaned++
        }
      }

      if (cleaned > 0) {
        console.log(`[AssetIconService] Cleaned ${cleaned} expired entries`)
        this.saveCache()
      }
    } catch (error) {
      console.error('[AssetIconService] Error loading cache:', error)
      this.cache = new Map()
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCache(): void {
    if (!this.isBrowser) {
      return
    }

    try {
      const serialized = Array.from(this.cache.entries())
      localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(serialized))
    } catch (error) {
      console.error('[AssetIconService] Error saving cache:', error)
    }
  }

  /**
   * Clear all cached icons
   */
  public clearCache(): void {
    this.cache.clear()
    if (this.isBrowser) {
      try {
        localStorage.removeItem(ICON_CACHE_KEY)
        console.log('[AssetIconService] Cache cleared')
      } catch (error) {
        console.error('[AssetIconService] Error clearing cache:', error)
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number
    maxSize: number
    ttlMs: number
  } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
      ttlMs: CACHE_TTL_MS,
    }
  }
}

// Export singleton instance
export const assetIconService = AssetIconService.getInstance()

// Export class for testing
export { AssetIconService }
