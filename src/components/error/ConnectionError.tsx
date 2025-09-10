import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Image,
  Link,
  HStack,
} from '@chakra-ui/react';
import { FaExclamationTriangle, FaDownload, FaRedo, FaExternalLinkAlt } from 'react-icons/fa';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface ConnectionErrorProps {
  onRetry?: () => void;
}

const ConnectionError: React.FC<ConnectionErrorProps> = ({ onRetry }) => {
  // Function to launch KeepKey Desktop using the custom URI scheme
  const launchKeepKeyDesktop = () => {
    try {
      // This uses the custom URI protocol that KeepKey Desktop should register
      window.location.href = 'keepkey://launch';
      
      // As a fallback, try a common install path for macOS
      setTimeout(() => {
        onRetry?.(); // Try to reconnect after a brief delay
      }, 3000);
    } catch (error) {
      console.error('Failed to launch KeepKey Desktop:', error);
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
        maxW="500px" 
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
          <FaExclamationTriangle size="50px" color={theme.gold} />
        </Box>

        <Heading size="lg" color={theme.gold} textAlign="center">
          Connection Error
        </Heading>

        <Image
          src="/images/kk-icon-gold.png"
          alt="KeepKey"
          height="80px"
          my={2}
        />

        <Text fontSize="md" color="gray.300" textAlign="center">
          Unable to connect to KeepKey Desktop. Please ensure the application is running on your computer.
        </Text>

        <VStack gap={4} width="100%">
          <Button
            width="100%"
            variant="solid"
            color="black"
            bg={theme.gold}
            _hover={{ bg: theme.goldHover }}
            onClick={launchKeepKeyDesktop}
          >
            <HStack>
              <FaExternalLinkAlt />
              <Text>Launch KeepKey Desktop</Text>
            </HStack>
          </Button>
          
          <Button
            width="100%"
            variant="outline"
            color={theme.gold}
            borderColor={theme.gold}
            _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
            onClick={onRetry}
          >
            <HStack>
              <FaRedo />
              <Text>Try Again</Text>
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

export default ConnectionError;