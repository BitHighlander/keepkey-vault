/**
 * SwapProgressSteps Component
 *
 * Main progress wrapper with automatic progression and timing focus
 * Replaces the separate StageIndicator components with a unified interface
 */

import { useState } from 'react';
import { Box, VStack, HStack, Text, Button } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FaCheckCircle, FaArrowUp, FaBolt, FaArrowDown, FaSync } from 'react-icons/fa';
import { SwapHeader } from './SwapHeader';
import { TimingDisplay } from './TimingDisplay';
import { SuccessView } from './SuccessView';
import { getStageIcon, getStageDescription } from './swap-timing-utils';

// Keyframe animations for active step
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(0, 220, 130, 0.7);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 20px 8px rgba(0, 220, 130, 0.4);
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
  inboundTxHash?: string;
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
  inputTxHash?: string;
  onClose: () => void;
  onForceRefresh?: () => Promise<void>;
}

// Define the 3 swap stages
const steps = [
  {
    title: 'Input Transaction',
    stage: 1,
    Icon: FaArrowUp,
    description: 'Confirming your transaction'
  },
  {
    title: 'Protocol Processing',
    stage: 2,
    Icon: FaBolt,
    description: 'Processing swap via THORChain'
  },
  {
    title: 'Output Transaction',
    stage: 3,
    Icon: FaArrowDown,
    description: 'Receiving your assets'
  },
];

export function SwapProgressSteps({
  swapStatus,
  fromAsset,
  toAsset,
  inputTxHash,
  onClose,
  onForceRefresh
}: SwapProgressStepsProps) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Convert to 0-indexed for Chakra Steps (stages 1-3 → 0-2)
  const currentStep = swapStatus.currentStage - 1;

  // Determine if swap is complete
  const isComplete = swapStatus.status === 'completed' || swapStatus.status === 'output_confirmed';

  // VALIDATION LOGGING
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[SwapProgressSteps] 🎨 RENDER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[SwapProgressSteps] Status:', swapStatus.status);
  console.log('[SwapProgressSteps] Current Stage:', swapStatus.currentStage);
  console.log('[SwapProgressSteps] Current Step (0-indexed):', currentStep);
  console.log('[SwapProgressSteps] Is Complete:', isComplete);
  console.log('[SwapProgressSteps] Confirmations:', swapStatus.confirmations, '/', swapStatus.requiredConfirmations);
  console.log('[SwapProgressSteps] Outbound Confirmations:', swapStatus.outboundConfirmations, '/', swapStatus.outboundRequiredConfirmations);

  // Validation checks
  if (!swapStatus.status) {
    console.error('[SwapProgressSteps] ❌ VALIDATION FAILED: No status provided');
  }

  if (!swapStatus.currentStage || swapStatus.currentStage < 1 || swapStatus.currentStage > 3) {
    console.error('[SwapProgressSteps] ❌ VALIDATION FAILED: Invalid currentStage:', swapStatus.currentStage);
  }

  if (swapStatus.status === 'completed' && !isComplete) {
    console.error('[SwapProgressSteps] ❌ LOGIC ERROR: Status is completed but isComplete is false');
  }

  if (swapStatus.status === 'output_confirmed' && !isComplete) {
    console.error('[SwapProgressSteps] ❌ LOGIC ERROR: Status is output_confirmed but isComplete is false');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Handle force refresh
  const handleForceRefresh = async () => {
    if (!onForceRefresh) return;

    console.log('🔄 [SwapProgressSteps] Force refresh triggered by user');
    setIsRefreshing(true);
    try {
      await onForceRefresh();
      console.log('✅ [SwapProgressSteps] Force refresh completed');
    } catch (err) {
      console.error('❌ [SwapProgressSteps] Force refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <VStack width="full" align="stretch" gap={6} p={4}>
      {/* Header with asset info and close button */}
      <SwapHeader
        fromAsset={fromAsset}
        toAsset={toAsset}
        onClose={onClose}
      />

      {/* Force Refresh Button - For debugging */}
      {onForceRefresh && !isComplete && (
        <HStack justify="center">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FaSync />}
            onClick={handleForceRefresh}
            isLoading={isRefreshing}
            loadingText="Checking..."
            colorScheme="teal"
            borderColor="teal.500"
            _hover={{ bg: 'teal.900', borderColor: 'teal.400' }}
          >
            Force Refresh Status
          </Button>
        </HStack>
      )}

      {/* Steps progress bar */}
      <HStack justify="space-between" position="relative" px={4}>
        {steps.map((step, index) => {
          const StepIcon = step.Icon;
          // When complete, show all steps as checked
          const isStepComplete = isComplete ? true : index < currentStep;
          const isStepActive = !isComplete && index === currentStep;

          return (
            <VStack key={index} flex={1} gap={2} position="relative">
              {/* Step indicator */}
              <Box
                width="40px"
                height="40px"
                borderRadius="full"
                bg={isStepComplete ? 'green.500' : isStepActive ? 'teal.500' : 'gray.700'}
                borderWidth="2px"
                borderColor={isStepComplete ? 'green.400' : isStepActive ? 'teal.400' : 'gray.600'}
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="lg"
                fontWeight="bold"
                color="white"
                transition="all 0.3s"
                animation={isStepActive ? `${pulseGlow} 2s ease-in-out infinite` : undefined}
                position="relative"
              >
                {isStepComplete ? <FaCheckCircle /> : <StepIcon />}
              </Box>

            {/* Step title */}
            <Text
              fontSize="sm"
              fontWeight={isStepActive ? 'bold' : 'normal'}
              color={isStepComplete ? 'green.400' : isStepActive ? 'teal.400' : 'gray.500'}
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
                bg={isComplete || index < currentStep ? 'green.500' : 'gray.700'}
                zIndex={-1}
              />
            )}
          </VStack>
        );
        })}
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
          inputTxHash={inputTxHash}
          thorchainData={swapStatus.thorchainData}
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
          inputTxHash={inputTxHash}
        />
      )}
    </VStack>
  );
}
