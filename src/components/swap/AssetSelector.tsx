'use client'

import React from 'react';
import { Box, HStack, Text, Image, Button } from '@chakra-ui/react';
import { FaChevronDown } from 'react-icons/fa';
import CountUp from 'react-countup';

interface AssetSelectorProps {
  asset: any;
  balance?: string;
  balanceUsd?: string;
  label: string;
  onClick: () => void;
  onMaxClick?: () => void;
  showMaxButton?: boolean;
}

export const AssetSelector = ({ 
  asset, 
  balance, 
  balanceUsd,
  label, 
  onClick,
  onMaxClick,
  showMaxButton = false
}: AssetSelectorProps) => {
  if (!asset) {
    return (
      <Box>
        <Text fontSize="xs" color="gray.500" mb={1}>{label}</Text>
        <Button
          onClick={onClick}
          variant="ghost"
          bg="gray.800"
          borderRadius="xl"
          p={2}
          height="auto"
          justify="space-between"
          width="full"
          _hover={{ bg: 'gray.700' }}
        >
          <Text color="gray.400" fontSize="sm">Select token</Text>
          <FaChevronDown color="gray" size={12} />
        </Button>
      </Box>
    );
  }

  // Format balance to reasonable precision
  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    if (num === 0) return '0';
    if (num < 0.00001) return '< 0.00001';
    if (num < 1) return num.toFixed(6);
    if (num < 100) return num.toFixed(4);
    if (num < 10000) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatUsdBalance = (bal: string) => {
    const num = parseFloat(bal);
    if (num < 0.01) return '< $0.01';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="xs" color="gray.400" fontWeight="medium">{label}</Text>
        {balance && (
          <HStack gap={2}>
            <HStack gap={1}>
              <Text fontSize="xs" color="gray.400">
                Balance: <Text as="span" color="#23DCC8" fontWeight="medium">
                  <CountUp
                    end={parseFloat(balance)}
                    decimals={parseFloat(balance) < 1 ? 6 : (parseFloat(balance) < 100 ? 4 : 2)}
                    duration={1.5}
                    separator=","
                    preserveValue={true}
                  />
                </Text> {asset.symbol}
              </Text>
              {balanceUsd && (
                <Text fontSize="xs" color="gray.400">
                  ($<Text as="span" color="#23DCC8">
                    <CountUp
                      end={parseFloat(balanceUsd)}
                      decimals={2}
                      duration={1.5}
                      separator=","
                      preserveValue={true}
                    />
                  </Text>)
                </Text>
              )}
            </HStack>
            {showMaxButton && onMaxClick && (
              <Button
                size="xs"
                variant="solid"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('🟢 MAX BUTTON CLICKED IN ASSETSELECTOR');
                  onMaxClick();
                }}
                bg="#23DCC8"
                color="black"
                _hover={{ bg: '#1FC4B3' }}
                _active={{ bg: '#1AAB9B' }}
                height="18px"
                px={1.5}
                fontSize="xs"
                borderRadius="md"
                minW="unset"
                fontWeight="bold"
              >
                MAX
              </Button>
            )}
          </HStack>
        )}
      </HStack>
      <Button
        onClick={onClick}
        variant="ghost"
        bg="rgba(30, 30, 30, 0.6)"
        borderRadius="xl"
        p={2}
        height="auto"
        width="full"
        justify="flex-start"
        borderWidth="1px"
        borderColor="rgba(255, 255, 255, 0.1)"
        _hover={{ bg: 'rgba(35, 220, 200, 0.1)', borderColor: 'rgba(35, 220, 200, 0.3)' }}
      >
        <HStack justify="space-between" width="full">
          <HStack gap={2}>
            <Box
              boxSize="24px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="rgba(255, 255, 255, 0.1)"
              borderRadius="md"
              p="2px"
              boxShadow="0 0 0 1px rgba(255, 255, 255, 0.15)"
            >
              <Image src={asset.icon} alt={asset.name} boxSize="100%" objectFit="contain" />
            </Box>
            <Text fontWeight="medium" color="white" fontSize="sm">{asset.symbol}</Text>
          </HStack>
          <FaChevronDown color="gray" size={12} />
        </HStack>
      </Button>
    </Box>
  );
};