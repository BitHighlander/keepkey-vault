/**
 * Payment Notification System - Notification Settings UI
 *
 * Comprehensive settings panel for payment notifications with:
 * - Toggle notifications on/off
 * - Toggle sound on/off
 * - Minimum amount threshold (USD)
 * - Show/hide fiat value
 * - Test notification button
 */

'use client'

import React, { useState } from 'react'
import { VStack, HStack, Text, Box, Input, Button } from '@chakra-ui/react'
import { FaBell, FaVolumeUp, FaDollarSign, FaEye, FaToggleOn, FaToggleOff } from 'react-icons/fa'
import { soundManager } from '@/lib/notifications/SoundManager'
import { paymentToastManager } from '@/lib/notifications/PaymentToastManager'
import type { PaymentEvent } from '@/types/events'

// Theme colors - matching Settings theme
const theme = {
  cardBg: '#111111',
  gold: '#FFD700',
  border: '#222222',
}

/**
 * NotificationSettings - Comprehensive notification settings panel
 *
 * Features:
 * - Enable/disable all notifications
 * - Enable/disable sounds
 * - Set minimum amount threshold
 * - Toggle fiat value display
 * - Test notification button
 */
export function NotificationSettings() {
  // Get initial preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    paymentToastManager.getEnabled()
  )
  const [soundEnabled, setSoundEnabled] = useState(!soundManager.getMuted())
  const [minimumAmount, setMinimumAmount] = useState(
    paymentToastManager.getPreferences().minimumAmountUsd.toString()
  )
  const [showFiatValue, setShowFiatValue] = useState(
    paymentToastManager.getPreferences().showFiatValue
  )

  /**
   * Handle toggle notifications
   */
  const handleToggleNotifications = () => {
    const newEnabled = paymentToastManager.toggleEnabled()
    setNotificationsEnabled(newEnabled)
  }

  /**
   * Handle toggle sound
   */
  const handleToggleSound = () => {
    const newMuted = soundManager.toggleMute()
    setSoundEnabled(!newMuted)
  }

  /**
   * Handle minimum amount change
   */
  const handleMinimumAmountChange = (value: string) => {
    setMinimumAmount(value)
    const amount = parseFloat(value) || 0
    paymentToastManager.setMinimumAmount(amount)
  }

  /**
   * Handle toggle show fiat value
   */
  const handleToggleShowFiat = () => {
    const newShowFiat = paymentToastManager.toggleShowFiatValue()
    setShowFiatValue(newShowFiat)
  }

  /**
   * Handle test notification
   */
  const handleTestNotification = () => {
    // Create a test payment event
    const testEvent: PaymentEvent = {
      type: 'payment_received',
      caip: 'eip155:1/slip44:60',
      networkId: 'ethereum',
      symbol: 'ETH',
      amount: '0.5',
      amountFormatted: '0.5 ETH',
      valueUsd: 1500.0,
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      timestamp: Date.now(),
      newBalance: '10.5',
    }

    // Show toast
    paymentToastManager.showPaymentToast(testEvent)

    // Play sound
    if (soundEnabled) {
      soundManager.play('payment_received')
    }
  }

  return (
    <VStack gap={3} align="stretch">
      {/* Enable Notifications Toggle */}
      <HStack justify="space-between" p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
        <VStack align="start" gap={0} flex={1}>
          <HStack gap={2}>
            <FaBell color={theme.gold} />
            <Text fontSize="sm" color="white">
              Payment Notifications
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            Show toast notifications for payments
          </Text>
        </VStack>
        <Box
          as="button"
          onClick={handleToggleNotifications}
          cursor="pointer"
          transition="all 0.2s"
          _hover={{ transform: 'scale(1.1)' }}
        >
          {notificationsEnabled ? (
            <FaToggleOn size={32} color="#00FF00" />
          ) : (
            <FaToggleOff size={32} color="#888888" />
          )}
        </Box>
      </HStack>

      {/* Sound Toggle */}
      <HStack justify="space-between" p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
        <VStack align="start" gap={0} flex={1}>
          <HStack gap={2}>
            <FaVolumeUp color={theme.gold} />
            <Text fontSize="sm" color="white">
              Payment Sounds
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            Play sound effects for payments
          </Text>
        </VStack>
        <Box
          as="button"
          onClick={handleToggleSound}
          cursor="pointer"
          transition="all 0.2s"
          _hover={{ transform: 'scale(1.1)' }}
        >
          {soundEnabled ? (
            <FaToggleOn size={32} color="#00FF00" />
          ) : (
            <FaToggleOff size={32} color="#888888" />
          )}
        </Box>
      </HStack>

      {/* Minimum Amount Threshold */}
      <VStack align="stretch" gap={2} p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
        <HStack gap={2}>
          <FaDollarSign color={theme.gold} />
          <Text fontSize="sm" color="white">
            Minimum Amount (USD)
          </Text>
        </HStack>
        <Input
          type="number"
          value={minimumAmount}
          onChange={(e) => handleMinimumAmountChange(e.target.value)}
          placeholder="0"
          min="0"
          step="1"
          size="sm"
          bg="rgba(0, 0, 0, 0.3)"
          borderColor={theme.border}
          color="white"
          _focus={{ borderColor: theme.gold }}
        />
        <Text fontSize="xs" color="gray.500">
          Only show notifications for payments above this amount (0 = all payments)
        </Text>
      </VStack>

      {/* Show Fiat Value Toggle */}
      <HStack justify="space-between" p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
        <VStack align="start" gap={0} flex={1}>
          <HStack gap={2}>
            <FaEye color={theme.gold} />
            <Text fontSize="sm" color="white">
              Show USD Value
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            Display fiat value in notifications
          </Text>
        </VStack>
        <Box
          as="button"
          onClick={handleToggleShowFiat}
          cursor="pointer"
          transition="all 0.2s"
          _hover={{ transform: 'scale(1.1)' }}
        >
          {showFiatValue ? (
            <FaToggleOn size={32} color="#00FF00" />
          ) : (
            <FaToggleOff size={32} color="#888888" />
          )}
        </Box>
      </HStack>

      {/* Test Notification Button */}
      <Button
        width="100%"
        size="sm"
        bg={theme.gold}
        color="black"
        _hover={{ opacity: 0.8 }}
        onClick={handleTestNotification}
      >
        Test Notification
      </Button>

      {/* Info Note */}
      <Box
        p={2}
        bg="rgba(255, 215, 0, 0.05)"
        borderRadius="md"
        borderWidth="1px"
        borderColor="rgba(255, 215, 0, 0.2)"
      >
        <Text fontSize="xs" color="gray.400" textAlign="center">
          💡 Notifications appear globally on all pages when you receive or send payments
        </Text>
      </Box>
    </VStack>
  )
}
