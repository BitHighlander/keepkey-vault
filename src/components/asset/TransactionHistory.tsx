'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, VStack, HStack, Spinner, Badge } from '@chakra-ui/react';
import { usePioneerContext } from '@/components/providers/pioneer';
import { TransactionDetailDialog } from './TransactionDetailDialog';
import { TransactionGroup, TransactionTableHeader } from './TransactionGroup';
import { TransactionRow } from './TransactionRow';
import { SwapTransactionRow } from './SwapTransactionRow';
import { SwapProgress } from '@/components/swap/SwapProgress';
import { DialogRoot, DialogContent, DialogBody } from '@/components/ui/dialog';
import { networkIdToSymbol, getSwapStatusColorScheme } from '@/utils/transactionUtils';
import { assetData } from '@pioneer-platform/pioneer-discovery';

const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  border: '#222222',
};

interface TransactionHistoryProps {
  caip?: string;
  networkId?: string;
  assetContext?: any;
}

export const TransactionHistory = ({ caip, networkId, assetContext }: TransactionHistoryProps) => {
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSwapProgress, setShowSwapProgress] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  const handleTransactionClick = (tx: any) => {
    // If it's a swap transaction, show SwapProgress directly
    if (tx.swapMetadata?.isSwap) {
      setSelectedTransaction(tx);
      setShowSwapProgress(true);
    } else {
      // For regular transactions, show the detail dialog
      setSelectedTransaction(tx);
      setIsDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleCloseSwapProgress = () => {
    setShowSwapProgress(false);
    setSelectedTransaction(null);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Get and filter transactions
  const transactions = useMemo(() => {
    if (!app?.transactions) return [];

    let txs = app.transactions;

    if (networkId) {
      txs = txs.filter((tx: any) =>
        tx.networkId === networkId ||
        // Also include swaps where this asset is the source or destination
        (tx.swapMetadata?.fromAsset && tx.swapMetadata.fromAsset.includes(networkId)) ||
        (tx.swapMetadata?.toAsset && tx.swapMetadata.toAsset.includes(networkId))
      );
    } else if (caip) {
      let filtered = txs.filter((tx: any) =>
        tx.caip === caip ||
        // Also include swaps where this asset is the source or destination
        tx.swapMetadata?.fromAsset === caip ||
        tx.swapMetadata?.toAsset === caip
      );

      if (filtered.length === 0 && caip.includes('/')) {
        const networkPart = caip.split('/')[0];
        filtered = txs.filter(
          (tx: any) =>
            tx.networkId === networkPart ||
            tx.caip?.startsWith(networkPart) ||
            // Also check if fromAsset or toAsset matches this network
            (tx.swapMetadata?.fromAsset && tx.swapMetadata.fromAsset.startsWith(networkPart)) ||
            (tx.swapMetadata?.toAsset && tx.swapMetadata.toAsset.startsWith(networkPart))
        );
      }

      txs = filtered;
    }

    return txs;
  }, [app?.transactions, caip, networkId]);

  // Group transactions by coin
  const groupedTransactions = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};

    transactions.forEach((tx: any) => {
      const symbol = networkIdToSymbol(tx.networkId);
      if (!grouped[symbol]) {
        grouped[symbol] = [];
      }
      grouped[symbol].push(tx);
    });

    Object.keys(grouped).forEach(symbol => {
      grouped[symbol].sort((a, b) => b.timestamp - a.timestamp);
    });

    return grouped;
  }, [transactions]);

  // Filter swap transactions
  const swapTransactions = useMemo(() => {
    const swaps = transactions.filter((tx: any) => tx.swapMetadata?.isSwap);

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

  const statusOrder = ['PENDING', 'CONFIRMING', 'COMPLETED', 'FAILED', 'REFUNDED', 'UNKNOWN'];

  return (
    <Box mt={6}>
      {/* Regular Transactions - Grouped by Coin */}
      {Object.entries(groupedTransactions)
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([coin, coinTxs]) => {
          const displayTxs = coinTxs.slice(0, 10);
          const isExpanded = expandedGroups.has(coin);
          const firstTx = coinTxs[0];
          const caipForIcon = firstTx?.caip || firstTx?.networkId;

          // Try to get asset info from assetData for the icon
          let coinAssetContext = null;

          // First, use assetContext if it matches this coin
          if (assetContext && assetContext.symbol === coin) {
            coinAssetContext = assetContext;
          } else if (caipForIcon) {
            // Try to look up from assetData using CAIP
            // @ts-ignore - assetData is a JSON object indexed by CAIP
            const assetInfo = assetData[caipForIcon] || assetData[caipForIcon?.toLowerCase()];
            if (assetInfo) {
              coinAssetContext = {
                icon: assetInfo.icon,
                caip: caipForIcon,
                symbol: coin,
                name: assetInfo.name || coin,
                color: assetInfo.color,
              };
            }
          }

          return (
            <TransactionGroup
              key={coin}
              groupId={coin}
              title={coin}
              subtitle={`${coinTxs.length} transaction${coinTxs.length !== 1 ? 's' : ''}`}
              isExpanded={isExpanded}
              onToggle={() => toggleGroup(coin)}
              assetContext={coinAssetContext}
            >
              <Box p={4}>
                <TransactionTableHeader
                  columns={['TxID', 'Type', 'Direction', 'Status', 'Value', 'Date']}
                  templateColumns="2fr 1.5fr 1fr 1fr 1.5fr 2fr"
                />

                <VStack gap={1} align="stretch">
                  {displayTxs.map((tx: any, index: number) => (
                    <TransactionRow
                      key={`${tx.txid}-${index}`}
                      transaction={tx}
                      onClick={handleTransactionClick}
                    />
                  ))}
                </VStack>
              </Box>

              {coinTxs.length > 10 && (
                <Box p={3} borderTop="1px" borderColor={theme.border} bg="rgba(255, 215, 0, 0.03)">
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    Showing 10 of {coinTxs.length} {coin} transactions (newest first)
                  </Text>
                </Box>
              )}
            </TransactionGroup>
          );
        })}

      {/* Swap Transactions */}
      {Object.keys(swapTransactions).length > 0 && (
        <TransactionGroup
          groupId="SWAPS"
          title="Swap Transactions"
          subtitle={`${transactions.filter((tx: any) => tx.swapMetadata?.isSwap).length} total`}
          isExpanded={expandedGroups.has('SWAPS')}
          onToggle={() => toggleGroup('SWAPS')}
          useSwapIcon={true}
        >
          {statusOrder.map(status => {
            const statusSwaps = swapTransactions[status];
            if (!statusSwaps || statusSwaps.length === 0) return null;

            return (
              <Box key={status}>
                <Box p={3} bg="rgba(17, 17, 17, 0.4)" borderBottom="1px" borderColor={theme.border}>
                  <HStack gap={3}>
                    <Badge
                      colorPalette={getSwapStatusColorScheme(status)}
                      fontSize="xs"
                      px={3}
                      py={1}
                      fontWeight="semibold"
                      textTransform="uppercase"
                    >
                      {status}
                    </Badge>
                    <Text color="gray.500" fontSize="xs">
                      {statusSwaps.length} swap{statusSwaps.length !== 1 ? 's' : ''}
                    </Text>
                  </HStack>
                </Box>

                <Box p={4}>
                  <TransactionTableHeader
                    columns={['From Asset', 'To Asset', 'Protocol', 'Status', 'Amount', 'Inbound TxID', 'Outbound TxID', 'Date']}
                    templateColumns="1.5fr 1.5fr 1fr 1fr 1fr 1.5fr 1.5fr 1.5fr"
                  />

                  <VStack gap={1} align="stretch">
                    {statusSwaps.map((tx: any, index: number) => {
                      // Get asset identifiers from swap metadata
                      const fromAsset = tx.swapMetadata?.fromAsset || '';
                      const toAsset = tx.swapMetadata?.toAsset || '';

                      // Check if these are CAIP strings (contain ':' or '/')
                      const isFromAssetCAIP = fromAsset.includes(':') || fromAsset.includes('/');
                      const isToAssetCAIP = toAsset.includes(':') || toAsset.includes('/');

                      // Look up icons from assetData only if we have CAIP strings
                      // @ts-ignore - assetData is a JSON object indexed by CAIP
                      const fromAssetInfo = isFromAssetCAIP
                        ? (assetData[fromAsset] || assetData[fromAsset?.toLowerCase()])
                        : null;
                      // @ts-ignore
                      const toAssetInfo = isToAssetCAIP
                        ? (assetData[toAsset] || assetData[toAsset?.toLowerCase()])
                        : null;

                      return (
                        <SwapTransactionRow
                          key={`${tx.txid}-${index}`}
                          transaction={tx}
                          status={status}
                          fromIconUrl={fromAssetInfo?.icon}
                          toIconUrl={toAssetInfo?.icon}
                          onClick={handleTransactionClick}
                        />
                      );
                    })}
                  </VStack>
                </Box>
              </Box>
            );
          })}
        </TransactionGroup>
      )}

      {/* Show SwapProgress for swap transactions */}
      <DialogRoot
        open={showSwapProgress && !!selectedTransaction?.swapMetadata}
        onOpenChange={(e) => {
          if (!e.open) {
            handleCloseSwapProgress();
          }
        }}
        size="xl"
      >
        <DialogContent
          bg="#000000"
          borderRadius="2xl"
          borderWidth="2px"
          borderColor="#1A1D23"
          maxW="900px"
          p={0}
        >
          <DialogBody p={0}>
            {selectedTransaction?.swapMetadata && (
              <SwapProgress
                txid={selectedTransaction.swapMetadata.inboundTxHash || selectedTransaction.txid}
                fromAsset={selectedTransaction.swapMetadata.fromAsset}
                toAsset={selectedTransaction.swapMetadata.toAsset}
                inputAmount={selectedTransaction.swapMetadata.inputAmount || '0'}
                outputAmount={selectedTransaction.swapMetadata.outputAmount || '0'}
                integration={selectedTransaction.swapMetadata.protocol === 'thorchain' ? 'thorchain' : 'mayaprotocol'}
                memo={selectedTransaction.swapMetadata.memo}
                onClose={handleCloseSwapProgress}
                onComplete={handleCloseSwapProgress}
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogRoot>

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
