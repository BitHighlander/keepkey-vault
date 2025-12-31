'use client'

import { Box, Text, Flex, VStack } from "@chakra-ui/react"
import { keyframes } from '@emotion/react'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import { FiTool, FiClock } from 'react-icons/fi'

const splashBg = '/images/backgrounds/splash-bg.png'

const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
`

export const MaintenancePage = () => {
  return (
    <Box
      bg="black"
      minHeight="100vh"
      width="100vw"
      overflow="hidden"
      backgroundImage={`url(${splashBg})`}
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
    >
      <Flex
        height="100vh"
        width="100%"
        direction="column"
        alignItems="center"
        justifyContent="center"
        px={4}
      >
        <VStack gap={8}>
          <Box animation={`${pulseAnimation} 2s ease-in-out infinite`}>
            <KeepKeyUiGlyph
              width="120px"
              height="120px"
              color="#FFD700"
            />
          </Box>

          <VStack gap={4} textAlign="center">
            <Flex alignItems="center" gap={3}>
              <Box as={FiTool} boxSize={6} color="yellow.400" />
              <Text fontSize="2xl" fontWeight="bold" color="white">
                Maintenance Mode
              </Text>
              <Box as={FiTool} boxSize={6} color="yellow.400" />
            </Flex>

            <Box
              maxWidth="600px"
              px={6}
              py={4}
              borderRadius="lg"
              bg="rgba(0, 0, 0, 0.6)"
              backdropFilter="blur(10px)"
            >
              <VStack gap={3}>
                <Text fontSize="lg" color="gray.200">
                  {process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ||
                    "KeepKey Vault is currently undergoing maintenance"}
                </Text>

                <Text fontSize="md" color="gray.400">
                  We're working to improve your experience. Please check back shortly.
                </Text>

                <Flex alignItems="center" gap={2} mt={2}>
                  <Box as={FiClock} boxSize={4} color="blue.400" />
                  <Text fontSize="sm" color="gray.500">
                    Estimated downtime: {process.env.NEXT_PUBLIC_MAINTENANCE_ETA || "TBD"}
                  </Text>
                </Flex>
              </VStack>
            </Box>
          </VStack>
        </VStack>
      </Flex>

      <Box
        position="absolute"
        bottom="20px"
        left="50%"
        transform="translateX(-50%)"
        textAlign="center"
      >
        <Text fontSize="xs" color="gray.500">
          For urgent support, please visit keepkey.com/support
        </Text>
      </Box>
    </Box>
  )
}
