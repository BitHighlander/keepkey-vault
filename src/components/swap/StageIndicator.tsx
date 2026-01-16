'use client'

import React from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Progress,
  Circle,
  Image
} from '@chakra-ui/react';
import { FaCheckCircle, FaClock } from 'react-icons/fa';
import { Spinner } from '@chakra-ui/react';

interface StageIndicatorProps {
  stage: 1 | 2 | 3;
  title: string;
  subtitle?: string;
  status: 'pending' | 'active' | 'complete';
  confirmations?: number;
  requiredConfirmations?: number;
  icon?: string;
  caip?: string;
  integration?: 'thorchain' | 'mayachain';
  reassuranceMessage?: string;
}

// Estimate time remaining based on confirmations
const getEstimatedTime = (
  stage: 1 | 2 | 3,
  confirmations?: number,
  requiredConfirmations?: number
): string => {
  if (stage === 2) {
    // Protocol processing stage
    return '~10-20 minutes';
  }

  if (confirmations !== undefined && requiredConfirmations !== undefined) {
    const remaining = requiredConfirmations - confirmations;
    const timePerConfirmation = stage === 1 ? 60 : 120; // seconds (input: 1min, output: 2min)
    const totalSeconds = remaining * timePerConfirmation;

    if (totalSeconds < 60) {
      return `~${totalSeconds}s`;
    } else {
      const minutes = Math.ceil(totalSeconds / 60);
      return `~${minutes} min`;
    }
  }

  // Default estimates
  if (stage === 1) return '~5-10 minutes';
  if (stage === 3) return '~10-15 minutes';
  return '';
};

export const StageIndicator = ({
  stage,
  title,
  subtitle,
  status,
  confirmations,
  requiredConfirmations,
  icon,
  caip,
  integration,
  reassuranceMessage
}: StageIndicatorProps) => {
  const isComplete = status === 'complete';
  const isActive = status === 'active';
  const isPending = status === 'pending';

  // Get status color
  const getStatusColor = () => {
    if (isComplete) return 'green.400';
    if (isActive) return 'blue.400';
    return 'gray.500';
  };

  // Get stage icon/number
  const renderStageIcon = () => {
    if (isComplete) {
      return <FaCheckCircle color="#48BB78" size="32px" />;
    }

    if (isActive) {
      return <Spinner size="lg" color="blue.400" thickness="3px" speed="0.8s" />;
    }

    // Pending state
    return (
      <Circle size="32px" bg="gray.700" borderWidth="2px" borderColor="gray.600">
        <Text fontSize="sm" fontWeight="bold" color="gray.500">
          {stage}
        </Text>
      </Circle>
    );
  };

  // Render confirmation progress (for Stages 1 & 3)
  const renderConfirmationProgress = () => {
    if (confirmations === undefined || requiredConfirmations === undefined) {
      return null;
    }

    const percentage = Math.min((confirmations / requiredConfirmations) * 100, 100);

    return (
      <VStack align="flex-start" gap={2} width="full">
        <HStack gap={2} width="full">
          <Progress
            value={percentage}
            size="sm"
            width="full"
            colorScheme={isComplete ? 'green' : 'blue'}
            borderRadius="full"
            bg="gray.700"
          />
          <Text fontSize="sm" color="gray.400" whiteSpace="nowrap" minWidth="80px">
            {confirmations}/{requiredConfirmations}
          </Text>
        </HStack>
        <Text fontSize="xs" color="gray.500">
          {confirmations} of {requiredConfirmations} confirmations
        </Text>
      </VStack>
    );
  };

  // Render protocol processing indicator (for Stage 2)
  const renderProtocolProcessing = () => {
    if (stage !== 2) return null;

    return (
      <VStack align="flex-start" gap={3} width="full">
        {/* THORChain/MayaChain Logo Animation */}
        {integration && (
          <HStack gap={2}>
            <Box
              animation={isActive ? 'pulse 2s ease-in-out infinite' : undefined}
              sx={{
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 }
                }
              }}
            >
              <Text fontSize="sm" color={isActive ? 'yellow.400' : 'gray.500'}>
                {integration === 'thorchain' ? '⚡ THORChain' : '🔮 MayaChain'} Router Processing
              </Text>
            </Box>
          </HStack>
        )}

        {/* Reassurance Message */}
        {reassuranceMessage && isActive && (
          <Box
            bg="yellow.900"
            borderColor="yellow.600"
            borderWidth="1px"
            borderRadius="md"
            p={3}
            width="full"
          >
            <Text fontSize="sm" color="yellow.300">
              {reassuranceMessage}
            </Text>
          </Box>
        )}

        {/* Default reassurance if no message */}
        {!reassuranceMessage && isActive && (
          <Text fontSize="sm" color="yellow.400">
            Your swap is being processed by the protocol. This typically takes 10-20 minutes.
          </Text>
        )}
      </VStack>
    );
  };

  // Render estimated time
  const renderEstimatedTime = () => {
    if (!isActive) return null;

    const timeEstimate = getEstimatedTime(stage, confirmations, requiredConfirmations);
    if (!timeEstimate) return null;

    return (
      <HStack gap={2}>
        <FaClock size="12px" color="#A0AEC0" />
        <Text fontSize="xs" color="gray.500">
          {timeEstimate} remaining
        </Text>
      </HStack>
    );
  };

  return (
    <Box
      bg={isActive ? 'gray.800' : 'gray.900'}
      borderRadius="xl"
      p={6}
      width="full"
      borderWidth="1px"
      borderColor={isActive ? 'blue.600' : isComplete ? 'green.600' : 'gray.700'}
      position="relative"
      transition="all 0.3s ease"
    >
      <HStack gap={4} width="full" align="flex-start">
        {/* Stage Icon/Number */}
        <Box position="relative" flexShrink={0}>
          {renderStageIcon()}
        </Box>

        {/* Stage Content */}
        <VStack align="flex-start" flex={1} gap={3}>
          {/* Title and Subtitle */}
          <VStack align="flex-start" gap={1}>
            <HStack gap={2}>
              <Text
                fontSize="lg"
                fontWeight="bold"
                color={isComplete ? 'green.400' : isActive ? 'white' : 'gray.400'}
              >
                {title}
              </Text>
              {icon && (
                <Image
                  src={icon}
                  alt=""
                  boxSize="20px"
                  borderRadius="full"
                />
              )}
            </HStack>
            {subtitle && (
              <Text fontSize="sm" color="gray.500">
                {subtitle}
              </Text>
            )}
          </VStack>

          {/* Confirmation Progress (Stages 1 & 3) */}
          {(stage === 1 || stage === 3) && renderConfirmationProgress()}

          {/* Protocol Processing (Stage 2) */}
          {stage === 2 && renderProtocolProcessing()}

          {/* Estimated Time */}
          {renderEstimatedTime()}

          {/* Completion Message */}
          {isComplete && (
            <HStack gap={2}>
              <Text fontSize="sm" color="green.400" fontWeight="semibold">
                ✓ Complete
              </Text>
            </HStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
};
