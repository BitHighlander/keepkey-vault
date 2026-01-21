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
      borderRadius="md"
      p={3}
      mt={2}
    >
      <VStack gap={2} align="stretch">
        {/* Stage title with confirmations inline */}
        <HStack justify="space-between" align="center">
          <HStack gap={2}>
            <Text fontSize="md" fontWeight="bold">
              {getStageIcon(stage)} {getStageTitle(stage)}
            </Text>
            <Badge colorScheme="teal" size="sm">Active</Badge>
          </HStack>
          {confirmations !== undefined && (
            <Text color="gray.400" fontSize="xs">
              {confirmations}/{requiredConfirmations}
            </Text>
          )}
        </HStack>

        {/* Compact time display */}
        <HStack gap={4} justify="center" bg="gray.800" p={2} borderRadius="md">
          <VStack gap={0}>
            <Text fontSize="lg" fontWeight="bold" color="white">
              {elapsed}
            </Text>
            <Text fontSize="2xs" color="gray.500">
              Elapsed
            </Text>
          </VStack>

          <Text fontSize="lg" color="gray.600">•</Text>

          <VStack gap={0}>
            <Text fontSize="lg" fontWeight="bold" color="teal.400">
              ~{remaining}
            </Text>
            <Text fontSize="2xs" color="gray.500">
              Remaining
            </Text>
          </VStack>
        </HStack>

        {/* Compact progress bar */}
        <Box>
          <Progress.Root value={percentage} colorPalette="teal" size="sm" striped animated>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text fontSize="2xs" color="gray.400" mt={0.5} textAlign="center">
            {percentage}% complete
          </Text>
        </Box>

        {/* Condensed reassurance message */}
        {timingData?.reassuranceMessage && (
          <HStack
            bg="teal.900"
            p={2}
            borderRadius="md"
            border="1px solid"
            borderColor="teal.700"
            gap={2}
          >
            <Box color="teal.300" fontSize="sm">
              <FaLightbulb />
            </Box>
            <Text fontSize="2xs" color="teal.200" lineHeight="1.3">
              {timingData.reassuranceMessage}
            </Text>
          </HStack>
        )}

        {/* Collapsible Transaction IDs */}
        <Button
          variant="ghost"
          size="xs"
          onClick={onToggleExpand}
          justifyContent="space-between"
          width="full"
        >
          <Text fontSize="xs">{isExpanded ? 'Hide' : 'Show'} Transaction Details</Text>
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </Button>

        <Collapsible.Root open={isExpanded}>
          <Collapsible.Content>
            <Box
              bg="gray.800"
              borderRadius="md"
              p={2}
              border="1px solid"
              borderColor="teal.700"
            >
              <VStack gap={2} align="stretch">
                {/* Input Transaction */}
                {inboundTx && (
                  <Box>
                    <HStack justify="space-between" align="center" mb={1}>
                      <Text fontSize="2xs" color="gray.400" fontWeight="medium">
                        Input TX
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
                <Box>
                  <HStack justify="space-between" align="center" mb={1}>
                    <Text fontSize="2xs" color="gray.400" fontWeight="medium">
                      Output TX
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
                  ) : (
                    <Box
                      bg="gray.900"
                      p={1}
                      borderRadius="sm"
                      border="1px dashed"
                      borderColor="gray.700"
                    >
                      <Text fontSize="2xs" color="gray.500" textAlign="center">
                        Waiting for output...
                      </Text>
                    </Box>
                  )}
                </Box>
              </VStack>
            </Box>
          </Collapsible.Content>
        </Collapsible.Root>

      </VStack>
    </Box>
  );
}
