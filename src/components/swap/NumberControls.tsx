import React from 'react';
import { VStack, IconButton } from '@chakra-ui/react';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';

interface NumberControlsProps {
  onIncrement: () => void;
  onDecrement: () => void;
  canDecrement: boolean;
}

const buttonStyles = {
  size: 'xs' as const,
  variant: 'solid' as const,
  bg: 'gray.700',
  color: 'white',
  _hover: { bg: 'gray.600' },
  _active: { bg: 'gray.500' },
  height: '18px',
  width: '24px',
  minW: '24px',
  fontSize: 'xs' as const,
  borderRadius: 'md',
};

export const NumberControls: React.FC<NumberControlsProps> = ({
  onIncrement,
  onDecrement,
  canDecrement,
}) => {
  return (
    <VStack
      gap={0}
      position="absolute"
      right={2}
      top="50%"
      transform="translateY(-50%)"
      zIndex={2}
    >
      <IconButton
        {...buttonStyles}
        onClick={onIncrement}
        aria-label="Increase value"
        icon={<FaChevronUp size={12} />}
      />
      <IconButton
        {...buttonStyles}
        onClick={onDecrement}
        aria-label="Decrease value"
        icon={<FaChevronDown size={12} />}
        disabled={!canDecrement}
      />
    </VStack>
  );
};
