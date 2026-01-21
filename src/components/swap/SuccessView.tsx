/**
 * SuccessView Component
 *
 * Celebration view displayed when swap completes successfully
 */

import { VStack, HStack, Box, Text, Link, Code } from '@chakra-ui/react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { formatTime } from './swap-timing-utils';

interface Asset {
  symbol: string;
}

interface TimingData {
  elapsedSeconds: number;
  expectedTotalSeconds?: number;
}

interface ThorchainData {
  outboundTxHash?: string;
  inboundTxHash?: string;
}

interface SwapStatus {
  timingData?: TimingData;
  thorchainData?: ThorchainData;
}

interface SuccessViewProps {
  swapStatus: SwapStatus;
  fromAsset: Asset;
  toAsset: Asset;
  inputTxHash?: string;
}

export function SuccessView({ swapStatus, fromAsset, toAsset, inputTxHash }: SuccessViewProps) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[SuccessView] 🎉 SUCCESS VIEW RENDERED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[SuccessView] Swap Status:', swapStatus);
  console.log('[SuccessView] From Asset:', fromAsset.symbol);
  console.log('[SuccessView] To Asset:', toAsset.symbol);
  console.log('[SuccessView] Input Tx Hash:', inputTxHash);

  // Get transaction hashes
  const inboundTx = swapStatus.thorchainData?.inboundTxHash || inputTxHash;
  const outboundTx = swapStatus.thorchainData?.outboundTxHash;

  console.log('[SuccessView] Inbound Tx:', inboundTx);
  console.log('[SuccessView] Outbound Tx:', outboundTx);

  // Validation
  if (!outboundTx) {
    console.error('[SuccessView] ❌ VALIDATION WARNING: No outbound tx hash available');
    console.error('[SuccessView] ThorchainData:', swapStatus.thorchainData);
  }

  if (!swapStatus.timingData) {
    console.warn('[SuccessView] ⚠️ No timing data available for completed swap');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return (
    <>
      <style>
        {`
          @keyframes pulseZoom {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `}
      </style>
      <VStack gap={3} py={4}>

        {/* Compact Celebration Header */}
        <HStack
          bg="rgba(16, 185, 129, 0.1)"
          border="2px solid"
          borderColor="green.500"
          borderRadius="lg"
          p={3}
          boxShadow="0 0 20px rgba(16, 185, 129, 0.3)"
          style={{
            animation: 'pulseZoom 2s ease-in-out infinite',
          }}
          justify="center"
          gap={3}
        >
          <Text fontSize="2xl">🎉</Text>
          <VStack gap={0} align="start">
            <Text fontSize="lg" fontWeight="bold" color="green.400">
              Swap Complete!
            </Text>
            <Text fontSize="xs" color="gray.400">
              Your {toAsset.symbol} has been received
            </Text>
          </VStack>
        </HStack>

        {/* Compact timing and transaction info */}
        <HStack gap={3} width="full">
          {/* Timing display */}
          {swapStatus.timingData && (
            <Box
              bg="gray.900"
              p={2}
              borderRadius="md"
              border="1px solid"
              borderColor="green.700"
              flex={1}
            >
              <VStack gap={0}>
                <Text fontSize="sm" fontWeight="bold">
                  {formatTime(swapStatus.timingData.elapsedSeconds)}
                </Text>
                <Text fontSize="2xs" color="gray.500">
                  Total Time
                </Text>
              </VStack>
            </Box>
          )}

          {/* Transaction count */}
          <Box
            bg="gray.900"
            p={2}
            borderRadius="md"
            border="1px solid"
            borderColor="green.700"
            flex={1}
          >
            <VStack gap={0}>
              <Text fontSize="sm" fontWeight="bold" color="green.400">
                {(inboundTx ? 1 : 0) + (outboundTx ? 1 : 0)}
              </Text>
              <Text fontSize="2xs" color="gray.500">
                Transactions
              </Text>
            </VStack>
          </Box>
        </HStack>

        {/* Compact Transaction IDs */}
        <Box
          bg="gray.800"
          borderRadius="md"
          p={2}
          border="1px solid"
          borderColor="green.700"
          w="full"
        >
          <VStack gap={2} align="stretch">
            {/* Input Transaction */}
            {inboundTx && (
              <Box>
                <Text fontSize="2xs" color="gray.400" mb={1} fontWeight="medium">
                  Input Transaction
                </Text>
                <Code
                  fontSize="2xs"
                  bg="gray.900"
                  color="teal.300"
                  p={1}
                  borderRadius="sm"
                  display="block"
                  wordBreak="break-all"
                >
                  {inboundTx}
                </Code>
              </Box>
            )}

            {/* Output Transaction */}
            {outboundTx && (
              <Box>
                <Text fontSize="2xs" color="gray.400" mb={1} fontWeight="medium">
                  Output Transaction
                </Text>
                <Code
                  fontSize="2xs"
                  bg="gray.900"
                  color="green.300"
                  p={1}
                  borderRadius="sm"
                  display="block"
                  wordBreak="break-all"
                >
                  {outboundTx}
                </Code>
              </Box>
            )}
          </VStack>
        </Box>

      {swapStatus.thorchainData?.outboundTxHash && (
        <Link
          href={`https://runescan.io/tx/${swapStatus.thorchainData.outboundTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          color="teal.400"
          fontSize="sm"
          display="flex"
          alignItems="center"
          gap={1}
        >
          View on Explorer <FaExternalLinkAlt />
        </Link>
      )}
      </VStack>
    </>
  );
}
