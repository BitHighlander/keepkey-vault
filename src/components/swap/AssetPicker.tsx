'use client'

import React, { useState, useRef, useEffect } from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Image,
  Grid,
  Input,
  Button,
  IconButton,
  Flex,
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
import { FaSearch, FaTimes } from 'react-icons/fa';
import { middleEllipsis } from '@/utils/strings';
import { extractNetworkId, getNetworkColor, getNetworkName, getNetworkSortOrder } from '@/lib/utils/networkIcons';

interface Asset {
  caip: string;
  name: string;
  symbol: string;
  icon: string;
  balance?: string | number;
  balanceUsd?: string | number;
  networkId?: string;
  isDisabled?: boolean; // Flag to grey out and disable selection
  hasBalance?: boolean; // Flag to indicate if asset has meaningful balance
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
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when search expands
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setIsSearchExpanded(false);
    }
  }, [isOpen]);

  const handleSelect = (asset: Asset) => {
    // Prevent selection of disabled assets
    if (asset.isDisabled) {
      return;
    }
    onSelect(asset);
    onClose();
  };

  // Sort assets by network first, then by USD value within each network
  const sortedAssets = [...assets].sort((a, b) => {
    // Primary sort: by network (Bitcoin first, then ETH, BSC, AVAX, etc.)
    const aNetworkId = a.networkId || extractNetworkId(a.caip);
    const bNetworkId = b.networkId || extractNetworkId(b.caip);
    const aNetworkOrder = getNetworkSortOrder(aNetworkId);
    const bNetworkOrder = getNetworkSortOrder(bNetworkId);

    if (aNetworkOrder !== bNetworkOrder) {
      return aNetworkOrder - bNetworkOrder;
    }

    // Secondary sort: by USD value (descending) within same network
    const aUsd = a.balanceUsd ? (typeof a.balanceUsd === 'number' ? a.balanceUsd : parseFloat(a.balanceUsd.toString())) : 0;
    const bUsd = b.balanceUsd ? (typeof b.balanceUsd === 'number' ? b.balanceUsd : parseFloat(b.balanceUsd.toString())) : 0;
    return bUsd - aUsd; // Descending order
  });

  // Filter assets based on search query only
  // Always show all assets (including zero balance) - disabled assets will be greyed out
  let filteredAssets = sortedAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <DialogHeader
          borderBottom="1px solid rgba(255, 255, 255, 0.1)"
          pb={3}
          pt={3}
          px={6}
        >
          <Flex
            align="center"
            justify="space-between"
            gap={3}
            width="full"
          >
            {/* Title - shrinks when search is expanded */}
            <DialogTitle
              color="white"
              fontSize="xl"
              fontWeight="700"
              letterSpacing="-0.02em"
              flex={isSearchExpanded ? "0 0 auto" : "1"}
              transition="all 0.3s ease"
              whiteSpace="nowrap"
            >
              {title}
            </DialogTitle>

            {/* Search Section */}
            <Flex
              align="center"
              gap={2}
              flex={isSearchExpanded ? "1" : "0 0 auto"}
              transition="all 0.3s ease"
            >
              {/* Collapsible Search Input */}
              {isSearchExpanded && (
                <Box
                  flex="1"
                  animation="fadeIn 0.3s ease"
                  css={{
                    '@keyframes fadeIn': {
                      from: { opacity: 0, transform: 'translateX(10px)' },
                      to: { opacity: 1, transform: 'translateX(0)' },
                    },
                  }}
                >
                  <InputGroup
                    startElement={
                      <Box pl={3}>
                        <FaSearch color="#23DCC8" size={14} />
                      </Box>
                    }
                  >
                    <Input
                      ref={searchInputRef}
                      placeholder="Search assets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      bg="rgba(30, 30, 30, 0.8)"
                      borderColor="rgba(35, 220, 200, 0.3)"
                      _hover={{ borderColor: 'rgba(35, 220, 200, 0.5)' }}
                      _focus={{
                        borderColor: '#23DCC8',
                        boxShadow: '0 0 0 1px #23DCC8',
                        bg: 'rgba(30, 30, 30, 0.95)'
                      }}
                      color="white"
                      size="sm"
                      pl={10}
                      height="36px"
                    />
                  </InputGroup>
                </Box>
              )}

              {/* Search Toggle Button */}
              <IconButton
                aria-label={isSearchExpanded ? "Close search" : "Open search"}
                onClick={() => {
                  if (isSearchExpanded && searchQuery) {
                    setSearchQuery('');
                  } else {
                    setIsSearchExpanded(!isSearchExpanded);
                  }
                }}
                size="sm"
                variant="ghost"
                bg={isSearchExpanded ? 'rgba(35, 220, 200, 0.1)' : 'transparent'}
                color={isSearchExpanded ? '#23DCC8' : 'gray.400'}
                _hover={{
                  bg: 'rgba(35, 220, 200, 0.2)',
                  color: '#23DCC8',
                  transform: 'scale(1.05)'
                }}
                _active={{
                  bg: 'rgba(35, 220, 200, 0.3)',
                  transform: 'scale(0.95)'
                }}
                transition="all 0.2s ease"
                borderRadius="md"
                height="36px"
                width="36px"
              >
                {isSearchExpanded && searchQuery ? (
                  <FaTimes size={14} />
                ) : (
                  <FaSearch size={14} />
                )}
              </IconButton>
            </Flex>

            <DialogCloseTrigger
              position="relative"
              top="unset"
              right="unset"
            />
          </Flex>
        </DialogHeader>
        <DialogBody pb={6} pt={4} px={6}>
          <VStack align="stretch" gap={4}>

            {/* Asset Grid */}
            <Grid
              templateColumns="repeat(auto-fit, minmax(160px, 1fr))"
              gap={3}
              maxH="500px"
              overflowY="auto"
              pr={2}
              justifyContent="center"
              justifyItems="center"
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
                const networkId = asset.networkId || extractNetworkId(asset.caip);
                const networkColor = getNetworkColor(networkId);
                const networkName = getNetworkName(networkId);
                const isDisabled = asset.isDisabled || false;

                return (
                  <Box
                    key={asset.caip}
                    onClick={() => handleSelect(asset)}
                    onMouseEnter={() => !isDisabled && setHoveredAsset(asset.caip)}
                    onMouseLeave={() => setHoveredAsset(null)}
                    cursor={isDisabled ? 'not-allowed' : 'pointer'}
                    position="relative"
                    transition="all 0.2s"
                    bg={isSelected ? 'rgba(35, 220, 200, 0.15)' : 'rgba(30, 30, 30, 0.6)'}
                    borderRadius="xl"
                    borderWidth="2px"
                    borderColor={isSelected ? '#23DCC8' : 'rgba(255, 255, 255, 0.1)'}
                    borderTopColor={networkColor}
                    borderTopWidth="3px"
                    p={4}
                    opacity={isDisabled ? 0.4 : 1}
                    filter={isDisabled ? 'grayscale(50%)' : 'none'}
                    _hover={isDisabled ? {} : {
                      bg: isSelected ? 'rgba(35, 220, 200, 0.2)' : 'rgba(35, 220, 200, 0.1)',
                      borderColor: '#23DCC8',
                      borderTopColor: networkColor,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px rgba(35, 220, 200, 0.2), 0 -2px 8px ${networkColor}40`,
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
                      {/* Asset Icon with Network Badge */}
                      <AssetIcon
                        src={asset.icon}
                        caip={asset.caip}
                        symbol={asset.symbol}
                        alt={asset.name}
                        boxSize="48px"
                        color="#FFD700"
                        showNetworkBadge={true}
                        networkId={networkId}
                      />

                      {/* Asset Symbol */}
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color={isSelected ? '#23DCC8' : 'white'}
                        textAlign="center"
                        lineClamp={1}
                        width="full"
                      >
                        {asset.symbol}
                      </Text>

                      {/* Network Name Badge */}
                      <Box
                        bg={`${networkColor}20`}
                        borderRadius="md"
                        px={2}
                        py={0.5}
                        borderWidth="1px"
                        borderColor={`${networkColor}60`}
                      >
                        <Text
                          fontSize="9px"
                          color={networkColor}
                          fontWeight="semibold"
                          textTransform="uppercase"
                          letterSpacing="wide"
                        >
                          {networkName}
                        </Text>
                      </Box>

                      {/* Asset Name */}
                      <Text
                        fontSize="xs"
                        color="gray.400"
                        textAlign="center"
                        lineClamp={2}
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
                  {searchQuery ? `No assets found matching "${searchQuery}"` : 'No assets available'}
                </Text>
              </Box>
            )}

            {/* Asset count */}
            <Text fontSize="xs" color="gray.500" textAlign="center">
              {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} available
              {isFromSelection && assetsWithBalance > 0 && (
                <> ({assetsWithBalance} with balance)</>
              )}
            </Text>
          </VStack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};