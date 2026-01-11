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

            {/* Enhanced Swap Metadata */}
            {tx.swapMetadata && tx.swapMetadata.isSwap && (
              <Box
                bg={`${assetColor}08`}
                borderRadius="lg"
                borderWidth="2px"
                borderColor={`${assetColor}55`}
                p={5}
              >
                <HStack mb={4} justify="space-between">
                  <HStack>
                    <Text fontSize="xl">💱</Text>
                    <Text color={assetColor} fontSize="lg" fontWeight="bold">
                      Swap Details
                    </Text>
                  </HStack>
                  {/* Swap Status Badge */}
                  {tx.swapMetadata.status && (
                    <Badge
                      colorScheme={
                        tx.swapMetadata.status === 'completed' ? 'green' :
                        tx.swapMetadata.status === 'output_confirmed' ? 'green' :
                        tx.swapMetadata.status === 'output_detected' ? 'blue' :
                        tx.swapMetadata.status === 'output_confirming' ? 'blue' :
                        tx.swapMetadata.status === 'confirming' ? 'blue' :
                        tx.swapMetadata.status === 'pending' ? 'yellow' :
                        tx.swapMetadata.status === 'failed' ? 'red' :
                        tx.swapMetadata.status === 'refunded' ? 'orange' :
                        'gray'
                      }
                      fontSize="sm"
                      px={3}
                      py={1}
                    >
                      {tx.swapMetadata.status === 'output_detected' ? '🎯 OUTPUT DETECTED' :
                       tx.swapMetadata.status === 'output_confirming' ? '⏳ CONFIRMING OUTPUT' :
                       tx.swapMetadata.status === 'output_confirmed' ? '✅ OUTPUT CONFIRMED' :
                       tx.swapMetadata.status === 'completed' ? '✅ COMPLETED' :
                       tx.swapMetadata.status === 'confirming' ? '⏳ CONFIRMING' :
                       tx.swapMetadata.status === 'pending' ? '⏳ PENDING' :
                       tx.swapMetadata.status === 'failed' ? '❌ FAILED' :
                       tx.swapMetadata.status === 'refunded' ? '🔄 REFUNDED' :
                       tx.swapMetadata.status?.toUpperCase()}
                    </Badge>
                  )}
                </HStack>

                <VStack gap={4} align="stretch">
                  {/* Asset Pair */}
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
                      {tx.swapMetadata.fromAmount && (
                        <Text color={assetColor} fontSize="xs" mt={1}>
                          {tx.swapMetadata.fromAmount}
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
                        {tx.swapMetadata.toAsset || 'N/A'}
                      </Text>
                      {tx.swapMetadata.toAmount && (
                        <Text color={assetColor} fontSize="xs" mt={1}>
                          {tx.swapMetadata.toAmount}
                        </Text>
                      )}
                    </Box>
                  </Grid>

                  {/* Protocol Integration */}
                  {tx.swapMetadata.integration && (
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
                        {tx.swapMetadata.integration === 'thorchain' ? 'THORChain' :
                         tx.swapMetadata.integration === 'mayachain' ? 'Maya Protocol' :
                         tx.swapMetadata.integration}
                      </Text>
                    </Box>
                  )}

                  {/* Confirmation Progress - Input Transaction */}
                  {tx.swapMetadata.confirmations !== undefined && (
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
                        {tx.swapMetadata.confirmations} confirmations
                      </Text>
                    </Box>
                  )}

                  {/* Confirmation Progress - Output Transaction */}
                  {tx.swapMetadata.outboundConfirmations !== undefined && (
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
                          {tx.swapMetadata.outboundConfirmations}
                        </Text>
                        {tx.swapMetadata.outboundRequiredConfirmations && (
                          <Text color="gray.400" fontSize="sm">
                            / {tx.swapMetadata.outboundRequiredConfirmations} required
                          </Text>
                        )}
                      </HStack>
                      {tx.swapMetadata.outboundRequiredConfirmations && (
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
                            w={`${Math.min(100, (tx.swapMetadata.outboundConfirmations / tx.swapMetadata.outboundRequiredConfirmations) * 100)}%`}
                            transition="width 0.3s"
                          />
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Timing Information */}
                  {tx.swapMetadata.createdAt && (
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
                          {new Date(tx.swapMetadata.createdAt).toLocaleString()}
                        </Text>
                      </Box>
                      {tx.swapMetadata.outputDetectedAt && (
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
                            {new Date(tx.swapMetadata.outputDetectedAt).toLocaleString()}
                          </Text>
                        </Box>
                      )}
                    </Grid>
                  )}

                  {/* Inbound Transaction */}
                  {tx.swapMetadata.inboundTxHash && (
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
                          {tx.swapMetadata.inboundTxHash}
                        </Code>
                        <Box
                          as="button"
                          onClick={() => copyToClipboard(tx.swapMetadata.inboundTxHash)}
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
                  {tx.swapMetadata.outboundTxHash && (
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
                          {tx.swapMetadata.outboundTxHash}
                        </Code>
                        <Box
                          as="button"
                          onClick={() => copyToClipboard(tx.swapMetadata.outboundTxHash)}
                          color={assetColor}
                          _hover={{ color: assetColorHover, transform: 'scale(1.1)' }}
                          p={2}
                          transition="all 0.2s"
                          bg={`${assetColor}11`}
                          borderRadius="md"
                        >
                          <FaCopy size={14} />
                        </Box>
                        {tx.swapMetadata.integration === 'thorchain' && (
                          <Box
                            as="a"
                            href={`https://viewblock.io/thorchain/tx/${tx.swapMetadata.outboundTxHash}`}
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
                  {tx.swapMetadata.error && (
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
                          {tx.swapMetadata.error.type || 'Error'}
                        </Text>
                        {tx.swapMetadata.error.severity && (
                          <Badge
                            colorScheme={tx.swapMetadata.error.severity === 'ERROR' ? 'red' : 'yellow'}
                            fontSize="xs"
                          >
                            {tx.swapMetadata.error.severity}
                          </Badge>
                        )}
                      </HStack>
                      {tx.swapMetadata.error.userMessage && (
                        <Text color="red.200" fontSize="sm" mb={2}>
                          {tx.swapMetadata.error.userMessage}
                        </Text>
                      )}
                      {tx.swapMetadata.error.actionable && (
                        <Text color="orange.300" fontSize="xs" fontStyle="italic">
                          💡 {tx.swapMetadata.error.actionable}
                        </Text>
                      )}
                      {tx.swapMetadata.error.message && (
                        <Text color="gray.400" fontSize="xs" mt={2} fontFamily="mono">
                          Technical: {tx.swapMetadata.error.message}
                        </Text>
                      )}
                    </Box>
                  )}

                  {/* Swap Memo */}
                  {tx.swapMetadata.memo && (
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
                        {tx.swapMetadata.memo}
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
