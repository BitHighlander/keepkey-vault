/**
 * Payment Notification System - Event Type Definitions
 *
 * Core type definitions for the global payment notification system.
 * These types support event detection, deduplication, and notification display.
 */

/**
 * Types of payment events that can trigger notifications
 */
export type PaymentEventType =
  | 'payment_received'    // New payment received (balance increased)
  | 'payment_confirmed'   // Payment confirmation (future use)
  | 'balance_updated'     // Balance changed (payment sent or other update)
  | 'swap_completed'      // Swap transaction completed (future use)

/**
 * Represents a detected payment or balance change event
 */
export interface PaymentEvent {
  /** Type of payment event */
  type: PaymentEventType

  /** CAIP identifier for the asset (e.g., 'eip155:1/slip44:60') */
  caip: string

  /** Network identifier (e.g., 'ethereum', 'bitcoin') */
  networkId: string

  /** Asset symbol (e.g., 'BTC', 'ETH') */
  symbol: string

  /** Raw amount as string to preserve precision */
  amount: string

  /** Human-readable formatted amount (e.g., '0.5 BTC') */
  amountFormatted: string

  /** USD value of the amount (optional) */
  valueUsd?: number

  /** Address associated with the payment */
  address: string

  /** Transaction ID (if available) */
  txid?: string

  /** Timestamp when event was detected (Unix milliseconds) */
  timestamp: number

  /** Previous balance before this event (optional) */
  previousBalance?: string

  /** New balance after this event */
  newBalance: string
}

/**
 * Event history stored in sessionStorage for deduplication
 */
export interface EventHistory {
  /** Map of event keys to PaymentEvent objects */
  events: Map<string, PaymentEvent>

  /** Timestamp of last processed DASHBOARD_UPDATE event */
  lastProcessed: number

  /** Timestamp when the session started */
  sessionStarted: number
}

/**
 * Serializable version of EventHistory for sessionStorage
 */
export interface SerializedEventHistory {
  /** Array of [key, event] tuples for serialization */
  events: Array<[string, PaymentEvent]>

  /** Timestamp of last processed event */
  lastProcessed: number

  /** Timestamp when the session started */
  sessionStarted: number
}

/**
 * User preferences for notification system
 */
export interface NotificationPreferences {
  /** Enable/disable all notifications */
  enabled: boolean

  /** Enable/disable sound effects */
  soundEnabled: boolean

  /** Minimum USD value to trigger notification (0 = all payments) */
  minimumAmountUsd: number

  /** Show USD value in toast notifications */
  showFiatValue: boolean

  /** Show confetti for large payments (>$100) */
  enableConfetti: boolean
}

/**
 * Sound type identifiers for SoundManager
 */
export type SoundType =
  | 'payment_received'  // Maps to chaching.mp3
  | 'payment_sent'      // Maps to woosh.mp3
  | 'error'             // Maps to error.mp3 (future)
  | 'success'           // Maps to success.mp3 (future)

/**
 * LRU cache entry for asset icons
 */
export interface IconCacheEntry {
  /** Icon URL or data URI */
  url: string

  /** Timestamp when cached (Unix milliseconds) */
  cachedAt: number

  /** Number of times this icon has been accessed */
  accessCount: number
}

/**
 * Asset icon cache storage
 */
export interface IconCache {
  /** Map of CAIP to IconCacheEntry */
  entries: Map<string, IconCacheEntry>

  /** Maximum number of entries to cache */
  maxSize: number

  /** TTL in milliseconds (default: 1 hour) */
  ttl: number
}
