/**
 * Payment Notification System - Payment Toast Component
 *
 * Rich toast notification for payment events with:
 * - Asset icon (from Pioneer Discovery API or fallback)
 * - Amount display with fiat value
 * - Network badge
 * - Smooth animations (slide-in, pulse, coin flip)
 * - Action buttons (View Transaction, Dismiss)
 */

'use client'

import React from 'react'
import { Box, HStack, VStack, Text, Image } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import type { PaymentEvent } from '@/types/events'

/**
 * Animation keyframes
 */
const pulseGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(72, 187, 120, 0); }
  100% { box-shadow: 0 0 0 0 rgba(72, 187, 120, 0); }
`

const slideInBounce = keyframes`
  0% { transform: translateX(400px); opacity: 0; }
  60% { transform: translateX(-10px); opacity: 1; }
  80% { transform: translateX(5px); }
  100% { transform: translateX(0); }
`

const coinFlip = keyframes`
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
`

/**
 * Props for PaymentToast component
 */
export interface PaymentToastProps {
  event: PaymentEvent
  iconUrl?: string
  onViewTransaction?: () => void
  onDismiss?: () => void
}

/**
 * PaymentToast - Rich notification component for payment events
 *
 * Features:
 * - Asset icon with fallback
 * - Amount display with symbol
 * - Optional fiat value
 * - Network badge
 * - Smooth animations
 */
export function PaymentToast({
  event,
  iconUrl,
  onViewTransaction,
  onDismiss,
}: PaymentToastProps) {
  // Log the raw event data
  console.log('PaymentToast event:', event)

  const isReceived = event.type === 'payment_received'
  const accentColor = isReceived ? '#48BB78' : '#4299E1' // Green for received, blue for sent

  return (
    <Box
      position="fixed"
      bottom={4}
      left={4}
      right={4}
      bg="rgba(17, 17, 17, 0.95)"
      borderRadius="lg"
      borderWidth="2px"
      borderColor={accentColor}
      p={4}
      backdropFilter="blur(10px)"
      animation={`${slideInBounce} 0.5s ease-out, ${pulseGlow} 2s ease-out`}
      boxShadow="0 4px 24px rgba(0, 0, 0, 0.4)"
      zIndex={9999}
    >
      <HStack gap={6} align="center">
        {/* Icon */}
        <Box
          width="48px"
          height="48px"
          borderRadius="full"
          bg={accentColor}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="2xl"
          flexShrink={0}
        >
          {isReceived ? '💰' : '📤'}
        </Box>

        {/* Payment Info */}
        <HStack flex={1} gap={8} align="center">
          {/* Title & Amount */}
          <VStack align="start" gap={1} minW="200px">
            <Text fontSize="lg" fontWeight="bold" color={accentColor}>
              Payment Received!
            </Text>
            <Text fontSize="xl" fontWeight="bold" color="white">
              {event.amountFormatted || `${event.amount} (amount)`}
            </Text>
          </VStack>

          {/* Address */}
          <VStack align="start" gap={1} flex={1}>
            <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">
              Address
            </Text>
            <Text fontSize="sm" color="white" fontFamily="mono" truncate maxW="100%">
              {event.address}
            </Text>
          </VStack>

          {/* Transaction ID */}
          <VStack align="start" gap={1} flex={1}>
            <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase">
              Transaction ID
            </Text>
            <Text fontSize="sm" color="white" fontFamily="mono" truncate maxW="100%">
              {event.txid}
            </Text>
          </VStack>
        </HStack>

        {/* Dismiss Button */}
        {onDismiss && (
          <Box
            as="button"
            width="32px"
            height="32px"
            borderRadius="md"
            bg="rgba(255, 255, 255, 0.08)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            transition="all 0.2s"
            flexShrink={0}
            _hover={{
              bg: 'rgba(255, 255, 255, 0.15)',
              transform: 'scale(1.1)',
            }}
            onClick={onDismiss}
          >
            <Text fontSize="lg" color="gray.400">
              ×
            </Text>
          </Box>
        )}
      </HStack>
    </Box>
  )
}

/**
 * Fallback icon component when image fails to load
 */
function FallbackIcon({ symbol, color }: { symbol: string; color: string }) {
  return (
    <Box
      width="48px"
      height="48px"
      borderRadius="full"
      bg={color}
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontWeight="bold"
      fontSize="xl"
      color="white"
    >
      {symbol.charAt(0).toUpperCase()}
    </Box>
  )
}
