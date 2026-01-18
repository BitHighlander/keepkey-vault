/**
 * SuccessView Component
 *
 * Celebration view displayed when swap completes successfully
 */

import { VStack, Box, Text, Link, Code } from '@chakra-ui/react';
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
    <VStack gap={6} py={8}>

      <VStack gap={2}>
        <Text fontSize="6xl">🎉</Text>
        <Text fontSize="2xl" fontWeight="bold" color="green.400">
          Swap Complete!
        </Text>
        <Text fontSize="sm" color="gray.400">
          Your {toAsset.symbol} has been received
        </Text>
      </VStack>

      {swapStatus.timingData && (
        <Box
          bg="gray.900"
          p={4}
          borderRadius="md"
          border="1px solid"
          borderColor="green.700"
          w="full"
          maxW="300px"
        >
          <VStack gap={2}>
            <Text fontSize="sm" color="gray.400">
              Total Time
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {formatTime(swapStatus.timingData.elapsedSeconds)}
            </Text>
            {swapStatus.timingData.expectedTotalSeconds && (
              <Text fontSize="xs" color="gray.500">
                Expected: {formatTime(swapStatus.timingData.expectedTotalSeconds)}
              </Text>
            )}
          </VStack>
        </Box>
      )}

      {/* Transaction IDs - Main Focus */}
      <Box
        bg="gray.800"
        borderRadius="md"
        p={4}
        border="1px solid"
        borderColor="green.700"
        w="full"
      >
        <VStack gap={3} align="stretch">
          {/* Input Transaction */}
          {inboundTx && (
            <Box>
              <Text fontSize="xs" color="gray.400" mb={1} fontWeight="medium">
                Input Transaction
              </Text>
              <Code
                fontSize="xs"
                bg="gray.900"
                color="teal.300"
                p={2}
                borderRadius="md"
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
              <Text fontSize="xs" color="gray.400" mb={1} fontWeight="medium">
                Output Transaction
              </Text>
              <Code
                fontSize="xs"
                bg="gray.900"
                color="green.300"
                p={2}
                borderRadius="md"
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
  );
}
