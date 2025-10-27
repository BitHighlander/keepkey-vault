'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Grid,
  VStack,
  HStack,
  Image,
  IconButton,
  Button,
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface Dapp {
  name: string;
  icon?: string;
  image?: string;
  url?: string;
  app?: string;
  description?: string;
  networks?: string[];
}

interface DappStoreProps {
  networkId: string;
}

export const DappStore = ({ networkId }: DappStoreProps) => {
  const [dapps, setDapps] = useState<Dapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const dappsPerPage = 9;

  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  useEffect(() => {
    const fetchDapps = async () => {
      setLoading(true);
      try {
        console.log('🔍 [DappStore] Fetching dapps for networkId:', networkId);

        // Try to fetch from Pioneer API if available
        let apiDapps: Dapp[] = [];
        if (app?.pioneer?.SearchDappsByNetworkId) {
          try {
            const result = await app.pioneer.SearchDappsByNetworkId({ networkId });
            console.log('✅ [DappStore] Pioneer API response:', result);
            apiDapps = result?.data || [];
          } catch (error) {
            console.error('❌ [DappStore] Pioneer API error:', error);
          }
        } else {
          console.log('⚠️ [DappStore] Pioneer API SearchDappsByNetworkId not available');
        }

        // TODO: Add support for local storage dapps when implementing custom dapp addition

        // Combine and deduplicate dapps by URL
        const allDapps = [...apiDapps];
        const uniqueDapps = allDapps.reduce((acc: Dapp[], dapp) => {
          const url = dapp.url || dapp.app;
          if (url && !acc.find(d => (d.url || d.app) === url)) {
            acc.push(dapp);
          }
          return acc;
        }, []);

        console.log('📊 [DappStore] Total unique dapps:', uniqueDapps.length);
        setDapps(uniqueDapps);
      } catch (error) {
        console.error('❌ [DappStore] Error fetching dapps:', error);
      } finally {
        setLoading(false);
      }
    };

    if (networkId) {
      fetchDapps();
    }
  }, [networkId, app]);

  const totalPages = Math.ceil(dapps.length / dappsPerPage);
  const startIndex = currentPage * dappsPerPage;
  const endIndex = startIndex + dappsPerPage;
  const currentDapps = dapps.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const handleDappClick = (dapp: Dapp) => {
    const url = dapp.url || dapp.app;
    if (url) {
      console.log('🚀 [DappStore] Opening dapp:', dapp.name, url);
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <Box
        bg={theme.cardBg}
        borderRadius="2xl"
        overflow="hidden"
        borderColor={theme.border}
        borderWidth="1px"
        mt={6}
        p={8}
      >
        <VStack gap={4}>
          <Spinner size="xl" color={theme.gold} />
          <Text color="gray.400">Loading dapps...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      bg={theme.cardBg}
      borderRadius="2xl"
      overflow="hidden"
      borderColor={theme.border}
      borderWidth="1px"
      mt={6}
    >
      <Box p={4} borderBottom="1px" borderColor={theme.border}>
        <Text color={theme.gold} fontSize="lg" fontWeight="bold">
          Dapps ({dapps.length})
        </Text>
      </Box>

      <Box p={4}>
        {currentDapps.length > 0 ? (
          <>
            <Grid
              templateColumns="repeat(3, 1fr)"
              gap={4}
              mb={4}
            >
              {currentDapps.map((dapp, index) => {
                const icon = dapp.icon || dapp.image || 'https://pioneers.dev/coins/ethereum.png';

                return (
                  <Box
                    key={`${dapp.url || dapp.app}-${index}`}
                    p={3}
                    bg={theme.bg}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={theme.border}
                    cursor="pointer"
                    _hover={{
                      borderColor: theme.gold,
                      bg: 'rgba(255, 215, 0, 0.05)',
                    }}
                    transition="all 0.2s"
                    onClick={() => handleDappClick(dapp)}
                  >
                    <VStack gap={2}>
                      <Box
                        boxSize="60px"
                        borderRadius="md"
                        overflow="hidden"
                        bg="rgba(255, 255, 255, 0.05)"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Image
                          src={icon}
                          alt={dapp.name}
                          boxSize="100%"
                          objectFit="contain"
                          onError={(e) => {
                            e.currentTarget.src = 'https://pioneers.dev/coins/ethereum.png';
                          }}
                        />
                      </Box>
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="white"
                        textAlign="center"
                        noOfLines={2}
                      >
                        {dapp.name}
                      </Text>
                    </VStack>
                  </Box>
                );
              })}
            </Grid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="center" align="center" gap={4}>
                <IconButton
                  aria-label="Previous page"
                  icon={<FaChevronLeft />}
                  size="sm"
                  variant="ghost"
                  color={theme.gold}
                  isDisabled={currentPage === 0}
                  onClick={handlePrevPage}
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                  }}
                />

                <HStack gap={2}>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={currentPage === i ? 'solid' : 'ghost'}
                      bg={currentPage === i ? theme.gold : 'transparent'}
                      color={currentPage === i ? 'black' : theme.gold}
                      onClick={() => setCurrentPage(i)}
                      _hover={{
                        bg: currentPage === i ? theme.goldHover : 'rgba(255, 215, 0, 0.1)',
                      }}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </HStack>

                <IconButton
                  aria-label="Next page"
                  icon={<FaChevronRight />}
                  size="sm"
                  variant="ghost"
                  color={theme.gold}
                  isDisabled={currentPage === totalPages - 1}
                  onClick={handleNextPage}
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                  }}
                />
              </Flex>
            )}
          </>
        ) : (
          <VStack align="center" gap={4} py={8}>
            <Box
              w="60px"
              h="60px"
              borderRadius="full"
              bg="rgba(255, 215, 0, 0.1)"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="2xl">🌐</Text>
            </Box>
            <VStack gap={2}>
              <Text fontSize="md" fontWeight="medium" color="white">
                No Dapps Found
              </Text>
              <Text fontSize="sm" color="gray.400" textAlign="center" maxW="sm">
                There are no dapps available for this network yet.
              </Text>
            </VStack>
          </VStack>
        )}
      </Box>
    </Box>
  );
};

export default DappStore;
