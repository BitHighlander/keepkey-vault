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
import { isEventsEnabled } from '@/config/features'


/**
 * Transaction event data from pioneer:tx WebSocket event
 * Uses Pioneer SDK format with networkId
 */
interface TransactionEventData {
  // Transaction direction from Pioneer SDK
  type?: 'incoming' | 'outgoing'

  // Network identification (REQUIRED)
  networkId: string // Network ID (e.g., "eip155:1", "bitcoin", "litecoin")
  caip?: string // CAIP identifier (optional, networkId is primary)

  // Transaction details
  address: string // Address that received/sent transaction
  txid: string // Transaction ID (blockchain hash)
  value: number | string // Transaction value (satoshis/wei)
  confirmations?: number // Block confirmations
  blockHeight?: number // Block height
  timestamp?: number // Event timestamp (ms)
  from?: string // Sender address (for direction detection)
  to?: string // Recipient address (for direction detection)
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

  // Track outgoing transaction hashes initiated by user (e.g., from Send component)
  // This allows us to correctly classify transactions even if Pioneer SDK
  // doesn't set the address field correctly
  private outgoingTxids: Set<string> = new Set()

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
    // Check if events feature flag is enabled
    if (!isEventsEnabled()) {
      console.log('[TransactionEventManager] Events feature disabled - skipping event processing')
      return
    }

    try {
      console.log('[TransactionEventManager] 🔍 Processing tx event:', {
        networkId: txData.networkId,
        type: txData.type,
        address: txData.address?.substring(0, 10) + '...',
        txid: txData.txid?.substring(0, 16) + '...',
        value: txData.value,
      })

      // Get network metadata directly from networkId (no conversion needed!)
      if (!txData.networkId) {
        console.error('[TransactionEventManager] ❌ Missing networkId in event:', txData)
        return
      }

      const metadata = {}

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
    metadata: ReturnType<any>
  ): PaymentEvent {
    if (!metadata) {
      throw new Error('Chain metadata is required')
    }

    // Convert value to number if it's a string
    const valueNumber = typeof txData.value === 'string'
      ? parseFloat(txData.value)
      : txData.value

    // Convert value from smallest unit (satoshis/wei) to decimal amount
    const amount = valueNumber / Math.pow(10, metadata.decimals)
    const amountStr = amount.toString()

    // Format amount with proper decimals
    const amountFormatted = `${amount.toFixed(
      Math.min(8, metadata.decimals)
    )} ${metadata.symbol}`

    // Determine event type based on transaction direction
    // Compare the address field with from/to to determine if incoming or outgoing
    let eventType: PaymentEvent['type'] = 'payment_received' // Default to received

    // Enhanced logging to diagnose classification issues
    console.log('[TransactionEventManager] Direction detection:', {
      txid: txData.txid,
      pioneerType: txData.type,
      address: txData.address,
      from: txData.from,
      to: txData.to,
      isTrackedOutgoing: this.outgoingTxids.has(txData.txid),
      addressMatchesFrom: txData.address?.toLowerCase() === txData.from?.toLowerCase(),
      addressMatchesTo: txData.address?.toLowerCase() === txData.to?.toLowerCase(),
    })

    // Priority 1: Check if this is a tracked outgoing transaction (registered by Send component)
    if (this.outgoingTxids.has(txData.txid)) {
      eventType = 'balance_updated' // Outbound payment
      console.log('[TransactionEventManager] ✅ Classified as OUTGOING (tracked txid)')
      // Remove from set after classification to free memory
      this.outgoingTxids.delete(txData.txid)
    }
    // Priority 2: Use Pioneer SDK's type field if available
    else if (txData.type) {
      if (txData.type === 'incoming') {
        eventType = 'payment_received'
        console.log('[TransactionEventManager] ✅ Classified as INCOMING (Pioneer type field)')
      } else if (txData.type === 'outgoing') {
        eventType = 'balance_updated'
        console.log('[TransactionEventManager] ✅ Classified as OUTGOING (Pioneer type field)')
      }
    }
    // Priority 3: Use address-based detection
    else if (txData.from && txData.to) {
      // If address matches the 'from' field (case-insensitive), it's an outbound payment
      if (txData.address.toLowerCase() === txData.from.toLowerCase()) {
        eventType = 'balance_updated' // Outbound payment (balance decreased)
        console.log('[TransactionEventManager] ✅ Classified as OUTGOING (address matches from)')
      }
      // If address matches the 'to' field (case-insensitive), it's an inbound payment
      else if (txData.address.toLowerCase() === txData.to.toLowerCase()) {
        eventType = 'payment_received' // Inbound payment (balance increased)
        console.log('[TransactionEventManager] ✅ Classified as INCOMING (address matches to)')
      }
      // Address doesn't match either - this shouldn't happen
      else {
        console.warn('[TransactionEventManager] ⚠️ Address does not match from or to - defaulting to payment_received')
      }
    } else {
      console.warn('[TransactionEventManager] ⚠️ Missing from/to fields - defaulting to payment_received')
    }

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

      // Play sounds for both incoming and outgoing transactions
      if (event.type === 'payment_received') {
        soundManager.play('payment_received') // Chaching sound
      } else if (event.type === 'balance_updated') {
        soundManager.play('payment_sent') // Swoosh sound
      }

      // ONLY show toast for INCOMING payments (payment_received)
      // Outbound payments just play sound and log - no toast notification
      if (event.type === 'payment_received') {
        console.log('[TransactionEventManager] 🎉 Showing toast for incoming payment')
        paymentToastManager.showPaymentToast(event)
      } else {
        console.log('[TransactionEventManager] ℹ️ Outgoing payment - sound only, no toast')
      }

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
   * Register an outgoing transaction hash
   *
   * Call this when a user initiates an outgoing transaction (e.g., from Send component)
   * to ensure it's correctly classified as outgoing when the event arrives.
   *
   * @param txid - Transaction hash to register as outgoing
   */
  public registerOutgoingTransaction(txid: string): void {
    this.outgoingTxids.add(txid)
    console.log(`[TransactionEventManager] Registered outgoing tx: ${txid.substring(0, 8)}...`)

    // Auto-cleanup after 5 minutes to prevent memory leaks
    setTimeout(() => {
      if (this.outgoingTxids.has(txid)) {
        this.outgoingTxids.delete(txid)
        console.log(`[TransactionEventManager] Auto-removed stale outgoing tx: ${txid.substring(0, 8)}...`)
      }
    }, 5 * 60 * 1000)
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
