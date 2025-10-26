'use client'

import React from 'react'
import {
  Box,
  Text,
  Stack,
  Input,
} from '@chakra-ui/react'

interface RecipientInputProps {
  recipient: string
  assetSymbol: string
  assetColor: string
  assetColorHover: string
  onRecipientChange: (value: string) => void
  theme: {
    cardBg: string
    borderRadius: string
    formPadding: string
    border: string
  }
}

export const RecipientInput: React.FC<RecipientInputProps> = ({
  recipient,
  assetSymbol,
  assetColor,
  assetColorHover,
  onRecipientChange,
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
        <Text color="white" fontWeight="medium">Recipient</Text>
        <Input
          value={recipient}
          onChange={(e) => onRecipientChange(e.target.value)}
          placeholder={`${assetSymbol} Address`}
          color="white"
          borderColor={theme.border}
          _hover={{ borderColor: assetColorHover }}
          _focus={{ borderColor: assetColor }}
          p={3}
          height="50px"
          fontSize="md"
        />
      </Stack>
    </Box>
  )
}
