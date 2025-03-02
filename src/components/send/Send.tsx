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
  VStack,
  Image,
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
  formPadding: '16px', // Added for consistent form padding
  borderRadius: '12px', // Added for consistent border radius
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
  
  // Add state to track if we're entering amount in USD
  const [isUsdInput, setIsUsdInput] = useState<boolean>(false)
  
  // Transaction state
  const [txHash, setTxHash] = useState<string>('')
  const [txSuccess, setTxSuccess] = useState<boolean>(false)
  const [isMax, setIsMax] = useState<boolean>(false)
  const [unsignedTx, setUnsignedTx] = useState<any>(null)
  const [signedTx, setSignedTx] = useState<any>(null)
  const [transactionStep, setTransactionStep] = useState<'build' | 'sign' | 'broadcast' | 'success'>('build')
  const [estimatedFee, setEstimatedFee] = useState<string>('0.0001')
  // Add state for fee in USD
  const [estimatedFeeUsd, setEstimatedFeeUsd] = useState<string>('0.00')
  
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
        
        // Also update fee in USD when asset context changes
        updateFeeInUsd(estimatedFee);
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
  }, [assetContext, assetLoaded, estimatedFee])

  // Format USD value
  const formatUsd = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })
  }

  // Convert USD to native token amount
  const usdToNative = (usdAmount: string): string => {
    if (!usdAmount || !assetContext.priceUsd || parseFloat(assetContext.priceUsd) === 0) return '0';
    const nativeAmount = parseFloat(usdAmount) / parseFloat(assetContext.priceUsd);
    // Return formatted with appropriate decimal places
    return nativeAmount.toFixed(8);
  }

  // Convert native token amount to USD
  const nativeToUsd = (nativeAmount: string): string => {
    if (!nativeAmount || !assetContext.priceUsd) return '0';
    const usdAmount = parseFloat(nativeAmount) * parseFloat(assetContext.priceUsd);
    // Return with 2 decimal places for USD
    return usdAmount.toFixed(2);
  }

  // Calculate fee in USD
  const updateFeeInUsd = (feeInNative: string) => {
    if (!feeInNative || !assetContext?.priceUsd) {
      setEstimatedFeeUsd('0.00');
      return;
    }
    
    try {
      let feeValue = parseFloat(feeInNative);
      
      // Special handling for EVM chains - if fee is too large, it's likely in gwei
      if (assetContext.networkId?.startsWith('eip155:') && feeValue > 1) {
        // Convert from gwei to ETH equivalent
        const gweiToEth = 0.000000001;
        feeValue = feeValue * gweiToEth;
      }
      
      const feeUsd = feeValue * parseFloat(assetContext.priceUsd);
      setEstimatedFeeUsd(feeUsd.toFixed(2));
    } catch (error) {
      console.error('Error calculating fee in USD:', error);
      setEstimatedFeeUsd('0.00');
    }
  };

  // Toggle between USD and native input
  const toggleInputMode = () => {
    if (amount) {
      // Convert the current amount when switching modes
      if (isUsdInput) {
        // Converting from USD to native
        setAmount(usdToNative(amount));
      } else {
        // Converting from native to USD
        setAmount(nativeToUsd(amount));
      }
    }
    setIsUsdInput(!isUsdInput);
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
    if (isUsdInput) {
      // If in USD mode, set max as the USD value of the balance
      setAmount(nativeToUsd(balance));
    } else {
      // In native mode, set the native balance
      setAmount(balance);
    }
    setIsMax(true);
  }

  // Handle send transaction
  const handleSend = async () => {
    if (!amount || !recipient) {
      console.error('Missing fields')
      return
    }

    // Convert amount to native token if in USD mode
    const nativeAmount = isUsdInput ? usdToNative(amount) : amount;

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
      
      // Convert amount to native token if in USD mode
      const nativeAmount = isUsdInput ? usdToNative(amount) : amount;
      
      const sendPayload: SendPayload = {
        caip,
        to: recipient,
        amount: nativeAmount,
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
      
      // Extract fee from unsigned transaction result if available
      try {
        // Different chains have different formats for fee information
        let feeValue = '0.0001'; // Default fallback
        
        if (unsignedTxResult && typeof unsignedTxResult === 'object') {
          // Try to extract fee from common patterns in transaction response
          if (unsignedTxResult.fee) {
            if (typeof unsignedTxResult.fee === 'string') {
              feeValue = unsignedTxResult.fee;
            } else if (typeof unsignedTxResult.fee === 'object') {
              // Fee might be in an object with amount property
              feeValue = unsignedTxResult.fee.amount || unsignedTxResult.fee.value || feeValue;
            }
          } else if (unsignedTxResult.gasPrice && unsignedTxResult.gasLimit) {
            // For EVM chains, calculate fee as gasPrice * gasLimit
            const gasPrice = parseFloat(unsignedTxResult.gasPrice);
            const gasLimit = parseFloat(unsignedTxResult.gasLimit);
            const gweiToEth = 0.000000001; // For EVM chains
            feeValue = (gasPrice * gasLimit * gweiToEth).toFixed(8);
          }
        }
        
        // Update fee state
        console.log('Extracted fee:', feeValue);
        setEstimatedFee(feeValue);
        
        // Calculate and update fee in USD
        updateFeeInUsd(feeValue);
      } catch (feeError) {
        console.error('Error extracting fee from transaction:', feeError);
        // If we can't extract fee, we still have the default value
        updateFeeInUsd(estimatedFee);
      }
      
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
      
      // Extract the transaction hash from the result - handle different result formats
      const finalTxHash = typeof broadcastResult === 'string' 
        ? broadcastResult 
        : broadcastResult?.txHash || broadcastResult?.txid || broadcastResult || '';
      
      console.log('Final TX Hash:', finalTxHash);
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
    if (!txHash) {
      console.error('No transaction hash available');
      return;
    }
    
    console.log('Viewing transaction on explorer:', txHash);
    console.log('Asset context:', assetContext);
    
    let explorerUrl;
    
    // First try to use the explorer link from asset context
    if (assetContext?.explorerTxLink) {
      // Check if the URL already ends with a slash
      const baseUrl = assetContext.explorerTxLink.endsWith('/') 
        ? assetContext.explorerTxLink
        : `${assetContext.explorerTxLink}/`;
      
      explorerUrl = `${baseUrl}${txHash}`;
    } 
    // Fallback for different network types
    else if (assetContext?.networkId) {
      // Bitcoin and similar chains
      if (assetContext.networkId.includes('bitcoin') || assetContext.networkId.includes('litecoin') || assetContext.networkId.includes('dogecoin')) {
        explorerUrl = `https://blockchair.com/${assetContext.networkId.split(':')[0]}/transaction/${txHash}`;
      }
      // Ethereum and EVM chains
      else if (assetContext.networkId.includes('ethereum') || assetContext.networkId.includes('polygon')) {
        explorerUrl = `https://etherscan.io/tx/${txHash}`;
      }
      // Cosmos chains
      else if (assetContext.networkId.includes('cosmos')) {
        explorerUrl = `https://mintscan.io/${assetContext.networkId.split(':')[1].split('/')[0]}/txs/${txHash}`;
      }
      // Default explorer
      else {
        explorerUrl = `https://explorer.keepkey.com/tx/${txHash}`;
      }
    } else {
      // Last resort, default explorer
      explorerUrl = `https://explorer.keepkey.com/tx/${txHash}`;
    }
    
    console.log('Opening explorer URL:', explorerUrl);
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
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
        <Box height="100vh" bg={theme.bg}>
          {/* Show confetti animation */}
          <Confetti 
            width={typeof window !== 'undefined' ? window.innerWidth : 375}
            height={typeof window !== 'undefined' ? window.innerHeight : 600}
            recycle={false}
            numberOfPieces={300}
            gravity={0.2}
            colors={['#FFD700', '#FFFFFF', '#E5C100', '#FFF8D9']}
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
              p={5}
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
              p={5} 
              overflowY="auto"
            >
              <Stack gap={6} align="center">
                {/* Success Icon */}
                <Box 
                  borderRadius="full" 
                  bg="green.500" 
                  color="white" 
                  width="90px" 
                  height="90px" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center"
                  fontSize="4xl"
                  mt={3}
                  boxShadow="0px 0px 20px rgba(56, 178, 72, 0.5)"
                >
                  <FaCheck />
                </Box>
                
                <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
                  Transaction Sent Successfully!
                </Text>
                
                {/* Asset Icon and Info */}
                <Box 
                  borderRadius="full" 
                  overflow="hidden" 
                  boxSize="60px"
                  bg={theme.cardBg}
                  boxShadow="lg"
                  p={2}
                  borderWidth="1px"
                  borderColor={assetContext.color || theme.border}
                >
                  <Image 
                    src={assetContext.icon}
                    alt={`${assetContext.name} Icon`}
                    boxSize="100%"
                    objectFit="contain"
                  />
                </Box>
                
                <Box width="100%" textAlign="center">
                  <Text color="gray.500" fontSize="sm">Amount Sent</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="white">
                    {isUsdInput ? usdToNative(amount) : amount} {assetContext.symbol}
                  </Text>
                  <Text color="gray.500" fontSize="md" mt={1}>
                    ≈ {formatUsd(parseFloat(isUsdInput ? usdToNative(amount) : amount) * (assetContext.priceUsd || 0))}
                  </Text>
                </Box>
                
                <Box as="hr" borderColor="gray.700" opacity={0.2} my={2} width="100%" />
                
                <Box width="100%">
                  <Text color="gray.500" fontSize="sm" mb={2}>Transaction Hash</Text>
                  <Box
                    p={3}
                    bg={theme.bg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={theme.border}
                  >
                    <Flex align="center">
                      <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all" flex="1">
                        {txHash ? txHash : 'Transaction hash pending...'}
                      </Text>
                      <IconButton
                        aria-label="Copy to clipboard"
                        onClick={copyToClipboard}
                        size="sm"
                        variant="ghost"
                        color={hasCopied ? "green.400" : "gray.400"}
                        ml={1}
                        disabled={!txHash}
                      >
                        {hasCopied ? <FaCheck /> : <FaCopy />}
                      </IconButton>
                    </Flex>
                  </Box>
                  {txHash && (
                    <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
                      <Box 
                        as="span" 
                        cursor="pointer" 
                        _hover={{ color: theme.goldHover }}
                        onClick={viewOnExplorer}
                        display="inline-flex"
                        alignItems="center"
                      >
                        View on Explorer <FaExternalLinkAlt size="0.7em" style={{ marginLeft: '4px' }} />
                      </Box>
                    </Text>
                  )}
                </Box>
              </Stack>
            </Box>
            
            {/* Footer with Action Buttons */}
            <Box 
              borderTop="1px" 
              borderColor={theme.border}
              p={5}
            >
              <Stack gap={4}>
                <Button
                  width="100%"
                  bg={theme.gold}
                  color="black"
                  _hover={{
                    bg: theme.goldHover,
                  }}
                  onClick={viewOnExplorer}
                  height="56px"
                >
                  <Flex gap={3} align="center">
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
                  height="56px"
                >
                  Return to Dashboard
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      );
    }
    
    // Transaction in progress
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
            p={5} 
            overflowY="auto"
          >
            <Stack gap={6} align="center">
              {/* Asset Avatar */}
              <Box 
                borderRadius="full" 
                overflow="hidden" 
                boxSize="70px"
                bg={theme.cardBg}
                boxShadow="lg"
                p={2}
                borderWidth="1px"
                borderColor={assetContext.color || theme.border}
              >
                <Image 
                  src={assetContext.icon}
                  alt={`${assetContext.name} Icon`}
                  boxSize="100%"
                  objectFit="contain"
                />
              </Box>
              
              <Box width="100%">
                <Text color="gray.500" fontSize="sm">You are sending</Text>
                <Flex align="center" justify="center" direction="column" mt={2}>
                  <Text fontSize="2xl" fontWeight="bold" color="white">
                    {isUsdInput ? usdToNative(amount) : amount} {assetContext.symbol}
                  </Text>
                  <Text color="gray.500" fontSize="md" mt={1}>
                    ≈ {formatUsd(parseFloat(isUsdInput ? usdToNative(amount) : amount) * (assetContext.priceUsd || 0))}
                  </Text>
                </Flex>
              </Box>
              
              <Box 
                width="100%" 
                bg={theme.bg} 
                borderRadius={theme.borderRadius}
                p={4}
                borderWidth="1px"
                borderColor={theme.border}
              >
                <Stack gap={4}>
                  <Box>
                    <Text color="gray.500" fontSize="sm">To address</Text>
                    <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all" mt={1} p={2}>
                      {recipient}
                    </Text>
                  </Box>
                  
                  {supportsMemo && memo && (
                    <Box>
                      <Text color="gray.500" fontSize="sm">
                        {assetContext.networkId?.includes('cosmos') ? 'Memo' : 'Tag'}
                      </Text>
                      <Text fontSize="sm" fontFamily="mono" color="white" wordBreak="break-all" mt={1} p={2}>
                        {memo}
                      </Text>
                    </Box>
                  )}
                </Stack>
              </Box>

              <Box as="hr" borderColor="gray.700" opacity={0.2} my={2} width="100%" />
              
              <Box width="100%">
                <Flex justify="space-between" align="center" mb={2}>
                  <Text color="gray.500" fontSize="sm">Network</Text>
                  <Flex align="center" gap={2}>
                    <Box 
                      width="10px" 
                      height="10px" 
                      borderRadius="full" 
                      bg={networkColor} 
                    />
                    <Text color="white" fontSize="sm">
                      {assetContext.networkName || assetContext.networkId?.split(':').pop() || 'Unknown Network'}
                    </Text>
                  </Flex>
                </Flex>

                <Flex justify="space-between" align="center" mb={2}>
                  <Text color="gray.500" fontSize="sm">Estimated fee</Text>
                  <Text color="white" fontSize="sm">
                    {estimatedFee} {assetContext.symbol}
                    {parseFloat(estimatedFeeUsd) > 0 && (
                      <Text as="span" color="gray.500" ml={1}>
                        (≈ ${estimatedFeeUsd})
                      </Text>
                    )}
                  </Text>
                </Flex>
              </Box>
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
                bg={theme.gold}
                color="black"
                _hover={{
                  bg: theme.goldHover,
                }}
                onClick={confirmTransaction}
                loading={loading}
                height="56px"
                fontSize="lg"
                boxShadow="0px 4px 12px rgba(255, 215, 0, 0.3)"
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
                height="56px"
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
    <Box height="100vh" bg={theme.bg}>
      {/* Header */}
      <Box 
        borderBottom="1px" 
        borderColor={theme.border}
        p={5}  // Increased padding
        bg={theme.cardBg}
        backdropFilter="blur(10px)"
      >
        <Flex justify="space-between" align="center">
          <Flex gap={3} align="center">
            <IconButton
              aria-label="Back"
              onClick={onBackClick}
              size="sm"
              variant="ghost"
              color={theme.gold}
            >
              <FaArrowRight transform="rotate(180)" />
            </IconButton>
            <Text fontSize="lg" fontWeight="bold" color={theme.gold}>
              Send {assetContext.symbol}
            </Text>
          </Flex>
          <IconButton
            aria-label="Close"
            onClick={onBackClick}
            size="sm"
            variant="ghost"
            color={theme.gold}
          >
            <FaTimes />
          </IconButton>
        </Flex>
      </Box>
      
      {/* Main Content */}
      <Box p={5}>
        <Stack gap={6} align="center">
          {/* Asset Avatar and Info */}
          <Box 
            bg={theme.cardBg} 
            p={5} 
            borderRadius={theme.borderRadius}
            boxShadow="lg"
            border="1px solid"
            borderColor={theme.border}
            width="100%"
          >
            <VStack align="center" gap={4}>
              <Box 
                borderRadius="full" 
                overflow="hidden" 
                boxSize="70px"
                bg={theme.cardBg}
                boxShadow="lg"
                p={2}
                borderWidth="1px"
                borderColor={assetContext.color || theme.border}
              >
                <Image 
                  src={assetContext.icon}
                  alt={`${assetContext.name} Icon`}
                  boxSize="100%"
                  objectFit="contain"
                />
              </Box>
              <Stack align="center" gap={1}>
                <Text fontSize="xl" fontWeight="bold" color="white">
                  {assetContext.name}
                </Text>
                <Stack>
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    Balance: {balance} {assetContext.symbol}
                  </Text>
                  <Text color={theme.gold} fontSize="md" textAlign="center" fontWeight="medium">
                    {formatUsd(totalBalanceUsd)}
                  </Text>
                </Stack>
              </Stack>
            </VStack>
          </Box>
          
          {/* Amount */}
          <Box 
            width="100%" 
            bg={theme.cardBg} 
            borderRadius={theme.borderRadius} 
            p={theme.formPadding}
            borderWidth="1px"
            borderColor={theme.border}
          >
            <Stack gap={3}>
              <Text color="white" fontWeight="medium">Amount</Text>
              <Flex>
                <Flex 
                  position="relative" 
                  flex="1"
                  align="center"
                >
                  {isUsdInput && (
                    <Box position="absolute" left="12px" zIndex="1">
                      <Text color={theme.gold} fontWeight="bold">$</Text>
                    </Box>
                  )}
                  <Input
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    color="white"
                    borderColor={theme.border}
                    _hover={{ borderColor: theme.goldHover }}
                    _focus={{ borderColor: theme.gold }}
                    p={3}
                    pl={isUsdInput ? "28px" : "12px"}
                    height="50px"
                    fontSize="lg"
                    flex="1"
                  />
                  {!isUsdInput && (
                    <Box position="absolute" right="12px" zIndex="1">
                      <Text color="gray.500" fontWeight="medium">{assetContext.symbol}</Text>
                    </Box>
                  )}
                </Flex>
                <Button
                  ml={3}
                  bg={theme.cardBg}
                  color={theme.gold}
                  borderColor={theme.border}
                  borderWidth="1px"
                  height="50px"
                  px={4}
                  _hover={{
                    bg: 'rgba(255, 215, 0, 0.1)',
                    borderColor: theme.gold,
                  }}
                  onClick={handleSetMax}
                >
                  MAX
                </Button>
              </Flex>
              <Text 
                fontSize="sm" 
                color="gray.500" 
                ml={2} 
                cursor="pointer" 
                _hover={{ color: theme.goldHover }}
                onClick={toggleInputMode}
                display="flex"
                alignItems="center"
              >
                {isUsdInput ? (
                  <>≈ {amount ? parseFloat(usdToNative(amount)).toFixed(8) : '0'} {assetContext.symbol}</>
                ) : (
                  <>≈ {formatUsd(parseFloat(amount || '0') * (assetContext.priceUsd || 0))}</>
                )}
                <Box as="span" ml={1} fontSize="xs">(click to switch)</Box>
              </Text>
            </Stack>
          </Box>
          
          {/* Recipient */}
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
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={`${assetContext.symbol} Address`}
                color="white"
                borderColor={theme.border}
                _hover={{ borderColor: theme.goldHover }}
                _focus={{ borderColor: theme.gold }}
                p={3}
                height="50px"
                fontSize="md"
              />
            </Stack>
          </Box>
          
          {/* Memo/Tag (only for supported networks) */}
          {supportsMemo && (
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
                  p={3}
                  height="50px"
                  fontSize="md"
                />
              </Stack>
            </Box>
          )}
          
          {/* Fee Estimate */}
          <Box 
            width="100%" 
            bg="rgba(255, 215, 0, 0.05)" 
            borderRadius={theme.borderRadius} 
            p={theme.formPadding}
            borderWidth="1px"
            borderColor="rgba(255, 215, 0, 0.2)"
          >
            <Flex justify="space-between" align="center">
              <Text color="gray.400">Estimated Fee</Text>
              <Stack gap={0} align="flex-end">
                <Text color={theme.gold} fontWeight="medium">
                  {estimatedFee} {assetContext.symbol}
                </Text>
                {parseFloat(estimatedFeeUsd) > 0 && (
                  <Text color="gray.500" fontSize="xs">
                    ≈ ${estimatedFeeUsd} USD
                  </Text>
                )}
              </Stack>
            </Flex>
          </Box>
          
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
            height="56px"
            fontSize="lg"
            boxShadow="0px 4px 12px rgba(255, 215, 0, 0.3)"
          >
            <Flex gap={3} align="center" justify="center">
              <FaPaperPlane />
              <Text>Send {assetContext.symbol}</Text>
            </Flex>
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default Send; 