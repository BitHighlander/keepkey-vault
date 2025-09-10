'use client'

import React, { useState, useMemo } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  IconButton,
  useClipboard,
  Badge,
  Button,
  Progress,
  Tooltip,
} from '@chakra-ui/react';
import { FaCopy, FaCheck, FaChevronDown, FaChevronUp, FaExternalLinkAlt } from 'react-icons/fa';
import { 
  BalanceDetail, 
  getAddressTypeIcon,
  formatAddress,
  AggregatedBalance,
} from '@/types/balance';

interface BalanceDistributionProps {
  aggregatedBalance: AggregatedBalance;
  selectedAddress?: string | null;
  onAddressClick?: (address: string) => void;
  onPubkeySelect?: (pubkey: any) => void;
}

const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  cardHover: '#1a1a1a',
};

// Individual balance card component
const BalanceCard: React.FC<{
  balance: BalanceDetail;
  aggregatedBalance: AggregatedBalance;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onAddressClick?: (address: string) => void;
  onPubkeySelect?: (pubkey: any) => void;
}> = ({ 
  balance, 
  aggregatedBalance, 
  isExpanded, 
  isSelected, 
  onToggle, 
  onAddressClick,
  onPubkeySelect 
}) => {
  const { hasCopied, onCopy } = useClipboard(balance.address);

  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.00001) return num.toExponential(4);
    if (num < 1) return num.toFixed(8);
    return num.toFixed(6);
  };

  // Find matching pubkey for this balance
  const matchingPubkey = aggregatedBalance.pubkeys.find(pk => 
    pk.address === balance.address || 
    pk.pubkey === balance.pubkey ||
    pk.master === balance.master
  );

  return (
    <Box
      bg={isSelected ? theme.cardHover : theme.cardBg}
      borderRadius="lg"
      border="2px solid"
      borderColor={isSelected ? theme.gold : theme.border}
      overflow="hidden"
      transition="all 0.2s"
      cursor="pointer"
      onClick={() => {
        if (onPubkeySelect && matchingPubkey) {
          onPubkeySelect(matchingPubkey);
        }
        onAddressClick?.(balance.address);
      }}
      _hover={{
        bg: theme.cardHover,
        borderColor: theme.gold,
        transform: 'translateY(-2px)',
        boxShadow: 'lg',
      }}
    >
      {/* Main Card Content */}
      <Box p={3}>
        <VStack align="stretch" spacing={2}>
          {/* Header Row */}
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Text fontSize="md">
                {getAddressTypeIcon(balance.addressType)}
              </Text>
              <VStack align="start" spacing={0}>
                <HStack spacing={1}>
                  <Text fontSize="sm" fontWeight="medium" color="white">
                    {balance.label}
                  </Text>
                  {balance.percentage && balance.percentage > 0 && (
                    <Text fontSize="xs" color={theme.gold}>
                      {balance.percentage.toFixed(0)}%
                    </Text>
                  )}
                </HStack>
                <HStack spacing={1}>
                  <Text fontSize="xs" color="gray.400" fontFamily="mono">
                    {formatAddress(balance.address, 20)}
                  </Text>
                  <IconButton
                    aria-label="Copy address"
                    icon={hasCopied ? <FaCheck /> : <FaCopy />}
                    size="xs"
                    variant="ghost"
                    color={hasCopied ? 'green.400' : 'gray.400'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopy();
                    }}
                    _hover={{ color: hasCopied ? 'green.300' : 'white' }}
                  />
                </HStack>
              </VStack>
            </HStack>
            
            <IconButton
              aria-label="Expand details"
              icon={isExpanded ? <FaChevronUp /> : <FaChevronDown />}
              size="sm"
              variant="ghost"
              color="gray.400"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              _hover={{ color: 'white' }}
            />
          </HStack>

          {/* Balance Row */}
          <HStack justify="space-between">
            <HStack spacing={3}>
              <Text 
                fontSize="sm" 
                fontWeight="medium" 
                color={parseFloat(balance.balance) === 0 ? "gray.500" : "white"}
              >
                {formatBalance(balance.balance)} {aggregatedBalance.symbol}
              </Text>
              <Text fontSize="sm" color={parseFloat(balance.balance) === 0 ? "gray.600" : "gray.400"}>
                ${formatUsd(balance.valueUsd)}
              </Text>
              {parseFloat(balance.balance) === 0 && (
                <Badge colorScheme="gray" size="sm" variant="subtle">
                  Empty
                </Badge>
              )}
            </HStack>
          </HStack>

          {/* Progress Bar */}
          <Progress 
            value={balance.percentage || 0} 
            size="xs"
            colorScheme="yellow"
            bg="whiteAlpha.100"
            borderRadius="full"
          />
        </VStack>
      </Box>

      {/* Expanded Details */}
      {isExpanded && (
        <Box
          p={4}
          bg="whiteAlpha.50"
          borderTop="1px solid"
          borderColor={theme.border}
        >
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.400">Full Address</Text>
              <Tooltip label={balance.address}>
                <Text fontSize="xs" fontFamily="mono" color="gray.200" isTruncated maxW="200px">
                  {balance.address}
                </Text>
              </Tooltip>
            </HStack>
            {balance.pubkey && (
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.400">Public Key</Text>
                <Tooltip label={balance.pubkey}>
                  <Text fontSize="xs" fontFamily="mono" color="gray.200" isTruncated maxW="200px">
                    {formatAddress(balance.pubkey, 20)}
                  </Text>
                </Tooltip>
              </HStack>
            )}
            {balance.path && (
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.400">Derivation Path</Text>
                <Text fontSize="xs" fontFamily="mono" color="gray.200">
                  {balance.path}
                </Text>
              </HStack>
            )}
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.400">Network</Text>
              <Text fontSize="xs" color="gray.200">
                {balance.networkId}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.400">Address Type</Text>
              <Text fontSize="xs" color="gray.200">
                {balance.addressType}
              </Text>
            </HStack>
            {onAddressClick && (
              <Button
                size="sm"
                variant="outline"
                color={theme.gold}
                borderColor={theme.gold}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddressClick(balance.address);
                }}
                rightIcon={<FaExternalLinkAlt />}
                _hover={{
                  bg: theme.gold,
                  color: 'black',
                }}
                mt={2}
              >
                View on Explorer
              </Button>
            )}
            {onPubkeySelect && matchingPubkey && (
              <Button
                size="sm"
                variant="solid"
                bg={theme.gold}
                color="black"
                onClick={(e) => {
                  e.stopPropagation();
                  onPubkeySelect(matchingPubkey);
                }}
                _hover={{
                  bg: theme.goldHover,
                }}
              >
                Set as Active Account
              </Button>
            )}
          </VStack>
        </Box>
      )}
    </Box>
  );
};

export const BalanceDistribution: React.FC<BalanceDistributionProps> = ({
  aggregatedBalance,
  selectedAddress,
  onAddressClick,
  onPubkeySelect,
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'value' | 'type' | 'percentage'>('value');
  const [showEmpty, setShowEmpty] = useState(true);

  // Format USD value
  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format balance with appropriate decimals
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.00001) return num.toExponential(4);
    if (num < 1) return num.toFixed(8);
    return num.toFixed(6);
  };

  // Sort and filter balances
  const sortedBalances = useMemo(() => {
    let balances = [...aggregatedBalance.balances];
    
    // Filter empty balances if needed
    if (!showEmpty) {
      balances = balances.filter(b => parseFloat(b.balance) > 0);
    }
    
    // Sort based on selected criteria
    switch (sortBy) {
      case 'value':
        return balances.sort((a, b) => b.valueUsd - a.valueUsd);
      case 'type':
        return balances.sort((a, b) => a.addressType.localeCompare(b.addressType));
      case 'percentage':
        return balances.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      default:
        return balances;
    }
  }, [aggregatedBalance.balances, sortBy, showEmpty]);

  const toggleCard = (address: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(address)) {
      newExpanded.delete(address);
    } else {
      newExpanded.add(address);
    }
    setExpandedCards(newExpanded);
  };

  // Don't show distribution section if no addresses
  if (aggregatedBalance.balances.length === 0) {
    return null;
  }

  // Calculate stats
  const nonEmptyCount = aggregatedBalance.balances.filter(b => parseFloat(b.balance) > 0).length;
  const emptyCount = aggregatedBalance.balances.length - nonEmptyCount;

  return (
    <VStack align="stretch" spacing={4} width="100%">
      {/* Header with Controls */}
      <Box 
        bg={theme.cardBg} 
        p={4} 
        borderRadius="lg" 
        border="1px solid" 
        borderColor={theme.border}
      >
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={0}>
              <Text fontSize="lg" fontWeight="bold" color={theme.gold}>
                Balance Distribution
              </Text>
              <Text fontSize="sm" color="gray.400">
                {aggregatedBalance.balances.length} total addresses · {nonEmptyCount} with balance
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Button
                size="xs"
                variant={showEmpty ? 'solid' : 'outline'}
                colorScheme={showEmpty ? 'yellow' : 'gray'}
                onClick={() => setShowEmpty(!showEmpty)}
              >
                {showEmpty ? 'Show All' : 'Hide Empty'}
              </Button>
            </HStack>
          </HStack>

          {/* Sort Options */}
          <HStack spacing={1}>
            <Text fontSize="xs" color="gray.500">Sort by:</Text>
            {(['value', 'type', 'percentage'] as const).map((option) => (
              <Button
                key={option}
                size="xs"
                variant={sortBy === option ? 'solid' : 'ghost'}
                bg={sortBy === option ? theme.gold : 'transparent'}
                color={sortBy === option ? 'black' : 'gray.400'}
                onClick={() => setSortBy(option)}
                _hover={{
                  bg: sortBy === option ? theme.goldHover : 'whiteAlpha.100',
                }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Button>
            ))}
          </HStack>

          {/* Summary Stats */}
          <HStack justify="space-between" pt={2} borderTop="1px solid" borderColor={theme.border}>
            <Text fontSize="sm" color="white" fontWeight="bold">
              Total Balance:
            </Text>
            <VStack align="end" spacing={0}>
              <Text fontSize="sm" fontWeight="bold" color="white">
                {formatBalance(aggregatedBalance.totalBalance)} {aggregatedBalance.symbol}
              </Text>
              <Text fontSize="xs" color="gray.400">
                ${formatUsd(aggregatedBalance.totalValueUsd)}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Box>

      {/* Balance Cards */}
      <VStack align="stretch" spacing={2}>
        {sortedBalances.map((balance) => (
          <BalanceCard
            key={balance.address}
            balance={balance}
            aggregatedBalance={aggregatedBalance}
            isExpanded={expandedCards.has(balance.address)}
            isSelected={selectedAddress === balance.address}
            onToggle={() => toggleCard(balance.address)}
            onAddressClick={onAddressClick}
            onPubkeySelect={onPubkeySelect}
          />
        ))}
      </VStack>

      {/* Empty State */}
      {sortedBalances.length === 0 && (
        <Box 
          p={8} 
          textAlign="center" 
          bg={theme.cardBg} 
          borderRadius="lg" 
          border="1px solid" 
          borderColor={theme.border}
        >
          <Text color="gray.400">
            {showEmpty ? 'No addresses found' : 'No addresses with balance'}
          </Text>
          {!showEmpty && emptyCount > 0 && (
            <Button
              mt={2}
              size="sm"
              variant="outline"
              color={theme.gold}
              borderColor={theme.gold}
              onClick={() => setShowEmpty(true)}
            >
              Show {emptyCount} empty address{emptyCount > 1 ? 'es' : ''}
            </Button>
          )}
        </Box>
      )}
    </VStack>
  );
};