'use client'

import React, { useEffect, useState } from 'react';
import { Box, Stack, HStack, VStack, Text, Button, Image, Link, Code } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FaCheckCircle, FaExternalLinkAlt, FaEnvelope } from 'react-icons/fa';
import Confetti from 'react-confetti';

interface SwapSuccessProps {
  txid: string;
  fromAsset: any;
  toAsset: any;
  inputAmount: string;
  outputAmount: string;
  outboundAssetContext?: any;
  onClose: () => void;
  memo?: string;
  txData?: any;
}

export const SwapSuccess = ({
  txid,
  fromAsset,
  toAsset,
  inputAmount,
  outputAmount,
  outboundAssetContext,
  onClose,
  memo,
  txData
}: SwapSuccessProps) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [decodedMemo, setDecodedMemo] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Decode memo from hex if available in txData
    if (txData?.data && typeof txData.data === 'string' && txData.data.startsWith('0x')) {
      try {
        // Remove '0x' prefix and decode hex to string
        const hexData = txData.data.slice(2);
        const decoded = Buffer.from(hexData, 'hex').toString('utf8');
        // THORChain memos are ASCII text, so this should work
        setDecodedMemo(decoded);
        console.log('Decoded memo from tx data:', decoded);
      } catch (err) {
        console.error('Failed to decode memo from tx data:', err);
      }
    } else if (memo) {
      // If memo is passed directly, use it
      setDecodedMemo(memo);
    }
  }, [txData, memo]);

  // Build THORChain tracker link with the specific format
  // Remove 0x prefix if present before converting to uppercase
  const cleanTxid = txid.startsWith('0x') || txid.startsWith('0X') 
    ? txid.slice(2) 
    : txid;
  const upperTxid = cleanTxid.toUpperCase();
  const thorchainTrackerLink = `https://track.ninerealms.com/${upperTxid}?=${upperTxid}`;

  // Build chain explorer link (keep original txid with 0x prefix)
  const getChainExplorerLink = () => {
    if (!fromAsset?.symbol) return null;
    
    // Use the original txid (with 0x if present) for chain explorers
    const symbol = fromAsset.symbol;
    
    if (symbol === 'ETH' || symbol === 'USDC' || symbol === 'USDT') {
      return `https://etherscan.io/tx/${txid}`;
    } else if (symbol === 'BTC') {
      return `https://mempool.space/tx/${txid}`;
    } else if (symbol === 'BCH') {
      return `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
    } else if (symbol === 'LTC') {
      return `https://blockchair.com/litecoin/transaction/${txid}`;
    } else if (symbol === 'DOGE') {
      return `https://blockchair.com/dogecoin/transaction/${txid}`;
    } else if (symbol === 'AVAX') {
      return `https://snowtrace.io/tx/${txid}`;
    } else if (symbol === 'BNB') {
      return `https://bscscan.com/tx/${txid}`;
    }
    
    return null;
  };

  const chainExplorerLink = getChainExplorerLink();

  // Format transaction ID for display (show first and last characters)
  const formatTxid = (id: string) => {
    // Remove 0x prefix if present for THORChain display
    const clean = id.startsWith('0x') || id.startsWith('0X') ? id.slice(2) : id;
    if (clean.length <= 16) return clean.toUpperCase();
    return `${clean.slice(0, 8).toUpperCase()}...${clean.slice(-8).toUpperCase()}`;
  };

  // Handle email sending
  const handleEmailSwapInfo = async () => {
    setIsSendingEmail(true);
    setEmailStatus('sending');
    
    try {
      // Prepare comprehensive swap data
      const swapData = {
        txid: txid,
        cleanTxid: cleanTxid,
        thorchainTrackerLink: thorchainTrackerLink,
        chainExplorerLink: chainExplorerLink,
        fromAsset: {
          symbol: fromAsset?.symbol,
          name: fromAsset?.name,
          icon: fromAsset?.icon,
          amount: inputAmount
        },
        toAsset: {
          symbol: toAsset?.symbol,
          name: toAsset?.name,
          icon: toAsset?.icon,
          amount: outputAmount
        },
        memo: decodedMemo || memo,
        timestamp: new Date().toISOString(),
        outboundAssetContext: outboundAssetContext
      };

      const response = await fetch('/api/email-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapData),
      });

      if (response.ok) {
        setEmailStatus('success');
        console.log('✅ Email sent successfully!');
        // Reset status after 3 seconds
        setTimeout(() => setEmailStatus('idle'), 3000);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('❌ Error sending email:', error);
      setEmailStatus('error');
      // Reset status after 3 seconds
      setTimeout(() => setEmailStatus('idle'), 3000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const pulseAnimation = keyframes`
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
    100% { transform: scale(1); opacity: 1; }
  `;

  return (
    <Box position="relative" width="full" minH="100vh">
      {/* Confetti animation - centered in viewport */}
      {showConfetti && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          pointerEvents="none"
          zIndex={9999}
        >
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={200}
            gravity={0.1}
            colors={['#10B981', '#059669', '#047857', '#065F46', '#064E3B']}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
        </Box>
      )}

      <VStack gap={8} width="full" align="center" py={8} position="relative">
        {/* Success Icon */}
        <Box position="relative">
          <Box
            as={FaCheckCircle}
            color="green.400"
            fontSize="80px"
            animation={`${pulseAnimation} 2s infinite`}
          />
        </Box>

        {/* Success Title */}
        <VStack gap={2}>
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Swap Successful!
          </Text>
          <Text fontSize="md" color="gray.400">
            Your transaction has been broadcasted
          </Text>
        </VStack>

        {/* Swap Summary */}
        <Box 
          bg="gray.800" 
          borderRadius="xl" 
          p={6} 
          width="full"
          borderWidth="1px"
          borderColor="gray.700"
        >
          <HStack justify="center" align="center" gap={4}>
            {/* From */}
            <HStack gap={2}>
              <Image src={fromAsset?.icon} alt={fromAsset?.name} boxSize="24px" />
              <Text fontSize="lg" fontWeight="semibold" color="gray.400">
                {inputAmount} {fromAsset?.symbol}
              </Text>
            </HStack>

            {/* Arrow */}
            <Box color="green.400" fontSize="xl">
              →
            </Box>

            {/* To */}
            <HStack gap={2}>
              <Image src={toAsset?.icon} alt={toAsset?.name} boxSize="24px" />
              <Text fontSize="lg" fontWeight="semibold" color="green.400">
                {outputAmount} {toAsset?.symbol}
              </Text>
            </HStack>
          </HStack>
        </Box>

        {/* Transaction ID */}
        <VStack gap={3} width="full">
          <Text fontSize="sm" color="gray.500">
            Transaction ID
          </Text>
          <Box 
            bg="gray.900" 
            borderRadius="lg" 
            p={3} 
            width="full"
            borderWidth="1px"
            borderColor="gray.700"
          >
            <HStack justify="center" gap={2}>
              <Text fontSize="sm" fontFamily="mono" color="white" textTransform="uppercase">
                {formatTxid(txid)}
              </Text>
              <Link
                href={thorchainTrackerLink}
                isExternal
                target="_blank"
                rel="noopener noreferrer"
                color="blue.400"
                _hover={{ color: 'blue.300' }}
              >
                <FaExternalLinkAlt size="14" />
              </Link>
            </HStack>
          </Box>
        </VStack>

        {/* THORChain Memo (if available) */}
        {decodedMemo && (
          <VStack gap={3} width="full">
            <Text fontSize="sm" color="gray.500">
              THORChain Memo
            </Text>
            <Box 
              bg="gray.900" 
              borderRadius="lg" 
              p={3} 
              width="full"
              borderWidth="1px"
              borderColor="gray.700"
            >
              <Code 
                fontSize="xs" 
                bg="transparent" 
                color="cyan.400"
                wordBreak="break-all"
              >
                {decodedMemo}
              </Code>
            </Box>
          </VStack>
        )}

        {/* View on Chain Explorer Button */}
        {chainExplorerLink && (
          <Link href={chainExplorerLink} isExternal target="_blank" rel="noopener noreferrer" width="full">
            <Button
              variant="outline"
              colorScheme="blue"
              width="full"
              height="48px"
              borderRadius="xl"
              rightIcon={<FaExternalLinkAlt />}
            >
              View on {fromAsset?.symbol === 'ETH' ? 'Etherscan' :
                      fromAsset?.symbol === 'BTC' ? 'Mempool' :
                      fromAsset?.symbol === 'AVAX' ? 'Snowtrace' :
                      fromAsset?.symbol === 'BNB' ? 'BSCScan' :
                      'Explorer'}
            </Button>
          </Link>
        )}

        {/* Track THORChain Swap Button */}
        <Link href={thorchainTrackerLink} isExternal target="_blank" rel="noopener noreferrer" width="full">
          <Button
            variant="outline"
            colorScheme="green"
            width="full"
            height="48px"
            borderRadius="xl"
            rightIcon={<FaExternalLinkAlt />}
          >
            Track THORChain Swap
          </Button>
        </Link>

        {/* Email Swap Info Button */}
        <Button
          variant="outline"
          colorScheme={emailStatus === 'success' ? 'green' : emailStatus === 'error' ? 'red' : 'purple'}
          width="full"
          height="48px"
          borderRadius="xl"
          leftIcon={<FaEnvelope />}
          onClick={handleEmailSwapInfo}
          isLoading={isSendingEmail}
          loadingText="Sending..."
          isDisabled={emailStatus === 'success'}
        >
          {emailStatus === 'success' ? '✅ Email Sent!' : 
           emailStatus === 'error' ? '❌ Failed - Try Again' : 
           'Email Me Swap Details'}
        </Button>

        {/* Done Button */}
        <Button
          size="lg"
          bg="gray.700"
          color="white"
          _hover={{ bg: 'gray.600' }}
          onClick={onClose}
          width="full"
          height="48px"
          borderRadius="xl"
          fontWeight="semibold"
        >
          Done
        </Button>

        {/* Additional Info */}
        <Text fontSize="xs" color="gray.500" textAlign="center" px={4}>
          It may take a few minutes for your transaction to be confirmed on the blockchain
        </Text>
      </VStack>
    </Box>
  );
};