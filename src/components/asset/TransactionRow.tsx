'use client'

import React from 'react';
import { Box, Text, Badge, Grid, Link } from '@chakra-ui/react';
import {
  formatTransactionValue,
  formatTransactionDate,
  getTypeColorScheme,
  getDirectionColorScheme,
  getStatusColorScheme,
  formatTxIdMiddleEllipsis,
  getBlockExplorerUrl,
} from '@/utils/transactionUtils';

interface TransactionRowProps {
  transaction: any;
  onClick: (tx: any) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onClick }) => {
  const formattedValue = formatTransactionValue(
    transaction.value || '0',
    transaction.networkId,
    transaction.type
  );
  const date = formatTransactionDate(transaction.timestamp);

  const typeColor = getTypeColorScheme(transaction.type);
  const directionColor = getDirectionColorScheme(transaction.direction);
  const statusColor = getStatusColorScheme(transaction.status);

  const formattedTxId = formatTxIdMiddleEllipsis(transaction.txid, 6, 4);
  const explorerUrl = getBlockExplorerUrl(transaction.txid, transaction.networkId);

  return (
    <Grid
      templateColumns="2fr 1.5fr 1fr 1fr 1.5fr 2fr"
      gap={3}
      p={3}
      bg="rgba(17, 17, 17, 0.6)"
      borderRadius="md"
      cursor="pointer"
      borderWidth="1px"
      borderColor="rgba(255, 215, 0, 0.1)"
      _hover={{
        bg: 'rgba(255, 215, 0, 0.15)',
        borderColor: 'rgba(255, 215, 0, 0.3)',
        transform: 'translateX(2px)',
      }}
      transition="all 0.2s"
      alignItems="center"
      onClick={() => onClick(transaction)}
    >
      {explorerUrl ? (
        <Link
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          color="gray.300"
          fontFamily="mono"
          fontSize="xs"
          _hover={{ color: '#FFD700', textDecoration: 'underline' }}
          onClick={(e) => e.stopPropagation()}
        >
          {formattedTxId}
        </Link>
      ) : (
        <Text color="gray.300" fontFamily="mono" fontSize="xs" isTruncated>
          {formattedTxId}
        </Text>
      )}
      <Box>
        <Badge colorPalette={typeColor} fontSize="xs" variant="subtle">
          {transaction.type}
        </Badge>
      </Box>
      <Box>
        <Badge colorPalette={directionColor} fontSize="xs" variant="subtle">
          {transaction.direction}
        </Badge>
      </Box>
      <Box>
        <Badge colorPalette={statusColor} fontSize="xs" variant="subtle">
          {transaction.status}
        </Badge>
      </Box>
      <Text color="white" fontFamily="mono" fontSize="xs" textAlign="right" fontWeight="semibold">
        {formattedValue}
      </Text>
      <Text color="gray.400" fontSize="xs">
        {date}
      </Text>
    </Grid>
  );
};
