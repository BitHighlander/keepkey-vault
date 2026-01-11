'use client'

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Badge,
  Grid,
  Flex,
} from '@chakra-ui/react';
import { usePioneerContext } from '@/components/providers/pioneer';
import { TransactionDetailDialog } from './TransactionDetailDialog';

// Theme colors - matching the asset page theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
};

interface TransactionHistoryProps {
  caip?: string; // Optional CAIP to filter transactions for specific asset
  networkId?: string; // Optional networkId to filter transactions
  assetContext?: any; // Asset context for color and explorer links
}

/**
 * Maps networkId to coin symbol
 */
function networkIdToSymbol(networkId: string): string {
  const networkMap: { [key: string]: string } = {
    'bip122:000000000019d6689c085ae165831e93': 'BTC',
    'bip122:000000000000000000651ef99cb9fcbe': 'BCH',
    'bip122:000007d91d1254d60e2dd1ae58038307': 'DASH',
    'bip122:00000000001a91e3dace36e2be3bf030': 'DOGE',
    'bip122:12a765e31ffd4059bada1e25190f6e98': 'LTC',
    'bip122:4da631f2ac1bed857bd968c67c913978': 'DGB',
    'bip122:00040fe8ec8471911baa1db1266ea15d': 'ZEC',
    'eip155:1': 'ETH',
    'eip155:137': 'MATIC',
    'eip155:56': 'BNB',
    'eip155:8453': 'BASE',
    'eip155:10': 'OP',
    'eip155:42161': 'ARB',
    'cosmos:cosmoshub-4': 'ATOM',
    'cosmos:osmosis-1': 'OSMO',
    'cosmos:thorchain-mainnet-v1': 'RUNE',
    'cosmos:mayachain-mainnet-v1': 'CACAO',
    'ripple:4109c6f2045fc7eff4cde8f9905d19c2': 'XRP',
  };

  // Try exact match first
  if (networkMap[networkId]) {
    return networkMap[networkId];
  }

  // Fallback: extract namespace prefix
  const prefix = networkId.split(':')[0];
  if (prefix === 'eip155') return 'EVM';
  if (prefix === 'bip122') return 'UTXO';
  if (prefix === 'cosmos') return 'COSMOS';
  return prefix.toUpperCase();
}

/**
 * Converts base unit value to human-readable format based on network type
 */
function formatTransactionValue(value: string, networkId: string, type: string): string {
  try {
    const valueBigInt = BigInt(value);

    // Determine decimals based on network type
    let decimals = 0;
    if (networkId.startsWith('eip155')) {
      // EVM chains use 18 decimals for native assets
      decimals = type === 'token_transfer' ? 18 : 18;
    } else if (networkId.startsWith('bip122')) {
      // Bitcoin-like chains use 8 decimals (satoshis)
      decimals = 8;
    } else if (networkId.startsWith('cosmos')) {
      // Cosmos-based chains typically use 6 decimals
      decimals = 6;
    } else if (networkId.startsWith('ripple')) {
      // Ripple uses 6 decimals (drops)
      decimals = 6;
    }

    // Convert from base units to human-readable
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = valueBigInt / divisor;
    const fractionalPart = valueBigInt % divisor;

    // Format with appropriate precision
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const displayDecimals = Math.min(decimals, 8); // Show max 8 decimal places
    const trimmedFractional = fractionalStr.substring(0, displayDecimals).replace(/0+$/, '');

    if (trimmedFractional) {
      return `${wholePart}.${trimmedFractional}`;
    } else {
      return wholePart.toString();
    }
  } catch (error) {
    // Fallback for invalid values
    return value;
  }
}

/**
 * Formats timestamp to readable date string
 */
function formatTransactionDate(timestamp: number): string {
  try {
    // Detect if timestamp is in seconds or milliseconds
    // Timestamps in seconds are typically < 10000000000 (year 2286)
    const timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;

    const date = new Date(timestampMs);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toISOString().substring(0, 19).replace('T', ' ');
  } catch (error) {
    return 'Invalid Date';
  }
}

export const TransactionHistory = ({ caip, networkId, assetContext }: TransactionHistoryProps) => {
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Handle transaction click
  const handleTransactionClick = (tx: any) => {
    setSelectedTransaction(tx);
    setIsDialogOpen(true);
  };

  // Handle dialog close
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  };

  // Get transactions from app state
  const transactions = useMemo(() => {
    if (!app?.transactions) {
      return [];
    }

    let txs = app.transactions;

    // Filter by networkId (primary filter for transactions)
    if (networkId) {
      txs = txs.filter((tx: any) => tx.networkId === networkId);
    } else if (caip) {
      // Fallback: Try to match by CAIP or extract networkId from CAIP
      // Try exact CAIP match first
      let filtered = txs.filter((tx: any) => tx.caip === caip);

      // If no exact match and CAIP contains a networkId prefix (e.g., "eip155:1/slip44:60")
      // Try to match just the network part (e.g., "eip155:1")
      if (filtered.length === 0 && caip.includes('/')) {
        const networkPart = caip.split('/')[0];
        filtered = txs.filter((tx: any) => tx.networkId === networkPart || tx.caip?.startsWith(networkPart));
      }

      txs = filtered;
    }

    return txs;
  }, [app?.transactions, caip, networkId]);

  // Group transactions by coin symbol
  const groupedTransactions = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};

    transactions.forEach((tx: any) => {
      const symbol = networkIdToSymbol(tx.networkId);
      if (!grouped[symbol]) {
        grouped[symbol] = [];
      }
      grouped[symbol].push(tx);
    });

    // Sort each group by timestamp (newest first)
    Object.keys(grouped).forEach(symbol => {
      grouped[symbol].sort((a, b) => b.timestamp - a.timestamp);
    });

    return grouped;
  }, [transactions]);

  // Filter and sort swap transactions
  const swapTransactions = useMemo(() => {
    const swaps = transactions.filter((tx: any) => tx.swapMetadata?.isSwap);

    // Group by status
    const grouped: { [key: string]: any[] } = {};
    swaps.forEach((tx: any) => {
      const status = tx.swapMetadata.status || 'UNKNOWN';
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(tx);
    });

    return grouped;
  }, [transactions]);

  useEffect(() => {
    // Set loading to false once we have the app loaded
    // Even if there are no transactions, we should show the empty state
    if (app) {
      setLoading(false);
    }
  }, [app]);

  if (loading) {
    return (
      <Box
        bg={theme.cardBg}
        borderRadius="lg"
        borderColor={theme.border}
        borderWidth="1px"
        mt={6}
        p={8}
      >
        <VStack gap={4}>
          <Spinner size="xl" color={theme.gold} />
          <Text color="gray.400">Loading transaction history...</Text>
        </VStack>
      </Box>
    );
  }

  if (transactions.length === 0) {
    return (
      <Box
        bg={theme.cardBg}
        borderRadius="lg"
        borderColor={theme.border}
        borderWidth="1px"
        mt={6}
        p={8}
      >
        <VStack gap={4}>
          <Box
            boxSize="60px"
            borderRadius="full"
            bg="rgba(255, 215, 0, 0.1)"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="2xl">📜</Text>
          </Box>
          <VStack gap={2}>
            <Text fontSize="md" fontWeight="medium" color="white">
              No Transaction History
            </Text>
            <Text fontSize="sm" color="gray.400" textAlign="center" maxW="sm">
              No transactions found for this asset yet.
            </Text>
          </VStack>
        </VStack>
      </Box>
    );
  }

  // Status order for swaps
  const statusOrder = ['PENDING', 'CONFIRMING', 'COMPLETED', 'FAILED', 'REFUNDED', 'UNKNOWN'];

  return (
    <Box mt={6}>
      {/* Regular Transactions - Grouped by Coin */}
      {Object.entries(groupedTransactions)
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([coin, coinTxs]) => {
          // Limit to 10 most recent per coin
          const displayTxs = coinTxs.slice(0, 10);

          return (
            <Box
              key={coin}
              bg={theme.cardBg}
              borderRadius="lg"
              borderColor={theme.border}
              borderWidth="1px"
              mb={4}
            >
              <Box p={4} borderBottom="1px" borderColor={theme.border}>
                <HStack justify="space-between">
                  <HStack>
                    <Text fontSize="lg">🪙</Text>
                    <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                      {coin}
                    </Text>
                  </HStack>
                  <Text color="gray.400" fontSize="sm">
                    {coinTxs.length} transaction{coinTxs.length !== 1 ? 's' : ''}
                  </Text>
                </HStack>
              </Box>

              <Box p={4}>
                {/* Header row */}
                <Grid
                  templateColumns="2fr 1.5fr 1fr 1fr 1.5fr 2fr"
                  gap={2}
                  pb={2}
                  borderBottom="1px"
                  borderColor={theme.border}
                  mb={2}
                >
                  <Text color="gray.400" fontSize="xs" fontWeight="bold">TxID</Text>
                  <Text color="gray.400" fontSize="xs" fontWeight="bold">Type</Text>
                  <Text color="gray.400" fontSize="xs" fontWeight="bold">Direction</Text>
                  <Text color="gray.400" fontSize="xs" fontWeight="bold">Status</Text>
                  <Text color="gray.400" fontSize="xs" fontWeight="bold" textAlign="right">Value</Text>
                  <Text color="gray.400" fontSize="xs" fontWeight="bold">Date</Text>
                </Grid>

                {/* Transaction rows */}
                <VStack gap={1} align="stretch">
                  {displayTxs.map((tx: any, index: number) => {
                    const formattedValue = formatTransactionValue(tx.value || '0', tx.networkId, tx.type);
                    const date = formatTransactionDate(tx.timestamp);

                    // Direction badge color
                    const directionColor =
                      tx.direction === 'received' ? 'green' :
                      tx.direction === 'sent' ? 'red' :
                      'gray';

                    // Status badge color
                    const statusColor =
                      tx.status === 'confirmed' ? 'green' :
                      tx.status === 'pending' ? 'yellow' :
                      'red';

                    return (
                      <Grid
                        key={`${tx.txid}-${index}`}
                        templateColumns="2fr 1.5fr 1fr 1fr 1.5fr 2fr"
                        gap={2}
                        p={2}
                        bg="rgba(255, 215, 0, 0.02)"
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{
                          bg: 'rgba(255, 215, 0, 0.1)',
                          transform: 'scale(1.01)',
                        }}
                        transition="all 0.2s"
                        alignItems="center"
                        onClick={() => handleTransactionClick(tx)}
                      >
                        <Text color="white" fontFamily="mono" fontSize="xs" isTruncated>
                          {tx.txid.substring(0, 16)}
                        </Text>
                        <Text color="gray.300" fontSize="xs" isTruncated>
                          {tx.type}
                        </Text>
                        <Box>
                          <Badge colorScheme={directionColor} fontSize="xs">
                            {tx.direction}
                          </Badge>
                        </Box>
                        <Box>
                          <Badge colorScheme={statusColor} fontSize="xs">
                            {tx.status}
                          </Badge>
                        </Box>
                        <Text color="white" fontFamily="mono" fontSize="xs" textAlign="right">
                          {formattedValue}
                        </Text>
                        <Text color="gray.400" fontSize="xs">
                          {date}
                        </Text>
                      </Grid>
                    );
                  })}
                </VStack>
              </Box>

              {coinTxs.length > 10 && (
                <Box p={3} borderTop="1px" borderColor={theme.border}>
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    📈 Showing 10 of {coinTxs.length} {coin} transactions (newest first)
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}

      {/* Swap Transactions */}
      {Object.keys(swapTransactions).length > 0 && (
        <Box
          bg={theme.cardBg}
          borderRadius="lg"
          borderColor={theme.border}
          borderWidth="1px"
          mb={4}
        >
          <Box p={4} borderBottom="1px" borderColor={theme.border}>
            <HStack>
              <Text fontSize="lg">💱</Text>
              <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                Swap Transactions
              </Text>
              <Text color="gray.400" fontSize="sm">
                ({transactions.filter((tx: any) => tx.swapMetadata?.isSwap).length} total)
              </Text>
            </HStack>
          </Box>

          {statusOrder.map(status => {
            const statusSwaps = swapTransactions[status];
            if (!statusSwaps || statusSwaps.length === 0) return null;

            // Status icon
            const statusIcon: { [key: string]: string } = {
              'PENDING': '⏳',
              'CONFIRMING': '🔄',
              'COMPLETED': '✅',
              'FAILED': '❌',
              'REFUNDED': '↩️',
              'UNKNOWN': '❓'
            };

            const icon = statusIcon[status] || '❓';

            return (
              <Box key={status}>
                <Box p={3} bg="rgba(255, 215, 0, 0.05)" borderBottom="1px" borderColor={theme.border}>
                  <HStack>
                    <Text fontSize="sm">{icon}</Text>
                    <Text color="white" fontSize="sm" fontWeight="medium">
                      {status}
                    </Text>
                    <Text color="gray.400" fontSize="sm">
                      - {statusSwaps.length} swap{statusSwaps.length !== 1 ? 's' : ''}
                    </Text>
                  </HStack>
                </Box>

                <Box p={4}>
                  {/* Header row */}
                  <Grid
                    templateColumns="2fr 2fr 1fr 1fr 1fr 1.5fr 1.5fr"
                    gap={2}
                    pb={2}
                    borderBottom="1px"
                    borderColor={theme.border}
                    mb={2}
                  >
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">From Asset</Text>
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">To Asset</Text>
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">Protocol</Text>
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">Status</Text>
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">Amount</Text>
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">Inbound TxID</Text>
                    <Text color="gray.400" fontSize="xs" fontWeight="bold">Outbound TxID</Text>
                  </Grid>

                  {/* Swap rows */}
                  <VStack gap={1} align="stretch">
                    {statusSwaps.map((tx: any, index: number) => {
                      const meta = tx.swapMetadata;
                      return (
                        <Grid
                          key={`${tx.txid}-${index}`}
                          templateColumns="2fr 2fr 1fr 1fr 1fr 1.5fr 1.5fr"
                          gap={2}
                          p={2}
                          bg="rgba(255, 215, 0, 0.02)"
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{
                            bg: 'rgba(255, 215, 0, 0.1)',
                            transform: 'scale(1.01)',
                          }}
                          transition="all 0.2s"
                          alignItems="center"
                          onClick={() => handleTransactionClick(tx)}
                        >
                          <Text color="white" fontSize="xs" fontFamily="mono" isTruncated>
                            {meta.fromAsset || '?'}
                          </Text>
                          <Text color="white" fontSize="xs" fontFamily="mono" isTruncated>
                            {meta.toAsset || '?'}
                          </Text>
                          <Text color="gray.300" fontSize="xs" isTruncated>
                            {meta.protocol || 'unknown'}
                          </Text>
                          <Box>
                            <Badge colorScheme={status === 'COMPLETED' ? 'green' : status === 'FAILED' ? 'red' : 'yellow'} fontSize="xs">
                              {meta.status || 'UNKNOWN'}
                            </Badge>
                          </Box>
                          <Text color="white" fontSize="xs" fontFamily="mono" isTruncated>
                            {meta.fromAmount || 'N/A'}
                          </Text>
                          <Text color="white" fontSize="xs" fontFamily="mono" isTruncated>
                            {meta.inboundTxHash ? meta.inboundTxHash.substring(0, 14) + '..' : tx.txid.substring(0, 14) + '..'}
                          </Text>
                          <Text color="white" fontSize="xs" fontFamily="mono" isTruncated>
                            {meta.outboundTxHash ? meta.outboundTxHash.substring(0, 14) + '..' : '-'}
                          </Text>
                        </Grid>
                      );
                    })}
                  </VStack>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        transaction={selectedTransaction}
        assetContext={assetContext}
      />
    </Box>
  );
};

export default TransactionHistory;
