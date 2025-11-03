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
import { AssetIcon } from '@/components/ui/AssetIcon';
import { FaSearch } from 'react-icons/fa';
import { middleEllipsis } from '@/utils/strings';

interface Asset {
  caip: string;
  name: string;
  symbol: string;
  icon: string;
  balance?: string | number;
  balanceUsd?: string | number;
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
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);

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

  // Format USD balance for display
  const formatUsdBalance = (balanceUsd: string | number) => {
    const num = typeof balanceUsd === 'string' ? parseFloat(balanceUsd) : balanceUsd;
    if (num === 0) return '$0';
    if (num < 0.01) return '< $0.01';
    if (num < 1) return `$${num.toFixed(2)}`;
    if (num < 1000) return `$${num.toFixed(0)}`;
    if (num < 1000000) return `$${(num / 1000).toFixed(1)}k`;
    return `$${(num / 1000000).toFixed(2)}M`;
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
      <DialogContent
        maxWidth="800px"
        bg="rgba(17, 17, 17, 0.98)"
        borderColor="#23DCC8"
        borderWidth="2px"
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        margin="0"
      >
        <DialogHeader borderBottom="1px solid rgba(255, 255, 255, 0.1)" pb={4} pt={2} px={6}>
          <DialogTitle color="white" fontSize="lg" fontWeight="600">{title}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb={6} pt={4} px={6}>
          <VStack align="stretch" gap={4}>
            {/* Search Input */}
            <InputGroup
              startElement={
                <Box pl={3}>
                  <FaSearch color="gray" size={14} />
                </Box>
              }
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
                pl={10}
              />
            </InputGroup>

            {/* Asset Grid */}
            <Grid
              templateColumns="repeat(auto-fill, minmax(160px, 1fr))"
              gap={3}
              maxH="500px"
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
                    onMouseEnter={() => setHoveredAsset(asset.caip)}
                    onMouseLeave={() => setHoveredAsset(null)}
                    cursor="pointer"
                    position="relative"
                    transition="all 0.2s"
                    bg={isSelected ? 'rgba(35, 220, 200, 0.15)' : 'rgba(30, 30, 30, 0.6)'}
                    borderRadius="xl"
                    borderWidth="2px"
                    borderColor={isSelected ? '#23DCC8' : 'rgba(255, 255, 255, 0.1)'}
                    p={4}
                    _hover={{
                      bg: isSelected ? 'rgba(35, 220, 200, 0.2)' : 'rgba(35, 220, 200, 0.1)',
                      borderColor: '#23DCC8',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(35, 220, 200, 0.2)',
                    }}
                  >
                    {/* Selected Indicator */}
                    {isSelected && (
                      <Box
                        position="absolute"
                        top={2}
                        left={2}
                        bg="#23DCC8"
                        borderRadius="full"
                        boxSize="10px"
                      />
                    )}

                    {/* Balance Badge (if has balance) - Show USD value */}
                    {hasBalance && asset.balanceUsd && (
                      <Box
                        position="absolute"
                        top={2}
                        right={2}
                        bg="rgba(35, 220, 200, 0.2)"
                        borderRadius="full"
                        px={2}
                        py={0.5}
                      >
                        <Text fontSize="10px" color="#23DCC8" fontWeight="bold">
                          {formatUsdBalance(asset.balanceUsd)}
                        </Text>
                      </Box>
                    )}

                    <VStack gap={2} align="center">
                      {/* Asset Icon */}
                      <AssetIcon
                        src={asset.icon}
                        caip={asset.caip}
                        symbol={asset.symbol}
                        alt={asset.name}
                        boxSize="48px"
                        color="#FFD700"
                      />

                      {/* Asset Symbol */}
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color={isSelected ? '#23DCC8' : 'white'}
                        textAlign="center"
                        noOfLines={1}
                        width="full"
                      >
                        {asset.symbol}
                      </Text>

                      {/* Asset Name */}
                      <Text
                        fontSize="xs"
                        color="gray.400"
                        textAlign="center"
                        noOfLines={2}
                        width="full"
                        lineHeight="1.3"
                      >
                        {asset.name}
                      </Text>

                      {/* CAIP Identifier */}
                      <Text
                        fontSize="9px"
                        color="gray.600"
                        textAlign="center"
                        width="full"
                        fontFamily="monospace"
                        mt={1}
                      >
                        {hoveredAsset === asset.caip
                          ? asset.caip
                          : middleEllipsis(asset.caip, 12)}
                      </Text>
                    </VStack>
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