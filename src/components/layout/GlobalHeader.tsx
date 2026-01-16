'use client'

import { Box, HStack, Text, Button, Image, IconButton } from '@chakra-ui/react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { usePioneerContext } from '@/components/providers/pioneer'
import { useHeader } from '@/contexts/HeaderContext'
import { FaSyncAlt } from 'react-icons/fa'

const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
}

export function GlobalHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { state } = usePioneerContext()
  const { actions } = useHeader()

  // Always use gold color for header
  const headerColor = theme.gold

  // Determine if we're on a page that needs back button
  const isAssetPage = pathname?.startsWith('/asset/')
  const isDashboard = pathname === '/'

  // Get current view from URL query params
  const currentView = searchParams?.get('view')

  // Get page title based on current route and view
  const getPageTitle = () => {
    if (isDashboard) return 'KeepKey Vault'
    if (isAssetPage) {
      if (currentView === 'send') return 'Send'
      if (currentView === 'receive') return 'Receive'
      if (currentView === 'swap') return 'Swap'
      return 'Asset Details'
    }
    return 'KeepKey Vault'
  }

  const handleBack = () => {
    router.back()
  }

  const handleClose = () => {
    router.push('/')
  }

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bg={theme.cardBg}
      borderBottom="1px"
      borderColor={theme.border}
      p={4}
      zIndex={1000}
    >
      <HStack justify="space-between" align="center" maxW="1400px" mx="auto">
        {isAssetPage ? (
          <Button
            size="sm"
            variant="ghost"
            color={headerColor}
            onClick={handleBack}
            _hover={{ color: theme.goldHover, bg: 'rgba(255, 215, 0, 0.1)' }}
          >
            <Text>Back</Text>
          </Button>
        ) : (
          <Box w="60px" />
        )}

        <HStack gap={3}>
          <Image src="/images/kk-icon-gold.png" alt="KeepKey" height="24px" />
          <Text fontSize="lg" fontWeight="bold" color={headerColor}>
            {getPageTitle()}
          </Text>
        </HStack>

        {isAssetPage ? (
          <Button
            size="sm"
            variant="ghost"
            color={headerColor}
            onClick={handleClose}
            _hover={{ color: theme.goldHover }}
          >
            <Text>Close</Text>
          </Button>
        ) : isDashboard ? (
          <HStack gap={2}>
            {actions.onRefreshClick && (
              <IconButton
                aria-label="Force refresh balances"
                title="Force Refresh (bypass cache)"
                size="sm"
                variant="ghost"
                color={headerColor}
                _hover={{ color: theme.goldHover, bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={actions.onRefreshClick}
                loading={actions.isRefreshing}
                disabled={actions.isRefreshing}
              >
                <FaSyncAlt />
              </IconButton>
            )}
            {actions.onSettingsClick && (
              <Button
                size="sm"
                variant="ghost"
                color={headerColor}
                _hover={{ color: theme.goldHover, bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={actions.onSettingsClick}
              >
                <Text>Settings</Text>
              </Button>
            )}
          </HStack>
        ) : (
          <Box w="60px" />
        )}
      </HStack>
    </Box>
  )
}
