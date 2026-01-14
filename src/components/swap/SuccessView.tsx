/**
 * SuccessView Component
 *
 * Celebration view displayed when swap completes successfully
 */

import { useState, useEffect } from 'react';
import { VStack, Box, Text, Link } from '@chakra-ui/react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import Confetti from 'react-confetti';
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
}

interface SwapStatus {
  timingData?: TimingData;
  thorchainData?: ThorchainData;
}

interface SuccessViewProps {
  swapStatus: SwapStatus;
  fromAsset: Asset;
  toAsset: Asset;
}

export function SuccessView({ swapStatus, fromAsset, toAsset }: SuccessViewProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <VStack spacing={6} py={8}>
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={200}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      )}

      <VStack spacing={2}>
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
          <VStack spacing={2}>
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

      {swapStatus.thorchainData?.outboundTxHash && (
        <Link
          href={`https://runescan.io/tx/${swapStatus.thorchainData.outboundTxHash}`}
          isExternal
          color="purple.400"
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
