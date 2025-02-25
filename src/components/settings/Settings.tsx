import React, { useEffect, useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Button,
  Image,
  Box,
} from '@chakra-ui/react';
import { FaGithub, FaBook, FaHome, FaTrash, FaBroadcastTower, FaRedo } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';

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

  const [maskingSettings, setMaskingSettings] = useState({
    enableMetaMaskMasking: false,
    enableXfiMasking: false,
    enableKeplrMasking: false,
  });

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
    </Box>
  );
};

export default Settings; 