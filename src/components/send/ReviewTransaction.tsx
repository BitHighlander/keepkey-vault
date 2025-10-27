'use client'

import React from 'react'
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  IconButton,
  Image,
  Textarea,
} from '@chakra-ui/react'
import { FaArrowRight, FaTimes } from 'react-icons/fa'
import { KeepKeyUiGlyph } from '@/components/logo/keepkey-ui-glyph'
import { keyframes } from '@emotion/react'
import ChangeControl from './ChangeControl'

// Animation keyframes
const scale = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`

interface ReviewTransactionProps {
  // Transaction state
  transactionStep: 'review' | 'sign' | 'broadcast' | 'success'
  loading: boolean
  unsignedTx: any

  // Asset context
  assetContext: any
  assetColor: string
  assetColorLight: string
  assetColorHover: string

  // Transaction details
  amount: string
  recipient: string
  memo?: string
  estimatedFee: string
  estimatedFeeUsd: string
  balance: string
  isMax: boolean
  isUsdInput: boolean

  // UI state
  showTxDetails: boolean
  showRawTxDialog: boolean
  editedRawTxJson: string

  // Theme
  theme: any

  // Callbacks
  closeConfirmation: () => void
  confirmTransaction: () => void
  setShowTxDetails: (show: boolean) => void
  openRawTxDialog: () => void
  closeRawTxDialog: () => void
  handleRawTxJsonChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  applyEditedJson: () => void
  formatTransactionDetails: (tx: any) => React.ReactNode
  usdToNative: (usd: string) => string
  nativeToUsd: (native: string) => string
  formatUsd: (value: number) => string
  getNetworkType: (networkId: string) => string
  onViewChangeOnDevice?: (output: any) => void
  onChangeAddressUpdate?: (outputIndex: number, newScriptType: string) => void
}

export const ReviewTransaction: React.FC<ReviewTransactionProps> = ({
  transactionStep,
  loading,
  unsignedTx,
  assetContext,
  assetColor,
  assetColorLight,
  assetColorHover,
  amount,
  recipient,
  memo,
  estimatedFee,
  estimatedFeeUsd,
  balance,
  isMax,
  isUsdInput,
  showTxDetails,
  showRawTxDialog,
  editedRawTxJson,
  theme,
  closeConfirmation,
  confirmTransaction,
  setShowTxDetails,
  openRawTxDialog,
  closeRawTxDialog,
  handleRawTxJsonChange,
  applyEditedJson,
  formatTransactionDetails,
  usdToNative,
  nativeToUsd,
  formatUsd,
  getNetworkType,
  onViewChangeOnDevice,
  onChangeAddressUpdate,
}) => {
  return (
    <Box height="100vh" bg={theme.bg}>
      <Box
        bg={theme.cardBg}
        borderColor={theme.border}
        borderWidth="1px"
        borderRadius="md"
        width="100%"
        height="100%"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        {/* Header */}
        <Box
          borderBottom="1px"
          borderColor={theme.border}
          p={5}
          bg={theme.cardBg}
        >
          <Flex justify="space-between" align="center">
            <Text fontSize="lg" fontWeight="bold" color={assetColor}>
              {transactionStep === 'review' ? 'Review Transaction' :
               transactionStep === 'sign' ? 'Signing Transaction' :
               transactionStep === 'broadcast' ? 'Broadcasting Transaction' : 'Confirm Transaction'}
            </Text>
            <IconButton
              aria-label="Close"
              onClick={closeConfirmation}
              size="sm"
              variant="ghost"
              color={assetColor}
              disabled={loading}
            >
              <FaTimes />
            </IconButton>
          </Flex>
        </Box>

        {/* Main Content */}
        <Box
          flex="1"
          p={5}
          overflowY="auto"
        >
          {/* Loading overlay for signing and broadcasting */}
          {(loading && (transactionStep === 'sign' || transactionStep === 'broadcast')) && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="rgba(0, 0, 0, 0.8)"
              zIndex={1000}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              p={4}
            >
              {transactionStep === 'sign' ? (
                <>
                  <Image
                    src="/images/hold-and-release.svg"
                    alt="Hold and Release Button on KeepKey"
                    width="200px"
                    mb={6}
                  />
                  <Text color={assetColor} fontSize="xl" fontWeight="bold" mb={2}>
                    Check Your KeepKey Device
                  </Text>
                  <Text color="gray.400" fontSize="md" textAlign="center" maxWidth="400px" mb={2}>
                    Please review the transaction details on your KeepKey
                  </Text>
                  <Text color="gray.400" fontSize="md" textAlign="center">
                    Hold the button to confirm or release to cancel
                  </Text>
                </>
              ) : (
                <>
                  <KeepKeyUiGlyph
                    boxSize="80px"
                    color={assetColor}
                    animation={`${scale} 2s ease-in-out infinite`}
                    mb={6}
                  />
                  <Text color={assetColor} fontSize="xl" fontWeight="bold" mb={2}>
                    Broadcasting Transaction...
                  </Text>
                  <Text color="gray.400" fontSize="md" textAlign="center">
                    Submitting transaction to the network
                  </Text>
                </>
              )}
            </Box>
          )}

          <Stack gap={5}>
            {/* Asset Information */}
            <Flex align="center" gap={3} width="100%">
              <Box
                borderRadius="full"
                overflow="hidden"
                boxSize="40px"
                p={1}
                bg={theme.cardBg}
                border="1px solid"
                borderColor={theme.border}
              >
                <Image
                  src={assetContext.icon}
                  alt={`${assetContext.name} Icon`}
                  boxSize="100%"
                  objectFit="contain"
                />
              </Box>
              <Box>
                <Text fontWeight="bold" color="white">
                  {isUsdInput ? usdToNative(amount) : amount} {assetContext.symbol}
                </Text>
                <Text color="gray.400" fontSize="sm">
                  {formatUsd(parseFloat(isUsdInput ? amount : nativeToUsd(amount)))}
                </Text>
              </Box>
            </Flex>

            {/* Recipient Details */}
            <Box
              p={4}
              bg={theme.bg}
              border="1px solid"
              borderColor={theme.border}
              borderRadius="md"
              width="100%"
            >
              <Text fontSize="sm" color="gray.400" mb={1}>
                Recipient
              </Text>
              <Text color="white" wordBreak="break-all" fontSize="sm">
                {recipient}
              </Text>

              {memo && (
                <>
                  <Text fontSize="sm" color="gray.400" mt={3} mb={1}>
                    Memo/Tag
                  </Text>
                  <Text color="white" wordBreak="break-all" fontSize="sm">
                    {memo}
                  </Text>
                </>
              )}
            </Box>

            {/* Fee Details - Hide for XRP */}
            {!assetContext?.caip?.includes('ripple') && !assetContext?.networkId?.includes('ripple') && (
              <Box
                p={4}
                bg={theme.bg}
                border="1px solid"
                borderColor={theme.border}
                borderRadius="md"
                width="100%"
              >
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" color="gray.400">
                    Network Fee
                  </Text>
                  <Box textAlign="right">
                    <Text color="white" fontSize="sm">
                      {estimatedFee} {assetContext.symbol}
                    </Text>
                    <Text color="gray.400" fontSize="xs">
                      ≈ ${estimatedFeeUsd} USD
                    </Text>
                  </Box>
                </Flex>

                <Flex justify="space-between" align="center" mt={3}>
                  <Text fontSize="sm" color="gray.400">
                    Total
                  </Text>
                  <Box textAlign="right">
                    <Text color="white" fontWeight="bold" fontSize="sm">
                      {(() => {
                        const nativeAmount = isUsdInput ? usdToNative(amount) : amount;
                        const totalNative = isMax ? balance : (parseFloat(nativeAmount || '0') + parseFloat(estimatedFee || '0')).toFixed(8);
                        return `${totalNative} ${assetContext.symbol}`;
                      })()}
                    </Text>
                    <Text color="gray.400" fontSize="xs">
                      {(() => {
                        const nativeAmount = isUsdInput ? usdToNative(amount) : amount;
                        const totalNative = parseFloat(nativeAmount || '0') + parseFloat(estimatedFee || '0');
                        return formatUsd(totalNative * (assetContext.priceUsd || 0));
                      })()}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )}

            {/* Change Control for UTXO transactions */}
            {unsignedTx?.unsignedTx && getNetworkType(assetContext?.networkId || '') === 'UTXO' && (
              <ChangeControl
                changeOutputs={unsignedTx.unsignedTx.outputs || []}
                assetColor={assetColor}
                assetColorLight={assetColorLight}
                theme={theme}
                onViewOnDevice={onViewChangeOnDevice}
                onChangeAddressUpdate={onChangeAddressUpdate}
              />
            )}

            {/* Transaction Details */}
            {unsignedTx && (
              <Box width="100%" mt={4}>
                <Box
                  as="button"
                  onClick={() => setShowTxDetails(!showTxDetails)}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="100%"
                  p={2}
                  bg="transparent"
                  border="1px solid"
                  borderColor={theme.border}
                  borderRadius="md"
                  color="white"
                  _hover={{ borderColor: assetColor }}
                >
                  <Text fontSize="sm">
                    {showTxDetails ? 'Hide Transaction Details' : 'Show Transaction Details'}
                  </Text>
                  <Box transform={showTxDetails ? 'rotate(180deg)' : 'none'} transition="transform 0.2s">
                    <FaArrowRight transform="rotate(90deg)" />
                  </Box>
                </Box>

                {showTxDetails && (
                  <Box
                    mt={3}
                    p={3}
                    borderRadius="md"
                    bg={theme.bg}
                    borderWidth="1px"
                    borderColor={theme.border}
                  >
                    {formatTransactionDetails(unsignedTx?.unsignedTx)}

                    {/* Add Raw Transaction Button */}
                    <Button
                      mt={3}
                      size="sm"
                      variant="outline"
                      width="100%"
                      borderColor={theme.border}
                      color={assetColor}
                      _hover={{ borderColor: assetColor, bg: assetColorLight }}
                      onClick={openRawTxDialog}
                    >
                      Edit Raw Transaction JSON
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {/* Raw Transaction Dialog */}
            {showRawTxDialog && (
              <Box
                position="fixed"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="rgba(0, 0, 0, 0.8)"
                zIndex="1000"
                display="flex"
                justifyContent="center"
                alignItems="center"
                p={4}
              >
                <Box
                  bg={theme.cardBg}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={theme.border}
                  width="90%"
                  maxWidth="800px"
                  maxHeight="90vh"
                  overflow="hidden"
                  display="flex"
                  flexDirection="column"
                >
                  <Box
                    p={4}
                    borderBottom="1px"
                    borderColor={theme.border}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text color={assetColor} fontWeight="bold" fontSize="lg">
                      Raw Transaction JSON
                    </Text>
                    <IconButton
                      aria-label="Close"
                      size="sm"
                      variant="ghost"
                      color={assetColor}
                      onClick={closeRawTxDialog}
                    >
                      <FaTimes />
                    </IconButton>
                  </Box>

                  <Box
                    p={4}
                    flex="1"
                    overflowY="auto"
                  >
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Edit the transaction JSON below:
                    </Text>
                    <Textarea
                      value={editedRawTxJson}
                      onChange={handleRawTxJsonChange}
                      p={3}
                      height="300px"
                      width="100%"
                      fontFamily="mono"
                      fontSize="sm"
                      color="white"
                      bg={theme.bg}
                      border="1px solid"
                      borderColor={theme.border}
                      borderRadius="md"
                      resize="vertical"
                      _focus={{
                        borderColor: assetColor,
                        outline: "none"
                      }}
                    />
                  </Box>

                  <Box
                    p={4}
                    borderTop="1px"
                    borderColor={theme.border}
                    display="flex"
                    justifyContent="flex-end"
                    gap={3}
                  >
                    <Button
                      variant="outline"
                      color="gray.400"
                      borderColor={theme.border}
                      onClick={closeRawTxDialog}
                    >
                      Cancel
                    </Button>
                    <Button
                      bg={assetColor}
                      color="black"
                      _hover={{ bg: assetColorHover }}
                      onClick={applyEditedJson}
                    >
                      Apply Changes
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Footer with Action Buttons */}
        <Box
          borderTop="1px"
          borderColor={theme.border}
          p={5}
        >
          <Stack gap={3}>
            <Button
              width="100%"
              bg={assetColor}
              color="black"
              _hover={{
                bg: assetColorHover,
              }}
              onClick={confirmTransaction}
              loading={loading}
              height="56px"
              fontSize="lg"
              boxShadow={`0px 4px 12px ${assetColor}4D`}
            >
              Sign & Send
            </Button>

            <Button
              width="100%"
              variant="outline"
              color={assetColor}
              borderColor={theme.border}
              _hover={{
                bg: 'rgba(255, 215, 0, 0.1)',
                borderColor: assetColor,
              }}
              onClick={closeConfirmation}
              height="56px"
            >
              Cancel
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
