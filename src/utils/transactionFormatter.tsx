import React from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';

export type NetworkType = 'UTXO' | 'EVM' | 'TENDERMINT' | 'OTHER';

/**
 * Formats transaction details for display based on network type
 * @param tx - The transaction object to format
 * @param networkType - The type of network (UTXO, EVM, TENDERMINT, OTHER)
 * @returns React node with formatted transaction details
 */
export const formatTransactionDetails = (tx: any, networkType: NetworkType): React.ReactNode => {
  if (!tx) return null;

  switch (networkType) {
    case 'UTXO': {
      return (
        <Box width="100%">
          <Text color="gray.500" fontSize="sm" mb={1}>Transaction Details</Text>
          {tx.inputs && tx.inputs.length > 0 && (
            <Box mb={3}>
              <Text color="gray.500" fontSize="xs">Inputs ({tx.inputs.length})</Text>
              <Box maxH="100px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
                {tx.inputs.map((input: any, idx: number) => (
                  <Text key={idx} fontFamily="mono" color="white" fontSize="10px" mb={1}>
                    {input.txid?.substring(0, 8)}...{input.txid?.substring(input.txid.length - 8)} : {input.vout}
                    {input.value && ` (${input.value} sats)`}
                  </Text>
                ))}
              </Box>
            </Box>
          )}

          {tx.outputs && tx.outputs.length > 0 && (
            <Box>
              <Text color="gray.500" fontSize="xs">Outputs ({tx.outputs.length})</Text>
              <Box maxH="100px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
                {tx.outputs.map((output: any, idx: number) => (
                  <Text key={idx} fontFamily="mono" color="white" fontSize="10px" mb={1} wordBreak="break-all">
                    {output.address ? (
                      <>
                        {output.address?.substring(0, 8)}...{output.address?.substring(output.address.length - 8)}
                        {output.amount && ` (${output.amount} sats)`}
                      </>
                    ) : (
                      <>
                        Change output
                        {output.amount && ` (${output.amount} sats)`}
                      </>
                    )}
                  </Text>
                ))}
              </Box>
            </Box>
          )}

          {tx.fee && (
            <Flex justify="space-between" mt={2}>
              <Text color="gray.500" fontSize="xs">Transaction Fee</Text>
              <Text color="white" fontSize="xs">{tx.fee} sats</Text>
            </Flex>
          )}
        </Box>
      );
    }

    case 'EVM': {
      return (
        <Box width="100%">
          <Text color="gray.500" fontSize="sm" mb={1}>Transaction Details</Text>
          <Box maxH="150px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
            {tx.to && (
              <Flex justify="space-between" mb={1}>
                <Text color="gray.500">To:</Text>
                <Text color="white" fontFamily="mono" wordBreak="break-all">{tx.to}</Text>
              </Flex>
            )}
            {tx.value && (
              <Flex justify="space-between" mb={1}>
                <Text color="gray.500">Value:</Text>
                <Text color="white" fontFamily="mono">{tx.value}</Text>
              </Flex>
            )}
            {tx.gasLimit && (
              <Flex justify="space-between" mb={1}>
                <Text color="gray.500">Gas Limit:</Text>
                <Text color="white" fontFamily="mono">{tx.gasLimit}</Text>
              </Flex>
            )}
            {tx.gasPrice && (
              <Flex justify="space-between" mb={1}>
                <Text color="gray.500">Gas Price:</Text>
                <Text color="white" fontFamily="mono">{tx.gasPrice} Gwei</Text>
              </Flex>
            )}
          </Box>
        </Box>
      );
    }

    default:
      // For other chains, just show the JSON structure
      return (
        <Box width="100%">
          <Text color="gray.500" fontSize="sm" mb={1}>Transaction Details</Text>
          <Box maxH="150px" overflowY="auto" mt={1} p={2} bg="rgba(0,0,0,0.2)" borderRadius="md" fontSize="xs">
            <Text color="white" fontFamily="mono" wordBreak="break-all">
              {JSON.stringify(tx, null, 2)}
            </Text>
          </Box>
        </Box>
      );
  }
};
