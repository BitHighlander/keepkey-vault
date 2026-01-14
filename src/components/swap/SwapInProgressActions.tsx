'use client'

import React from 'react';
import {
  VStack,
  Button,
  Link,
  Text
} from '@chakra-ui/react';
import { FaExternalLinkAlt, FaCode } from 'react-icons/fa';

interface SwapInProgressActionsProps {
  thorchainTrackerLink: string;
  midgardApiLink: string;
  onClose: () => void;
}

export const SwapInProgressActions = ({
  thorchainTrackerLink,
  midgardApiLink,
  onClose
}: SwapInProgressActionsProps) => {
  return (
    <VStack gap={4} width="full" px={4}>
      {/* Track Swap Button */}
      <Link
        href={thorchainTrackerLink}
        isExternal
        target="_blank"
        rel="noopener noreferrer"
        width="full"
      >
        <Button
          variant="outline"
          borderColor="#23DCC8"
          color="white"
          _hover={{ bg: 'rgba(35, 220, 200, 0.1)', borderColor: '#1FC4B3' }}
          width="full"
          height="48px"
          borderRadius="xl"
          rightIcon={<FaExternalLinkAlt />}
        >
          Track Swap Progress
        </Button>
      </Link>

      {/* View API Details Button */}
      <Link
        href={midgardApiLink}
        isExternal
        target="_blank"
        rel="noopener noreferrer"
        width="full"
      >
        <Button
          variant="ghost"
          color="gray.400"
          _hover={{ color: 'white', bg: 'gray.700' }}
          width="full"
          height="48px"
          borderRadius="xl"
          rightIcon={<FaCode />}
        >
          View API Details
        </Button>
      </Link>

      {/* Close Button */}
      <Button
        size="lg"
        bg="gray.700"
        color="white"
        _hover={{ bg: 'gray.600' }}
        onClick={onClose}
        width="full"
        height="48px"
        borderRadius="xl"
        fontWeight="semibold"
      >
        Close
      </Button>

      {/* Helper Text */}
      <Text fontSize="xs" color="gray.500" textAlign="center">
        You can track your swap progress on THORChain Tracker or close this window and check back later
      </Text>
    </VStack>
  );
};
