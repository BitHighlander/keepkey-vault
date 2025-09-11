import React, { useState } from 'react';
import { Box, Center, Text, Image } from '@chakra-ui/react';
import { 
  FaCoins, 
  FaBitcoin, 
  FaEthereum,
  FaDollarSign,
  FaEuroSign,
  FaPoundSign,
  FaYenSign,
  FaRupeeSign,
  FaWonSign,
  FaLiraSign,
  FaRubleSign,
  FaShekelSign
} from 'react-icons/fa';
import { SiBinance, SiCardano, SiPolkadot, SiSolana, SiDogecoin, SiLitecoin, SiRipple } from 'react-icons/si';

interface TokenIconProps {
  icon?: string;
  color?: string;
  symbol?: string;
  name?: string;
  size?: string | number;
  fontSize?: string;
}

// Map symbols to specific icons
const symbolToIcon: Record<string, React.ComponentType<any>> = {
  'BTC': FaBitcoin,
  'ETH': FaEthereum,
  'WETH': FaEthereum,
  'BNB': SiBinance,
  'ADA': SiCardano,
  'DOT': SiPolkadot,
  'SOL': SiSolana,
  'DOGE': SiDogecoin,
  'LTC': SiLitecoin,
  'XRP': SiRipple,
  'USD': FaDollarSign,
  'USDT': FaDollarSign,
  'USDC': FaDollarSign,
  'DAI': FaDollarSign,
  'BUSD': FaDollarSign,
  'EUR': FaEuroSign,
  'GBP': FaPoundSign,
  'JPY': FaYenSign,
  'INR': FaRupeeSign,
  'KRW': FaWonSign,
  'TRY': FaLiraSign,
  'RUB': FaRubleSign,
  'ILS': FaShekelSign,
};

// Generate a consistent color from a string
const stringToColor = (str: string): string => {
  // Default to gray if no string provided
  return '#718096'; // gray.500
};

export const TokenIcon: React.FC<TokenIconProps> = ({
  icon,
  color,
  symbol = '',
  name = '',
  size = '44px',
  fontSize = 'md'
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!icon);
  
  // Get the display text (first 2-3 characters of symbol)
  const displayText = symbol ? (
    symbol.length > 3 ? symbol.substring(0, 3) : symbol
  ).toUpperCase() : '?';
  
  // Check if we have a specific icon for this symbol
  const IconComponent = symbol ? symbolToIcon[symbol.toUpperCase()] : null;
  
  // Determine the background color - use provided color or default to gray
  const bgColor = color || '#718096'; // Use provided color or gray.500
  
  // If we have a valid image URL and it hasn't errored
  if (icon && !imageError) {
    return (
      <Box position="relative" boxSize={size}>
        {imageLoading && (
          <Center
            position="absolute"
            boxSize="100%"
            bg={bgColor}
            borderRadius="full"
            color="white"
          >
            {IconComponent ? (
              <Box as={IconComponent} boxSize="60%" />
            ) : (
              <Text fontSize={fontSize} fontWeight="bold">
                {displayText}
              </Text>
            )}
          </Center>
        )}
        <Image
          src={icon}
          alt={name || symbol || 'Token'}
          boxSize="100%"
          borderRadius="full"
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
          onLoad={() => setImageLoading(false)}
          style={{ 
            display: imageLoading ? 'none' : 'block',
            objectFit: 'cover'
          }}
        />
      </Box>
    );
  }
  
  // Fallback to icon or text
  return (
    <Center
      boxSize={size}
      bg={bgColor}
      borderRadius="full"
      color="white"
      flexShrink={0}
    >
      {IconComponent ? (
        <Box as={IconComponent} boxSize="60%" />
      ) : displayText === '?' ? (
        <Box as={FaCoins} boxSize="60%" />
      ) : (
        <Text fontSize={fontSize} fontWeight="bold">
          {displayText}
        </Text>
      )}
    </Center>
  );
};