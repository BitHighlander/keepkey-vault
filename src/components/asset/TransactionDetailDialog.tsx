'use client'

import React from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Grid,
  Code,
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
  if (!tx) return null;

  const date = formatTransactionDate(tx.timestamp);
  const explorerLink = getExplorerLink(tx, assetContext);

  // Use asset color or fallback to gold
  const assetColor = assetContext?.color || theme.gold;
  const assetColorHover = assetContext?.color ? `${assetContext.color}dd` : theme.goldHover;

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
                  {tx.txid}
                </Code>
                <Box
                  as="button"
                  onClick={() => copyToClipboard(tx.txid)}
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
                  {tx.status || 'unknown'}
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
                  {tx.direction || 'unknown'}
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
                <Text color="white" fontSize="md">{tx.type || 'transfer'}</Text>
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
                  {tx.networkId || tx.caip || 'unknown'}
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
                  {tx.value || '0'}
                </Text>
              </Box>
              {tx.fee && (
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
                    {tx.fee}
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
              {tx.blockHeight && (
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
                    {tx.blockHeight}
                  </Text>
                </Box>
              )}
            </Grid>

            {/* Confirmations */}
            {tx.confirmations !== undefined && (
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
                <Text color="white" fontSize="md">{tx.confirmations}</Text>
              </Box>
            )}

            {/* Addresses */}
            {tx.from && tx.from.length > 0 && (
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
                  {tx.from.map((addr: string, idx: number) => (
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

            {tx.to && tx.to.length > 0 && (
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
                  {tx.to.map((addr: string, idx: number) => (
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
            {tx.memo && (
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
                  {tx.memo}
                </Code>
              </Box>
            )}

            {/* Swap Metadata */}
            {tx.swapMetadata && tx.swapMetadata.isSwap && (
              <Box
                bg={`${assetColor}08`}
                borderRadius="lg"
                borderWidth="2px"
                borderColor={`${assetColor}55`}
                p={5}
              >
                <HStack mb={4}>
                  <Text fontSize="xl">💱</Text>
                  <Text color={assetColor} fontSize="lg" fontWeight="bold">
                    Swap Details
                  </Text>
                </HStack>
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
                        {tx.swapMetadata.fromAsset || 'N/A'}
                      </Text>
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
                        {tx.swapMetadata.toAsset || 'N/A'}
                      </Text>
                    </Box>
                  </Grid>
                  {tx.swapMetadata.protocol && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Protocol
                      </Text>
                      <Text color="white" fontSize="sm">{tx.swapMetadata.protocol}</Text>
                    </Box>
                  )}
                  {tx.swapMetadata.fromAmount && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Amount
                      </Text>
                      <Text color={assetColor} fontSize="md" fontWeight="bold">
                        {tx.swapMetadata.fromAmount}
                      </Text>
                    </Box>
                  )}
                  {tx.swapMetadata.inboundTxHash && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Inbound TX
                      </Text>
                      <Code
                        fontSize="xs"
                        fontFamily="mono"
                        color={assetColor}
                        bg={`${assetColor}11`}
                        p={2}
                        borderRadius="md"
                      >
                        {tx.swapMetadata.inboundTxHash.substring(0, 32)}...
                      </Code>
                    </Box>
                  )}
                  {tx.swapMetadata.outboundTxHash && (
                    <Box>
                      <Text color="gray.400" fontSize="xs" mb={2} fontWeight="medium">
                        Outbound TX
                      </Text>
                      <Code
                        fontSize="xs"
                        fontFamily="mono"
                        color={assetColor}
                        bg={`${assetColor}11`}
                        p={2}
                        borderRadius="md"
                      >
                        {tx.swapMetadata.outboundTxHash.substring(0, 32)}...
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
