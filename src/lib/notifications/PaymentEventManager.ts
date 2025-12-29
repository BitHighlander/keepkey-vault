/**
 * Payment Notification System - Payment Event Manager
 *
 * Orchestrates payment event detection, deduplication, and coordination
 * with sound and toast notification systems.
 */

import type { PaymentEvent, EventHistory } from '@/types/events'
import {
  detectPaymentEvents,
  isDuplicate,
  getEventHistory,
  saveEventHistory,
  createBalancesMap,
} from './eventDetection'
import { soundManager } from './SoundManager'
import { paymentToastManager } from './PaymentToastManager'

/**
 * Callback function type for event listeners
 */
type EventCallback = (event: PaymentEvent) => void

/**
 * Balance snapshot interface matching Pioneer SDK structure
 */
interface BalanceSnapshot {
  caip: string
  networkId: string
  symbol: string
  address: string
  balance: string
  valueUsd?: number
  ticker?: string
}

/**
 * PaymentEventManager - Singleton class for managing payment events
 *
 * Responsibilities:
 * - Coordinate event detection from balance updates
 * - Manage event deduplication
 * - Emit events to registered listeners (sound/toast systems)
 * - Provide access to event history
 */
class PaymentEventManager {
  private static instance: PaymentEventManager | null = null
  private eventListeners: Set<EventCallback> = new Set()
  private history: EventHistory

  private constructor() {
    this.history = getEventHistory()
    console.log(
      '[PaymentEventManager] Initialized with',
      this.history.events.size,
      'cached events'
    )
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PaymentEventManager {
    if (!PaymentEventManager.instance) {
      PaymentEventManager.instance = new PaymentEventManager()
    }
    return PaymentEventManager.instance
  }

  /**
   * Process balance update from DASHBOARD_UPDATE event
   *
   * Compares old and new balances, detects payment events,
   * applies deduplication, and emits to listeners.
   *
   * @param oldBalances - Previous balance snapshot (Map or array)
   * @param newBalances - Current balance snapshot (array)
   */
  public processBalanceUpdate(
    oldBalances: Map<string, BalanceSnapshot> | BalanceSnapshot[],
    newBalances: BalanceSnapshot[]
  ): void {
    try {
      // Detect potential payment events
      const detectedEvents = detectPaymentEvents(oldBalances, newBalances)

      if (detectedEvents.length === 0) {
        return
      }

      console.log(
        `[PaymentEventManager] Detected ${detectedEvents.length} potential event(s)`
      )

      // Filter out duplicates and emit unique events
      for (const event of detectedEvents) {
        if (!isDuplicate(event, this.history)) {
          this.handlePaymentEvent(event)
        } else {
          console.log(
            `[PaymentEventManager] Filtered duplicate event for ${event.symbol}`
          )
        }
      }

      // Update last processed timestamp
      this.history.lastProcessed = Date.now()
      saveEventHistory(this.history)
    } catch (error) {
      console.error('[PaymentEventManager] Error processing balance update:', error)
    }
  }

  /**
   * Handle a unique payment event
   *
   * Adds to history, emits to listeners, plays sound, and logs the event.
   *
   * @param event - PaymentEvent to handle
   */
  private handlePaymentEvent(event: PaymentEvent): void {
    try {
      // Add to history for deduplication
      const eventKey = this.generateEventKey(event)
      this.history.events.set(eventKey, event)
      saveEventHistory(this.history)

      // Log event details
      console.log(
        `[PaymentEventManager] ${event.type.toUpperCase()}:`,
        `${event.amountFormatted}`,
        event.valueUsd ? `($${event.valueUsd.toFixed(2)})` : '',
        `on ${event.networkId}`
      )

      // Play sound based on event type
      if (event.type === 'payment_received') {
        soundManager.play('payment_received')
      } else if (event.type === 'balance_updated') {
        soundManager.play('payment_sent')
      }

      // Show toast notification
      paymentToastManager.showPaymentToast(event)

      // Emit to all registered listeners
      this.emitEvent(event)
    } catch (error) {
      console.error('[PaymentEventManager] Error handling event:', error)
    }
  }

  /**
   * Generate event key for deduplication
   */
  private generateEventKey(event: PaymentEvent): string {
    const txPart = event.txid || ''
    const timePart = Math.floor(event.timestamp / 1000) * 1000
    return `${event.caip}:${txPart}:${timePart}`
  }

  /**
   * Emit event to all registered listeners
   */
  private emitEvent(event: PaymentEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('[PaymentEventManager] Error in event listener:', error)
      }
    })
  }

  /**
   * Register a callback to receive payment events
   *
   * @param callback - Function to call when events occur
   * @returns Unsubscribe function
   */
  public addEventListener(callback: EventCallback): () => void {
    this.eventListeners.add(callback)
    console.log(
      `[PaymentEventManager] Listener registered (${this.eventListeners.size} total)`
    )

    // Return unsubscribe function
    return () => {
      this.eventListeners.delete(callback)
      console.log(
        `[PaymentEventManager] Listener removed (${this.eventListeners.size} remaining)`
      )
    }
  }

  /**
   * Get recent payment events from history
   *
   * @param limit - Maximum number of events to return
   * @returns Array of recent PaymentEvent objects, sorted by timestamp descending
   */
  public getRecentEvents(limit: number = 20): PaymentEvent[] {
    const events = Array.from(this.history.events.values())

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => b.timestamp - a.timestamp)

    return events.slice(0, limit)
  }

  /**
   * Clear all event history
   */
  public clearHistory(): void {
    this.history = {
      events: new Map(),
      lastProcessed: Date.now(),
      sessionStarted: Date.now(),
    }
    saveEventHistory(this.history)
    console.log('[PaymentEventManager] Event history cleared')
  }

  /**
   * Get event history statistics
   */
  public getStats(): {
    totalEvents: number
    sessionDuration: number
    lastProcessed: number
  } {
    const now = Date.now()
    return {
      totalEvents: this.history.events.size,
      sessionDuration: now - this.history.sessionStarted,
      lastProcessed: this.history.lastProcessed,
    }
  }
}

// Export singleton instance
export const paymentEventManager = PaymentEventManager.getInstance()

// Export class for testing
export { PaymentEventManager }

// Re-export utility function for creating balance maps
export { createBalancesMap }
