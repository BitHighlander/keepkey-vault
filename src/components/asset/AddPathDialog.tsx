'use client'

import React from 'react';
import {
  Box,
  Button,
  HStack,
  Text,
  Spinner,
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FaPlus } from 'react-icons/fa';
import { usePioneerContext } from '@/components/providers/pioneer';
import { usePathManager } from '@/hooks/usePathManager';
import { PathFormInputs } from '@/components/path/PathFormInputs';

// Theme colors - matching the project theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
  borderLight: '#333333',
};

interface AddPathDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetContext: any;
}

export const AddPathDialog: React.FC<AddPathDialogProps> = ({ isOpen, onClose, assetContext }) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // Use the shared path manager hook
  const pathManager = usePathManager({ assetContext, app });

  const handleAddPath = async () => {
    try {
      await pathManager.addPath();
      // Close dialog on success
      onClose();
    } catch (err: any) {
      // Error is already handled in the hook
      console.error('❌ [AddPathDialog] Error adding path:', err);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent
        bg={theme.cardBg}
        borderColor={theme.gold}
        borderWidth="2px"
        borderRadius="xl"
        maxW="600px"
        p={8}
      >
        <DialogHeader borderBottom={`1px solid ${theme.border}`} pb={6} mb={6}>
          <DialogTitle color={theme.gold} fontSize="2xl" fontWeight="bold">
            Add New Path
          </DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody pt={0} pb={6}>
          <PathFormInputs
            note={pathManager.note}
            accountIndex={pathManager.accountIndex}
            addressIndex={pathManager.addressIndex}
            derivationPath={pathManager.derivationPath}
            assetContext={assetContext}
            error={pathManager.error}
            accentColor={theme.gold}
            onNoteChange={pathManager.setNote}
            onAccountIndexChange={pathManager.setAccountIndex}
            onAddressIndexChange={pathManager.setAddressIndex}
            compact={false}
          />
        </DialogBody>

        <DialogFooter borderTop={`1px solid ${theme.border}`} pt={6}>
          <HStack gap={4} width="100%">
            <Button
              flex={1}
              size="lg"
              height="56px"
              variant="ghost"
              onClick={onClose}
              color="gray.400"
              _hover={{ bg: theme.border }}
              borderRadius="lg"
              disabled={pathManager.loading}
            >
              Cancel
            </Button>
            <Button
              flex={2}
              size="lg"
              height="56px"
              onClick={handleAddPath}
              disabled={pathManager.loading || !pathManager.note.trim()}
              bg={theme.gold}
              color="black"
              _hover={{ bg: theme.goldHover }}
              _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              borderRadius="lg"
              fontWeight="bold"
            >
              {pathManager.loading ? (
                <HStack gap={3}>
                  <Spinner size="sm" color="black" />
                  <Text>Adding Path...</Text>
                </HStack>
              ) : (
                <HStack gap={3}>
                  <FaPlus />
                  <Text>Add Path</Text>
                </HStack>
              )}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
