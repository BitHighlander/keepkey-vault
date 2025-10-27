import React, { useState } from 'react';
import {
  Box,
  Text,
  Flex,
  Button,
  Icon,
  Stack,
} from '@chakra-ui/react';
import { FaChevronDown, FaChevronUp, FaShieldAlt, FaInfoCircle } from 'react-icons/fa';

// Simple Badge component replacement
const Badge: React.FC<{ colorScheme?: string; fontSize?: string; children: React.ReactNode }> = ({
  colorScheme = 'gray',
  fontSize = '10px',
  children
}) => {
  const colors: Record<string, { bg: string; color: string }> = {
    orange: { bg: 'rgba(237, 137, 54, 0.2)', color: '#ed8936' },
    green: { bg: 'rgba(72, 187, 120, 0.2)', color: '#48bb78' },
    gray: { bg: 'rgba(160, 174, 192, 0.2)', color: '#a0aec0' },
  };

  const style = colors[colorScheme] || colors.gray;

  return (
    <Box
      as="span"
      display="inline-block"
      px={2}
      py={0.5}
      borderRadius="md"
      bg={style.bg}
      color={style.color}
      fontSize={fontSize}
      fontWeight="bold"
      textTransform="uppercase"
      letterSpacing="wide"
    >
      {children}
    </Box>
  );
};

interface ChangeOutput {
  address?: string;
  amount?: string;
  addressNList?: number[];
  address_n?: number[];
  scriptType?: string;
  isChange?: boolean;
  addressType?: string;
}

interface ChangeControlProps {
  changeOutputs: ChangeOutput[];
  assetColor: string;
  assetColorLight: string;
  theme: any;
  onChangeAddressUpdate?: (outputIndex: number, newScriptType: string) => void;
}

/**
 * Converts BIP32 path array to human-readable string
 * Example: [2147483732, 2147483648, 2147483648, 0, 0] → m/84'/0'/0'/0/0
 */
const pathArrayToString = (pathArray: number[]): string => {
  if (!pathArray || pathArray.length === 0) return 'Unknown';

  return 'm/' + pathArray.map((num, index) => {
    // Check if hardened (0x80000000 = 2147483648)
    const isHardened = num >= 0x80000000;
    const value = isHardened ? num - 0x80000000 : num;
    return `${value}${isHardened ? "'" : ''}`;
  }).join('/');
};

/**
 * Gets script type info from script type string
 */
const getScriptTypeInfo = (scriptType: string): { type: string; label: string; description: string } => {
  switch (scriptType.toLowerCase()) {
    case 'p2pkh':
      return {
        type: 'p2pkh',
        label: 'Legacy (P2PKH)',
        description: 'Pay to Public Key Hash - Original Bitcoin address format (1...)'
      };
    case 'p2sh-p2wpkh':
    case 'p2sh':
      return {
        type: 'p2sh-p2wpkh',
        label: 'Nested SegWit (P2SH-P2WPKH)',
        description: 'Pay to Script Hash wrapped SegWit - Compatible address format (3...)'
      };
    case 'p2wpkh':
    case 'bech32':
      return {
        type: 'p2wpkh',
        label: 'Native SegWit (P2WPKH)',
        description: 'Pay to Witness Public Key Hash - Modern Bech32 address format (bc1...)'
      };
    case 'p2tr':
    case 'taproot':
      return {
        type: 'p2tr',
        label: 'Taproot (P2TR)',
        description: 'Pay to Taproot - Latest Bitcoin address format (bc1p...)'
      };
    default:
      return {
        type: scriptType,
        label: scriptType.toUpperCase(),
        description: 'Script type'
      };
  }
};

/**
 * Determines script type from BIP32 path
 */
const getScriptTypeFromPath = (pathArray: number[]): { type: string; label: string; description: string } => {
  if (!pathArray || pathArray.length === 0) {
    return { type: 'unknown', label: 'Unknown', description: 'Script type could not be determined' };
  }

  // First element determines the purpose (BIP44/49/84)
  const purpose = pathArray[0] >= 0x80000000 ? pathArray[0] - 0x80000000 : pathArray[0];

  switch (purpose) {
    case 44:
      return getScriptTypeInfo('p2pkh');
    case 49:
      return getScriptTypeInfo('p2sh-p2wpkh');
    case 84:
      return getScriptTypeInfo('p2wpkh');
    case 86:
      return getScriptTypeInfo('p2tr');
    default:
      return {
        type: 'unknown',
        label: `Unknown (BIP${purpose})`,
        description: 'Non-standard or unrecognized script type'
      };
  }
};

/**
 * Formats satoshi amount to BTC with proper decimals
 */
const formatBtcAmount = (satoshis: string | number): string => {
  const sats = typeof satoshis === 'string' ? parseInt(satoshis, 10) : satoshis;
  return (sats / 100000000).toFixed(8) + ' BTC';
};

const ChangeControl: React.FC<ChangeControlProps> = ({
  changeOutputs,
  assetColor,
  assetColorLight,
  theme,
  onChangeAddressUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filter to only change outputs
  // Priority: use isChange flag if available, otherwise check for addressNList/address_n or addressType
  const changeOnlyOutputs = changeOutputs.filter(
    output =>
      output.isChange === true ||
      output.addressType === 'change' ||
      (!output.address && (output.addressNList || output.address_n))
  );

  console.log('ChangeControl: Total outputs:', changeOutputs.length);
  console.log('ChangeControl: Change outputs:', changeOnlyOutputs.length);
  console.log('ChangeControl: Change outputs data:', changeOnlyOutputs);

  if (changeOnlyOutputs.length === 0) {
    return null;
  }

  return (
    <Box
      width="100%"
      p={4}
      bg={theme.bg}
      border="1px solid"
      borderColor={theme.border}
      borderRadius="md"
    >
      {/* Header with expand/collapse */}
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        _hover={{ opacity: 0.8 }}
      >
        <Flex align="center" gap={2}>
          <Icon as={FaInfoCircle} color={assetColor} />
          <Text fontSize="sm" fontWeight="bold" color="white">
            Change Output Information
          </Text>
          <Badge colorScheme="orange" fontSize="10px">
            {changeOnlyOutputs.length} change {changeOnlyOutputs.length === 1 ? 'output' : 'outputs'}
          </Badge>
        </Flex>
        <Icon
          as={isExpanded ? FaChevronUp : FaChevronDown}
          color={assetColor}
          boxSize={4}
        />
      </Flex>

      {/* Firmware Validation Notice */}
      <Box
        mt={3}
        p={3}
        bg={assetColorLight}
        borderRadius="md"
        border="1px solid"
        borderColor={assetColor}
      >
        <Flex align="center" gap={2} fontSize="xs" color="white">
          <Icon as={FaShieldAlt} color={assetColor} />
          <Text>
            KeepKey firmware validates change addresses internally to ensure they belong to your device
          </Text>
        </Flex>
      </Box>

      {/* Expandable content */}
      {isExpanded && (
        <Stack gap={3} mt={3}>
          {changeOnlyOutputs.map((output, index) => {
            const path = output.addressNList || output.address_n || [];
            const pathString = pathArrayToString(path);
            // Use scriptType from output if available, otherwise derive from path
            const scriptInfo = output.scriptType
              ? getScriptTypeInfo(output.scriptType)
              : getScriptTypeFromPath(path);

            return (
              <Box
                key={index}
                p={3}
                bg="rgba(0, 0, 0, 0.3)"
                border="1px solid"
                borderColor={theme.border}
                borderRadius="md"
              >
                <Flex justify="space-between" align="start" mb={2}>
                  <Box>
                    <Text fontSize="xs" color="gray.400" mb={1}>
                      Change Output #{index + 1}
                    </Text>
                    <Text fontSize="sm" color="white" fontWeight="bold">
                      {output.amount && formatBtcAmount(output.amount)}
                    </Text>
                  </Box>
                  <Badge colorScheme="green" fontSize="10px">
                    {scriptInfo.label}
                  </Badge>
                </Flex>

                {/* Path Information */}
                <Box mb={2}>
                  <Text fontSize="xs" color="gray.400" mb={1}>
                    Derivation Path
                  </Text>
                  <Text
                    fontSize="xs"
                    fontFamily="mono"
                    color={assetColor}
                    bg="rgba(0, 0, 0, 0.4)"
                    p={2}
                    borderRadius="md"
                  >
                    {pathString}
                  </Text>
                </Box>

                {/* Script Type Info */}
                <Box>
                  <Text fontSize="xs" color="gray.400" mb={1}>
                    Script Type
                  </Text>
                  <Text fontSize="xs" color="gray.300">
                    {scriptInfo.description}
                  </Text>
                </Box>

                {/* Change Address if available */}
                {output.address && (
                  <Box mt={2}>
                    <Text fontSize="xs" color="gray.400" mb={1}>
                      Change Address
                    </Text>
                    <Text
                      fontSize="xs"
                      fontFamily="mono"
                      color="white"
                      bg="rgba(0, 0, 0, 0.4)"
                      p={2}
                      borderRadius="md"
                      wordBreak="break-all"
                    >
                      {output.address}
                    </Text>
                  </Box>
                )}

                {/* Advanced Options */}
                {onChangeAddressUpdate && (
                  <Box mt={3}>
                    <Button
                      size="xs"
                      variant="outline"
                      color={assetColor}
                      borderColor={theme.border}
                      _hover={{ bg: assetColorLight, borderColor: assetColor }}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      {showAdvanced ? 'Hide Advanced' : 'Advanced Options'}
                    </Button>

                    {showAdvanced && (
                      <Box mt={2} p={2} bg="rgba(0, 0, 0, 0.2)" borderRadius="md">
                        <Text fontSize="xs" color="gray.400" mb={2}>
                          Select Different Script Type:
                        </Text>
                        <Stack gap={2}>
                          <Button
                            size="xs"
                            variant={scriptInfo.type === 'p2pkh' ? 'solid' : 'outline'}
                            colorScheme={scriptInfo.type === 'p2pkh' ? 'orange' : undefined}
                            onClick={() => onChangeAddressUpdate(index, 'p2pkh')}
                          >
                            Legacy (P2PKH) - 1...
                          </Button>
                          <Button
                            size="xs"
                            variant={scriptInfo.type === 'p2sh-p2wpkh' ? 'solid' : 'outline'}
                            colorScheme={scriptInfo.type === 'p2sh-p2wpkh' ? 'orange' : undefined}
                            onClick={() => onChangeAddressUpdate(index, 'p2sh-p2wpkh')}
                          >
                            Nested SegWit (P2SH) - 3...
                          </Button>
                          <Button
                            size="xs"
                            variant={scriptInfo.type === 'p2wpkh' ? 'solid' : 'outline'}
                            colorScheme={scriptInfo.type === 'p2wpkh' ? 'orange' : undefined}
                            onClick={() => onChangeAddressUpdate(index, 'p2wpkh')}
                          >
                            Native SegWit (Bech32) - bc1...
                          </Button>
                          <Button
                            size="xs"
                            variant={scriptInfo.type === 'p2tr' ? 'solid' : 'outline'}
                            colorScheme={scriptInfo.type === 'p2tr' ? 'orange' : undefined}
                            onClick={() => onChangeAddressUpdate(index, 'p2tr')}
                          >
                            Taproot - bc1p...
                          </Button>
                        </Stack>
                        <Text fontSize="xs" color="gray.500" mt={2} fontStyle="italic">
                          Note: Changing script type will regenerate the transaction
                        </Text>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default ChangeControl;
