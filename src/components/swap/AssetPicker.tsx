'use client'

import React, { useState } from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Image,
  Grid,
  Input,
  Button,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { InputGroup } from '@/components/ui/input-group';
import { FaSearch } from 'react-icons/fa';
import { middleEllipsis } from '@/utils/strings';

interface Asset {
  caip: string;
  name: string;
  symbol: string;
  icon: string;
  balance?: string | number;
  networkId?: string;
}

interface AssetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  assets: Asset[];
  title?: string;
  currentAsset?: Asset | null;
  isFromSelection?: boolean; // true for FROM, false for TO
}

export const AssetPicker = ({
  isOpen,
  onClose,
  onSelect,
  assets,
  title = 'Select Asset',
  currentAsset,
  isFromSelection = false
}: AssetPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllAssets, setShowAllAssets] = useState(false);

  const handleSelect = (asset: Asset) => {
    onSelect(asset);
    onClose();
  };

  // Sort assets by USD value (descending) - largest first
  const sortedAssets = [...assets].sort((a, b) => {
    const aUsd = a.balanceUsd ? (typeof a.balanceUsd === 'number' ? a.balanceUsd : parseFloat(a.balanceUsd.toString())) : 0;
    const bUsd = b.balanceUsd ? (typeof b.balanceUsd === 'number' ? b.balanceUsd : parseFloat(b.balanceUsd.toString())) : 0;
    return bUsd - aUsd; // Descending order
  });

  // Filter assets based on search query and balance
  let filteredAssets = sortedAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // For FROM selection, hide zero balance assets unless "show all" is toggled
  if (isFromSelection && !showAllAssets) {
    filteredAssets = filteredAssets.filter(asset => {
      const balance = asset.balance ? parseFloat(asset.balance.toString()) : 0;
      return balance > 0;
    });
  }

  // Count assets with balance
  const assetsWithBalance = sortedAssets.filter(asset => {
    const balance = asset.balance ? parseFloat(asset.balance.toString()) : 0;
    return balance > 0;
  }).length;

  // Format balance for display
  const formatBalance = (balance: string | number) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance;
    if (num === 0) return '0';
    if (num < 0.001) return '< 0.001';
    if (num < 1) return num.toFixed(4);
    if (num < 100) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
      <DialogContent
        maxWidth="600px"
        bg="rgba(17, 17, 17, 0.98)"
        borderColor="#23DCC8"
        borderWidth="2px"
      >
        <DialogHeader borderBottom="1px solid rgba(255, 255, 255, 0.1)" pb={3}>
          <DialogTitle color="white" fontSize="lg">{title}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb={4} pt={4}>
          <VStack align="stretch" gap={4}>
            {/* Search Input */}
            <InputGroup
              startElement={<FaSearch color="gray" size={14} />}
            >
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                bg="rgba(30, 30, 30, 0.6)"
                borderColor="rgba(255, 255, 255, 0.1)"
                _hover={{ borderColor: 'rgba(35, 220, 200, 0.3)' }}
                _focus={{ borderColor: '#23DCC8', boxShadow: '0 0 0 1px #23DCC8' }}
                color="white"
                size="md"
              />
            </InputGroup>

            {/* Asset Grid */}
            <Grid
              templateColumns="repeat(auto-fill, minmax(90px, 1fr))"
              gap={2}
              maxH="400px"
              overflowY="auto"
              pr={2}
              css={{
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(35, 220, 200, 0.3)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(35, 220, 200, 0.5)',
                },
              }}
            >
              {filteredAssets.map((asset) => {
                const isSelected = currentAsset?.caip === asset.caip;
                const hasBalance = asset.balance && parseFloat(asset.balance.toString()) > 0;

                return (
                  <Box
                    key={asset.caip}
                    onClick={() => handleSelect(asset)}
                    cursor="pointer"
                    position="relative"
                    transition="all 0.2s"
                  >
                    {/* Square Tile */}
                    <Box
                      aspectRatio={1}
                      bg={isSelected ? 'rgba(35, 220, 200, 0.15)' : 'rgba(30, 30, 30, 0.6)'}
                      borderRadius="lg"
                      borderWidth="2px"
                      borderColor={isSelected ? '#23DCC8' : 'rgba(255, 255, 255, 0.1)'}
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      gap={1.5}
                      p={2}
                      _hover={{
                        bg: isSelected ? 'rgba(35, 220, 200, 0.2)' : 'rgba(35, 220, 200, 0.1)',
                        borderColor: '#23DCC8',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(35, 220, 200, 0.2)',
                      }}
                    >
                      {/* Asset Icon */}
                      <Image
                        src={asset.icon}
                        alt={asset.name}
                        boxSize="36px"
                        borderRadius="full"
                        fallbackSrc="https://pioneers.dev/coins/coin.png"
                      />

                      {/* Asset Symbol */}
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        color={isSelected ? '#23DCC8' : 'white'}
                        textAlign="center"
                        noOfLines={1}
                        width="full"
                      >
                        {asset.symbol}
                      </Text>

                      {/* Balance Badge (if has balance) */}
                      {hasBalance && (
                        <Box
                          position="absolute"
                          top={1}
                          right={1}
                          bg="rgba(35, 220, 200, 0.2)"
                          borderRadius="full"
                          px={1.5}
                          py={0.5}
                        >
                          <Text fontSize="9px" color="#23DCC8" fontWeight="bold">
                            {formatBalance(asset.balance!)}
                          </Text>
                        </Box>
                      )}

                      {/* Selected Indicator */}
                      {isSelected && (
                        <Box
                          position="absolute"
                          top={1}
                          left={1}
                          bg="#23DCC8"
                          borderRadius="full"
                          boxSize="8px"
                        />
                      )}
                    </Box>

                    {/* Asset Name (below tile) */}
                    <Text
                      fontSize="9px"
                      color="gray.500"
                      textAlign="center"
                      mt={1}
                      noOfLines={1}
                      width="full"
                    >
                      {asset.name}
                    </Text>
                  </Box>
                );
              })}
            </Grid>

            {/* No results message */}
            {filteredAssets.length === 0 && (
              <Box py={8} textAlign="center">
                <Text color="gray.500" fontSize="sm">
                  {searchQuery ? `No assets found matching "${searchQuery}"` : 'No assets with balance'}
                </Text>
              </Box>
            )}

            {/* Show All Assets Toggle (only for FROM selection) */}
            {isFromSelection && assetsWithBalance < sortedAssets.length && (
              <HStack justify="center" pt={2}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAllAssets(!showAllAssets)}
                  color="gray.400"
                  _hover={{ color: '#23DCC8', bg: 'rgba(35, 220, 200, 0.1)' }}
                  fontSize="xs"
                  height="auto"
                  py={1}
                >
                  {showAllAssets ? (
                    <HStack gap={1}>
                      <Text>Hide zero balances</Text>
                      <Text>▲</Text>
                    </HStack>
                  ) : (
                    <HStack gap={1}>
                      <Text>Show all {sortedAssets.length} assets</Text>
                      <Text>▼</Text>
                    </HStack>
                  )}
                </Button>
              </HStack>
            )}

            {/* Asset count */}
            <Text fontSize="xs" color="gray.500" textAlign="center">
              {isFromSelection && !showAllAssets
                ? `${assetsWithBalance} asset${assetsWithBalance !== 1 ? 's' : ''} with balance`
                : `${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''} available`
              }
            </Text>
          </VStack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};