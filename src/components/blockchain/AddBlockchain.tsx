import React, { useState, useEffect } from 'react';
import {
  VStack,
  HStack,
  Text,
  Button,
  Box,
  Image,
  Grid,
  Input,
  Spinner,
  Flex,
  Icon,
} from '@chakra-ui/react';
import { FaSearch, FaPlus } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface Chain {
  name: string;
  chainId: string;
  icon: string;
  color: string;
  symbol: string;
}

interface AddBlockchainProps {
  onClose: () => void;
}

const AddBlockchain = ({ onClose }: AddBlockchainProps) => {
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { app } = usePioneerContext();

  useEffect(() => {
    const fetchChains = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual pioneer-coins call when package is added
        const mockChains: Chain[] = [
          {
            name: 'Ethereum',
            chainId: 'eip155:1',
            icon: 'https://pioneers.dev/coins/ethereum.png',
            color: '#627EEA',
            symbol: 'ETH'
          },
          {
            name: 'Polygon',
            chainId: 'eip155:137',
            icon: 'https://pioneers.dev/coins/polygon.png',
            color: '#8247E5',
            symbol: 'MATIC'
          },
          {
            name: 'Cosmos Hub',
            chainId: 'cosmos:cosmoshub-4',
            icon: 'https://pioneers.dev/coins/cosmos.png',
            color: '#2E3148',
            symbol: 'ATOM'
          },
          // Add more mock chains as needed
        ];
        setAvailableChains(mockChains);
      } catch (error) {
        console.error('Error fetching chains:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChains();
  }, []);

  const filteredChains = availableChains.filter(chain => 
    chain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chain.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddChain = async (chain: Chain) => {
    try {
      // TODO: Implement actual chain addition logic
      console.log('Adding chain:', chain);
      onClose();
    } catch (error) {
      console.error('Error adding chain:', error);
    }
  };

  return (
    <VStack gap={4} align="stretch" maxH="500px">
      {/* Search Input */}
      <Box position="relative">
        <Icon
          as={FaSearch}
          color={theme.gold}
          position="absolute"
          left={3}
          top="50%"
          transform="translateY(-50%)"
          zIndex={2}
        />
        <Input
          pl={10}
          placeholder="Search networks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          color={theme.gold}
          borderColor={theme.border}
          _hover={{ borderColor: theme.gold }}
          _focus={{ borderColor: theme.gold, boxShadow: `0 0 0 1px ${theme.gold}` }}
        />
      </Box>

      {/* Chains Grid */}
      {loading ? (
        <Flex justify="center" align="center" minH="200px">
          <Spinner color={theme.gold} />
        </Flex>
      ) : (
        <Box overflowY="auto" maxH="400px">
          <Grid gap={3} templateColumns="1fr">
            {filteredChains.map((chain) => (
              <Box
                key={chain.chainId}
                p={4}
                borderRadius="xl"
                bg={theme.cardBg}
                borderWidth="1px"
                borderColor={theme.border}
                _hover={{
                  borderColor: chain.color,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                }}
              >
                <HStack justify="space-between">
                  <HStack gap={3}>
                    <Box
                      borderRadius="full"
                      overflow="hidden"
                      boxSize="40px"
                      bg={chain.color}
                      p={2}
                    >
                      <Image
                        src={chain.icon}
                        alt={chain.name}
                        width="100%"
                        height="100%"
                        objectFit="contain"
                      />
                    </Box>
                    <VStack align="start" gap={0}>
                      <Text color="white" fontWeight="bold">
                        {chain.name}
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        {chain.symbol}
                      </Text>
                    </VStack>
                  </HStack>
                  <Button
                    size="sm"
                    variant="outline"
                    color={chain.color}
                    borderColor={chain.color}
                    _hover={{
                      bg: `${chain.color}20`,
                    }}
                    onClick={() => handleAddChain(chain)}
                  >
                    <Icon as={FaPlus} mr={2} />
                    Add
                  </Button>
                </HStack>
              </Box>
            ))}
          </Grid>
        </Box>
      )}
    </VStack>
  );
};

export default AddBlockchain; 