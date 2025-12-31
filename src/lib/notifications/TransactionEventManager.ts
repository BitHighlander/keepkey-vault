/**
 * Transaction Event Manager
 *
 * Processes blockchain transaction events (pioneer:tx) from WebSocket
 * and converts them to PaymentEvents for notification display.
 *
 * This manager handles actual on-chain transactions, preventing false
 * positives from price updates or balance changes.
 */

import type { PaymentEvent, EventHistory } from '@/types/events'
import { getEventHistory, saveEventHistory } from './eventDetection'
import { soundManager } from './SoundManager'
import { paymentToastManager } from './PaymentToastManager'
import { getChainMetadata } from './chainMetadata'

/**
 * Transaction event data from pioneer:tx WebSocket event
 */
interface TransactionEventData {
  chain: string // Chain symbol (e.g., "BTC", "LTC", "ETH")
  address: string // Address that received/sent transaction
  txid: string // Transaction ID (blockchain hash)
  value: number // Transaction value (satoshis/wei)
  confirmations?: number // Block confirmations
  blockHeight?: number // Block height
  timestamp: number // Event timestamp (ms)
}

/**
 * Callback function type for event listeners
 */
type EventCallback = (event: PaymentEvent) => void

/**
 * TransactionEventManager - Singleton class for managing transaction events
 *
 * Responsibilities:
 * - Process pioneer:tx WebSocket events
 * - Convert transaction data to PaymentEvent format
 * - Manage event deduplication using txid + address
 * - Emit events to sound/toast notification systems
 */
class TransactionEventManager {
  private static instance: TransactionEventManager | null = null
  private eventListeners: Set<EventCallback> = new Set()
  private history: EventHistory

  // Deduplication window: 60 seconds (longer than balance comparison)
  // Allows for slower blockchain confirmations
  private readonly DEDUP_WINDOW_MS = 60000

  private constructor() {
    this.history = getEventHistory()
    console.log(
      '[TransactionEventManager] Initialized with',
      this.history.events.size,
      'cached events'
    )
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TransactionEventManager {
    if (!TransactionEventManager.instance) {
      TransactionEventManager.instance = new TransactionEventManager()
    }
    return TransactionEventManager.instance
  }

  /**
   * Process transaction event from pioneer:tx WebSocket
   *
   * Converts transaction data to PaymentEvent format,
   * applies deduplication, and emits to listeners.
   *
   * @param txData - Transaction event data from WebSocket
   */
  public processTransactionEvent(txData: TransactionEventData): void {
    try {
      console.log('[TransactionEventManager] Processing tx event:', {
        chain: txData.chain,
        address: txData.address,
        txid: txData.txid,
        value: txData.value,
      })

      // Get chain metadata
      const metadata = getChainMetadata(txData.chain)
      if (!metadata) {
        console.error(
          `[TransactionEventManager] Unknown chain: ${txData.chain}`
        )
        return
      }

      // Convert transaction to PaymentEvent
      const event = this.convertToPaymentEvent(txData, metadata)

      // Check for duplicate
      if (this.isDuplicate(event)) {
        console.log(
          `[TransactionEventManager] Filtered duplicate tx: ${txData.txid.substring(0, 8)}...`
        )
        return
      }

      // Handle the event
      this.handleTransactionEvent(event)
    } catch (error) {
      console.error(
        '[TransactionEventManager] Error processing transaction:',
        error
      )
    }
  }

  /**
   * Convert transaction data to PaymentEvent format
   */
  private convertToPaymentEvent(
    txData: TransactionEventData,
    metadata: ReturnType<typeof getChainMetadata>
  ): PaymentEvent {
    if (!metadata) {
      throw new Error('Chain metadata is required')
    }

    // Convert value from smallest unit (satoshis/wei) to decimal amount
    const amount = txData.value / Math.pow(10, metadata.decimals)
    const amountStr = amount.toString()

    // Format amount with proper decimals
    const amountFormatted = `${amount.toFixed(
      Math.min(8, metadata.decimals)
    )} ${metadata.symbol}`

    // Determine event type
    // Note: We can't reliably determine incoming vs outgoing from pioneer:tx
    // so we default to 'payment_received' for now
    // Future: Add direction field to pioneer:tx event
    const eventType: PaymentEvent['type'] = 'payment_received'

    return {
      type: eventType,
      caip: metadata.caip,
      networkId: metadata.networkId,
      symbol: metadata.symbol,
      amount: amountStr,
      amountFormatted,
      address: txData.address,
      txid: txData.txid,
      timestamp: txData.timestamp || Date.now(),
      newBalance: amountStr, // We don't have balance info from tx events
      // valueUsd will be calculated later if needed
    }
  }

  /**
   * Check if event is a duplicate
   *
   * Uses txid + address as unique key to allow same txid
   * to trigger notifications for multiple addresses
   */
  private isDuplicate(event: PaymentEvent): boolean {
    if (!event.txid) {
      return false
    }

    const eventKey = this.generateEventKey(event)
    const existingEvent = this.history.events.get(eventKey)

    if (!existingEvent) {
      return false
    }

    // Check if event is within deduplication window
    const timeDiff = event.timestamp - existingEvent.timestamp
    return timeDiff < this.DEDUP_WINDOW_MS
  }

  /**
   * Generate event key for deduplication
   *
   * Format: txid:address
   * Allows same txid to affect multiple addresses
   */
  private generateEventKey(event: PaymentEvent): string {
    return `${event.txid}:${event.address}`
  }

  /**
   * Handle a unique transaction event
   *
   * Adds to history, emits to listeners, plays sound, and shows toast.
   */
  private handleTransactionEvent(event: PaymentEvent): void {
    try {
      // Add to history for deduplication
      const eventKey = this.generateEventKey(event)
      this.history.events.set(eventKey, event)
      saveEventHistory(this.history)

      // Log event details
      console.log(
        `[TransactionEventManager] ${event.type.toUpperCase()}:`,
        `${event.amountFormatted}`,
        event.valueUsd ? `($${event.valueUsd.toFixed(2)})` : '',
        `on ${event.networkId}`,
        `txid: ${event.txid?.substring(0, 8)}...`
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

      // Update last processed timestamp
      this.history.lastProcessed = Date.now()
      saveEventHistory(this.history)
    } catch (error) {
      console.error(
        '[TransactionEventManager] Error handling transaction event:',
        error
      )
    }
  }

  /**
   * Emit event to all registered listeners
   */
  private emitEvent(event: PaymentEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('[TransactionEventManager] Error in event listener:', error)
      }
    })
  }

  /**
   * Register a callback to receive transaction events
   *
   * @param callback - Function to call when events occur
   * @returns Unsubscribe function
   */
  public addEventListener(callback: EventCallback): () => void {
    this.eventListeners.add(callback)
    console.log(
      `[TransactionEventManager] Listener registered (${this.eventListeners.size} total)`
    )

    return () => {
      this.eventListeners.delete(callback)
      console.log(
        `[TransactionEventManager] Listener removed (${this.eventListeners.size} remaining)`
      )
    }
  }

  /**
   * Clean up old events from history
   * Removes events older than deduplication window
   */
  public cleanupHistory(): void {
    const now = Date.now()
    let removedCount = 0

    this.history.events.forEach((event, key) => {
      if (now - event.timestamp > this.DEDUP_WINDOW_MS) {
        this.history.events.delete(key)
        removedCount++
      }
    })

    if (removedCount > 0) {
      saveEventHistory(this.history)
      console.log(
        `[TransactionEventManager] Cleaned up ${removedCount} old events`
      )
    }
  }

  /**
   * Get event history statistics
   */
  public getStats(): {
    totalEvents: number
    dedupWindowMs: number
    lastProcessed: number
  } {
    return {
      totalEvents: this.history.events.size,
      dedupWindowMs: this.DEDUP_WINDOW_MS,
      lastProcessed: this.history.lastProcessed,
    }
  }
}

// Export singleton instance
export const transactionEventManager = TransactionEventManager.getInstance()

// Export class for testing
export { TransactionEventManager }
