'use client'

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Link,
  Code
} from '@chakra-ui/react';
import { FaExternalLinkAlt, FaTimes } from 'react-icons/fa';
import Confetti from 'react-confetti';
import { usePioneerContext } from '@/components/providers/pioneer';
import { THORCHAIN_TRACKER_URL, MIDGARD_URL } from '@/config/external-trackers';
import { assetData } from '@pioneer-platform/pioneer-discovery';

// Import sub-components
import { StageIndicator } from './StageIndicator';
import { SwapInProgressActions } from './SwapInProgressActions';
import { SwapProgressSteps } from './SwapProgressSteps';

interface SwapProgressProps {
  txid: string;
  fromAsset: any;
  toAsset: any;
  inputAmount: string;
  outputAmount: string;
  integration?: 'thorchain' | 'mayachain';
  memo?: string;
  onComplete: () => void;  // Called when fully confirmed
  onClose: () => void;
}

interface SwapStatus {
  txHash: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed' | 'refunded' | 'output_detected' | 'output_confirming' | 'output_confirmed';
  confirmations?: number;
  requiredConfirmations?: number;
  outboundConfirmations?: number;
  outboundRequiredConfirmations?: number;
  outputDetectedAt?: string;
  thorchainData?: {
    outboundTxHash?: string;
    swapStatus?: string;
  };
  timingData?: {
    elapsedSeconds: number;
    currentStage: string;
    stageElapsedSeconds: number;
    stageExpectedSeconds: number;
    actualVsEstimate: string;
    remainingFormatted: string;
    reassuranceMessage: string;
  };
  error?: {
    type?: string;
    severity?: string;
    userMessage?: string;
    actionable?: string;
    message?: string;
  };
}

// Blue theme for swap dialog
const swapTheme = {
  bg: '#1A1D23',
  cardBg: '#242931',
  accent: '#3B82F6',
  accentHover: '#2563EB',
  border: '#374151',
  borderLight: '#4B5563',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
};

// Get asset info from CAIP identifier - ALWAYS lookup in assetData (20,000+ assets)
const getAssetInfo = (caipOrAsset: any) => {
  // Extract CAIP from object or use string directly
  const caip = caipOrAsset?.caip || caipOrAsset;

  if (!caip || typeof caip !== 'string') {
    console.error('[SwapProgress] Invalid CAIP input:', caipOrAsset);
    return {
      caip: 'unknown',
      symbol: 'Unknown',
      name: 'Unknown',
      icon: undefined
    };
  }

  // ALWAYS lookup in assetData - authoritative source for all swappable assets
  // @ts-ignore - assetData is indexed by CAIP
  const asset = assetData[caip];

  if (asset) {
    return {
      caip,
      symbol: asset.symbol,
      name: asset.name,
      icon: asset.icon
    };
  }

  console.error('[SwapProgress] Asset not found for CAIP:', caip);
  return {
    caip,
    symbol: 'Unknown',
    name: 'Unknown',
    icon: undefined
  };
};

export const SwapProgress = ({
  txid,
  fromAsset,
  toAsset,
  inputAmount,
  outputAmount,
  integration = 'thorchain',
  memo,
  onComplete,
  onClose
}: SwapProgressProps) => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;

  // ============================================
  // ASSET PARSING - Convert CAIP strings to asset objects
  // ============================================
  const fromAssetInfo = getAssetInfo(fromAsset);
  const toAssetInfo = getAssetInfo(toAsset);

  // ============================================
  // DIAGNOSTIC LOGGING - Component Mount
  // ============================================

  // State
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);
  const [swapStatus, setSwapStatus] = useState<SwapStatus | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<number>(Date.now());

  // REST API data (normalized from sellAsset/buyAsset → fromAsset/toAsset)
  const [restData, setRestData] = useState<{
    fromAsset: any | null;
    toAsset: any | null;
    inputAmount: string | null;
    outputAmount: string | null;
  } | null>(null);

  // Build tracker links
  const cleanTxid = txid.startsWith('0x') || txid.startsWith('0X') ? txid.slice(2) : txid;
  const upperTxid = cleanTxid.toUpperCase();
  const thorchainTrackerLink = `${THORCHAIN_TRACKER_URL}/${upperTxid}`;
  const midgardApiLink = `${MIDGARD_URL}/v2/actions?txid=${upperTxid}`;

  // ============================================
  // INITIAL REST API FETCH - Fetch current swap status on mount
  // ============================================
  useEffect(() => {
    const fetchInitialStatus = async () => {

      if (!app?.pioneer?.GetPendingSwap) {
        return;
      }

      try {
        const response = await app.pioneer.GetPendingSwap({ txHash: txid });

        // Log complete REST API response for debugging
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[SwapProgress] 📦 FULL REST API RESPONSE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(JSON.stringify(response, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


        // Extract swap data from new API response format
        // New format: {data: {status, message, details, swap: {...}}}
        // Old format: {data: {txHash, status, sellAsset, buyAsset, ...}}
        const apiData = response?.data || response;
        const swap = apiData?.swap || apiData;

        if (swap) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('[SwapProgress] ✅ SWAP DATA EXTRACTED FROM RESPONSE:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('[SwapProgress] Status:', swap.status);
          console.log('[SwapProgress] Sell Asset (FROM):', swap.sellAsset);
          console.log('[SwapProgress] Buy Asset (TO):', swap.buyAsset);
          console.log('[SwapProgress] Sell Amount:', swap.sellAsset?.amount);
          console.log('[SwapProgress] Buy Amount:', swap.buyAsset?.amount);
          console.log('[SwapProgress] Confirmations:', swap.confirmations);
          console.log('[SwapProgress] Outbound confirmations:', swap.outboundConfirmations);
          console.log('[SwapProgress] ThorChain data:', swap.thorchainData);
          console.log('[SwapProgress] Outbound txHash:', swap.thorchainData?.outboundTxHash);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


          // Calculate timing data if not provided by API
          let timingData = swap.timingData;
          if (!timingData && swap.createdAt) {
            const createdAt = new Date(swap.createdAt);
            const now = new Date();
            const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

            // Estimate total time based on stage
            const stageEstimates = {
              pending: 180,        // 3 minutes for confirmation
              confirming: 180,     // 3 minutes
              processing: 120,     // 2 minutes for protocol
              completed: 0
            };
            const estimatedTotal = stageEstimates[swap.status as keyof typeof stageEstimates] || 300;
            const remaining = Math.max(0, estimatedTotal - elapsedSeconds);

            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            const remainingFormatted = minutes > 0
              ? `${minutes}m ${seconds}s`
              : `${seconds}s`;

            timingData = {
              elapsedSeconds,
              currentStage: swap.status || 'pending',
              stageElapsedSeconds: elapsedSeconds,
              stageExpectedSeconds: estimatedTotal,
              actualVsEstimate: remaining > 0 ? 'on-track' : 'delayed',
              remainingFormatted: remaining > 0 ? `~${remainingFormatted}` : 'Completing...',
              reassuranceMessage: remaining > 0
                ? 'Transaction is being processed. This typically takes a few minutes.'
                : 'Almost there! Finalizing your swap...'
            };

          }

          // Update state with REST data
          const initialStatus: SwapStatus = {
            txHash: txid,
            status: swap.status || 'pending',
            confirmations: swap.confirmations,
            requiredConfirmations: swap.requiredConfirmations,
            outboundConfirmations: swap.outboundConfirmations,
            outboundRequiredConfirmations: swap.outboundRequiredConfirmations,
            outputDetectedAt: swap.outputDetectedAt,
            thorchainData: swap.thorchainData,
            timingData,
            error: swap.error
          };

          setSwapStatus(initialStatus);
          setLastEventTime(Date.now());

          // Normalize and store REST API data (sellAsset/buyAsset → fromAsset/toAsset)
          if (swap.sellAsset && swap.buyAsset) {
            console.log('[SwapProgress] ✅ Normalizing REST data for display');
            setRestData({
              fromAsset: {
                caip: swap.sellAsset.caip,
                symbol: swap.sellAsset.symbol,
                name: swap.sellAsset.name || swap.sellAsset.symbol,
                icon: swap.sellAsset.icon
              },
              toAsset: {
                caip: swap.buyAsset.caip,
                symbol: swap.buyAsset.symbol,
                name: swap.buyAsset.name || swap.buyAsset.symbol,
                icon: swap.buyAsset.icon
              },
              inputAmount: swap.sellAsset.amount,
              outputAmount: swap.buyAsset.amount
            });
          }

          // Set stage based on status
          if (swap.status === 'output_confirmed' || swap.status === 'completed') {
            setCurrentStage(3);
            setIsComplete(true);
          } else if (swap.status === 'output_detected' || swap.status === 'output_confirming') {
            setCurrentStage(3);
          } else if (swap.status === 'confirming') {
            setCurrentStage(1);
          }
        } else {
        }
      } catch (err) {
        console.error('[SwapProgress] ❌ Failed to fetch initial swap status via REST');
        console.error('[SwapProgress] Error:', err);
        console.error('[SwapProgress] Error message:', err instanceof Error ? err.message : String(err));
        // Continue - will rely on WebSocket events
      }
    };

    fetchInitialStatus();
  }, [txid, app]);

  // ============================================
  // PRIMARY: WebSocket Event Subscription (Real-time updates)
  // ============================================
  useEffect(() => {

    if (!app?.events) {
      return;
    }

    const handleSwapEvent = (event: any) => {

      // Only handle events for this swap
      if (event.txHash !== txid && event.transaction?.txid !== txid) {
        return;
      }

      setLastEventTime(Date.now());

      // Update swap status from event
      const updatedStatus: SwapStatus = {
        txHash: txid,
        status: event.type || event.status || 'pending',
        confirmations: event.confirmations,
        requiredConfirmations: event.requiredConfirmations,
        outboundConfirmations: event.outboundConfirmations,
        outboundRequiredConfirmations: event.outboundRequiredConfirmations,
        outputDetectedAt: event.outputDetectedAt,
        thorchainData: event.thorchainData,
        timingData: event.timingData,
        error: event.error
      };


      setSwapStatus(updatedStatus);

      // Determine current stage based on event type
      const eventType = event.type || event.status;

      if (eventType === 'swap:output_confirmed' || eventType === 'swap:completed' || eventType === 'output_confirmed' || eventType === 'completed') {
        setCurrentStage(3);
        setIsComplete(true);
        // Confetti disabled - was triggering repeatedly on already completed swaps
        // setShowConfetti(true);
        // setTimeout(() => setShowConfetti(false), 5000);

        onComplete();
      } else if (eventType === 'swap:output_detected' || eventType === 'swap:output_confirming' || eventType === 'output_detected' || eventType === 'output_confirming') {
        setCurrentStage(3);
      } else if (eventType === 'swap:confirming' || eventType === 'confirming') {
        setCurrentStage(1);
      } else if (eventType === 'swap:initiated' || eventType === 'pending') {
        setCurrentStage(1);
      } else {
      }

      // Handle errors
      if (event.error) {
        console.error('[SwapProgress] ❌ SWAP ERROR DETECTED');
        console.error('[SwapProgress] Error object:', JSON.stringify(event.error, null, 2));
        console.error('[SwapProgress] Error type:', event.error.type);
        console.error('[SwapProgress] Error severity:', event.error.severity);
        console.error('[SwapProgress] Error message:', event.error.message);
        console.error('[SwapProgress] User message:', event.error.userMessage);
        console.error('[SwapProgress] Actionable:', event.error.actionable);
      }
    };

    // Subscribe to swap events from SDK EventEmitter
    // SDK bridges WebSocket 'swap:event' to local EventEmitter
    app.events.on('swap:event', handleSwapEvent);

    return () => {
      app.events.off('swap:event', handleSwapEvent);
    };
  }, [txid, app, onComplete]);

  // ============================================
  // FALLBACK: REST API Polling (Redundancy + Recovery)
  // ============================================
  useEffect(() => {

    // Check if WebSocket is available
    const hasWebSocket = !!app?.events;

    // Determine polling strategy
    // - If WebSocket unavailable: Primary polling (30s intervals)
    // - If WebSocket available: Backup polling (60s intervals) to catch missed events
    const pollingInterval = hasWebSocket ? 60000 : 30000;
    const pollingMode = hasWebSocket ? 'BACKUP' : 'PRIMARY';


    if (!app?.pioneer?.GetPendingSwap) {
      console.error('[SwapProgress] ❌ GetPendingSwap not available - cannot set up polling');
      return;
    }

    // Polling function
    const pollSwapStatus = async () => {

      try {
        const response = await app.pioneer.GetPendingSwap({ txHash: txid });

        const swap = response?.data || response;

        if (swap) {

          // Update state with polling data
          const polledStatus: SwapStatus = {
            txHash: txid,
            status: swap.status || 'pending',
            confirmations: swap.confirmations,
            requiredConfirmations: swap.requiredConfirmations,
            outboundConfirmations: swap.outboundConfirmations,
            outboundRequiredConfirmations: swap.outboundRequiredConfirmations,
            outputDetectedAt: swap.outputDetectedAt,
            thorchainData: swap.thorchainData,
            timingData: swap.timingData,
            error: swap.error
          };

          setSwapStatus(polledStatus);
          setLastEventTime(Date.now());

          // Update stage based on polled status
          if (swap.status === 'output_confirmed' || swap.status === 'completed') {
            setCurrentStage(3);
            setIsComplete(true);
          } else if (swap.status === 'output_detected' || swap.status === 'output_confirming') {
            setCurrentStage(3);
          } else if (swap.status === 'confirming') {
            setCurrentStage(1);
          }
        } else {
        }
      } catch (err) {
        console.error('[SwapProgress] ❌ Polling failed:', err);
        console.error('[SwapProgress] Error message:', err instanceof Error ? err.message : String(err));
        // Continue polling - transient network errors shouldn't stop monitoring
      }
    };

    // Set up polling interval
    const intervalId = setInterval(pollSwapStatus, pollingInterval);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [txid, app, lastEventTime]);

  // NOTE: Hybrid monitoring strategy (WebSocket + REST):
  // - PRIMARY: WebSocket events (real-time, low latency)
  // - FALLBACK: REST API polling (reliability, missed event recovery)
  // - INITIAL: REST fetch on mount (historical swap data)
  // This ensures swap monitoring works even if WebSocket fails or events are missed
  // See: SWAP_MONITORING_AUDIT.md for full architecture details

  // Log swap status changes
  useEffect(() => {
    if (!swapStatus) {
      return;
    }

  }, [swapStatus, currentStage, isComplete]);

  // Detect when Stage 2 should be active (input complete, waiting for output detection)
  useEffect(() => {
    if (!swapStatus) return;

    const isInputComplete =
      swapStatus.confirmations &&
      swapStatus.requiredConfirmations &&
      swapStatus.confirmations >= swapStatus.requiredConfirmations;

    const isOutputDetected =
      swapStatus.status === 'output_detected' ||
      swapStatus.status === 'output_confirming' ||
      swapStatus.status === 'output_confirmed' ||
      swapStatus.status === 'completed';


    if (isInputComplete && !isOutputDetected && currentStage === 1) {
      setCurrentStage(2);
    }
  }, [swapStatus, currentStage]);

  // Get required confirmations (fallback if not in status)
  const getRequiredConfirmations = (stage: 1 | 3): number => {
    if (stage === 1) {
      return swapStatus?.requiredConfirmations || 6; // Default for input
    } else {
      return swapStatus?.outboundRequiredConfirmations || 12; // Default for output (higher for safety)
    }
  };

  return (
    <Box
      position="relative"
      width="full"
      bg={swapTheme.bg}
      borderRadius="2xl"
      borderWidth="2px"
      borderColor={swapTheme.border}
      p={8}
      boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.5)"
    >
      {/* Confetti - Disabled temporarily to prevent repeated triggers */}
      {/* {showConfetti && isComplete && (
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
            colors={['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A']}
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
      )} */}

      <VStack gap={8} width="full" align="stretch" position="relative">
        {/* Header */}
        <HStack justify="space-between" width="full">
          <Text fontSize="2xl" fontWeight="bold" color={swapTheme.text}>
            {isComplete ? 'Swap Completed!' : 'Swap in Progress'}
          </Text>
          <Button
            variant="ghost"
            onClick={onClose}
            size="sm"
            color={swapTheme.textMuted}
            _hover={{ color: swapTheme.text, bg: swapTheme.cardBg }}
          >
            <FaTimes />
          </Button>
        </HStack>

        {/* Chakra Steps Progress Component */}
        <SwapProgressSteps
          swapStatus={{
            currentStage,
            status: swapStatus?.status || 'pending',
            confirmations: swapStatus?.confirmations,
            requiredConfirmations: getRequiredConfirmations(1),
            outboundConfirmations: swapStatus?.outboundConfirmations,
            outboundRequiredConfirmations: getRequiredConfirmations(3),
            timingData: swapStatus?.timingData,
            thorchainData: swapStatus?.thorchainData,
            error: swapStatus?.error
          }}
          fromAsset={{
            caip: restData?.fromAsset?.caip || fromAssetInfo.caip,
            symbol: restData?.fromAsset?.symbol || fromAssetInfo.symbol,
            amount: restData?.inputAmount || inputAmount
          }}
          toAsset={{
            caip: restData?.toAsset?.caip || toAssetInfo.caip,
            symbol: restData?.toAsset?.symbol || toAssetInfo.symbol,
            amount: restData?.outputAmount || outputAmount
          }}
          inputTxHash={txid}
          onClose={onClose}
        />

        {/* Error Display */}
        {swapStatus?.error && (
          <Box
            bg="rgba(239, 68, 68, 0.1)"
            borderColor="red.500"
            borderWidth="2px"
            borderRadius="xl"
            p={6}
            width="full"
          >
            <Text fontSize="sm" fontWeight="bold" color="red.400" mb={2}>
              {swapStatus.error.userMessage || 'Swap Error'}
            </Text>
            {swapStatus.error.actionable && (
              <Text fontSize="xs" color={swapTheme.textMuted}>
                {swapStatus.error.actionable}
              </Text>
            )}
          </Box>
        )}


        {/* Action Buttons - Only show Done button when complete */}
        {isComplete && (
          <VStack gap={4} width="full">
            {/* Done Button */}
            <Button
              size="lg"
              bg={swapTheme.accent}
              color="white"
              _hover={{ bg: swapTheme.accentHover }}
              onClick={onClose}
              width="full"
              height="52px"
              borderRadius="xl"
              fontWeight="semibold"
            >
              Done
            </Button>
          </VStack>
        )}
      </VStack>
    </Box>
  );
};
