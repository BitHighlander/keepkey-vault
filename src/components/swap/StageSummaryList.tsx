/**
 * StageSummaryList Component
 *
 * Compact list showing all swap stages at once with status indicators
 */

import { VStack, HStack, Text } from '@chakra-ui/react';

interface SwapStatus {
  currentStage: number;
  confirmations?: number;
  requiredConfirmations?: number;
  outboundConfirmations?: number;
  outboundRequiredConfirmations?: number;
}

interface StageSummaryListProps {
  swapStatus: SwapStatus;
}

export function StageSummaryList({ swapStatus }: StageSummaryListProps) {
  const stages = [
    {
      title: 'Input Transaction',
      status: swapStatus.currentStage > 1 ? 'complete' :
              swapStatus.currentStage === 1 ? 'active' : 'pending',
      detail: swapStatus.confirmations
        ? `${swapStatus.confirmations} / ${swapStatus.requiredConfirmations} confirms`
        : null
    },
    {
      title: 'Protocol Processing',
      status: swapStatus.currentStage > 2 ? 'complete' :
              swapStatus.currentStage === 2 ? 'active' : 'pending',
      detail: swapStatus.currentStage === 2 ? 'In progress' : null
    },
    {
      title: 'Output Transaction',
      status: swapStatus.currentStage > 3 ? 'complete' :
              swapStatus.currentStage === 3 ? 'active' : 'pending',
      detail: swapStatus.outboundConfirmations
        ? `${swapStatus.outboundConfirmations} / ${swapStatus.outboundRequiredConfirmations} confirms`
        : null
    }
  ];

  return (
    <VStack spacing={2} align="stretch" mt={6}>
      {stages.map((stage, index) => (
        <HStack
          key={index}
          p={3}
          bg="gray.900"
          borderRadius="md"
          border="1px solid"
          borderColor={
            stage.status === 'complete' ? 'green.700' :
            stage.status === 'active' ? 'purple.700' : 'gray.700'
          }
          justify="space-between"
        >
          <HStack>
            <Text fontSize="lg">
              {stage.status === 'complete' ? '✓' :
               stage.status === 'active' ? '🔄' : '⏳'}
            </Text>
            <Text fontSize="sm" fontWeight="medium">
              Stage {index + 1}: {stage.title}
            </Text>
          </HStack>
          {stage.detail && (
            <Text fontSize="xs" color="gray.400">
              {stage.detail}
            </Text>
          )}
        </HStack>
      ))}
    </VStack>
  );
}
