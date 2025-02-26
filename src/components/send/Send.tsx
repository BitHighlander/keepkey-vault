'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Text,
  Stack,
  Flex,
  Input,
  IconButton,
} from '@chakra-ui/react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePioneerContext } from '@/components/providers/pioneer'
import { FaArrowRight, FaPaperPlane, FaTimes, FaWallet, FaExternalLinkAlt, FaCheck, FaCopy } from 'react-icons/fa'
import Confetti from 'react-confetti'

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

// TypeScript interfaces for transaction data
interface SendPayload {
  caip: string;
  to: string;
  amount: string;
  feeLevel: number;
  isMax: boolean;
  memo?: string;
}

interface TransactionState {
  method: string;
  caip: string;
  params: SendPayload;
  unsignedTx: any;
  signedTx: any;
  state: string;
  context: any;
}

const Send: React.FC<SendProps> = ({ onBackClick }) => {
  // Dialog state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const openConfirmation = () => setShowConfirmation(true)
  const closeConfirmation = () => setShowConfirmation(false)
  
  const pioneer = usePioneerContext()
  const { state } = pioneer
  const { app } = state
  const assetContext = app?.assetContext

  // State for input fields
  const [amount, setAmount] = useState<string>('')
  const [recipient, setRecipient] = useState<string>('')
  const [memo, setMemo] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [balance, setBalance] = useState<string>('0')
  const [totalBalanceUsd, setTotalBalanceUsd] = useState<number>(0)
  
  // Transaction state
  const [txHash, setTxHash] = useState<string>('')
  const [txSuccess, setTxSuccess] = useState<boolean>(false)
  const [isMax, setIsMax] = useState<boolean>(false)
  const [unsignedTx, setUnsignedTx] = useState<any>(null)
  const [signedTx, setSignedTx] = useState<any>(null)
  const [transactionStep, setTransactionStep] = useState<'build' | 'sign' | 'broadcast' | 'success'>('build')
  const [estimatedFee, setEstimatedFee] = useState<string>('0.0001')
  
  // Add a state to track if asset data has loaded
  const [assetLoaded, setAssetLoaded] = useState<boolean>(false)
  
  // Manual copy to clipboard implementation
  const [hasCopied, setHasCopied] = useState(false)
  const copyToClipboard = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash)
        .then(() => {
          setHasCopied(true)
          setTimeout(() => setHasCopied(false), 2000)
        })
        .catch(err => {
          console.error('Error copying to clipboard:', err)
        })
    }
  }

  // Calculate total balance
  useEffect(() => {
    if (assetContext) {
      try {
        setBalance(assetContext.balance || '0')
        setTotalBalanceUsd(parseFloat(assetContext.balance || '0') * (assetContext.priceUsd || 0))
        setAssetLoaded(true)
        setLoading(false)
      } catch (e) {
        console.error('Error setting balance:', e)
        setBalance('0')
        setTotalBalanceUsd(0)
        setLoading(false)
      }
    } else {
      // Check if context is available after a short delay
      const timer = setTimeout(() => {
        if (!assetLoaded) setLoading(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [assetContext, assetLoaded])

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
      setIsMax(false)
    }
  }

  // Set max amount (full balance)
  const handleSetMax = () => {
    setAmount(balance)
    setIsMax(true)
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
      setTransactionStep('build')
      openConfirmation()
    } catch (error) {
      console.error('Error preparing transaction:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build transaction
  const buildTransaction = async () => {
    setLoading(true)
    try {
      // Use the Pioneer SDK to build the transaction
      const caip = assetContext?.caip || assetContext?.assetId
      
      if (!caip) {
        throw new Error('Missing asset CAIP')
      }
      
      const sendPayload: SendPayload = {
        caip,
        to: recipient,
        amount,
        feeLevel: 5, // Default fee level
        isMax,
      }
      
      if (memo && supportsMemo) {
        sendPayload.memo = memo
      }
      
      console.log('Build TX Payload:', sendPayload)
      
      // Call the SDK's buildTx method
      const unsignedTxResult = await app.buildTx(sendPayload)
      console.log('Unsigned TX Result:', unsignedTxResult)
      
      // Store the unsigned transaction
      const transactionState: TransactionState = {
        method: 'transfer',
        caip,
        params: sendPayload,
        unsignedTx: unsignedTxResult,
        signedTx: null,
        state: 'unsigned',
        context: assetContext,
      }
      
      setUnsignedTx(transactionState)
      setTransactionStep('sign')
      
      // For demo purposes, automatically proceed to signing
      return transactionState
    } catch (error) {
      console.error('Transaction build error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }
  
  // Sign transaction
  const signTransaction = async (txState: TransactionState) => {
    setLoading(true)
    try {
      const caip = assetContext?.caip || assetContext?.assetId
      
      if (!txState?.unsignedTx) {
        throw new Error('No unsigned transaction to sign')
      }
      
      console.log('Signing TX:', txState.unsignedTx)
      
      // Call the SDK's signTx method
      const signedTxResult = await app.signTx({ 
        caip, 
        unsignedTx: txState.unsignedTx 
      })
      
      console.log('Signed TX Result:', signedTxResult)
      setSignedTx(signedTxResult)
      setTransactionStep('broadcast')
      
      return signedTxResult
    } catch (error) {
      console.error('Transaction signing error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }
  
  // Broadcast transaction
  const broadcastTransaction = async (signedTxData: any) => {
    setLoading(true)
    try {
      const caip = assetContext?.caip || assetContext?.assetId
      
      if (!signedTxData) {
        throw new Error('No signed transaction to broadcast')
      }
      
      console.log('Broadcasting TX:', signedTxData)
      
      // Call the SDK's broadcastTx method
      const broadcastResult = await app.broadcastTx(caip, signedTxData)
      
      console.log('Broadcast Result:', broadcastResult)
      
      // Extract the transaction hash from the result
      const finalTxHash = broadcastResult.txHash || broadcastResult.txid || ''
      setTxHash(finalTxHash)
      setTxSuccess(true)
      setTransactionStep('success')
      
      return broadcastResult
    } catch (error) {
      console.error('Transaction broadcast error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Confirm and execute transaction
  const confirmTransaction = async () => {
    setLoading(true)
    try {
      // Step 1: Build the transaction
      const builtTx = await buildTransaction()
      
      // Step 2: Sign the transaction
      const signedTxData = await signTransaction(builtTx)
      
      // Step 3: Broadcast the transaction
      await broadcastTransaction(signedTxData)
      
      console.log('Transaction sent successfully')
    } catch (error) {
      console.error('Transaction error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Function to handle viewing transaction on explorer
  const viewOnExplorer = () => {
    if (!txHash) return
    
    const explorerUrl = assetContext?.explorerTxLink 
      ? `${assetContext.explorerTxLink}${txHash}`
      : `https://explorer.keepkey.com/tx/${txHash}`
    
    window.open(explorerUrl, '_blank', 'noopener,noreferrer')
  }
  
  // Reset the form after completing a transaction
  const resetForm = () => {
    setAmount('')
    setRecipient('')
    setMemo('')
    setTxHash('')
    setTxSuccess(false)
    setUnsignedTx(null)
    setSignedTx(null)
    setTransactionStep('build')
    setShowConfirmation(false)
  }

  if (!assetContext) {
    return (
      <Box p={6}>
        <Stack gap={4}>
          <Skeleton height="60px" width="100%" />
          <Skeleton height="40px" width="70%" />
          <Skeleton height="80px" width="100%" />
          <Skeleton height="40px" width="90%" />
          <Skeleton height="50px" width="100%" />
          <Text color="gray.400" textAlign="center" mt={2}>
            Loading asset information...
          </Text>
        </Stack>
      </Box>
    )
  }

  const networkColor = assetContext.color || '#3182CE'
  
  // Network supports memo
  const supportsMemo = TENDERMINT_SUPPORT.includes(assetContext.assetId) || OTHER_SUPPORT.includes(assetContext.assetId);

  // Render confirmation overlay if needed
  if (showConfirmation) {
    // Transaction success screen
    if (transactionStep === 'success' && txSuccess) {
      return (
        <Box 
          height="600px"
          bg={theme.bg}
          overflow="hidden"
        >
          {/* Show confetti animation */}
          <Confetti 
            width={375}
            height={600}
            recycle={false}
            numberOfPieces={200}
          />
          
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
              p={4}
              bg={theme.cardBg}
            >
              <Flex justify="space-between" align="center">
                <Text fontSize="lg" fontWeight="bold" color={theme.gold}>
                  Transaction Complete
                </Text>
                <IconButton
                  aria-label="Close"
                  onClick={resetForm}
                  size="sm"
                  variant="ghost"
                  color={theme.gold}
                >
                  <FaTimes />
                </IconButton>
              </Flex>
            </Box>
            
            {/* Main Content */}
            <Box 
              flex="1" 
              p={4} 
              overflowY="auto"
            >
              <Stack gap={6} align="center">
                <Box 
                  borderRadius="full" 
                  bg="green.500" 
                  color="white" 
                  width="70px" 
                  height="70px" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center"
                  fontSize="3xl"
                  mt={2}
                >
                  <FaCheck />
                </Box>
                
                <Text fontSize="xl" fontWeight="bold" color="white" textAlign="center">
                  Transaction Sent Successfully!
                </Text>
                
                <Box width="100%">
                  <Text color="gray.500" fontSize="sm">Amount</Text>
                  <Text fontSize="xl" fontWeight="bold" color="white">
                    {amount} {assetContext.symbol}
                  </Text>
                  <Text color="gray.500" fontSize="sm" mt={1}>
                    ≈ {formatUsd(parseFloat(amount) * (assetContext.priceUsd || 0))}
                  </Text>
                </Box>
                
                <Box as="hr" borderColor="gray.700" opacity={0.2} my={2} width="100%" />
                
                <Box width="100%">
                  <Text color="gray.500" fontSize="sm">Transaction Hash</Text>
                  <Flex align="center" mt={1}>
                    <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all" flex="1">
                      {txHash}
                    </Text>
                    <IconButton
                      aria-label="Copy to clipboard"
                      onClick={copyToClipboard}
                      size="sm"
                      variant="ghost"
                      color={hasCopied ? "green.400" : "gray.400"}
                    >
                      {hasCopied ? <FaCheck /> : <FaCopy />}
                    </IconButton>
                  </Flex>
                </Box>
              </Stack>
            </Box>
            
            {/* Footer with Action Buttons */}
            <Box 
              borderTop="1px" 
              borderColor={theme.border}
              p={4}
            >
              <Stack gap={3}>
                <Button
                  width="100%"
                  bg={theme.gold}
                  color="black"
                  _hover={{
                    bg: theme.goldHover,
                  }}
                  onClick={viewOnExplorer}
                >
                  <Flex gap={2} align="center">
                    <FaExternalLinkAlt />
                    <Text>View on Explorer</Text>
                  </Flex>
                </Button>
                
                <Button
                  width="100%"
                  variant="outline"
                  color={theme.gold}
                  borderColor={theme.border}
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                    borderColor: theme.gold,
                  }}
                  onClick={resetForm}
                >
                  Close
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      );
    }
    
    // Transaction in progress
    return (
      <Box 
        height="600px"
        bg={theme.bg}
        overflow="hidden"
      >
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
            p={4}
            bg={theme.cardBg}
          >
            <Flex justify="space-between" align="center">
              <Text fontSize="lg" fontWeight="bold" color={theme.gold}>
                Confirm Transaction
              </Text>
              <IconButton
                aria-label="Close"
                onClick={closeConfirmation}
                size="sm"
                variant="ghost"
                color={theme.gold}
              >
                <FaTimes />
              </IconButton>
            </Flex>
          </Box>
          
          {/* Main Content */}
          <Box 
            flex="1" 
            p={4} 
            overflowY="auto"
          >
            <Stack gap={6}>
              <Box>
                <Text color="gray.500" fontSize="sm">You are sending</Text>
                <Text fontSize="xl" fontWeight="bold" color="white">
                  {amount} {assetContext.symbol}
                </Text>
                <Text color="gray.500" fontSize="sm" mt={1}>
                  ≈ {formatUsd(parseFloat(amount) * (assetContext.priceUsd || 0))}
                </Text>
              </Box>
              
              <Box>
                <Text color="gray.500" fontSize="sm">To address</Text>
                <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all">
                  {recipient}
                </Text>
              </Box>
              
              {supportsMemo && memo && (
                <Box>
                  <Text color="gray.500" fontSize="sm">
                    {assetContext.networkId?.includes('cosmos') ? 'Memo' : 'Tag'}
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all">
                    {memo}
                  </Text>
                </Box>
              )}

              <Box as="hr" borderColor="gray.700" opacity={0.2} my={2} />
              
              <Box>
                <Text color="gray.500" fontSize="sm">Network</Text>
                <Flex align="center" gap={2} mt={1}>
                  <Box 
                    width="10px" 
                    height="10px" 
                    borderRadius="full" 
                    bg={networkColor} 
                  />
                  <Text color="white" fontSize="sm">
                    {assetContext.networkId || 'Unknown Network'}
                  </Text>
                </Flex>
              </Box>

              <Box>
                <Text color="gray.500" fontSize="sm">Estimated fee</Text>
                <Text color="white" fontSize="sm">
                  {estimatedFee} {assetContext.symbol}
                </Text>
              </Box>
            </Stack>
          </Box>
          
          {/* Footer with Action Buttons */}
          <Box 
            borderTop="1px" 
            borderColor={theme.border}
            p={4}
          >
            <Stack gap={3}>
              <Button
                width="100%"
                bg={theme.gold}
                color="black"
                _hover={{
                  bg: theme.goldHover,
                }}
                onClick={confirmTransaction}
                loading={loading}
              >
                Confirm & Send
              </Button>
              
              <Button
                width="100%"
                variant="outline"
                color={theme.gold}
                borderColor={theme.border}
                _hover={{
                  bg: 'rgba(255, 215, 0, 0.1)',
                  borderColor: theme.gold,
                }}
                onClick={closeConfirmation}
              >
                Cancel
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    );
  }

  // Normal send form
  return (
    <Box height="600px" bg={theme.bg}>
      {/* Header - omitted in dialog mode since header is provided by dialog */}
      
      {/* Main Content */}
      <Box p={4}>
        <Stack gap={6}>
          <Stack>
            <Text color="gray.400" fontSize="sm">
              Balance: {balance} {assetContext.symbol}
            </Text>
            <Text color={theme.gold} fontSize="sm">
              {formatUsd(totalBalanceUsd)}
            </Text>
          </Stack>
          
          {/* Amount */}
          <Stack gap={2}>
            <Text color="white" fontWeight="medium">Amount</Text>
            <Flex>
              <Input
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                color="white"
                borderColor={theme.border}
                _hover={{ borderColor: theme.goldHover }}
                _focus={{ borderColor: theme.gold }}
                flex="1"
              />
              <Button
                ml={2}
                bg={theme.cardBg}
                color={theme.gold}
                borderColor={theme.border}
                borderWidth="1px"
                _hover={{
                  bg: 'rgba(255, 215, 0, 0.1)',
                  borderColor: theme.gold,
                }}
                onClick={handleSetMax}
              >
                MAX
              </Button>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              ≈ {formatUsd(parseFloat(amount || '0') * (assetContext.priceUsd || 0))}
            </Text>
          </Stack>
          
          {/* Recipient */}
          <Stack gap={2}>
            <Text color="white" fontWeight="medium">Recipient</Text>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={`${assetContext.symbol} Address`}
              color="white"
              borderColor={theme.border}
              _hover={{ borderColor: theme.goldHover }}
              _focus={{ borderColor: theme.gold }}
            />
          </Stack>
          
          {/* Memo/Tag (only for supported networks) */}
          {supportsMemo && (
            <Stack gap={2}>
              <Text color="white" fontWeight="medium">
                {assetContext.networkId?.includes('cosmos') ? 'Memo' : 'Tag'} (Optional)
              </Text>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={assetContext.networkId?.includes('cosmos') ? 'Memo' : 'Destination Tag'}
                color="white"
                borderColor={theme.border}
                _hover={{ borderColor: theme.goldHover }}
                _focus={{ borderColor: theme.gold }}
              />
            </Stack>
          )}
          
          {/* Send Button */}
          <Button
            mt={4}
            width="100%"
            bg={theme.gold}
            color="black"
            _hover={{
              bg: theme.goldHover,
            }}
            onClick={handleSend}
            disabled={!amount || !recipient}
          >
            <Flex gap={2} align="center">
              <FaPaperPlane />
              <Text>Send {assetContext.symbol}</Text>
            </Flex>
          </Button>
          
          {/* Cancel Button */}
          <Button
            width="100%"
            variant="outline"
            color={theme.gold}
            borderColor={theme.border}
            _hover={{
              bg: 'rgba(255, 215, 0, 0.1)',
              borderColor: theme.gold,
            }}
            onClick={onBackClick}
          >
            Cancel
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default Send; 