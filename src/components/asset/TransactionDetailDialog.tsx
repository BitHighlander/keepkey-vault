'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Grid,
  Code,
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
import { FaExternalLinkAlt, FaCopy } from 'react-icons/fa';
import { mergeSwapStatusUpdate, transformSwapToTransaction } from '@/utils/swapDataAdapter';
import { usePioneerContext } from '@/components/providers/pioneer';

// Theme colors - matching the asset page theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  borderLight: '#333333',
};

interface TransactionDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
  assetContext?: any;
}

/**
 * Formats timestamp to readable date string
 */
function formatTransactionDate(timestamp: number): string {
  try {
    const timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toISOString().substring(0, 19).replace('T', ' ');
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Copy text to clipboard
 */
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

/**
 * Get explorer link for transaction
 */
const getExplorerLink = (tx: any, assetContext?: any): string | null => {
  if (!assetContext?.explorerTxLink || !tx?.txid) return null;

  const explorerLink = assetContext.explorerTxLink;

  // Handle different explorer link formats:
  // 1. Contains {txid} placeholder: https://example.com/tx/{txid}
  if (explorerLink.includes('{txid}')) {
    return explorerLink.replace('{txid}', tx.txid);
  }

  // 2. Ends with / or nothing: https://example.com/tx/ or https://example.com/tx
  // Just append the txid
  if (explorerLink.endsWith('/')) {
    return explorerLink + tx.txid;
  } else {
    return explorerLink + '/' + tx.txid;
  }
};

export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  isOpen,
  onClose,
  transaction: tx,
  assetContext,
}) => {
  const { app } = usePioneerContext();
  const [transaction, setTransaction] = useState(tx);

  // Update local state when prop changes
  useEffect(() => {
    setTransaction(tx);
  }, [tx]);

  // Subscribe to real-time swap events
  useEffect(() => {
    if (!tx?.swapMetadata?.isSwap || !app?.events) return;

    const handleSwapEvent = (event: any) => {
      // Only handle events for this swap
      if (event.txHash !== tx.txid && event.transaction?.txid !== tx.txid) return;

      console.log('[TransactionDetailDialog] Received swap:event:', event);
      const updatedTx = mergeSwapStatusUpdate(transaction, event);
      setTransaction(updatedTx);
    };

    app.events.on('swap:event', handleSwapEvent);
    return () => app.events.off('swap:event', handleSwapEvent);
  }, [tx?.txid, tx?.swapMetadata?.isSwap, app, transaction]);

  // REST polling fallback for swap status
  useEffect(() => {
    if (!tx?.swapMetadata?.isSwap || !isOpen || !app?.pioneer) return;

    const pollSwapStatus = async () => {
      try {
        const response = await app.pioneer.GetPendingSwap({ txHash: tx.txid });
        const swapData = response?.data?.swap || response?.data;
        if (swapData) {
          console.log('[TransactionDetailDialog] Polled swap status:', swapData);
          const updatedTx = transformSwapToTransaction(swapData);
          setTransaction(updatedTx);
        }
      } catch (err) {
        console.error('[TransactionDetailDialog] Failed to poll swap status:', err);
      }
    };

    // Poll every 30s when dialog is open
    const interval = setInterval(pollSwapStatus, 30000);
    pollSwapStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [tx?.txid, tx?.swapMetadata?.isSwap, isOpen, app]);

  if (!tx) return null;

  const date = formatTransactionDate(transaction.timestamp);
  const explorerLink = getExplorerLink(transaction, assetContext);

  // Use asset color or fallback to gold
  const assetColor = assetContext?.color || theme.gold;
  const assetColorHover = assetContext?.color ? `${assetContext.color}dd` : theme.goldHover;

  // Direction badge color
  const directionColor =
    transaction.direction === 'received' ? 'green' :
    transaction.direction === 'sent' ? 'red' :
    'gray';

  // Status badge color
  const statusColor =
    transaction.status === 'confirmed' ? 'green' :
    transaction.status === 'pending' ? 'yellow' :
    'red';

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <DialogContent
        bg={theme.cardBg}
        borderColor={assetColor}
        borderWidth="2px"
        borderRadius="xl"
        maxW="900px"
        p={0}
      >
        <DialogHeader
          borderBottom="2px"
          borderColor={assetColor}
          pb={6}
          pt={6}
          px={8}
          bg={`${assetColor}11`}
        >
          <DialogTitle color={assetColor} fontSize="2xl" fontWeight="bold">
            Transaction Details
          </DialogTitle>
          <DialogCloseTrigger color="white" />
        </DialogHeader>

        <DialogBody py={8} px={8}>
          <VStack gap={6} align="stretch">
            {/* Transaction ID */}
            <Box
              bg={`${assetColor}08`}
              borderRadius="lg"
              p={4}
              borderWidth="1px"
              borderColor={`${assetColor}33`}
            >
              <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                Transaction ID
              </Text>
              <HStack gap={3}>
                <Code
                  bg={`${assetColor}15`}
                  color={assetColor}
                  p={3}
                  borderRadius="md"
                  fontSize="sm"
                  fontFamily="mono"
                  wordBreak="break-all"
                  flex="1"
                  borderWidth="1px"
                  borderColor={`${assetColor}22`}
                >
                  {transaction.txid}
                </Code>
                <Box
                  as="button"
                  onClick={() => copyToClipboard(transaction.txid)}
                  color={assetColor}
                  _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                  p={3}
                  transition="all 0.2s"
                  bg={`${assetColor}11`}
                  borderRadius="md"
                >
                  <FaCopy />
                </Box>
                {explorerLink && (
                  <Box
                    as="a"
                    href={explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    color={assetColor}
                    _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                    p={3}
                    transition="all 0.2s"
                    bg={`${assetColor}11`}
                    borderRadius="md"
                  >
                    <FaExternalLinkAlt />
                  </Box>
                )}
              </HStack>
            </Box>

            {/* Status and Direction */}
            <Grid templateColumns="1fr 1fr" gap={6}>
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Status
                </Text>
                <Badge colorScheme={statusColor} fontSize="md" px={4} py={2}>
                  {transaction.status || 'unknown'}
                </Badge>
              </Box>
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Direction
                </Text>
                <Badge colorScheme={directionColor} fontSize="md" px={4} py={2}>
                  {transaction.direction || 'unknown'}
                </Badge>
              </Box>
            </Grid>

            {/* Type and Network */}
            <Grid templateColumns="1fr 1fr" gap={6}>
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Type
                </Text>
                <Text color="white" fontSize="md">{transaction.type || 'transfer'}</Text>
              </Box>
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Network
                </Text>
                <Text color="white" fontSize="sm" fontFamily="mono">
                  {transaction.networkId || transaction.caip || 'unknown'}
                </Text>
              </Box>
            </Grid>

            {/* Value and Fee */}
            <Grid templateColumns="1fr 1fr" gap={6}>
              <Box
                bg={`${assetColor}08`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={`${assetColor}33`}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Value
                </Text>
                <Text color={assetColor} fontSize="xl" fontFamily="mono" fontWeight="bold">
                  {transaction.value || '0'}
                </Text>
              </Box>
              {transaction.fee && (
                <Box
                  bg={`${assetColor}05`}
                  p={4}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={theme.border}
                >
                  <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                    Fee
                  </Text>
                  <Text color="white" fontSize="md" fontFamily="mono">
                    {transaction.fee}
                  </Text>
                </Box>
              )}
            </Grid>

            {/* Timestamp and Block */}
            <Grid templateColumns="1fr 1fr" gap={6}>
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Timestamp
                </Text>
                <Text color="white" fontSize="md">{date}</Text>
              </Box>
              {transaction.blockHeight && (
                <Box
                  bg={`${assetColor}05`}
                  p={4}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={theme.border}
                >
                  <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                    Block Height
                  </Text>
                  <Text color="white" fontSize="md" fontFamily="mono">
                    {transaction.blockHeight}
                  </Text>
                </Box>
              )}
            </Grid>

            {/* Confirmations */}
            {transaction.confirmations !== undefined && (
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Confirmations
                </Text>
                <Text color="white" fontSize="md">{transaction.confirmations}</Text>
              </Box>
            )}

            {/* Addresses */}
            {transaction.from && transaction.from.length > 0 && (
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  From
                </Text>
                <VStack gap={2} align="stretch">
                  {transaction.from.map((addr: string, idx: number) => (
                    <HStack key={idx} gap={2}>
                      <Code
                        bg={`${assetColor}08`}
                        color="white"
                        p={3}
                        borderRadius="md"
                        fontSize="xs"
                        fontFamily="mono"
                        wordBreak="break-all"
                        flex="1"
                        borderWidth="1px"
                        borderColor={`${assetColor}22`}
                      >
                        {addr}
                      </Code>
                      <Box
                        as="button"
                        onClick={() => copyToClipboard(addr)}
                        color={assetColor}
                        _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                        p={2}
                        transition="all 0.2s"
                        bg={`${assetColor}11`}
                        borderRadius="md"
                      >
                        <FaCopy size={14} />
                      </Box>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}

            {transaction.to && transaction.to.length > 0 && (
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  To
                </Text>
                <VStack gap={2} align="stretch">
                  {transaction.to.map((addr: string, idx: number) => (
                    <HStack key={idx} gap={2}>
                      <Code
                        bg={`${assetColor}08`}
                        color="white"
                        p={3}
                        borderRadius="md"
                        fontSize="xs"
                        fontFamily="mono"
                        wordBreak="break-all"
                        flex="1"
                        borderWidth="1px"
                        borderColor={`${assetColor}22`}
                      >
                        {addr}
                      </Code>
                      <Box
                        as="button"
                        onClick={() => copyToClipboard(addr)}
                        color={assetColor}
                        _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                        p={2}
                        transition="all 0.2s"
                        bg={`${assetColor}11`}
                        borderRadius="md"
                      >
                        <FaCopy size={14} />
                      </Box>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}

            {/* Memo */}
            {transaction.memo && (
              <Box
                bg={`${assetColor}05`}
                p={4}
                borderRadius="lg"
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Text color="gray.400" fontSize="sm" mb={3} fontWeight="medium">
                  Memo
                </Text>
                <Code
                  bg={`${assetColor}08`}
                  color="white"
                  p={3}
                  borderRadius="md"
                  fontSize="sm"
                  display="block"
                  borderWidth="1px"
                  borderColor={`${assetColor}22`}
                >
                  {transaction.memo}
                </Code>
              </Box>
            )}

            {/* Enhanced Swap Metadata */}
            {transaction.swapMetadata && transaction.swapMetadata.isSwap && (
              <Box
                bg={`${assetColor}08`}
                borderRadius="lg"
                borderWidth="2px"
                borderColor={`${assetColor}55`}
                p={5}
              >
                <VStack gap={4} align="stretch">
                  {/* Header with title, status, and monitor button */}
                  <HStack justify="space-between">
                    <HStack>
                      <Text fontSize="xl">💱</Text>
                      <Text color={assetColor} fontSize="lg" fontWeight="bold">
                        Swap Details
                      </Text>
                    </HStack>
                    <HStack gap={2}>
                      {/* Swap Status Badge */}
                      {transaction.swapMetadata.status && (
                        <Badge
                          colorScheme={
                            transaction.swapMetadata.status === 'completed' ? 'green' :
                            transaction.swapMetadata.status === 'output_confirmed' ? 'green' :
                            transaction.swapMetadata.status === 'output_detected' ? 'blue' :
                            transaction.swapMetadata.status === 'output_confirming' ? 'blue' :
                            transaction.swapMetadata.status === 'confirming' ? 'blue' :
                            transaction.swapMetadata.status === 'pending' ? 'yellow' :
                            transaction.swapMetadata.status === 'failed' ? 'red' :
                            transaction.swapMetadata.status === 'refunded' ? 'orange' :
                            'gray'
                          }
                          fontSize="sm"
                          px={3}
                          py={1}
                        >
                          {transaction.swapMetadata.status === 'output_detected' ? '🎯 OUTPUT DETECTED' :
                           transaction.swapMetadata.status === 'output_confirming' ? '⏳ CONFIRMING OUTPUT' :
                           transaction.swapMetadata.status === 'output_confirmed' ? '✅ OUTPUT CONFIRMED' :
                           transaction.swapMetadata.status === 'completed' ? '✅ COMPLETED' :
                           transaction.swapMetadata.status === 'confirming' ? '⏳ CONFIRMING' :
                           transaction.swapMetadata.status === 'pending' ? '⏳ PENDING' :
                           transaction.swapMetadata.status === 'failed' ? '❌ FAILED' :
                           transaction.swapMetadata.status === 'refunded' ? '🔄 REFUNDED' :
                           transaction.swapMetadata.status?.toUpperCase()}
                        </Badge>
                      )}
                    </HStack>
                  </HStack>
                </VStack>

                {/* Asset Pair */}
                <VStack gap={4} align="stretch">
                  <Grid templateColumns="1fr 1fr" gap={4}>
                    <Box
                      bg={`${assetColor}05`}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        From Asset
                      </Text>
                      <Text color="white" fontSize="sm" fontWeight="bold">
                        {transaction.swapMetadata.fromAsset || 'N/A'}
                      </Text>
                      {transaction.swapMetadata.fromAmount && (
                        <Text color={assetColor} fontSize="xs" mt={1}>
                          {transaction.swapMetadata.fromAmount}
                        </Text>
                      )}
                    </Box>
                    <Box
                      bg={`${assetColor}05`}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        To Asset
                      </Text>
                      <Text color="white" fontSize="sm" fontWeight="bold">
                        {transaction.swapMetadata.toAsset || 'N/A'}
                      </Text>
                      {transaction.swapMetadata.toAmount && (
                        <Text color={assetColor} fontSize="xs" mt={1}>
                          {transaction.swapMetadata.toAmount}
                        </Text>
                      )}
                    </Box>
                  </Grid>

                  {/* Protocol Integration */}
                  {transaction.swapMetadata.integration && (
                    <Box
                      bg={`${assetColor}05`}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Integration
                      </Text>
                      <Text color="white" fontSize="sm">
                        {transaction.swapMetadata.integration === 'thorchain' ? 'THORChain' :
                         transaction.swapMetadata.integration === 'mayachain' ? 'Maya Protocol' :
                         transaction.swapMetadata.integration}
                      </Text>
                    </Box>
                  )}

                  {/* Confirmation Progress - Input Transaction */}
                  {transaction.swapMetadata.confirmations !== undefined && (
                    <Box
                      bg={`${assetColor}05`}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Input Transaction Confirmations
                      </Text>
                      <Text color="white" fontSize="sm">
                        {transaction.swapMetadata.confirmations} confirmations
                      </Text>
                    </Box>
                  )}

                  {/* Confirmation Progress - Output Transaction */}
                  {transaction.swapMetadata.outboundConfirmations !== undefined && (
                    <Box
                      bg={`${assetColor}05`}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={theme.border}
                    >
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Output Transaction Confirmations
                      </Text>
                      <HStack>
                        <Text color={assetColor} fontSize="lg" fontWeight="bold">
                          {transaction.swapMetadata.outboundConfirmations}
                        </Text>
                        {transaction.swapMetadata.outboundRequiredConfirmations && (
                          <Text color="gray.400" fontSize="sm">
                            / {transaction.swapMetadata.outboundRequiredConfirmations} required
                          </Text>
                        )}
                      </HStack>
                      {transaction.swapMetadata.outboundRequiredConfirmations && (
                        <Box
                          mt={2}
                          h="6px"
                          bg="gray.700"
                          borderRadius="full"
                          overflow="hidden"
                        >
                          <Box
                            h="100%"
                            bg={assetColor}
                            w={`${Math.min(100, (transaction.swapMetadata.outboundConfirmations / transaction.swapMetadata.outboundRequiredConfirmations) * 100)}%`}
                            transition="width 0.3s"
                          />
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Timing Information */}
                  {transaction.swapMetadata.createdAt && (
                    <Grid templateColumns="1fr 1fr" gap={4}>
                      <Box
                        bg={`${assetColor}05`}
                        p={3}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={theme.border}
                      >
                        <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                          Created
                        </Text>
                        <Text color="white" fontSize="xs">
                          {new Date(transaction.swapMetadata.createdAt).toLocaleString()}
                        </Text>
                      </Box>
                      {transaction.swapMetadata.outputDetectedAt && (
                        <Box
                          bg={`${assetColor}05`}
                          p={3}
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor={theme.border}
                        >
                          <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                            Output Detected
                          </Text>
                          <Text color="white" fontSize="xs">
                            {new Date(transaction.swapMetadata.outputDetectedAt).toLocaleString()}
                          </Text>
                        </Box>
                      )}
                    </Grid>
                  )}

                  {/* Inbound Transaction */}
                  {transaction.swapMetadata.inboundTxHash && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Inbound Transaction
                      </Text>
                      <HStack gap={2}>
                        <Code
                          fontSize="xs"
                          fontFamily="mono"
                          color={assetColor}
                          bg={`${assetColor}11`}
                          p={2}
                          borderRadius="md"
                          flex="1"
                          borderWidth="1px"
                          borderColor={`${assetColor}22`}
                        >
                          {transaction.swapMetadata.inboundTxHash}
                        </Code>
                        <Box
                          as="button"
                          onClick={() => copyToClipboard(transaction.swapMetadata.inboundTxHash)}
                          color={assetColor}
                          _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                          p={2}
                          transition="all 0.2s"
                          bg={`${assetColor}11`}
                          borderRadius="md"
                        >
                          <FaCopy size={14} />
                        </Box>
                      </HStack>
                    </Box>
                  )}

                  {/* Outbound Transaction */}
                  {transaction.swapMetadata.outboundTxHash && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Outbound Transaction
                      </Text>
                      <HStack gap={2}>
                        <Code
                          fontSize="xs"
                          fontFamily="mono"
                          color={assetColor}
                          bg={`${assetColor}11`}
                          p={2}
                          borderRadius="md"
                          flex="1"
                          borderWidth="1px"
                          borderColor={`${assetColor}22`}
                        >
                          {transaction.swapMetadata.outboundTxHash}
                        </Code>
                        <Box
                          as="button"
                          onClick={() => copyToClipboard(transaction.swapMetadata.outboundTxHash)}
                          color={assetColor}
                          _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                          p={2}
                          transition="all 0.2s"
                          bg={`${assetColor}11`}
                          borderRadius="md"
                        >
                          <FaCopy size={14} />
                        </Box>
                        {transaction.swapMetadata.integration === 'thorchain' && (
                          <Box
                            as="a"
                            href={`https://viewblock.io/thorchain/tx/${transaction.swapMetadata.outboundTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            color={assetColor}
                            _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                            p={2}
                            transition="all 0.2s"
                            bg={`${assetColor}11`}
                            borderRadius="md"
                          >
                            <FaExternalLinkAlt size={14} />
                          </Box>
                        )}
                      </HStack>
                    </Box>
                  )}

                  {/* Error Information */}
                  {transaction.swapMetadata.error && (
                    <Box
                      bg="red.900"
                      borderWidth="1px"
                      borderColor="red.500"
                      p={4}
                      borderRadius="md"
                    >
                      <HStack mb={2}>
                        <Text fontSize="lg">⚠️</Text>
                        <Text color="red.300" fontSize="sm" fontWeight="bold">
                          {transaction.swapMetadata.error.type || 'Error'}
                        </Text>
                        {transaction.swapMetadata.error.severity && (
                          <Badge
                            colorScheme={transaction.swapMetadata.error.severity === 'ERROR' ? 'red' : 'yellow'}
                            fontSize="xs"
                          >
                            {transaction.swapMetadata.error.severity}
                          </Badge>
                        )}
                      </HStack>
                      {transaction.swapMetadata.error.userMessage && (
                        <Text color="red.200" fontSize="sm" mb={2}>
                          {transaction.swapMetadata.error.userMessage}
                        </Text>
                      )}
                      {transaction.swapMetadata.error.actionable && (
                        <Text color="orange.300" fontSize="xs" fontStyle="italic">
                          💡 {transaction.swapMetadata.error.actionable}
                        </Text>
                      )}
                      {transaction.swapMetadata.error.message && (
                        <Text color="gray.400" fontSize="xs" mt={2} fontFamily="mono">
                          Technical: {transaction.swapMetadata.error.message}
                        </Text>
                      )}
                    </Box>
                  )}

                  {/* Swap Memo */}
                  {transaction.swapMetadata.memo && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Swap Memo
                      </Text>
                      <Code
                        fontSize="xs"
                        fontFamily="mono"
                        color="white"
                        bg={`${assetColor}11`}
                        p={2}
                        borderRadius="md"
                        display="block"
                        borderWidth="1px"
                        borderColor={`${assetColor}22`}
                      >
                        {transaction.swapMetadata.memo}
                      </Code>
                    </Box>
                  )}
                </VStack>
              </Box>
            )}
          </VStack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

export default TransactionDetailDialog;
