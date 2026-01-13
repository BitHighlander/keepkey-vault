'use client'

import React from 'react';
import { Box, Text, VStack, HStack, IconButton, Collapsible, Grid } from '@chakra-ui/react';
import { FaChevronDown, FaChevronUp, FaExchangeAlt } from 'react-icons/fa';
import { AssetIcon } from '@/components/ui/AssetIcon';

const theme = {
  cardBg: '#111111',
  border: '#222222',
  gold: '#FFD700',
};

interface TransactionGroupProps {
  groupId: string;
  title: string;
  subtitle: string;
  isExpanded: boolean;
  onToggle: () => void;
  assetContext?: any; // Asset context for icon display
  useSwapIcon?: boolean; // Use swap icon instead of asset icon
  children: React.ReactNode;
}

export const TransactionGroup: React.FC<TransactionGroupProps> = ({
  groupId,
  title,
  subtitle,
  isExpanded,
  onToggle,
  assetContext,
  useSwapIcon = false,
  children,
}) => {
  return (
    <Box
      bg={theme.cardBg}
      borderRadius="lg"
      borderColor={theme.border}
      borderWidth="1px"
      mb={4}
      overflow="hidden"
    >
      {/* Header */}
      <Box
        p={4}
        borderBottom="1px"
        borderColor={theme.border}
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: 'rgba(255, 215, 0, 0.05)' }}
        transition="background 0.2s"
      >
        <HStack justify="space-between">
          <HStack gap={3}>
            {useSwapIcon ? (
              <Box
                boxSize="32px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="rgba(255, 215, 0, 0.1)"
                borderRadius="full"
                color={theme.gold}
              >
                <FaExchangeAlt size={16} />
              </Box>
            ) : assetContext ? (
              <AssetIcon
                src={assetContext.icon}
                caip={assetContext.caip}
                symbol={assetContext.symbol}
                alt={assetContext.name}
                boxSize="32px"
              />
            ) : null}
            <VStack align="start" gap={0}>
              <Text color={theme.gold} fontSize="lg" fontWeight="bold">
                {title}
              </Text>
              <Text color="gray.500" fontSize="xs">
                {subtitle}
              </Text>
            </VStack>
          </HStack>
          <IconButton
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            size="sm"
            variant="ghost"
            color={theme.gold}
            _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
          >
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </IconButton>
        </HStack>
      </Box>

      {/* Collapsible Content */}
      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>{children}</Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

interface TransactionTableHeaderProps {
  columns: string[];
  templateColumns: string;
}

export const TransactionTableHeader: React.FC<TransactionTableHeaderProps> = ({
  columns,
  templateColumns,
}) => {
  return (
    <Grid
      templateColumns={templateColumns}
      gap={2}
      pb={2}
      borderBottom="1px"
      borderColor={theme.border}
      mb={2}
    >
      {columns.map((column, index) => (
        <Text
          key={index}
          color="gray.400"
          fontSize="xs"
          fontWeight="bold"
          textTransform="uppercase"
          textAlign={column === 'Value' ? 'right' : 'left'}
        >
          {column}
        </Text>
      ))}
    </Grid>
  );
};
