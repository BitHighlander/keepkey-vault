'use client'

import React from 'react'
import {
  Box,
  Text,
  Stack,
  Input,
} from '@chakra-ui/react'

interface MemoInputProps {
  memo: string
  networkId: string
  assetColor: string
  assetColorHover: string
  onMemoChange: (value: string) => void
  theme: {
    cardBg: string
    borderRadius: string
    formPadding: string
    border: string
  }
}

export const MemoInput: React.FC<MemoInputProps> = ({
  memo,
  networkId,
  assetColor,
  assetColorHover,
  onMemoChange,
  theme,
}) => {
  const isCosmos = networkId?.includes('cosmos')

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
        <Text color="white" fontWeight="medium">
          {isCosmos ? 'Memo' : 'Tag'} (Optional)
        </Text>
        <Input
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder={isCosmos ? 'Memo' : 'Destination Tag'}
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
