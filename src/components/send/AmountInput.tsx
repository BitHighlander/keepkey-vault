'use client'

import React from 'react'
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  Input,
} from '@chakra-ui/react'

interface AmountInputProps {
  amount: string
  isUsdInput: boolean
  assetSymbol: string
  assetColor: string
  assetColorLight: string
  assetColorHover: string
  onAmountChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onToggleInputMode: () => void
  onSetMax: () => void
  nativeToUsd: (amount: string) => string
  usdToNative: (amount: string) => string
  theme: {
    cardBg: string
    borderRadius: string
    formPadding: string
    border: string
  }
}

export const AmountInput: React.FC<AmountInputProps> = ({
  amount,
  isUsdInput,
  assetSymbol,
  assetColor,
  assetColorLight,
  assetColorHover,
  onAmountChange,
  onToggleInputMode,
  onSetMax,
  nativeToUsd,
  usdToNative,
  theme,
}) => {
  return (
    <Box
      width="100%"
      bg={theme.cardBg}
      borderRadius={theme.borderRadius}
      p={theme.formPadding}
      borderWidth="1px"
      borderColor={theme.border}
    >
      <Stack gap={3}>
        <Flex justify="space-between" align="center">
          <Text color="white" fontWeight="medium">Amount</Text>
          <Button
            size="sm"
            bg={theme.cardBg}
            color={assetColor}
            borderColor={theme.border}
            borderWidth="1px"
            height="30px"
            px={3}
            _hover={{
              bg: assetColorLight,
              borderColor: assetColor,
            }}
            onClick={onSetMax}
          >
            MAX
          </Button>
        </Flex>

        {/* Active Input (Larger) */}
        <Box
          onClick={() => !isUsdInput && onToggleInputMode()}
          cursor={!isUsdInput ? "pointer" : "default"}
          transition="all 0.2s"
        >
          <Flex
            position="relative"
            align="center"
            opacity={isUsdInput ? 1 : 0.6}
            transform={isUsdInput ? "scale(1)" : "scale(0.95)"}
            transition="all 0.2s"
          >
            <Box position="absolute" left="12px" zIndex="1">
              <Text color={isUsdInput ? assetColor : "gray.500"} fontWeight="bold" fontSize={isUsdInput ? "lg" : "md"}>$</Text>
            </Box>
            <Input
              value={isUsdInput ? amount : nativeToUsd(amount)}
              onChange={isUsdInput ? onAmountChange : undefined}
              placeholder="0.00"
              color={isUsdInput ? "white" : "gray.400"}
              borderColor={isUsdInput ? assetColor : theme.border}
              borderWidth={isUsdInput ? "2px" : "1px"}
              bg={isUsdInput ? theme.cardBg : "rgba(255,255,255,0.02)"}
              _hover={{ borderColor: isUsdInput ? assetColorHover : theme.border }}
              _focus={{ borderColor: isUsdInput ? assetColor : theme.border }}
              p={3}
              pl="35px"
              pr="60px"
              height={isUsdInput ? "56px" : "48px"}
              fontSize={isUsdInput ? "xl" : "lg"}
              fontWeight={isUsdInput ? "bold" : "medium"}
              readOnly={!isUsdInput}
              cursor={!isUsdInput ? "pointer" : "text"}
            />
            <Box position="absolute" right="12px" zIndex="1">
              <Text color={isUsdInput ? "gray.400" : "gray.500"} fontSize={isUsdInput ? "md" : "sm"} fontWeight="medium">USD</Text>
            </Box>
          </Flex>
        </Box>

        {/* Divider with Switch Icon */}
        <Flex align="center" justify="center" position="relative" my={1}>
          <Box position="absolute" width="100%" height="1px" bg={theme.border} />
          <Box
            position="relative"
            bg={theme.cardBg}
            borderRadius="full"
            border="1px solid"
            borderColor={theme.border}
            p={2}
            cursor="pointer"
            onClick={onToggleInputMode}
            _hover={{
              borderColor: assetColor,
              bg: assetColorLight,
              transform: "rotate(180deg)"
            }}
            transition="all 0.3s"
            zIndex={1}
          >
            <Text fontSize="sm" color={assetColor}>⇅</Text>
          </Box>
        </Flex>

        {/* Secondary Input (Smaller) */}
        <Box
          onClick={() => isUsdInput && onToggleInputMode()}
          cursor={isUsdInput ? "pointer" : "default"}
          transition="all 0.2s"
        >
          <Flex
            position="relative"
            align="center"
            opacity={!isUsdInput ? 1 : 0.6}
            transform={!isUsdInput ? "scale(1)" : "scale(0.95)"}
            transition="all 0.2s"
          >
            <Input
              value={!isUsdInput ? amount : usdToNative(amount)}
              onChange={!isUsdInput ? onAmountChange : undefined}
              placeholder="0.00000000"
              color={!isUsdInput ? "white" : "gray.400"}
              borderColor={!isUsdInput ? assetColor : theme.border}
              borderWidth={!isUsdInput ? "2px" : "1px"}
              bg={!isUsdInput ? theme.cardBg : "rgba(255,255,255,0.02)"}
              _hover={{ borderColor: !isUsdInput ? assetColorHover : theme.border }}
              _focus={{ borderColor: !isUsdInput ? assetColor : theme.border }}
              p={3}
              pl="12px"
              pr="80px"
              height={!isUsdInput ? "56px" : "48px"}
              fontSize={!isUsdInput ? "xl" : "lg"}
              fontWeight={!isUsdInput ? "bold" : "medium"}
              readOnly={isUsdInput}
              cursor={isUsdInput ? "pointer" : "text"}
            />
            <Box position="absolute" right="12px" zIndex="1">
              <Text color={!isUsdInput ? assetColor : "gray.500"} fontSize={!isUsdInput ? "md" : "sm"} fontWeight="bold">{assetSymbol}</Text>
            </Box>
          </Flex>
        </Box>

        {/* Helper text */}
        <Text
          fontSize="xs"
          color="gray.500"
          textAlign="center"
          fontStyle="italic"
        >
          Click on either field to switch input mode
        </Text>
      </Stack>
    </Box>
  )
}
