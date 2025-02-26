'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  Input,
  Spinner,
} from '@chakra-ui/react'
import { usePioneerContext } from '@/components/providers/pioneer'
import { FaArrowRight, FaPaperPlane, FaTimes, FaWallet } from 'react-icons/fa'

// Theme colors - matching our dashboard theme
const theme = {
  bg: '#000000',
  cardBg: '#111111',
  gold: '#FFD700',
  goldHover: '#FFE135',
  border: '#222222',
}

interface SendProps {
  onBackClick?: () => void
}

// Tendermint networks with memo support
const TENDERMINT_SUPPORT = [
  'cosmos:mayachain-mainnet-v1/slip44:931',
  'cosmos:osmosis-1/slip44:118',
  'cosmos:cosmoshub-4/slip44:118',
  'cosmos:kaiyo-1/slip44:118',
  'cosmos:thorchain-mainnet-v1/slip44:931',
]

// Other networks with special tag fields
const OTHER_SUPPORT = ['ripple:4109c6f2045fc7eff4cde8f9905d19c2/slip44:144']

const Send: React.FC<SendProps> = ({ onBackClick }) => {
  // Dialog state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const openConfirmation = () => setShowConfirmation(true)
  const closeConfirmation = () => setShowConfirmation(false)
  
  const pioneer = usePioneerContext()
  const { state } = pioneer
  const { asset } = state

  // State for input fields
  const [amount, setAmount] = useState<string>('')
  const [recipient, setRecipient] = useState<string>('')
  const [memo, setMemo] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [balance, setBalance] = useState<string>('0')
  const [totalBalanceUsd, setTotalBalanceUsd] = useState<number>(0)

  // Calculate total balance
  useEffect(() => {
    if (asset) {
      try {
        setBalance(asset.balance || '0')
        setTotalBalanceUsd(parseFloat(asset.balance || '0') * (asset.priceUsd || 0))
      } catch (e) {
        console.error('Error setting balance:', e)
        setBalance('0')
        setTotalBalanceUsd(0)
      }
    }
  }, [asset])

  // Format USD value
  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })
  }

  // Handle amount input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow only numbers and a single decimal point
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setAmount(value)
    }
  }

  // Set max amount (full balance)
  const handleSetMax = () => {
    setAmount(balance)
  }

  // Handle send transaction
  const handleSend = async () => {
    if (!amount || !recipient) {
      console.error('Missing fields')
      return
    }

    setLoading(true)
    try {
      // Show confirmation dialog
      openConfirmation()
    } catch (error) {
      console.error('Error preparing transaction:', error)
    } finally {
      setLoading(false)
    }
  }

  // Confirm and execute transaction
  const confirmTransaction = async () => {
    closeConfirmation()
    setLoading(true)
    try {
      // In a real implementation, this would call the API to send the transaction
      // For now, we'll simulate a successful transaction
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log('Transaction sent successfully')
      
      // Reset form
      setAmount('')
      setRecipient('')
      setMemo('')
    } catch (error) {
      console.error('Transaction error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!asset) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" color={theme.gold} />
        <Text mt={4}>Loading asset information...</Text>
      </Box>
    )
  }

  const networkColor = asset.networkColor || '#3182CE'

  // Render confirmation overlay if needed
  if (showConfirmation) {
    return (
      <Box 
        position="fixed" 
        top="0" 
        left="0" 
        right="0" 
        bottom="0" 
        bg="rgba(0,0,0,0.8)" 
        zIndex={999}
        display="flex"
        alignItems="center"
        justifyContent="center"
        p={4}
      >
        <Box 
          bg={theme.cardBg} 
          borderRadius="xl" 
          maxW="500px" 
          w="100%" 
          p={0}
          position="relative"
          overflow="hidden"
          borderWidth="1px"
          borderColor={theme.border}
        >
          {/* Header */}
          <Box 
            p={4} 
            borderBottomWidth="1px" 
            borderBottomColor={theme.border}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Text fontWeight="bold" fontSize="lg">Confirm Transaction</Text>
            <Button size="sm" variant="ghost" onClick={closeConfirmation}>
              <FaTimes />
            </Button>
          </Box>
          
          {/* Body */}
          <Box p={5}>
            <Stack gap={4}>
              <Box p={4} bg="blackAlpha.300" borderRadius="md">
                <Text>You are about to send:</Text>
                <Text fontSize="xl" fontWeight="bold">
                  {amount} {asset.symbol}
                  <Text as="span" fontSize="md" color="gray.400" ml={2}>
                    ({formatUsd(parseFloat(amount) * (asset.priceUsd || 0))})
                  </Text>
                </Text>
              </Box>
              
              <Box>
                <Text color="gray.400">To address:</Text>
                <Text fontWeight="medium" wordBreak="break-all">{recipient}</Text>
              </Box>

              {memo && (
                <Box>
                  <Text color="gray.400">Memo:</Text>
                  <Text>{memo}</Text>
                </Box>
              )}

              <Box p={4} bg="yellow.900" borderRadius="md" opacity={0.8}>
                <Flex gap={2} align="center">
                  <Box as={FaWallet} />
                  <Text>Please verify all details before confirming.</Text>
                </Flex>
              </Box>
            </Stack>
          </Box>
          
          {/* Footer */}
          <Box 
            p={4} 
            borderTopWidth="1px" 
            borderTopColor={theme.border}
            display="flex"
            justifyContent="flex-end"
            gap={3}
          >
            <Button variant="outline" onClick={closeConfirmation}>
              Cancel
            </Button>
            <Button 
              colorScheme="yellow"
              bg={theme.gold}
              color="black"
              onClick={confirmTransaction}
              loading={loading}
            >
              <Flex gap={2} align="center">
                <Box as={FaArrowRight} />
                <span>Confirm Send</span>
              </Flex>
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box height="100%" bg={theme.bg} p={4}>
      {/* Header with back button */}
      <Flex justify="space-between" align="center" mb={4}>
        <Button
          variant="ghost"
          color={theme.gold}
          onClick={onBackClick}
          _hover={{ color: theme.goldHover }}
        >
          <Flex gap={2} align="center">
            <Box as={FaTimes} />
            <span>Back</span>
          </Flex>
        </Button>
        <Text fontSize="xl" fontWeight="bold" color={theme.gold}>
          Send {asset.symbol}
        </Text>
        <Box w="40px"></Box> {/* Empty box for alignment */}
      </Flex>

      {/* Asset information */}
      <Box
        borderRadius="xl"
        bg={theme.cardBg}
        p={4}
        mb={4}
        borderWidth="1px"
        borderColor={`${networkColor}40`}
        boxShadow={`0 4px 20px ${networkColor}20, inset 0 0 20px ${networkColor}10`}
      >
        <Flex gap={4}>
          <Box 
            borderRadius="full" 
            overflow="hidden" 
            boxSize="48px"
            bg={networkColor}
          >
            <img 
              src={asset.icon} 
              alt={asset.symbol} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
          <Box>
            <Text fontWeight="bold" fontSize="lg">
              {asset.name} 
              <Box as="span" ml={2} px={2} py={1} bg="blue.800" color="blue.200" borderRadius="md" fontSize="xs">
                {asset.network}
              </Box>
            </Text>
            <Text>{balance} {asset.symbol}</Text>
            <Text color="gray.400">
              ({formatUsd(totalBalanceUsd)})
            </Text>
          </Box>
        </Flex>
      </Box>

      {/* Send form */}
      <Box
        borderRadius="xl"
        bg={theme.cardBg}
        p={5}
        borderWidth="1px"
        borderColor={theme.border}
      >
        <Stack gap={4}>
          {/* Amount input */}
          <Box>
            <Text mb={2} fontWeight="medium">Amount</Text>
            <Box position="relative">
              <Input
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                borderColor={theme.border}
                bg="blackAlpha.300"
                paddingRight="70px"
              />
              <Button 
                position="absolute"
                right="2px"
                top="50%"
                transform="translateY(-50%)"
                h="1.75rem" 
                size="sm" 
                onClick={handleSetMax}
              >
                Max
              </Button>
            </Box>
            {amount && (
              <Text fontSize="sm" color="gray.400" mt={1}>
                ≈ {formatUsd(parseFloat(amount) * (asset.priceUsd || 0))}
              </Text>
            )}
          </Box>

          {/* Recipient address */}
          <Box>
            <Text mb={2} fontWeight="medium">Recipient</Text>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={`Enter ${asset.symbol} address`}
              borderColor={theme.border}
              bg="blackAlpha.300"
            />
          </Box>

          {/* Optional memo */}
          <Box>
            <Text mb={2} fontWeight="medium">Memo (Optional)</Text>
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add a note to this transaction"
              borderColor={theme.border}
              bg="blackAlpha.300"
              h="auto"
              py={2}
              minH="80px"
            />
          </Box>

          {/* Send button */}
          <Button
            colorScheme="yellow"
            bg={theme.gold}
            color="black"
            size="lg"
            onClick={handleSend}
            loading={loading}
            _hover={{ bg: theme.goldHover }}
            mt={4}
          >
            <Flex gap={2} align="center">
              <Box as={FaPaperPlane} />
              <span>Send {asset.symbol}</span>
            </Flex>
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default Send 