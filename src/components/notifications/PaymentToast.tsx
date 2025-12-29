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
  const isReceived = event.type === 'payment_received'
  const accentColor = isReceived ? '#48BB78' : '#4299E1' // Green for received, blue for sent

  return (
    <Box
      position="relative"
      bg="rgba(17, 17, 17, 0.95)"
      borderRadius="xl"
      borderWidth="1px"
      borderColor={accentColor}
      p={5}
      width="100%"
      maxW="500px"
      mx={4}
      backdropFilter="blur(10px)"
      animation={`${slideInBounce} 0.5s ease-out`}
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 'xl',
        padding: '1px',
        background: `linear-gradient(135deg, ${accentColor}80, transparent)`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    >
      <HStack gap={3} align="start">
        {/* Asset Icon */}
        <Box
          position="relative"
          flexShrink={0}
          animation={`${coinFlip} 0.6s ease-out, ${pulseGlow} 2s infinite`}
        >
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt={event.symbol}
              width="48px"
              height="48px"
              borderRadius="full"
              bg="rgba(255, 255, 255, 0.1)"
              onError={(e) => {
                // Fallback to letter if image fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          ) : (
            <Box
              width="48px"
              height="48px"
              borderRadius="full"
              bg={accentColor}
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontWeight="bold"
              fontSize="xl"
              color="white"
            >
              {event.symbol.charAt(0).toUpperCase()}
            </Box>
          )}
        </Box>

        {/* Content */}
        <VStack align="start" gap={2} flex={1}>
          {/* Title */}
          <HStack gap={2}>
            <Text fontSize="md" fontWeight="bold" color={accentColor}>
              {isReceived ? '💰 Payment Received' : '📤 Payment Sent'}
            </Text>
          </HStack>

          {/* Amount */}
          <Text fontSize="xl" fontWeight="bold" color="white">
            {event.amountFormatted}
          </Text>

          {/* Fiat Value */}
          {event.valueUsd && event.valueUsd > 0 && (
            <Text fontSize="md" color="gray.300" fontWeight="medium">
              ≈ ${event.valueUsd.toFixed(2)} USD
            </Text>
          )}

          {/* Transaction ID (if available) */}
          {event.txid && (
            <Text
              fontSize="xs"
              color="gray.500"
              fontFamily="mono"
              isTruncated
              maxW="100%"
            >
              {event.txid}
            </Text>
          )}

          {/* Network Badge */}
          <HStack gap={2} mt={1}>
            <Box
              px={3}
              py={1}
              borderRadius="md"
              bg="rgba(255, 255, 255, 0.08)"
              borderWidth="1px"
              borderColor="rgba(255, 255, 255, 0.15)"
            >
              <Text fontSize="xs" color="gray.300" textTransform="capitalize" fontWeight="medium">
                {event.networkId}
              </Text>
            </Box>
          </HStack>
        </VStack>
      </HStack>

      {/* Action Buttons (optional) */}
      {(onViewTransaction || onDismiss) && (
        <HStack gap={3} mt={4}>
          {onViewTransaction && (
            <Box
              as="button"
              flex={1}
              px={4}
              py={2.5}
              fontSize="sm"
              fontWeight="semibold"
              color={accentColor}
              bg="rgba(255, 255, 255, 0.08)"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="rgba(255, 255, 255, 0.15)"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                bg: 'rgba(255, 255, 255, 0.15)',
                borderColor: accentColor,
                transform: 'translateY(-1px)',
              }}
              onClick={onViewTransaction}
            >
              View Transaction
            </Box>
          )}
          {onDismiss && (
            <Box
              as="button"
              px={4}
              py={2.5}
              fontSize="sm"
              fontWeight="semibold"
              color="gray.400"
              bg="rgba(255, 255, 255, 0.08)"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="rgba(255, 255, 255, 0.15)"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                bg: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                transform: 'translateY(-1px)',
              }}
              onClick={onDismiss}
            >
              Dismiss
            </Box>
          )}
        </HStack>
      )}
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
