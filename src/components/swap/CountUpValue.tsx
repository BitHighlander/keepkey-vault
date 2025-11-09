import React from 'react';
import { Text } from '@chakra-ui/react';
import CountUp from 'react-countup';
import { getDecimalPlaces } from './swap-utils';

interface CountUpValueProps {
  value: string | number;
  isUsd?: boolean;
  color?: string;
  fontSize?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export const CountUpValue: React.FC<CountUpValueProps> = ({
  value,
  isUsd = false,
  color = '#23DCC8',
  fontSize = 'inherit',
  prefix = '',
  suffix = '',
  duration = 1.5,
}) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue) || numValue <= 0) {
    return <>{value}</>;
  }

  return (
    <Text as="span" color={color} fontSize={fontSize}>
      {prefix}
      <CountUp
        end={numValue}
        decimals={getDecimalPlaces(numValue, isUsd)}
        duration={duration}
        separator=","
        preserveValue={true}
      />
      {suffix}
    </Text>
  );
};
