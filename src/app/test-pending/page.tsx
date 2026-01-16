'use client'

import { Box, Text, VStack, Code, Spinner, HStack } from '@chakra-ui/react';
import { usePendingSwaps } from '@/hooks/usePendingSwaps';

export default function TestPendingPage() {
  const { pendingSwaps, isLoading, error } = usePendingSwaps();

  return (
    <Box p={8} bg="black" minH="100vh" color="white">
      <VStack align="stretch" gap={4}>
        <Text fontSize="2xl">Pending Swaps Hook Test</Text>
        
        <HStack gap={4}>
          <Text>Loading: {isLoading ? 'Yes' : 'No'}</Text>
          <Text>Count: {pendingSwaps.length}</Text>
          {error && <Text color="red.400">Error: {error}</Text>}
        </HStack>
        
        {isLoading ? (
          <Spinner />
        ) : (
          <Code p={4} borderRadius="md" maxH="600px" overflow="auto">
            <pre>{JSON.stringify(pendingSwaps, null, 2)}</pre>
          </Code>
        )}
      </VStack>
    </Box>
  );
}
