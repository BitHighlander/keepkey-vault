/**
 * Payment Notification System - Event Detection Utilities
 *
 * Core logic for detecting payment events by comparing balance snapshots.
 * Implements deduplication and event history management.
 */

import type {
  PaymentEvent,
  PaymentEventType,
  EventHistory,
  SerializedEventHistory,
} from '@/types/events'

const STORAGE_KEY = 'payment_event_history'
const DEDUP_WINDOW_MS = 5000 // 5 seconds
const MAX_HISTORY_SIZE = 100

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
 * Detect payment events by comparing old and new balance snapshots
 *
 * @param oldBalances - Previous balance snapshot (Map or array)
 * @param newBalances - Current balance snapshot (array)
 * @returns Array of detected PaymentEvent objects
 */
export function detectPaymentEvents(
  oldBalances: Map<string, BalanceSnapshot> | BalanceSnapshot[],
  newBalances: BalanceSnapshot[]
): PaymentEvent[] {
  const events: PaymentEvent[] = []
  const timestamp = Date.now()

  // Convert oldBalances to Map if it's an array
  const oldMap =
    oldBalances instanceof Map
      ? oldBalances
      : new Map(oldBalances.map((b) => [b.caip, b]))

  // Check each new balance against old balances
  for (const newBalance of newBalances) {
    const oldBalance = oldMap.get(newBalance.caip)

    // Case 1: New CAIP (new asset added to portfolio)
    if (!oldBalance) {
      // Only trigger if balance > 0 (not just adding asset to watch list)
      if (parseFloat(newBalance.balance) > 0) {
        events.push(createPaymentEvent({
          type: 'payment_received',
          balance: newBalance,
          previousBalance: '0',
          timestamp,
        }))
      }
      continue
    }

    // Case 2: Balance increased (payment received)
    const oldAmount = parseFloat(oldBalance.balance)
    const newAmount = parseFloat(newBalance.balance)

    if (newAmount > oldAmount) {
      const diff = (newAmount - oldAmount).toString()
      events.push(createPaymentEvent({
        type: 'payment_received',
        balance: newBalance,
        previousBalance: oldBalance.balance,
        timestamp,
        amount: diff,
      }))
    }
    // Case 3: Balance decreased (payment sent or other update)
    else if (newAmount < oldAmount && newAmount >= 0) {
      const diff = (oldAmount - newAmount).toString()
      events.push(createPaymentEvent({
        type: 'balance_updated',
        balance: newBalance,
        previousBalance: oldBalance.balance,
        timestamp,
        amount: diff,
      }))
    }
  }

  return events
}

/**
 * Create a PaymentEvent object from balance data
 */
function createPaymentEvent(params: {
  type: PaymentEventType
  balance: BalanceSnapshot
  previousBalance: string
  timestamp: number
  amount?: string
}): PaymentEvent {
  const { type, balance, previousBalance, timestamp, amount } = params

  // Calculate amount if not provided
  const eventAmount = amount || balance.balance

  // Calculate USD value for the TRANSACTION AMOUNT, not total balance
  // CRITICAL FIX: Calculate ratio of transaction amount to total balance
  let transactionValueUsd: number | undefined
  if (balance.valueUsd && balance.balance) {
    const totalBalance = parseFloat(balance.balance)
    const txAmount = parseFloat(eventAmount)

    if (totalBalance > 0) {
      // Proportional USD value: (txAmount / totalBalance) * totalBalanceUsd
      transactionValueUsd = (txAmount / totalBalance) * balance.valueUsd
    }
  }

  return {
    type,
    caip: balance.caip,
    networkId: balance.networkId,
    symbol: balance.ticker || balance.symbol,
    amount: eventAmount,
    amountFormatted: `${eventAmount} ${balance.ticker || balance.symbol}`,
    valueUsd: transactionValueUsd,
    address: balance.address,
    timestamp,
    previousBalance,
    newBalance: balance.balance,
  }
}

/**
 * Check if an event is a duplicate within the deduplication window
 *
 * @param event - PaymentEvent to check
 * @param history - Event history from sessionStorage
 * @returns true if event is a duplicate
 */
export function isDuplicate(
  event: PaymentEvent,
  history: EventHistory
): boolean {
  const eventKey = generateEventKey(event)
  const existingEvent = history.events.get(eventKey)

  if (!existingEvent) {
    return false
  }

  // Check if within deduplication window
  const timeDiff = event.timestamp - existingEvent.timestamp
  return timeDiff < DEDUP_WINDOW_MS
}

/**
 * Generate a unique key for event deduplication
 *
 * Key format: {caip}:{txid}:{timestamp}
 * If txid is not available, use rounded timestamp
 */
function generateEventKey(event: PaymentEvent): string {
  const txPart = event.txid || ''
  // Round timestamp to nearest second for similarity matching
  const timePart = Math.floor(event.timestamp / 1000) * 1000
  return `${event.caip}:${txPart}:${timePart}`
}

/**
 * Get event history from sessionStorage
 *
 * @returns EventHistory object with deserialized Map
 */
export function getEventHistory(): EventHistory {
  // SSR-safe: Only access sessionStorage in browser environment
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return createEmptyHistory()
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return createEmptyHistory()
    }

    const parsed: SerializedEventHistory = JSON.parse(stored)

    // Deserialize events array back to Map
    const eventsMap = new Map<string, PaymentEvent>(parsed.events)

    return {
      events: eventsMap,
      lastProcessed: parsed.lastProcessed,
      sessionStarted: parsed.sessionStarted,
    }
  } catch (error) {
    console.error('[EventDetection] Error loading history:', error)
    return createEmptyHistory()
  }
}

/**
 * Save event history to sessionStorage
 *
 * @param history - EventHistory object to serialize and save
 */
export function saveEventHistory(history: EventHistory): void {
  // SSR-safe: Only access sessionStorage in browser environment
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return
  }

  try {
    // Prune before saving to keep history size manageable
    const pruned = pruneEventHistory(history)

    // Serialize Map to array for JSON storage
    const serialized: SerializedEventHistory = {
      events: Array.from(pruned.events.entries()),
      lastProcessed: pruned.lastProcessed,
      sessionStarted: pruned.sessionStarted,
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
  } catch (error) {
    console.error('[EventDetection] Error saving history:', error)
  }
}

/**
 * Prune event history to stay within size limits
 *
 * Keeps most recent events and removes old ones beyond MAX_HISTORY_SIZE
 *
 * @param history - EventHistory to prune
 * @returns Pruned EventHistory
 */
export function pruneEventHistory(history: EventHistory): EventHistory {
  if (history.events.size <= MAX_HISTORY_SIZE) {
    return history
  }

  // Convert to array, sort by timestamp descending, take most recent
  const sortedEvents = Array.from(history.events.entries()).sort(
    ([, a], [, b]) => b.timestamp - a.timestamp
  )

  const prunedEvents = new Map(sortedEvents.slice(0, MAX_HISTORY_SIZE))

  return {
    ...history,
    events: prunedEvents,
  }
}

/**
 * Create an empty event history object
 */
function createEmptyHistory(): EventHistory {
  return {
    events: new Map(),
    lastProcessed: Date.now(),
    sessionStarted: Date.now(),
  }
}

/**
 * Clear all event history from sessionStorage
 */
export function clearEventHistory(): void {
  // SSR-safe: Only access sessionStorage in browser environment
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[EventDetection] Error clearing history:', error)
  }
}

/**
 * Create a Map of balances indexed by CAIP for efficient lookups
 *
 * @param balances - Array of balance snapshots
 * @returns Map of CAIP to BalanceSnapshot
 */
export function createBalancesMap(
  balances: BalanceSnapshot[]
): Map<string, BalanceSnapshot> {
  return new Map(balances.map((balance) => [balance.caip, balance]))
}
