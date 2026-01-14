/**
 * Payment Notification System - Sound Manager
 *
 * Manages audio playback for payment notifications with:
 * - SSR-safe Audio API access
 * - Frequency limiting (max 1 sound per 3 seconds)
 * - User preference management (muted/unmuted)
 * - Sound preloading for instant playback
 */

import type { SoundType } from '@/types/events'

const STORAGE_KEY = 'payment_sound_preferences'
const SOUND_FREQUENCY_LIMIT_MS = 3000 // 3 seconds
const LAST_PLAYED_KEY = 'payment_sound_last_played'

/**
 * Sound file mappings
 */
const SOUND_FILES: Record<SoundType, string> = {
  payment_received: '/sounds/chaching.mp3',
  payment_sent: '/sounds/woosh.mp3',
  error: '/sounds/error.mp3', // Future use
  success: '/sounds/success.mp3', // Future use
}

/**
 * User sound preferences
 */
interface SoundPreferences {
  muted: boolean
  volume: number // 0.0 to 1.0
}

/**
 * Last played timestamp tracking
 */
interface LastPlayedMap {
  [key: string]: number
}

/**
 * SoundManager - Singleton class for managing payment sounds
 *
 * Features:
 * - SSR-safe (checks for Audio API availability)
 * - Frequency limiting to prevent audio spam
 * - User preferences with localStorage persistence
 * - Sound preloading for instant playback
 */
class SoundManager {
  private static instance: SoundManager | null = null
  private audioCache: Map<SoundType, HTMLAudioElement> = new Map()
  private preferences: SoundPreferences
  private lastPlayed: LastPlayedMap = {}
  private isInitialized: boolean = false
  private isBrowser: boolean

  private constructor() {
    // Check if we're in a browser environment
    this.isBrowser =
      typeof window !== 'undefined' && typeof Audio !== 'undefined'

    // Load preferences
    this.preferences = this.loadPreferences()

    // Initialize last played timestamps
    this.lastPlayed = this.loadLastPlayed()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  /**
   * Initialize audio system (call on first user interaction)
   *
   * Preloads sounds for instant playback
   */
  public async init(): Promise<void> {
    if (!this.isBrowser) {
      return
    }

    if (this.isInitialized) {
      return
    }

    try {
      // Preload sounds
      for (const [type, path] of Object.entries(SOUND_FILES)) {
        // Only preload sounds that exist
        if (
          type === 'payment_received' ||
          type === 'payment_sent'
        ) {
          const audio = new Audio(path)
          audio.volume = this.preferences.volume
          audio.preload = 'auto'
          this.audioCache.set(type as SoundType, audio)
        }
      }

      this.isInitialized = true
    } catch (error) {
      console.error('[SoundManager] Error initializing sounds:', error)
    }
  }

  /**
   * Play a sound if not muted and frequency limit allows
   *
   * @param type - Type of sound to play
   */
  public play(type: SoundType): void {
    if (!this.isBrowser) {
      return
    }

    // Check if muted
    if (this.preferences.muted) {
      return
    }

    // Check frequency limit
    if (!this.canPlaySound(type)) {
      return
    }

    // Initialize if needed (lazy init on first play)
    if (!this.isInitialized) {
      this.init()
    }

    // Play sound
    this.playSound(type)

    // Update last played timestamp
    this.updateLastPlayed(type)
  }

  /**
   * Check if sound can be played based on frequency limit
   */
  private canPlaySound(type: SoundType): boolean {
    const now = Date.now()
    const lastPlayed = this.lastPlayed[type] || 0
    const timeSinceLastPlay = now - lastPlayed

    return timeSinceLastPlay >= SOUND_FREQUENCY_LIMIT_MS
  }

  /**
   * Play a sound (internal method)
   */
  private playSound(type: SoundType): void {
    try {
      // Get cached audio or create new one
      let audio = this.audioCache.get(type)

      if (!audio) {
        const path = SOUND_FILES[type]
        if (!path) {
          console.warn(`[SoundManager] No sound file for type: ${type}`)
          return
        }

        audio = new Audio(path)
        audio.volume = this.preferences.volume
        this.audioCache.set(type, audio)
      }

      // Reset playback to beginning
      audio.currentTime = 0

      // Play sound
      audio
        .play()
        .catch((error) => {
          console.error(`[SoundManager] Error playing ${type}:`, error)
        })
    } catch (error) {
      console.error('[SoundManager] Error in playSound:', error)
    }
  }

  /**
   * Update last played timestamp
   */
  private updateLastPlayed(type: SoundType): void {
    this.lastPlayed[type] = Date.now()
    this.saveLastPlayed()
  }

  /**
   * Toggle mute state
   *
   * @returns New muted state
   */
  public toggleMute(): boolean {
    this.preferences.muted = !this.preferences.muted
    this.savePreferences()
    return this.preferences.muted
  }

  /**
   * Set muted state
   *
   * @param muted - New muted state
   */
  public setMuted(muted: boolean): void {
    this.preferences.muted = muted
    this.savePreferences()
  }

  /**
   * Get current muted state
   */
  public getMuted(): boolean {
    return this.preferences.muted
  }

  /**
   * Set volume (0.0 to 1.0)
   *
   * @param volume - Volume level (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.preferences.volume = Math.max(0, Math.min(1, volume))
    this.savePreferences()

    // Update volume for all cached audio elements
    this.audioCache.forEach((audio) => {
      audio.volume = this.preferences.volume
    })
  }

  /**
   * Get current volume
   */
  public getVolume(): number {
    return this.preferences.volume
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): SoundPreferences {
    if (!this.isBrowser) {
      return { muted: false, volume: 0.7 }
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return { muted: false, volume: 0.7 }
      }

      return JSON.parse(stored)
    } catch (error) {
      console.error('[SoundManager] Error loading preferences:', error)
      return { muted: false, volume: 0.7 }
    }
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    if (!this.isBrowser) {
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences))
    } catch (error) {
      console.error('[SoundManager] Error saving preferences:', error)
    }
  }

  /**
   * Load last played timestamps from localStorage
   */
  private loadLastPlayed(): LastPlayedMap {
    if (!this.isBrowser) {
      return {}
    }

    try {
      const stored = localStorage.getItem(LAST_PLAYED_KEY)
      if (!stored) {
        return {}
      }

      return JSON.parse(stored)
    } catch (error) {
      console.error('[SoundManager] Error loading last played:', error)
      return {}
    }
  }

  /**
   * Save last played timestamps to localStorage
   */
  private saveLastPlayed(): void {
    if (!this.isBrowser) {
      return
    }

    try {
      localStorage.setItem(LAST_PLAYED_KEY, JSON.stringify(this.lastPlayed))
    } catch (error) {
      console.error('[SoundManager] Error saving last played:', error)
    }
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance()

// Export class for testing
export { SoundManager }
