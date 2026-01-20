/**
 * TimingDisplay Component
 *
 * Time-focused display with prominent timing information and expandable diagnostic details
 */

import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Badge, Collapsible, Progress, Code, IconButton } from '@chakra-ui/react';
import { FaChevronDown, FaChevronUp, FaLightbulb, FaExclamationTriangle, FaCopy, FaCheck } from 'react-icons/fa';
import {
  formatTime,
  calculatePercentage,
  getPerformanceLabel,
  getStageIcon,
  getStageTitle
} from './swap-timing-utils';

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

interface TimingDisplayProps {
  timingData?: TimingData;
  stage: 1 | 2 | 3;
  confirmations?: number;
  requiredConfirmations?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  inputTxHash?: string;
  thorchainData?: ThorchainData;
}

/**
 * Helper component for detail rows in expanded view
 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="space-between" fontSize="sm">
      <Text color="gray.400">{label}:</Text>
      <Text color="white" fontWeight="medium">{value}</Text>
    </HStack>
  );
}

export function TimingDisplay({
  timingData,
  stage,
  confirmations,
  requiredConfirmations,
  isExpanded,
  onToggleExpand,
  inputTxHash,
  thorchainData
}: TimingDisplayProps) {
  // Copy state - track which txid was copied
  const [copiedTx, setCopiedTx] = useState<'input' | 'output' | null>(null);

  // Format timing data
  const elapsed = formatTime(timingData?.elapsedSeconds || 0);
  const remaining = timingData?.remainingFormatted || 'Calculating...';
  const percentage = calculatePercentage(
    timingData?.stageElapsedSeconds,
    timingData?.stageExpectedSeconds
  );

  // Get transaction hashes
  const inboundTx = thorchainData?.inboundTxHash || inputTxHash;
  const outboundTx = thorchainData?.outboundTxHash;

  // Copy to clipboard function
  const handleCopy = async (text: string, txType: 'input' | 'output') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTx(txType);
      // Reset after 2 seconds
      setTimeout(() => setCopiedTx(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Box
      bg="gray.900"
      border="1px solid"
      borderColor="teal.700"
      borderRadius="lg"
      p={6}
      mt={4}
    >
      <VStack gap={4} align="stretch">
        {/* Stage title with icon and badge */}
        <HStack justify="space-between">
          <HStack>
            <Text fontSize="xl" fontWeight="bold">
              {getStageIcon(stage)} {getStageTitle(stage)}
            </Text>
            <Badge colorScheme="teal">Active</Badge>
          </HStack>
          {confirmations !== undefined && (
            <Text color="gray.400" fontSize="sm">
              {confirmations} / {requiredConfirmations} confirmations
            </Text>
          )}
        </HStack>

        {/* Prominent time display */}
        <Box bg="gray.800" p={4} borderRadius="md">
          <HStack gap={6} justify="center">
            <VStack gap={0}>
              <Text fontSize="2xl" fontWeight="bold" color="white">
                {elapsed}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Elapsed
              </Text>
            </VStack>

            <Text fontSize="2xl" color="gray.600">•</Text>

            <VStack gap={0}>
              <Text fontSize="2xl" fontWeight="bold" color="teal.400">
                ~{remaining}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Remaining
              </Text>
            </VStack>
          </HStack>
        </Box>

        {/* Progress bar */}
        <Box>
          <Progress.Root value={percentage} colorPalette="teal" size="lg" striped animated>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text fontSize="sm" color="gray.400" mt={1} textAlign="center">
            {percentage}% complete
          </Text>
        </Box>

        {/* Reassurance message */}
        {timingData?.reassuranceMessage && (
          <HStack
            bg="teal.900"
            p={3}
            borderRadius="md"
            border="1px solid"
            borderColor="teal.700"
          >
            <Box color="teal.300" fontSize="lg">
              <FaLightbulb />
            </Box>
            <Text fontSize="sm" color="teal.200">
              {timingData.reassuranceMessage}
            </Text>
          </HStack>
        )}

        {/* Transaction IDs - Main Focus */}
        <Box
          bg="gray.800"
          borderRadius="md"
          p={4}
          border="1px solid"
          borderColor="teal.700"
        >
          <VStack gap={3} align="stretch">
            {/* Input Transaction */}
            {inboundTx && (
              <Box>
                <HStack justify="space-between" align="center" mb={1}>
                  <Text fontSize="xs" color="gray.400" fontWeight="medium">
                    Input Transaction
                  </Text>
                  <IconButton
                    aria-label="Copy input transaction"
                    size="xs"
                    variant="ghost"
                    onClick={() => handleCopy(inboundTx, 'input')}
                    color={copiedTx === 'input' ? 'green.400' : 'gray.400'}
                    _hover={{ color: copiedTx === 'input' ? 'green.300' : 'teal.300' }}
                  >
                    {copiedTx === 'input' ? <FaCheck /> : <FaCopy />}
                  </IconButton>
                </HStack>
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
            <Box>
              <HStack justify="space-between" align="center" mb={1}>
                <Text fontSize="xs" color="gray.400" fontWeight="medium">
                  Output Transaction
                </Text>
                {outboundTx && (
                  <IconButton
                    aria-label="Copy output transaction"
                    size="xs"
                    variant="ghost"
                    onClick={() => handleCopy(outboundTx, 'output')}
                    color={copiedTx === 'output' ? 'green.400' : 'gray.400'}
                    _hover={{ color: copiedTx === 'output' ? 'green.300' : 'green.300' }}
                  >
                    {copiedTx === 'output' ? <FaCheck /> : <FaCopy />}
                  </IconButton>
                )}
              </HStack>
              {outboundTx ? (
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
              ) : (
                <Box
                  bg="gray.900"
                  p={2}
                  borderRadius="md"
                  border="1px dashed"
                  borderColor="gray.700"
                >
                  <Text fontSize="xs" color="gray.500" textAlign="center">
                    Waiting for output transaction...
                  </Text>
                </Box>
              )}
            </Box>
          </VStack>
        </Box>

        {/* Expandable details toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
        >
          {isExpanded ? 'Hide' : 'Show'} Details
          <Box ml={2}>
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </Box>
        </Button>

        {/* Expanded content */}
        <Collapsible.Root open={isExpanded}>
          <Collapsible.Content>
            <VStack gap={3} align="stretch" pt={3}>
              <Box borderTop="1px" borderColor="gray.700" />

              <DetailRow
                label="Expected Duration"
                value={formatTime(timingData?.stageExpectedSeconds || 0)}
              />
              <DetailRow
                label="Actual Progress"
                value={`${formatTime(timingData?.stageElapsedSeconds || 0)} (${timingData?.ratio || '0.00'}x)`}
              />
              <DetailRow
                label="Performance"
                value={getPerformanceLabel(timingData?.ratio)}
              />

              {confirmations !== undefined && (
                <>
                  <Box borderTop="1px" borderColor="gray.700" />
                  <DetailRow
                    label="Confirmations"
                    value={`${confirmations} / ${requiredConfirmations}`}
                  />
                  <DetailRow
                    label="Block Progress"
                    value={`${((confirmations / (requiredConfirmations || 1)) * 100).toFixed(0)}%`}
                  />
                </>
              )}

              {timingData?.usingDefaults && (
                <HStack
                  bg="yellow.900"
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                >
                  <Box color="yellow.400">
                    <FaExclamationTriangle />
                  </Box>
                  <Text color="yellow.200">
                    Using default estimates - precise timing loading
                  </Text>
                </HStack>
              )}
            </VStack>
          </Collapsible.Content>
        </Collapsible.Root>
      </VStack>
    </Box>
  );
}
