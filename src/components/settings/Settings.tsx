import React, { useEffect, useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Button,
  Image,
  Box,
  Input,
} from '@chakra-ui/react';
import { FaGithub, FaBook, FaHome, FaTrash, FaBroadcastTower, FaRedo, FaMobileAlt, FaEye, FaCircle, FaToggleOn, FaToggleOff, FaServer, FaCheckCircle, FaTimesCircle, FaEdit, FaSave } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';
import { MobilePairingDialog } from '@/components/pairing/MobilePairingDialog';
import {
  hasStoredPubkeys,
  getDeviceInfo,
  clearPubkeys,
  isCacheEnabled,
  setCacheEnabled
} from '@/lib/storage/pubkeyStorage';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface SettingsProps {
  onClose: () => void;
}

const Settings = ({ onClose }: SettingsProps) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const [loading, setLoading] = useState(false);
  const [showMobilePairing, setShowMobilePairing] = useState(false);

  const [maskingSettings, setMaskingSettings] = useState({
    enableMetaMaskMasking: false,
    enableXfiMasking: false,
    enableKeplrMasking: false,
  });

  // View-Only Mode Cache Settings
  const [cacheEnabled, setCacheEnabledState] = useState(isCacheEnabled());
  const [hasCachedPubkeys, setHasCachedPubkeys] = useState(hasStoredPubkeys());
  const [cachedDeviceInfo, setCachedDeviceInfo] = useState(getDeviceInfo());

  // Pioneer Server Configuration
  const defaultWss = 'wss://api.keepkey.info';
  const localWss = 'ws://localhost:9001';
  const [pioneerWss, setPioneerWss] = useState<string>(
    localStorage.getItem('pioneerWss') || defaultWss
  );
  const [editingWss, setEditingWss] = useState(false);
  const [wssInput, setWssInput] = useState(pioneerWss);
  const [wssStatus, setWssStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Update cache status when settings dialog opens
  useEffect(() => {
    setHasCachedPubkeys(hasStoredPubkeys());
    setCachedDeviceInfo(getDeviceInfo());
    setCacheEnabledState(isCacheEnabled());
    checkPioneerServerStatus();
  }, []);

  // Check Pioneer Server connection status
  const checkPioneerServerStatus = async () => {
    setWssStatus('checking');
    try {
      // Try to connect to the configured WSS URL (convert to HTTP for health check)
      const httpUrl = pioneerWss.replace('wss://', 'https://').replace('ws://', 'http://');
      const response = await fetch(`${httpUrl}/`, { method: 'HEAD' });
      setWssStatus(response.ok ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Pioneer Server status check failed:', error);
      setWssStatus('disconnected');
    }
  };

  const handleToggle = async (setting: keyof typeof maskingSettings) => {
    try {
      setMaskingSettings(prev => ({
        ...prev,
        [setting]: !prev[setting],
      }));
    } catch (error) {
      console.error('Error toggling setting:', error);
    }
  };

  const handleClearStorage = async () => {
    try {
      setLoading(true);
      // TODO: Implement clear storage functionality
      console.log('Storage cleared');
      onClose();
    } catch (error) {
      console.error('Error clearing storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceReset = async () => {
    try {
      setLoading(true);
      // TODO: Implement force reset functionality
      console.log('App reset');
      onClose();
    } catch (error) {
      console.error('Error resetting app:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnounceProvider = () => {
    try {
      window.postMessage(
        {
          type: 'ANNOUNCE_REQUEST',
          provider: {
            name: 'KeepKey',
            uuid: '350670db-19fa-4704-a166-e52e178b59d4',
            icon: 'https://pioneers.dev/coins/keepkey.png',
            rdns: 'com.keepkey',
          },
        },
        '*'
      );
      console.log('Provider announced');
      onClose();
    } catch (error) {
      console.error('Error announcing provider:', error);
    }
  };

  const handleToggleCache = () => {
    try {
      const newValue = !cacheEnabled;
      setCacheEnabled(newValue);
      setCacheEnabledState(newValue);
      console.log('View-only mode cache:', newValue ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error toggling cache:', error);
    }
  };

  const handleClearCache = () => {
    try {
      const success = clearPubkeys();
      if (success) {
        setHasCachedPubkeys(false);
        setCachedDeviceInfo(null);
        console.log('Cache cleared successfully');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const handleSaveWss = () => {
    try {
      localStorage.setItem('pioneerWss', wssInput);
      setPioneerWss(wssInput);
      setEditingWss(false);
      console.log('Pioneer Server WSS URL updated:', wssInput);
      checkPioneerServerStatus();
    } catch (error) {
      console.error('Error saving WSS URL:', error);
    }
  };

  const handleUseLocalServer = () => {
    setWssInput(localWss);
  };

  const handleUseProductionServer = () => {
    setWssInput(defaultWss);
  };

  const handleReInitSdk = async () => {
    try {
      setLoading(true);
      console.log('🔄 Re-initializing Pioneer SDK with new configuration...');
      // Force page reload to reinitialize with new config
      window.location.reload();
    } catch (error) {
      console.error('Error re-initializing SDK:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box height="600px" bg={theme.bg}>
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={3}
        bg={theme.cardBg}
        backdropFilter="blur(10px)"
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
        <HStack gap={2}>
          <Image src="/images/kk-icon-gold.png" alt="KeepKey" height="20px" />
          <Text fontSize="md" fontWeight="bold" color={theme.gold}>
            Settings
          </Text>
        </HStack>
      </Box>

      {/* Main Content */}
      <Box 
        height="calc(100% - 52px)" 
        overflowY="auto" 
        p={3}
      >
        <VStack gap={4} align="stretch">
          {/* KeepKey Animation */}
          <Box 
            position="relative" 
            width="40%"
            mx="auto"
          >
            <Image
              src="https://i.ibb.co/jR8WcJM/kk.gif"
              alt="KeepKey"
              width="100%"
              objectFit="contain"
            />
          </Box>

          {/* Mobile Pairing */}
          <Box bg={theme.cardBg} p={4} borderRadius="xl" borderWidth="1px" borderColor={theme.border}>
            <VStack gap={3}>
              <Text fontSize="md" fontWeight="bold" color={theme.gold}>
                Mobile Devices
              </Text>
              <Button
                width="100%"
                size="sm"
                variant="outline"
                color={theme.gold}
                borderColor={theme.border}
                _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={() => setShowMobilePairing(true)}
              >
                <HStack gap={2}>
                  <FaMobileAlt />
                  <Text>Pair Mobile Device</Text>
                </HStack>
              </Button>
              <Text fontSize="xs" color="gray.500" textAlign="center">
                View your portfolio on your phone
              </Text>
            </VStack>
          </Box>

          {/* Pioneer Server Configuration */}
          <Box bg={theme.cardBg} p={4} borderRadius="xl" borderWidth="1px" borderColor={theme.border}>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <HStack gap={2}>
                  <FaServer color={theme.gold} />
                  <Text fontSize="md" fontWeight="bold" color={theme.gold}>
                    Pioneer Server
                  </Text>
                </HStack>
                <HStack gap={1}>
                  {wssStatus === 'connected' && <FaCheckCircle color="#00FF00" />}
                  {wssStatus === 'disconnected' && <FaTimesCircle color="#FF4444" />}
                  {wssStatus === 'checking' && <Box as={FaCircle} color="#888888" fontSize="8px" />}
                </HStack>
              </HStack>

              {/* Server Status */}
              <HStack justify="space-between" p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
                <VStack align="start" gap={0} flex={1}>
                  <Text fontSize="sm" color="white">
                    Connection Status
                  </Text>
                  <Text fontSize="xs" color={wssStatus === 'connected' ? '#00FF00' : wssStatus === 'disconnected' ? '#FF4444' : 'gray.500'}>
                    {wssStatus === 'connected' && '✅ Connected'}
                    {wssStatus === 'disconnected' && '❌ Disconnected'}
                    {wssStatus === 'checking' && '⏳ Checking...'}
                  </Text>
                </VStack>
              </HStack>

              {/* WSS URL Configuration */}
              <VStack align="stretch" gap={2}>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="white">Server URL</Text>
                  {!editingWss && (
                    <Button
                      size="xs"
                      variant="ghost"
                      color={theme.gold}
                      onClick={() => setEditingWss(true)}
                    >
                      <FaEdit />
                    </Button>
                  )}
                </HStack>

                {editingWss ? (
                  <VStack gap={2}>
                    <Input
                      value={wssInput}
                      onChange={(e) => setWssInput(e.target.value)}
                      placeholder="wss://api.keepkey.info"
                      size="sm"
                      bg="rgba(0, 0, 0, 0.3)"
                      borderColor={theme.border}
                      color="white"
                      _focus={{ borderColor: theme.gold }}
                      fontSize="xs"
                      fontFamily="mono"
                    />
                    <HStack width="100%" gap={2}>
                      <Button
                        size="xs"
                        flex={1}
                        variant="outline"
                        color="white"
                        borderColor={theme.border}
                        onClick={handleUseLocalServer}
                        fontSize="xs"
                      >
                        Use Local
                      </Button>
                      <Button
                        size="xs"
                        flex={1}
                        variant="outline"
                        color="white"
                        borderColor={theme.border}
                        onClick={handleUseProductionServer}
                        fontSize="xs"
                      >
                        Use Production
                      </Button>
                    </HStack>
                    <HStack width="100%" gap={2}>
                      <Button
                        size="sm"
                        flex={1}
                        variant="outline"
                        onClick={() => {
                          setWssInput(pioneerWss);
                          setEditingWss(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        flex={1}
                        bg={theme.gold}
                        color="black"
                        _hover={{ bg: theme.goldHover }}
                        onClick={handleSaveWss}
                      >
                        <HStack gap={1}>
                          <FaSave />
                          <Text>Save</Text>
                        </HStack>
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <Box p={2} bg="rgba(0, 0, 0, 0.3)" borderRadius="md">
                    <Text fontSize="xs" color="gray.400" fontFamily="mono" wordBreak="break-all">
                      {pioneerWss}
                    </Text>
                  </Box>
                )}
              </VStack>

              {/* Re-init SDK Button */}
              <Button
                width="100%"
                size="sm"
                colorScheme="blue"
                variant="outline"
                onClick={handleReInitSdk}
                disabled={loading || editingWss}
              >
                <HStack gap={2}>
                  <FaRedo />
                  <Text>Re-initialize SDK</Text>
                </HStack>
              </Button>

              {/* Info Note */}
              <Box p={2} bg="rgba(255, 215, 0, 0.05)" borderRadius="md" borderWidth="1px" borderColor="rgba(255, 215, 0, 0.2)">
                <Text fontSize="xs" color="gray.400" textAlign="center">
                  ℹ️ Pioneer Server must be running for portfolio sync and balance updates. Use local server for development.
                </Text>
              </Box>
            </VStack>
          </Box>

          {/* View-Only Mode Cache */}
          <Box bg={theme.cardBg} p={4} borderRadius="xl" borderWidth="1px" borderColor={theme.border}>
            <VStack gap={3} align="stretch">
              <HStack justify="space-between">
                <HStack gap={2}>
                  <FaEye color={theme.gold} />
                  <Text fontSize="md" fontWeight="bold" color={theme.gold}>
                    View-Only Mode
                  </Text>
                </HStack>
              </HStack>

              {/* Toggle for enabling/disabling cache */}
              <HStack justify="space-between" p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
                <VStack align="start" gap={0} flex={1}>
                  <Text fontSize="sm" color="white">
                    Enable Cache
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Save pubkeys for offline viewing
                  </Text>
                </VStack>
                <Box
                  as="button"
                  onClick={handleToggleCache}
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ transform: 'scale(1.1)' }}
                >
                  {cacheEnabled ? (
                    <FaToggleOn size={32} color="#00FF00" />
                  ) : (
                    <FaToggleOff size={32} color="#888888" />
                  )}
                </Box>
              </HStack>

              {/* Cache Status Indicator */}
              <HStack justify="space-between" p={2} bg="rgba(255, 255, 255, 0.02)" borderRadius="md">
                <VStack align="start" gap={0} flex={1}>
                  <HStack gap={2}>
                    <Text fontSize="sm" color="white">
                      Cache Status
                    </Text>
                    <Box as={FaCircle} color={hasCachedPubkeys ? '#00FF00' : '#888888'} fontSize="8px" />
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {hasCachedPubkeys
                      ? `Ready • ${cachedDeviceInfo?.label || 'Device cached'}`
                      : 'No pubkeys cached yet'}
                  </Text>
                </VStack>
              </HStack>

              {/* Clear Cache Button */}
              {hasCachedPubkeys && (
                <Button
                  width="100%"
                  size="sm"
                  variant="outline"
                  colorScheme="red"
                  onClick={handleClearCache}
                >
                  <HStack gap={2}>
                    <FaTrash />
                    <Text>Clear Cache</Text>
                  </HStack>
                </Button>
              )}

              {/* Privacy Note */}
              <Box p={2} bg="rgba(255, 215, 0, 0.05)" borderRadius="md" borderWidth="1px" borderColor="rgba(255, 215, 0, 0.2)">
                <Text fontSize="xs" color="gray.400" textAlign="center">
                  🔒 Your pubkeys are stored locally on your device only. They are <strong>never</strong> sent to our servers for your privacy.
                </Text>
              </Box>
            </VStack>
          </Box>

          {/* Documentation Links */}
          <Box bg={theme.cardBg} p={4} borderRadius="xl" borderWidth="1px" borderColor={theme.border}>
            <VStack gap={3}>
              <Button
                width="100%"
                size="sm"
                variant="outline"
                color={theme.gold}
                borderColor={theme.border}
                _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={() => window.open('https://docs.keepkey.info', '_blank')}
              >
                <HStack gap={2}>
                  <FaBook />
                  <Text>KeepKey Documentation</Text>
                </HStack>
              </Button>
              <Button
                width="100%"
                size="sm"
                variant="outline"
                color={theme.gold}
                borderColor={theme.border}
                _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={() => window.open('https://www.keepkey.com', '_blank')}
              >
                <HStack gap={2}>
                  <FaHome />
                  <Text>About KeepKey</Text>
                </HStack>
              </Button>
              <Button
                width="100%"
                size="sm"
                variant="outline"
                color={theme.gold}
                borderColor={theme.border}
                _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={() => window.open('https://github.com/keepkey', '_blank')}
              >
                <HStack gap={2}>
                  <FaGithub />
                  <Text>GitHub Repository</Text>
                </HStack>
              </Button>
            </VStack>
          </Box>

          {/* Advanced Actions */}
          <Box bg={theme.cardBg} p={4} borderRadius="xl" borderWidth="1px" borderColor={theme.border}>
            <VStack gap={3}>
              <Text fontSize="md" fontWeight="bold" color={theme.gold}>
                Advanced Actions
              </Text>
              <Button
                width="100%"
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={handleClearStorage}
                disabled={loading}
              >
                <HStack gap={2}>
                  <FaTrash />
                  <Text>Clear Storage</Text>
                </HStack>
              </Button>
              <Button
                width="100%"
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={handleForceReset}
                disabled={loading}
              >
                <HStack gap={2}>
                  <FaRedo />
                  <Text>Force Reset App</Text>
                </HStack>
              </Button>
              <Button
                width="100%"
                size="sm"
                colorScheme="blue"
                variant="outline"
                onClick={handleAnnounceProvider}
                disabled={loading}
              >
                <HStack gap={2}>
                  <FaBroadcastTower />
                  <Text>Announce Provider</Text>
                </HStack>
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* Mobile Pairing Dialog */}
      <MobilePairingDialog
        open={showMobilePairing}
        onClose={() => setShowMobilePairing(false)}
      />
    </Box>
  );
};

export default Settings; 