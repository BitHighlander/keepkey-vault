'use client'

import React from 'react';
import { Text, Badge, Grid, HStack, Box, Link } from '@chakra-ui/react';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { AssetIcon } from '@/components/ui/AssetIcon';
import {
  extractAssetSymbolFromCAIP,
  extractNetworkIdFromCAIP,
  getSwapStatusColorScheme,
  formatTxIdMiddleEllipsis,
  getBlockExplorerUrl,
  formatDetailedRelativeTime,
} from '@/utils/transactionUtils';

interface SwapTransactionRowProps {
  transaction: any;
  status: string;
  fromIconUrl?: string;
  toIconUrl?: string;
  onClick: (tx: any) => void;
}

export const SwapTransactionRow: React.FC<SwapTransactionRowProps> = ({
  transaction,
  status,
  fromIconUrl,
  toIconUrl,
  onClick,
}) => {
  const meta = transaction.swapMetadata;

  // Extract asset info - fromAsset/toAsset might be CAIP strings or symbols
  const rawFromAsset = meta.fromAsset || '';
  const rawToAsset = meta.toAsset || '';

  // Check if fromAsset/toAsset are CAIP strings (contain ':' or '/')
  const isFromAssetCAIP = rawFromAsset.includes(':') || rawFromAsset.includes('/');
  const isToAssetCAIP = rawToAsset.includes(':') || rawToAsset.includes('/');

  const fromAssetDisplay = isFromAssetCAIP
    ? extractAssetSymbolFromCAIP(rawFromAsset)
    : rawFromAsset || 'UNKNOWN';
  const toAssetDisplay = isToAssetCAIP ? extractAssetSymbolFromCAIP(rawToAsset) : rawToAsset || 'UNKNOWN';

  const fromNetworkId = isFromAssetCAIP ? extractNetworkIdFromCAIP(rawFromAsset) : null;
  const toNetworkId = isToAssetCAIP ? extractNetworkIdFromCAIP(rawToAsset) : null;

  // Get timestamp - prefer transaction.timestamp, fallback to swapMetadata.createdAt
  const timestamp = transaction.timestamp || meta.createdAt;
  const relativeTime = timestamp ? formatDetailedRelativeTime(timestamp) : 'Unknown';

  return (
    <Grid
      templateColumns="1.5fr 1.5fr 1fr 1fr 1fr 1.5fr 1.5fr 1.5fr"
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
      {/* From Asset with Icon */}
      <HStack gap={2}>
        <AssetIcon
          src={fromIconUrl}
          caip={rawFromAsset || undefined}
          symbol={fromAssetDisplay}
          alt={fromAssetDisplay}
          boxSize="24px"
        />
        <Text color="white" fontSize="xs" fontWeight="medium" truncate>
          {fromAssetDisplay}
        </Text>
      </HStack>

      {/* To Asset with Icon */}
      <HStack gap={2}>
        <AssetIcon
          src={toIconUrl}
          caip={rawToAsset || undefined}
          symbol={toAssetDisplay}
          alt={toAssetDisplay}
          boxSize="24px"
        />
        <Text color="white" fontSize="xs" fontWeight="medium" truncate>
          {toAssetDisplay}
        </Text>
      </HStack>

      {/* Protocol */}
      <Badge colorPalette="teal" fontSize="xs" variant="subtle">
        {meta.protocol || 'unknown'}
      </Badge>

      {/* Status */}
      <Badge colorPalette={getSwapStatusColorScheme(status)} fontSize="xs" variant="subtle">
        <HStack gap={1}>
          {status === 'COMPLETED' && <FaCheckCircle size={10} />}
          {status === 'FAILED' && <FaExclamationTriangle size={10} />}
          <Text>{meta.status || 'UNKNOWN'}</Text>
        </HStack>
      </Badge>

      {/* Amount */}
      <Text color="white" fontSize="xs" fontFamily="mono" truncate fontWeight="semibold">
        {meta.fromAmount || 'N/A'}
      </Text>

      {/* Inbound TxID */}
      {(() => {
        const inboundTxHash = meta.inboundTxHash || transaction.txid;
        const formattedInbound = formatTxIdMiddleEllipsis(inboundTxHash, 6, 4);
        const inboundNetworkId = fromNetworkId || transaction.networkId;
        const inboundUrl = getBlockExplorerUrl(inboundTxHash, inboundNetworkId);

        return inboundUrl ? (
          <Link
            href={inboundUrl}
            target="_blank"
            rel="noopener noreferrer"
            color="gray.400"
            fontFamily="mono"
            fontSize="xs"
            _hover={{ color: '#FFD700', textDecoration: 'underline' }}
            onClick={(e) => e.stopPropagation()}
          >
            {formattedInbound}
          </Link>
        ) : (
          <Text color="gray.400" fontSize="xs" fontFamily="mono" truncate>
            {formattedInbound}
          </Text>
        );
      })()}

      {/* Outbound TxID */}
      {(() => {
        if (!meta.outboundTxHash) {
          return (
            <Text color="gray.400" fontSize="xs" fontFamily="mono">
              -
            </Text>
          );
        }

        const formattedOutbound = formatTxIdMiddleEllipsis(meta.outboundTxHash, 6, 4);
        const outboundNetworkId = toNetworkId || transaction.networkId;
        const outboundUrl = getBlockExplorerUrl(meta.outboundTxHash, outboundNetworkId);

        return outboundUrl ? (
          <Link
            href={outboundUrl}
            target="_blank"
            rel="noopener noreferrer"
            color="gray.400"
            fontFamily="mono"
            fontSize="xs"
            _hover={{ color: '#FFD700', textDecoration: 'underline' }}
            onClick={(e) => e.stopPropagation()}
          >
            {formattedOutbound}
          </Link>
        ) : (
          <Text color="gray.400" fontSize="xs" fontFamily="mono" truncate>
            {formattedOutbound}
          </Text>
        );
      })()}

      {/* Date */}
      <Text color="gray.400" fontSize="xs">
        {relativeTime}
      </Text>
    </Grid>
  );
};
