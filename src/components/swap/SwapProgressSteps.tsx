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
    box-shadow: 0 4px 14px rgba(20, 184, 166, 0.5), 0 0 0 0 rgba(20, 184, 166, 0.7), inset 0 -2px 10px rgba(0, 0, 0, 0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 4px 20px rgba(20, 184, 166, 0.6), 0 0 25px 10px rgba(20, 184, 166, 0.5), inset 0 -2px 10px rgba(0, 0, 0, 0.3);
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
  // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // console.log('[SwapProgressSteps] 🎨 RENDER');
  // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // console.log('[SwapProgressSteps] Status:', swapStatus.status);
  // console.log('[SwapProgressSteps] Current Stage:', swapStatus.currentStage);
  // console.log('[SwapProgressSteps] Current Step (0-indexed):', currentStep);
  // console.log('[SwapProgressSteps] Is Complete:', isComplete);
  // console.log('[SwapProgressSteps] Confirmations:', swapStatus.confirmations, '/', swapStatus.requiredConfirmations);
  // console.log('[SwapProgressSteps] Outbound Confirmations:', swapStatus.outboundConfirmations, '/', swapStatus.outboundRequiredConfirmations);

  // Validation checks
  // if (!swapStatus.status) {
  //   console.error('[SwapProgressSteps] ❌ VALIDATION FAILED: No status provided');
  // }

  // if (!swapStatus.currentStage || swapStatus.currentStage < 1 || swapStatus.currentStage > 3) {
  //   console.error('[SwapProgressSteps] ❌ VALIDATION FAILED: Invalid currentStage:', swapStatus.currentStage);
  // }

  // if (swapStatus.status === 'completed' && !isComplete) {
  //   console.error('[SwapProgressSteps] ❌ LOGIC ERROR: Status is completed but isComplete is false');
  // }

  // if (swapStatus.status === 'output_confirmed' && !isComplete) {
  //   console.error('[SwapProgressSteps] ❌ LOGIC ERROR: Status is output_confirmed but isComplete is false');
  // }

  // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
        confirmations={swapStatus.confirmations}
        requiredConfirmations={swapStatus.requiredConfirmations}
        onClose={onClose}
        onForceRefresh={onForceRefresh}
        isRefreshing={isRefreshing}
        isComplete={isComplete}
      />


      {/* Steps progress bar */}
      <HStack justify="space-between" position="relative" px={4}>
        {steps.map((step, index) => {
          const StepIcon = step.Icon;
          // When complete, show all steps as checked
          const isStepComplete = isComplete ? true : index < currentStep;
          const isStepActive = !isComplete && index === currentStep;

          // Step colors
          const stepColors = {
            complete: {
              bg: 'linear-gradient(135deg, #10B981, #059669)',
              border: '#10B981',
              glow: 'rgba(16, 185, 129, 0.5)'
            },
            active: {
              bg: 'linear-gradient(135deg, #14B8A6, #0D9488)',
              border: '#14B8A6',
              glow: 'rgba(20, 184, 166, 0.5)'
            },
            pending: {
              bg: 'linear-gradient(135deg, #374151, #1F2937)',
              border: '#4B5563',
              glow: 'rgba(75, 85, 99, 0.3)'
            }
          };

          const currentColors = isStepComplete ? stepColors.complete : isStepActive ? stepColors.active : stepColors.pending;

          return (
            <VStack key={index} flex={1} gap={2} position="relative">
              {/* Step indicator */}
              <Box
                width="50px"
                height="50px"
                borderRadius="full"
                background={currentColors.bg}
                borderWidth="3px"
                borderColor={currentColors.border}
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="xl"
                fontWeight="bold"
                color="white"
                transition="all 0.3s"
                animation={isStepActive ? `${pulseGlow} 2s ease-in-out infinite` : undefined}
                position="relative"
                boxShadow={`0 4px 14px ${currentColors.glow}, inset 0 -2px 10px rgba(0, 0, 0, 0.3)`}
              >
                {isStepComplete ? <FaCheckCircle /> : <StepIcon />}
              </Box>

            {/* Step title */}
            <Text
              fontSize="sm"
              fontWeight={isStepActive ? 'bold' : 'medium'}
              color={isStepComplete ? '#10B981' : isStepActive ? '#14B8A6' : '#9CA3AF'}
              textAlign="center"
            >
              {step.title}
            </Text>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <Box
                position="absolute"
                top="25px"
                left="50%"
                width="full"
                height="3px"
                background={
                  isComplete || index < currentStep
                    ? 'linear-gradient(90deg, #10B981, #059669)'
                    : 'linear-gradient(90deg, #374151, #1F2937)'
                }
                zIndex={-1}
                boxShadow={
                  isComplete || index < currentStep
                    ? '0 0 10px rgba(16, 185, 129, 0.4)'
                    : 'none'
                }
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
