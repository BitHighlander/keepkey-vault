'use client'

import React from 'react';
import {
  VStack,
  HStack,
  Box,
  Text,
  Image,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { middleEllipsis } from '@/utils/strings';

interface Asset {
  caip: string;
  name: string;
  symbol: string;
  icon: string;
  balance?: string | number;
  networkId?: string;
}

interface AssetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  assets: Asset[];
  title?: string;
  currentAsset?: Asset | null;
}

export const AssetPicker = ({
  isOpen,
  onClose,
  onSelect,
  assets,
  title = 'Select Asset',
  currentAsset
}: AssetPickerProps) => {
  const handleSelect = (asset: Asset) => {
    onSelect(asset);
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
      <DialogContent maxWidth="400px" bg="gray.800" borderColor="gray.700">
        <DialogHeader>
          <DialogTitle color="white">{title}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb={6}>
          <VStack align="stretch" gap={2}>
            {assets.map((asset) => (
              <HStack
                key={asset.caip}
                p={3}
                borderRadius="lg"
                bg={currentAsset?.caip === asset.caip ? 'gray.700' : 'gray.900'}
                borderWidth="1px"
                borderColor={currentAsset?.caip === asset.caip ? 'blue.500' : 'transparent'}
                _hover={{ bg: 'gray.700', borderColor: 'gray.600' }}
                cursor="pointer"
                onClick={() => handleSelect(asset)}
                justify="space-between"
                transition="all 0.2s"
              >
                <HStack gap={3}>
                  <Image 
                    src={asset.icon} 
                    alt={asset.name} 
                    boxSize="32px" 
                    borderRadius="full"
                    fallbackSrc="https://pioneers.dev/coins/coin.png"
                  />
                  <Box>
                    <Text fontWeight="medium" color="white">
                      {asset.symbol}
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                      {asset.name}
                    </Text>
                  </Box>
                </HStack>
                {asset.balance && (
                  <Box textAlign="right">
                    <Text fontSize="sm" color="gray.400">
                      Balance
                    </Text>
                    <Text fontSize="sm" color="white" fontWeight="medium">
                      {middleEllipsis(asset.balance.toString(), 10)}
                    </Text>
                    {asset.balanceUsd && asset.balanceUsd > 0 && (
                      <Text fontSize="xs" color="gray.500">
                        ${asset.balanceUsd.toFixed(2)}
                      </Text>
                    )}
                  </Box>
                )}
              </HStack>
            ))}
          </VStack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};