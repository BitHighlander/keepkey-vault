/**
 * Payment Notification System - Payment Toast Manager
 *
 * Orchestrates toast notifications for payment events with:
 * - Integration with Chakra UI toaster
 * - Asset icon fetching via AssetIconService
 * - User preferences (enabled, minimum amount, show fiat)
 * - Custom toast rendering with PaymentToast component
 */

'use client'

import type { PaymentEvent, NotificationPreferences } from '@/types/events'
import { assetIconService } from './AssetIconService'
import { toaster } from '@/components/ui/toaster'
import { PaymentToast } from '@/components/notifications/PaymentToast'
import { createElement } from 'react'
import { isEventsEnabled } from '@/config/features'

const STORAGE_KEY = 'payment_notification_preferences'

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false, // Toasts disabled by default
  soundEnabled: true,
  minimumAmountUsd: 0,
  showFiatValue: true,
  enableConfetti: true,
}

/**
 * PaymentToastManager - Singleton class for managing payment toast notifications
 *
 * Features:
 * - Orchestrate toasts + sounds + icons
 * - User preferences with localStorage persistence
 * - Integration with Chakra UI toaster
 * - Custom toast rendering
 */
class PaymentToastManager {
  private static instance: PaymentToastManager | null = null
  private preferences: NotificationPreferences
  private isBrowser: boolean

  private constructor() {
    // Check if we're in a browser environment
    this.isBrowser =
      typeof window !== 'undefined' && typeof localStorage !== 'undefined'

    // Load preferences
    this.preferences = this.loadPreferences()

    // Initialize asset icon service
    if (this.isBrowser) {
      assetIconService.init()
    }

    console.log('[PaymentToastManager] Initialized:', {
      browser: this.isBrowser,
      enabled: this.preferences.enabled,
    })
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PaymentToastManager {
    if (!PaymentToastManager.instance) {
      PaymentToastManager.instance = new PaymentToastManager()
    }
    return PaymentToastManager.instance
  }

  /**
   * Show a payment toast notification
   *
   * @param event - PaymentEvent to display
   */
  public async showPaymentToast(event: PaymentEvent): Promise<void> {
    if (!this.isBrowser) {
      return
    }

    // Check if events feature flag is enabled
    if (!isEventsEnabled()) {
      console.log('[PaymentToastManager] Events feature disabled')
      return
    }

    // Check if notifications are enabled in preferences
    if (!this.preferences.enabled) {
      console.log('[PaymentToastManager] Notifications disabled in preferences')
      return
    }

    // Check minimum amount filter
    if (this.preferences.minimumAmountUsd > 0 && event.valueUsd) {
      if (event.valueUsd < this.preferences.minimumAmountUsd) {
        console.log(
          `[PaymentToastManager] Payment below minimum ($${event.valueUsd} < $${this.preferences.minimumAmountUsd})`
        )
        return
      }
    }

    try {
      // Fetch asset icon
      const iconUrl = await assetIconService.getIconUrl(event.caip)

      // Create toast with PaymentToast component
      toaster.create({
        title: event.type === 'payment_received' ? 'Payment Received' : 'Payment Sent',
        description: createElement(PaymentToast, {
          event: {
            ...event,
            // Hide fiat value if user preference is disabled
            valueUsd: this.preferences.showFiatValue ? event.valueUsd : undefined,
          },
          iconUrl: iconUrl || undefined,
        }),
        type: event.type === 'payment_received' ? 'success' : 'info',
        duration: 5000,
      })

      console.log('[PaymentToastManager] Toast displayed for', event.symbol)
    } catch (error) {
      console.error('[PaymentToastManager] Error showing toast:', error)
    }
  }

  /**
   * Update notification preferences
   *
   * @param prefs - Partial preferences to update
   */
  public updatePreferences(prefs: Partial<NotificationPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...prefs,
    }
    this.savePreferences()
    console.log('[PaymentToastManager] Preferences updated:', this.preferences)
  }

  /**
   * Get current notification preferences
   */
  public getPreferences(): NotificationPreferences {
    return { ...this.preferences }
  }

  /**
   * Toggle notifications on/off
   *
   * @returns New enabled state
   */
  public toggleEnabled(): boolean {
    this.preferences.enabled = !this.preferences.enabled
    this.savePreferences()
    console.log('[PaymentToastManager] Notifications:', this.preferences.enabled ? 'enabled' : 'disabled')
    return this.preferences.enabled
  }

  /**
   * Set enabled state
   *
   * @param enabled - New enabled state
   */
  public setEnabled(enabled: boolean): void {
    this.preferences.enabled = enabled
    this.savePreferences()
    console.log('[PaymentToastManager] Notifications set to:', enabled)
  }

  /**
   * Get enabled state
   */
  public getEnabled(): boolean {
    return this.preferences.enabled
  }

  /**
   * Set minimum amount threshold (USD)
   *
   * @param amount - Minimum amount in USD (0 = show all)
   */
  public setMinimumAmount(amount: number): void {
    this.preferences.minimumAmountUsd = Math.max(0, amount)
    this.savePreferences()
    console.log('[PaymentToastManager] Minimum amount set to:', this.preferences.minimumAmountUsd)
  }

  /**
   * Toggle show fiat value
   *
   * @returns New showFiatValue state
   */
  public toggleShowFiatValue(): boolean {
    this.preferences.showFiatValue = !this.preferences.showFiatValue
    this.savePreferences()
    console.log('[PaymentToastManager] Show fiat value:', this.preferences.showFiatValue)
    return this.preferences.showFiatValue
  }

  /**
   * Toggle confetti for large payments
   *
   * @returns New enableConfetti state
   */
  public toggleConfetti(): boolean {
    this.preferences.enableConfetti = !this.preferences.enableConfetti
    this.savePreferences()
    console.log('[PaymentToastManager] Confetti:', this.preferences.enableConfetti)
    return this.preferences.enableConfetti
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): NotificationPreferences {
    if (!this.isBrowser) {
      return { ...DEFAULT_PREFERENCES }
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return { ...DEFAULT_PREFERENCES }
      }

      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
      }
    } catch (error) {
      console.error('[PaymentToastManager] Error loading preferences:', error)
      return { ...DEFAULT_PREFERENCES }
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
      console.error('[PaymentToastManager] Error saving preferences:', error)
    }
  }

  /**
   * Reset preferences to defaults
   */
  public resetPreferences(): void {
    this.preferences = { ...DEFAULT_PREFERENCES }
    this.savePreferences()
    console.log('[PaymentToastManager] Preferences reset to defaults')
  }
}

// Export singleton instance
export const paymentToastManager = PaymentToastManager.getInstance()

// Export class for testing
export { PaymentToastManager }
