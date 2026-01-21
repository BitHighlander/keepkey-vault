'use client'

import React, { useState, useEffect, useRef } from 'react';
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
  const hasShownConfettiRef = useRef(false);
  const [lastEventTime, setLastEventTime] = useState<number>(Date.now());
  const [swapStartTime, setSwapStartTime] = useState<number | null>(null);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

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
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log('[SwapProgress] 📦 FULL REST API RESPONSE:');
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log(JSON.stringify(response, null, 2));
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


        // Extract swap data from API response
        // Response formats:
        // 1. Swap in DB: {data: {txHash, status, sellAsset, buyAsset, ...}}
        // 2. Swap found with assets: {data: {status, message, details, sellAsset, buyAsset, ...}}
        // 3. Swap processing (no asset data yet): {data: {status, message, details}} <- NO sellAsset/buyAsset
        const apiData = response?.data || response;
        const swap = apiData?.swap || apiData;

        // Check if we have complete swap data with assets
        const hasSwapData = swap && swap.sellAsset && swap.buyAsset;

        if (hasSwapData) {
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          // console.log('[SwapProgress] ✅ SWAP DATA EXTRACTED FROM RESPONSE:');
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          // console.log('[SwapProgress] Status:', swap.status);
          // console.log('[SwapProgress] Sell Asset (FROM):', swap.sellAsset);
          // console.log('[SwapProgress] Buy Asset (TO):', swap.buyAsset);
          // console.log('[SwapProgress] Sell Amount:', swap.sellAsset?.amount);
          // console.log('[SwapProgress] Buy Amount:', swap.buyAsset?.amount);
          // console.log('[SwapProgress] Confirmations:', swap.confirmations);
          // console.log('[SwapProgress] Outbound confirmations:', swap.outboundConfirmations);
          // console.log('[SwapProgress] ThorChain data:', swap.thorchainData);
          // console.log('[SwapProgress] Outbound txHash:', swap.thorchainData?.outboundTxHash);
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

          // Set swap start time if we have createdAt
          if (swap.createdAt && !swapStartTime) {
            setSwapStartTime(new Date(swap.createdAt).getTime());
          }

          // Normalize and store REST API data (sellAsset/buyAsset → fromAsset/toAsset)
          if (swap.sellAsset && swap.buyAsset) {
            console.log('[SwapProgress] ✅ Normalizing REST data for display');

            // FIX: buyAsset.amount is "0" for pending swaps - use quote.raw.buyAmount as fallback
            let outputAmount = swap.buyAsset.amount;
            if (!outputAmount || outputAmount === '0' || parseFloat(outputAmount) === 0) {
              // Try to get expected amount from quote
              outputAmount = swap.quote?.raw?.buyAmount ||
                           swap.quote?.raw?.amountOut ||
                           swap.quote?.expectedAmountOut ||
                           '0';
              console.log('[SwapProgress] 💡 buyAsset.amount is 0, using quote amount:', outputAmount);
            }

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
              outputAmount: outputAmount
            });
          }

          // Set stage based on status
          // console.log('[SwapProgress] 🎯 INITIAL LOAD: Determining stage from status:', swap.status);

          if (swap.status === 'output_confirmed' || swap.status === 'completed') {
            // console.log('[SwapProgress] ✅ INITIAL LOAD: Swap already completed!');
            setCurrentStage(3);
            setIsComplete(true);

            // Show confetti ONCE when swap completes
            if (!hasShownConfettiRef.current) {
              // console.log('[SwapProgress] 🎉 INITIAL LOAD: Showing confetti');
              setShowConfetti(true);
              hasShownConfettiRef.current = true;
              setTimeout(() => setShowConfetti(false), 5000);
            }
          } else if (swap.status === 'output_detected' || swap.status === 'output_confirming') {
            // console.log('[SwapProgress] 📥 INITIAL LOAD: Output stage detected');
            // console.log('[SwapProgress] Outbound confirmations:', swap.outboundConfirmations, '/', swap.outboundRequiredConfirmations);
            setCurrentStage(3);
          } else if (swap.status === 'confirming') {
            // console.log('[SwapProgress] ⚡ INITIAL LOAD: Protocol processing');
            setCurrentStage(2);  // FIX: 'confirming' means protocol is processing the swap (Stage 2)
          } else if (swap.status === 'pending') {
            // console.log('[SwapProgress] 📤 INITIAL LOAD: Input pending confirmation');
            setCurrentStage(1);  // Input transaction stage
          } else {
            // console.log('[SwapProgress] 🚀 INITIAL LOAD: Unknown status, defaulting to input stage');
            // console.log('[SwapProgress] Status:', swap.status);
            setCurrentStage(1);  // Default to input stage for unknown statuses
          }
        } else {
          // Swap is in "processing" state - protocol APIs don't have asset data yet
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          // console.log('[SwapProgress] ⏳ SWAP IN EARLY PROCESSING STATE:');
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          // console.log('[SwapProgress] Status:', apiData.status);
          // console.log('[SwapProgress] Message:', apiData.message);
          // console.log('[SwapProgress] Details:', apiData.details);
          // console.log('[SwapProgress] NOTE: Asset data not available yet - swap just broadcast or confirming');
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Continue polling - asset data will be available once protocol observes the tx
          // Don't update UI state yet to preserve initial swap details
          return;
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
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      // console.log('[SwapProgress] 🔔 WEBSOCKET EVENT RECEIVED');
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      // console.log('[SwapProgress] Full event:', JSON.stringify(event, null, 2));

      // Only handle events for this swap
      if (event.txHash !== txid && event.transaction?.txid !== txid) {
        console.warn('[SwapProgress] ⚠️ Event txHash mismatch - ignoring');
        console.warn('[SwapProgress] Event txHash:', event.txHash);
        console.warn('[SwapProgress] Expected txHash:', txid);
        return;
      }

      // ============================================
      // VALIDATION LAYER - Fail fast on invalid data
      // ============================================

      // Validate event structure
      if (!event.type && !event.status) {
        console.error('[SwapProgress] ❌ VALIDATION FAILED: Missing event.type AND event.status');
        console.error('[SwapProgress] Event keys:', Object.keys(event));
        console.error('[SwapProgress] This event cannot be processed - no status indicator');
      }

      const eventType = event.type || event.status;
      console.log('[SwapProgress] 📍 Event Type:', eventType);
      console.log('[SwapProgress] 📊 Current State BEFORE Update:', {
        currentStage,
        isComplete,
        hasShownConfetti: hasShownConfettiRef.current
      });

      // Validate confirmation data
      if (eventType.includes('confirming') || eventType.includes('output_detected')) {
        if (event.confirmations === undefined) {
          console.error('[SwapProgress] ❌ VALIDATION FAILED: Event type suggests confirming but confirmations is undefined');
          console.error('[SwapProgress] Event type:', eventType);
          console.error('[SwapProgress] Confirmations:', event.confirmations);
        }
        if (event.requiredConfirmations === undefined) {
          console.error('[SwapProgress] ❌ VALIDATION FAILED: Missing requiredConfirmations for confirmation stage');
        }
      }

      // Validate outbound data
      if (eventType.includes('output')) {
        if (!event.outboundTxHash && !event.thorchainData?.outboundTxHash) {
          console.error('[SwapProgress] ❌ VALIDATION FAILED: Output stage but no outboundTxHash');
          console.error('[SwapProgress] Event type:', eventType);
          console.error('[SwapProgress] outboundTxHash:', event.outboundTxHash);
          console.error('[SwapProgress] thorchainData:', event.thorchainData);
        }
      }

      setLastEventTime(Date.now());

      // Update swap status from event
      const updatedStatus: SwapStatus = {
        txHash: txid,
        status: eventType,
        confirmations: event.confirmations,
        requiredConfirmations: event.requiredConfirmations,
        outboundConfirmations: event.outboundConfirmations,
        outboundRequiredConfirmations: event.outboundRequiredConfirmations,
        outputDetectedAt: event.outputDetectedAt,
        thorchainData: event.thorchainData,
        timingData: event.timingData,
        error: event.error
      };

      console.log('[SwapProgress] 📝 Updated Status Object:', {
        status: updatedStatus.status,
        confirmations: updatedStatus.confirmations,
        requiredConfirmations: updatedStatus.requiredConfirmations,
        outboundConfirmations: updatedStatus.outboundConfirmations,
        outboundRequiredConfirmations: updatedStatus.outboundRequiredConfirmations,
        hasOutboundTx: !!updatedStatus.thorchainData?.outboundTxHash
      });

      setSwapStatus(updatedStatus);

      // ============================================
      // STAGE PROGRESSION - Determine next stage
      // ============================================

      // COMPLETION CHECK
      if (eventType === 'swap:output_confirmed' || eventType === 'swap:completed' || eventType === 'output_confirmed' || eventType === 'completed') {
        console.log('[SwapProgress] ✅ COMPLETION EVENT DETECTED');
        console.log('[SwapProgress] Event type matched:', eventType);
        console.log('[SwapProgress] Setting stage to 3 and isComplete to true');

        setCurrentStage(3);
        setIsComplete(true);

        // Show confetti ONCE when swap completes
        if (!hasShownConfettiRef.current) {
          console.log('[SwapProgress] 🎉 SHOWING CONFETTI (first time)');
          setShowConfetti(true);
          hasShownConfettiRef.current = true;
          setTimeout(() => setShowConfetti(false), 5000);
        } else {
          console.log('[SwapProgress] 🎉 Confetti already shown, skipping');
        }

        onComplete();
      }
      // OUTPUT STAGE (Stage 3 - not complete)
      else if (eventType === 'swap:output_detected' || eventType === 'swap:output_confirming' || eventType === 'output_detected' || eventType === 'output_confirming') {
        console.log('[SwapProgress] 📥 OUTPUT STAGE DETECTED');
        console.log('[SwapProgress] Event type matched:', eventType);
        console.log('[SwapProgress] Setting stage to 3 (output confirming)');
        console.log('[SwapProgress] Outbound confirmations:', event.outboundConfirmations, '/', event.outboundRequiredConfirmations);

        // Check if we should already be complete
        if (event.outboundConfirmations && event.outboundRequiredConfirmations) {
          if (event.outboundConfirmations >= event.outboundRequiredConfirmations) {
            console.error('[SwapProgress] ❌ LOGIC ERROR: Confirmations show complete but event type is not completed');
            console.error('[SwapProgress] Event type:', eventType);
            console.error('[SwapProgress] Outbound confirmations:', event.outboundConfirmations);
            console.error('[SwapProgress] Required confirmations:', event.outboundRequiredConfirmations);
            console.error('[SwapProgress] This swap should be completed but status says otherwise!');
          }
        }

        setCurrentStage(3);
      }
      // PROTOCOL PROCESSING (Stage 2)
      else if (eventType === 'swap:confirming' || eventType === 'confirming') {
        console.log('[SwapProgress] ⚡ PROTOCOL PROCESSING STAGE');
        console.log('[SwapProgress] Event type matched:', eventType);
        console.log('[SwapProgress] Setting stage to 2 (protocol processing)');
        console.log('[SwapProgress] Input confirmations:', event.confirmations, '/', event.requiredConfirmations);
        setCurrentStage(2);  // FIX: 'confirming' means protocol is processing the swap
      }
      // INITIATED/PENDING (Stage 1)
      else if (eventType === 'swap:initiated' || eventType === 'pending') {
        console.log('[SwapProgress] 🚀 SWAP INITIATED/PENDING');
        console.log('[SwapProgress] Event type matched:', eventType);
        console.log('[SwapProgress] Setting stage to 1');
        setCurrentStage(1);
      }
      // UNKNOWN EVENT TYPE
      else {
        console.error('[SwapProgress] ❌ UNKNOWN EVENT TYPE');
        console.error('[SwapProgress] Event type:', eventType);
        console.error('[SwapProgress] Full event:', event);
        console.error('[SwapProgress] This event type is not handled - swap progress may be stuck!');
      }

      // console.log('[SwapProgress] 📊 Current State AFTER Update:', {
      //   currentStage,
      //   isComplete,
      //   hasShownConfetti: hasShownConfettiRef.current
      // });
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // console.log(`[SwapProgress] 🔄 POLLING SETUP: ${pollingMode} mode (${pollingInterval/1000}s interval)`);
    // console.log(`[SwapProgress] WebSocket available: ${hasWebSocket}`);
    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!app?.pioneer?.GetPendingSwap) {
      console.error('[SwapProgress] ❌ GetPendingSwap not available - cannot set up polling');
      return;
    }

    // Polling function
    const pollSwapStatus = async () => {
      const pollTimestamp = new Date().toISOString();
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      // console.log(`[SwapProgress] 🔄 ${pollingMode} POLLING TRIGGERED at ${pollTimestamp}`);
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      try {
        // STEP 1: Trigger server-side status check (POST)
        // This forces the backend to query THORChain/Maya APIs for latest status
        if (app.pioneer.CheckPendingSwap && typeof app.pioneer.CheckPendingSwap === 'function') {
          try {
            console.log('[SwapProgress] 📤 STEP 1: Triggering force check (POST)...');
            const checkResponse = await app.pioneer.CheckPendingSwap({ txHash: txid });
            console.log('[SwapProgress] ✅ CheckPendingSwap response:', JSON.stringify(checkResponse, null, 2));
          } catch (checkErr) {
            console.warn('[SwapProgress] ⚠️ CheckPendingSwap failed, continuing with GET:', checkErr);
            // Continue to GET even if POST fails - better to have stale data than no data
          }
        } else {
          console.warn('[SwapProgress] ⚠️ CheckPendingSwap not available, skipping force check');
        }

        // STEP 2: Fetch updated swap data (GET)
        // console.log('[SwapProgress] 📥 STEP 2: Fetching swap data (GET)...');
        const response = await app.pioneer.GetPendingSwap({ txHash: txid });

        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log('[SwapProgress] 📦 FULL POLLING REST API RESPONSE:');
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log(JSON.stringify(response, null, 2));
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const swap = response?.data || response;

        if (swap) {
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          // console.log(`[SwapProgress] 🔄 ${pollingMode} POLLING UPDATE`);
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          // console.log('[SwapProgress] Polled status:', swap.status);
          // console.log('[SwapProgress] Confirmations:', swap.confirmations, '/', swap.requiredConfirmations);
          // console.log('[SwapProgress] Outbound confirmations:', swap.outboundConfirmations, '/', swap.outboundRequiredConfirmations);
          // console.log('[SwapProgress] Has outbound tx:', !!swap.thorchainData?.outboundTxHash);

          // VALIDATION: Check for data inconsistencies
          if (!swap.status) {
            console.error('[SwapProgress] ❌ POLLING VALIDATION FAILED: No status in response');
            console.error('[SwapProgress] Response:', swap);
          }

          if (swap.status === 'output_detected' && !swap.thorchainData?.outboundTxHash) {
            console.error('[SwapProgress] ❌ POLLING DATA INCONSISTENCY: Status is output_detected but no outboundTxHash');
            console.error('[SwapProgress] ThorchainData:', swap.thorchainData);
          }

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
            console.log('[SwapProgress] ✅ POLLING: Swap completed');
            setCurrentStage(3);
            setIsComplete(true);

            // Show confetti ONCE when swap completes
            if (!hasShownConfettiRef.current) {
              console.log('[SwapProgress] 🎉 POLLING: Showing confetti');
              setShowConfetti(true);
              hasShownConfettiRef.current = true;
              setTimeout(() => setShowConfetti(false), 5000);
            }
          } else if (swap.status === 'output_detected' || swap.status === 'output_confirming') {
            console.log('[SwapProgress] 📥 POLLING: Output stage detected');
            console.log('[SwapProgress] Outbound confirmations:', swap.outboundConfirmations, '/', swap.outboundRequiredConfirmations);

            // Check if should be complete
            if (swap.outboundConfirmations && swap.outboundRequiredConfirmations &&
                swap.outboundConfirmations >= swap.outboundRequiredConfirmations) {
              console.error('[SwapProgress] ❌ POLLING LOGIC ERROR: Outbound confirmations complete but status not updated');
              console.error('[SwapProgress] Status:', swap.status);
              console.error('[SwapProgress] Confirmations:', swap.outboundConfirmations, '/', swap.outboundRequiredConfirmations);
            }

            setCurrentStage(3);
          } else if (swap.status === 'confirming') {
            console.log('[SwapProgress] ⚡ POLLING: Protocol processing');
            setCurrentStage(2);  // FIX: 'confirming' means protocol is processing the swap
          }

          // console.log('[SwapProgress] 📊 State after polling:', {
          //   currentStage,
          //   isComplete,
          //   status: swap.status
          // });
          // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
          console.error('[SwapProgress] ❌ POLLING FAILED: No swap data in response');
          console.error('[SwapProgress] Response:', response);
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

  // Log swap status changes and state transitions
  useEffect(() => {
    if (!swapStatus) {
      return;
    }

    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // console.log('[SwapProgress] 🔄 STATE CHANGE DETECTED');
    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // console.log('[SwapProgress] Current Stage:', currentStage);
    // console.log('[SwapProgress] Is Complete:', isComplete);
    // console.log('[SwapProgress] Swap Status:', swapStatus.status);
    // console.log('[SwapProgress] Has shown confetti:', hasShownConfettiRef.current);
    // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  }, [swapStatus, currentStage, isComplete]);

  // ============================================
  // FORCE REFRESH FUNCTION - Manually trigger status check
  // ============================================
  const handleForceRefresh = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[SwapProgress] 🔄 FORCE REFRESH TRIGGERED BY USER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!app?.pioneer) {
      console.error('[SwapProgress] ❌ Pioneer SDK not available');
      return;
    }

    setIsForceRefreshing(true);

    try {
      // STEP 1: Force backend to check status (POST)
      if (app.pioneer.CheckPendingSwap && typeof app.pioneer.CheckPendingSwap === 'function') {
        console.log('[SwapProgress] 📤 Triggering force check (POST)...');
        const checkResponse = await app.pioneer.CheckPendingSwap({ txHash: txid });
        console.log('[SwapProgress] ✅ CheckPendingSwap response:');
        console.log(JSON.stringify(checkResponse, null, 2));
      }

      // STEP 2: Fetch updated data (GET)
      console.log('[SwapProgress] 📥 Fetching updated swap data (GET)...');
      const response = await app.pioneer.GetPendingSwap({ txHash: txid });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[SwapProgress] 📦 FORCE REFRESH - FULL REST API RESPONSE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(response, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const swap = response?.data || response;

      if (swap) {
        // Update state with new data
        const updatedStatus: SwapStatus = {
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

        console.log('[SwapProgress] ✅ Updating state with force-refreshed data');
        console.log('[SwapProgress] New status:', swap.status);
        console.log('[SwapProgress] Confirmations:', swap.confirmations, '/', swap.requiredConfirmations);
        console.log('[SwapProgress] Outbound confirmations:', swap.outboundConfirmations, '/', swap.outboundRequiredConfirmations);

        setSwapStatus(updatedStatus);
        setLastEventTime(Date.now());

        // Update stage based on status
        if (swap.status === 'output_confirmed' || swap.status === 'completed') {
          console.log('[SwapProgress] ✅ Swap completed!');
          setCurrentStage(3);
          setIsComplete(true);

          if (!hasShownConfettiRef.current) {
            setShowConfetti(true);
            hasShownConfettiRef.current = true;
            setTimeout(() => setShowConfetti(false), 5000);
          }
        } else if (swap.status === 'output_detected' || swap.status === 'output_confirming') {
          console.log('[SwapProgress] 📥 Output stage detected');
          setCurrentStage(3);
        } else if (swap.status === 'confirming') {
          console.log('[SwapProgress] ⚡ Protocol processing');
          setCurrentStage(2);  // FIX: 'confirming' means protocol is processing the swap
        }
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
      console.error('[SwapProgress] ❌ Force refresh failed:', err);
      console.error('[SwapProgress] Error details:', err instanceof Error ? err.message : String(err));
    } finally {
      setIsForceRefreshing(false);
    }
  };

  // ============================================
  // LOCAL TIMER - Increment elapsed seconds every second
  // ============================================
  useEffect(() => {
    // Only run timer if swap is active (not complete) and we have initial timing data
    if (isComplete || !swapStatus?.timingData) {
      return;
    }

    // Set up interval to update elapsed seconds every second
    const intervalId = setInterval(() => {
      setSwapStatus(prevStatus => {
        if (!prevStatus?.timingData) return prevStatus;

        // Calculate new elapsed seconds based on swap start time
        const now = Date.now();
        let newElapsedSeconds: number;

        if (swapStartTime) {
          // Use swap start time if available (most accurate)
          newElapsedSeconds = Math.floor((now - swapStartTime) / 1000);
        } else {
          // Fallback: increment from current elapsed seconds
          newElapsedSeconds = (prevStatus.timingData.elapsedSeconds || 0) + 1;
        }

        // Calculate remaining time
        const stageExpected = prevStatus.timingData.stageExpectedSeconds || 300;
        const stageElapsed = prevStatus.timingData.stageElapsedSeconds || newElapsedSeconds;
        const remaining = Math.max(0, stageExpected - stageElapsed);

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const remainingFormatted = minutes > 0
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`;

        return {
          ...prevStatus,
          timingData: {
            ...prevStatus.timingData,
            elapsedSeconds: newElapsedSeconds,
            remainingFormatted: remaining > 0 ? `${remainingFormatted}` : 'Completing...',
            reassuranceMessage: remaining > 0
              ? prevStatus.timingData.reassuranceMessage || 'Transaction is being processed.'
              : 'Almost there! Finalizing your swap...'
          }
        };
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isComplete, swapStatus?.timingData, swapStartTime]);

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

  // Get asset color for border (extract from icon or use default based on chain)
  const getAssetBorderColor = (caip: string) => {
    // Extract chain from CAIP (format: eip155:1/slip44:60)
    const chainPart = caip.split('/')[0] || caip.split(':')[0];

    // Chain color mapping
    const chainColors: Record<string, string> = {
      'eip155': '#627EEA',     // Ethereum blue
      'bip122': '#F7931A',     // Bitcoin orange
      'cosmos': '#2E3148',     // Cosmos dark blue
      'solana': '#14F195',     // Solana green
      'base': '#0052FF',       // Base blue
      'arbitrum': '#28A0F0',   // Arbitrum blue
      'optimism': '#FF0420',   // Optimism red
      'polygon': '#8247E5',    // Polygon purple
      'avalanche': '#E84142',  // Avalanche red
      'bsc': '#F3BA2F',        // BSC yellow
    };

    // Check for specific chain names in CAIP
    for (const [chain, color] of Object.entries(chainColors)) {
      if (chainPart.toLowerCase().includes(chain) || caip.toLowerCase().includes(chain)) {
        return color;
      }
    }

    // Default to teal if not found
    return '#14B8A6';
  };

  const borderColor = getAssetBorderColor(fromAssetInfo.caip);
  const borderGlow = borderColor + '60'; // Add transparency for glow effect

  return (
    <Box
      position="relative"
      width="full"
      bg={swapTheme.bg}
      backgroundImage="url(/images/backgrounds/splash-bg.png)"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
      borderRadius="2xl"
      borderWidth="3px"
      borderColor={borderColor}
      p={4}
      boxShadow={`0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px ${borderGlow}, inset 0 0 20px rgba(0, 0, 0, 0.3)`}
      _before={{
        content: '""',
        position: 'absolute',
        top: '-3px',
        left: '-3px',
        right: '-3px',
        bottom: '-3px',
        borderRadius: '2xl',
        background: `linear-gradient(135deg, ${borderColor}, ${borderColor}80, ${borderColor})`,
        zIndex: -1,
        opacity: 0.6,
        filter: 'blur(8px)',
      }}
    >
      {/* Confetti - Shows ONCE when swap completes */}
      {showConfetti && isComplete && (
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

      <VStack gap={4} width="full" align="stretch" position="relative">
        {/* Header */}
        <HStack justify="space-between" width="full">
          <Text fontSize="lg" fontWeight="bold" color={swapTheme.text}>
            {isComplete ? 'Swap Completed!' : 'Swap in Progress'}
          </Text>
          <Button
            variant="ghost"
            onClick={onClose}
            size="xs"
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
          onForceRefresh={handleForceRefresh}
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
          <Button
            size="md"
            bg={swapTheme.accent}
            color="white"
            _hover={{ bg: swapTheme.accentHover }}
            onClick={onClose}
            width="full"
            height="40px"
            borderRadius="md"
            fontWeight="semibold"
          >
            Done
          </Button>
        )}
      </VStack>

      {/* Bottom Right Logos - THORChain and KeepKey */}
      <HStack
        position="absolute"
        bottom={4}
        right={4}
        gap={3}
        opacity={0.4}
        _hover={{ opacity: 0.7 }}
        transition="opacity 0.2s"
      >
        {/* THORChain Logo */}
        <img
          src="/images/logos/thorchain.jpeg"
          alt="THORChain"
          style={{
            height: '24px',
            width: '24px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
        {/* KeepKey Logo */}
        <img
          src="/images/logos/keepkey_logo.png"
          alt="KeepKey"
          style={{
            height: '20px',
            width: 'auto',
            objectFit: 'contain'
          }}
        />
      </HStack>
    </Box>
  );
};
