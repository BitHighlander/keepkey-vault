/**
 * SwapProgressSteps Component
 *
 * Main progress wrapper with automatic progression and timing focus
 * Replaces the separate StageIndicator components with a unified interface
 */

import { useState } from 'react';
import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FaCheckCircle } from 'react-icons/fa';
import { SwapHeader } from './SwapHeader';
import { TimingDisplay } from './TimingDisplay';
import { SuccessView } from './SuccessView';
import { getStageIcon, getStageDescription } from './swap-timing-utils';

// Keyframe animations for active step
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 20px 8px rgba(139, 92, 246, 0.4);
    transform: scale(1.05);
  }
`;

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

interface Asset {
  caip: string;
  symbol: string;
  amount?: string;
}

interface TimingData {
  elapsedSeconds: number;
  expectedTotalSeconds?: number;
  currentStage?: string;
  stageElapsedSeconds?: number;
  stageExpectedSeconds?: number;
  ratio?: string;
  remainingSeconds?: number;
  remainingFormatted?: string;
  reassuranceMessage?: string;
  usingDefaults?: boolean;
}

interface ThorchainData {
  outboundTxHash?: string;
}

interface SwapStatus {
  currentStage: number;
  status: string;
  confirmations?: number;
  requiredConfirmations?: number;
  outboundConfirmations?: number;
  outboundRequiredConfirmations?: number;
  timingData?: TimingData;
  thorchainData?: ThorchainData;
  error?: any;
}

interface SwapProgressStepsProps {
  swapStatus: SwapStatus;
  fromAsset: Asset;
  toAsset: Asset;
  onClose: () => void;
}

// Define the 3 swap stages
const steps = [
  {
    title: 'Input Transaction',
    stage: 1,
    icon: '↗',
    description: 'Confirming your transaction'
  },
  {
    title: 'Protocol Processing',
    stage: 2,
    icon: '⚡',
    description: 'Processing swap via THORChain'
  },
  {
    title: 'Output Transaction',
    stage: 3,
    icon: '↙',
    description: 'Receiving your assets'
  },
];

export function SwapProgressSteps({
  swapStatus,
  fromAsset,
  toAsset,
  onClose
}: SwapProgressStepsProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  // Convert to 0-indexed for Chakra Steps (stages 1-3 → 0-2)
  const currentStep = swapStatus.currentStage - 1;

  // Determine if swap is complete
  const isComplete = swapStatus.status === 'completed';

  return (
    <VStack width="full" align="stretch" gap={6} p={4}>
      {/* Header with asset info and close button */}
      <SwapHeader
        fromAsset={fromAsset}
        toAsset={toAsset}
        onClose={onClose}
      />

      {/* Steps progress bar */}
      <HStack justify="space-between" position="relative" px={4}>
        {steps.map((step, index) => (
          <VStack key={index} flex={1} gap={2} position="relative">
            {/* Step indicator */}
            <Box
              width="40px"
              height="40px"
              borderRadius="full"
              bg={index < currentStep ? 'green.500' : index === currentStep ? 'purple.500' : 'gray.700'}
              borderWidth="2px"
              borderColor={index < currentStep ? 'green.400' : index === currentStep ? 'purple.400' : 'gray.600'}
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontSize="xl"
              fontWeight="bold"
              color="white"
              transition="all 0.3s"
              animation={index === currentStep ? `${pulseGlow} 2s ease-in-out infinite` : undefined}
              position="relative"
              _before={index === currentStep ? {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100%',
                height: '100%',
                borderRadius: 'full',
                border: '2px solid',
                borderColor: 'purple.400',
                transform: 'translate(-50%, -50%)',
                animation: `${pulseGlow} 2s ease-in-out infinite`,
                zIndex: -1
              } : undefined}
            >
              {index < currentStep ? <FaCheckCircle /> : <Text>{step.icon}</Text>}
            </Box>

            {/* Step title */}
            <Text
              fontSize="sm"
              fontWeight={index === currentStep ? 'bold' : 'normal'}
              color={index < currentStep ? 'green.400' : index === currentStep ? 'purple.400' : 'gray.500'}
              textAlign="center"
            >
              {step.title}
            </Text>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <Box
                position="absolute"
                top="20px"
                left="50%"
                width="full"
                height="2px"
                bg={index < currentStep ? 'green.500' : 'gray.700'}
                zIndex={-1}
              />
            )}
          </VStack>
        ))}
      </HStack>

      {/* Active step content with timing display */}
      {!isComplete && (
        <TimingDisplay
          timingData={swapStatus.timingData}
          stage={swapStatus.currentStage as 1 | 2 | 3}
          confirmations={
            swapStatus.currentStage === 1
              ? swapStatus.confirmations
              : swapStatus.currentStage === 3
              ? swapStatus.outboundConfirmations
              : undefined
          }
          requiredConfirmations={
            swapStatus.currentStage === 1
              ? swapStatus.requiredConfirmations
              : swapStatus.currentStage === 3
              ? swapStatus.outboundRequiredConfirmations
              : undefined
          }
          isExpanded={expandedStage === currentStep}
          onToggleExpand={() => setExpandedStage(
            expandedStage === currentStep ? null : currentStep
          )}
        />
      )}

      {/* Completion state */}
      {isComplete && (
        <SuccessView
          swapStatus={swapStatus}
          fromAsset={fromAsset}
          toAsset={toAsset}
        />
      )}
    </VStack>
  );
}
