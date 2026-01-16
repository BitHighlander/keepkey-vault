import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Image,
  Link,
  Spinner,
} from '@chakra-ui/react';
import { FaEye, FaExternalLinkAlt, FaDownload, FaCheckCircle } from 'react-icons/fa';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  green: '#00FF00',
  greenHover: '#00DD00',
  greenGlow: 'rgba(0, 255, 0, 0.2)',
  border: '#222222',
};

interface DeviceInfo {
  label?: string;
  model?: string;
  deviceId?: string;
}

interface WatchOnlyLandingProps {
  onContinueWatchOnly: () => void;
  deviceInfo?: DeviceInfo | null;
}

const WatchOnlyLanding: React.FC<WatchOnlyLandingProps> = ({
  onContinueWatchOnly,
  deviceInfo,
}) => {
  const [isPolling, setIsPolling] = React.useState(false);
  const [pollStatus, setPollStatus] = React.useState<string>('');

  const deviceLabel = deviceInfo?.label || 'KeepKey';
  const deviceModel = deviceInfo?.model || 'KeepKey';
  const deviceId = deviceInfo?.deviceId;

  // Poll vault endpoints to detect when it becomes available
  const pollForVault = async () => {
    const vaultEndpoints = [
      'http://localhost:1646/spec/swagger.json',
      'http://127.0.0.1:1646/spec/swagger.json',
    ];

    let pollAttempts = 0;
    const maxAttempts = 60; // Poll for up to 60 seconds
    const pollInterval = 1000; // Check every 1 second

    const checkVault = async (): Promise<boolean> => {
      for (const endpoint of vaultEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            signal: AbortSignal.timeout(500),
            headers: { 'Accept': 'application/json' }
          });

          if (response.ok) {
            console.log(`✅ Vault detected at ${endpoint}!`);
            return true;
          }
        } catch (error) {
          // Endpoint not available yet, continue polling
        }
      }
      return false;
    };

    const poll = async () => {
      pollAttempts++;
      setPollStatus(`Waiting for KeepKey Desktop... (${pollAttempts}s)`);

      const vaultAvailable = await checkVault();

      if (vaultAvailable) {
        console.log('🎉 KeepKey Desktop is now available! Connecting...');
        setPollStatus('KeepKey Desktop detected! Connecting...');

        // Clear session flag so user gets normal flow
        sessionStorage.removeItem('keepkey_watch_only_session');

        // Wait a moment then reload to connect
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else if (pollAttempts < maxAttempts) {
        // Continue polling
        setTimeout(poll, pollInterval);
      } else {
        console.log('⏱️ Polling timeout - KeepKey Desktop not detected');
        setPollStatus('KeepKey Desktop not detected. Try launching manually.');
        setIsPolling(false);
      }
    };

    poll();
  };

  // Function to launch KeepKey Desktop using the custom URI scheme
  const launchKeepKeyDesktop = () => {
    try {
      console.log('🚀 Attempting to launch KeepKey Desktop...');
      setIsPolling(true);
      setPollStatus('Launching KeepKey Desktop...');

      // This uses the custom URI protocol that KeepKey Desktop should register
      window.location.href = 'keepkey://launch';

      // Start polling after a brief delay to allow desktop app to start
      setTimeout(() => {
        console.log('⏱️ Starting vault polling...');
        pollForVault();
      }, 2000);
    } catch (error) {
      console.error('Failed to launch KeepKey Desktop:', error);
      setIsPolling(false);
      setPollStatus('Failed to launch. Please open KeepKey Desktop manually.');
    }
  };

  return (
    <Box
      height="100vh"
      width="100%"
      bg={theme.bg}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <VStack
        gap={6}
        maxW="600px"
        bg={theme.cardBg}
        p={8}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={theme.border}
        position="relative"
        _after={{
          content: '""',
          position: "absolute",
          bottom: "-1px",
          left: "0",
          right: "0",
          height: "1px",
          background: `linear-gradient(90deg, transparent 0%, ${theme.gold}40 50%, transparent 100%)`,
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          p={4}
        >
          <FaEye size="50px" color={theme.green} />
        </Box>

        <Heading size="lg" color={theme.green} textAlign="center">
          Watch-Only Mode Available
        </Heading>

        <Image
          src="/images/kk-icon-gold.png"
          alt="KeepKey"
          height="80px"
          my={2}
        />

        <VStack gap={1}>
          <Text fontSize="md" color="gray.300" textAlign="center">
            View balances for <strong>{deviceLabel}</strong> without KeepKey Desktop connected.
          </Text>
          {deviceId && (
            <Text fontSize="xs" color="gray.500" textAlign="center" fontFamily="mono">
              Device ID: {deviceId}
            </Text>
          )}
        </VStack>

        {/* Polling Status Indicator */}
        {isPolling && pollStatus && (
          <Box
            p={3}
            bg="rgba(0, 255, 0, 0.1)"
            borderRadius="md"
            borderWidth="1px"
            borderColor="rgba(0, 255, 0, 0.3)"
            width="100%"
          >
            <HStack justify="center" gap={3}>
              {pollStatus.includes('detected') ? (
                <FaCheckCircle color={theme.green} size={20} />
              ) : (
                <Spinner size="sm" color={theme.green} />
              )}
              <Text fontSize="sm" color={theme.green} fontWeight="medium">
                {pollStatus}
              </Text>
            </HStack>
          </Box>
        )}

        <Box
          p={4}
          bg={theme.greenGlow}
          borderRadius="md"
          borderWidth="1px"
          borderColor="rgba(0, 255, 0, 0.3)"
        >
          <VStack gap={2} align="start">
            <Text fontSize="sm" color={theme.green} fontWeight="bold">
              ✓ Watch-Only Mode allows you to:
            </Text>
            <Text fontSize="sm" color="gray.300">
              • View your portfolio and balances
            </Text>
            <Text fontSize="sm" color="gray.300">
              • Monitor asset prices and performance
            </Text>
            <Text fontSize="sm" color="gray.300">
              • Check transaction history
            </Text>
          </VStack>
        </Box>

        <Box
          p={4}
          bg="rgba(255, 107, 0, 0.1)"
          borderRadius="md"
          borderWidth="1px"
          borderColor="rgba(255, 107, 0, 0.3)"
        >
          <VStack gap={2} align="start">
            <Text fontSize="sm" color="orange.300" fontWeight="bold">
              ⚠️ Watch-Only Limitations:
            </Text>
            <Text fontSize="sm" color="gray.400">
              • Cannot send transactions
            </Text>
            <Text fontSize="sm" color="gray.400">
              • Cannot sign messages
            </Text>
            <Text fontSize="sm" color="gray.400">
              • Cannot interact with dApps
            </Text>
          </VStack>
        </Box>

        <VStack gap={3} width="100%" mt={2}>
          {/* PRIMARY ACTION - Continue in Watch-Only Mode (GREEN) */}
          <Button
            width="100%"
            variant="solid"
            color="black"
            bg={theme.green}
            _hover={{
              bg: theme.greenHover,
              boxShadow: `0 0 20px ${theme.greenGlow}`
            }}
            onClick={onContinueWatchOnly}
            size="lg"
            fontSize="lg"
            fontWeight="bold"
            disabled={isPolling}
          >
            <HStack>
              <FaEye />
              <Text>Continue in Watch-Only Mode</Text>
            </HStack>
          </Button>

          {/* SECONDARY ACTION - Launch Desktop */}
          <Button
            width="100%"
            variant="outline"
            color={theme.gold}
            borderColor={theme.gold}
            _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
            onClick={launchKeepKeyDesktop}
            size="md"
            disabled={isPolling}
            loading={isPolling}
          >
            <HStack>
              <FaExternalLinkAlt />
              <Text>Launch KeepKey Desktop</Text>
            </HStack>
          </Button>

          {/* Divider */}
          <Box width="100%" height="1px" bg={`${theme.border}`} opacity={0.3} my={1} />

          <Button
            width="100%"
            variant="ghost"
            color="gray.400"
            _hover={{ bg: 'rgba(255, 255, 255, 0.05)' }}
            onClick={() => window.open('https://www.keepkey.com/get-started', '_blank')}
            size="sm"
          >
            <HStack>
              <FaDownload />
              <Text>Download KeepKey Desktop</Text>
            </HStack>
          </Button>
        </VStack>

        <Text fontSize="sm" color="gray.500" textAlign="center">
          Need help? Visit our{' '}
          <Link
            color={theme.gold}
            href="https://docs.keepkey.info"
            target="_blank"
            _hover={{ textDecoration: 'underline' }}
          >
            support documentation
          </Link>
        </Text>
      </VStack>
    </Box>
  );
};

export default WatchOnlyLanding;
