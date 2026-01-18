import { useState, useEffect, useCallback } from 'react';
import { usePioneerContext } from '@/components/providers/pioneer';

export interface PendingSwap {
  txHash: string;
  sellAsset: {
    caip: string;
    symbol: string;
    amount: string;
    icon?: string;
    name?: string;
  };
  buyAsset: {
    caip: string;
    symbol: string;
    amount: string;
    icon?: string;
    name?: string;
  };
  status: 'signing' | 'pending' | 'confirming' | 'completed' | 'failed' | 'refunded' | 'output_detected' | 'output_confirming' | 'output_confirmed';
  confirmations: number;
  createdAt: string;
  integration: string;
  // Enhanced swap metadata from event system
  outboundConfirmations?: number;
  outboundRequiredConfirmations?: number;
  outputDetectedAt?: string;
  quote?: {
    memo?: string;
  };
  error?: {
    type?: string;
    severity?: string;
    userMessage?: string;
    actionable?: string;
    message?: string;
  };
  thorchainData?: {
    outboundTxHash?: string;
    swapStatus?: string;
  };
}

export const usePendingSwaps = () => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const [pendingSwaps, setPendingSwaps] = useState<PendingSwap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get ETH address specifically - swaps are usually EVM-based
  // Priority: ETH address > any address
  const userAddress = 
    state?.pubkeys?.find((p: any) => p.networks?.includes('eip155:1') || p.networks?.includes('eip155:*'))?.address ||
    state?.pubkeys?.find((p: any) => p.address)?.address ||
    app?.assetContext?.pubkey ||
    app?.pubkeys?.find((p: any) => p.address)?.address ||
    '';
  
  //console.log('🔍 [usePendingSwaps] Using address:', userAddress);

  // Fetch pending swaps - EXACT PATTERN from useCustomTokens
  const fetchPendingSwaps = useCallback(async () => {
    if (!userAddress || !app?.pioneer) {
      //console.log('⏭️ [usePendingSwaps] Skipping fetch:', { userAddress, hasPioneer: !!app?.pioneer });
      return;
    }

    console.log('🔍 [usePendingSwaps] Fetching for address:', userAddress);

    try {
      setIsLoading(true);
      setError(null);

      if (typeof app.pioneer.GetAddressPendingSwaps !== 'function') {
        console.warn('⚠️ GetAddressPendingSwaps not available on Pioneer SDK');
        return;
      }

      const response = await app.pioneer.GetAddressPendingSwaps({
        address: userAddress
      });

      console.log('[usePendingSwaps] Response:', response);

      // Handle the new SDK response format
      if (response?.success && response?.swaps) {
        setPendingSwaps(Array.isArray(response.swaps) ? response.swaps : []);
        console.log(`[usePendingSwaps] Found ${response.swaps.length} pending swap(s)`);
      } else if (response?.error) {
        console.error('[usePendingSwaps] Error from SDK:', response.error);
        setError(response.error);
        setPendingSwaps([]);
      } else {
        // Fallback to old format for backward compatibility
        const swaps = response?.data || response?.swaps || [];
        setPendingSwaps(Array.isArray(swaps) ? swaps : []);
      }

    } catch (err: any) {
      console.error('Error fetching pending swaps:', err);
      setError(err.message || 'Failed to fetch pending swaps');
      setPendingSwaps([]);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, app]);

  // Fetch on mount - EXACT PATTERN from useCustomTokens
  useEffect(() => {
    fetchPendingSwaps();
  }, [fetchPendingSwaps]);

  // Helper functions
  const getPendingForAsset = useCallback((caip: string) => {
    return pendingSwaps.filter(swap => 
      swap.sellAsset.caip === caip || swap.buyAsset.caip === caip
    );
  }, [pendingSwaps]);

  const getDebitsForAsset = useCallback((caip: string) => {
    return pendingSwaps
      .filter(swap => swap.sellAsset.caip === caip && swap.status !== 'completed' && swap.status !== 'failed')
      .reduce((total, swap) => total + (parseFloat(swap.sellAsset.amount) || 0), 0);
  }, [pendingSwaps]);

  const getCreditsForAsset = useCallback((caip: string) => {
    return pendingSwaps
      .filter(swap => swap.buyAsset.caip === caip && swap.status !== 'completed' && swap.status !== 'failed')
      .reduce((total, swap) => total + (parseFloat(swap.buyAsset.amount) || 0), 0);
  }, [pendingSwaps]);

  return {
    pendingSwaps,
    isLoading,
    error,
    refreshPendingSwaps: fetchPendingSwaps,
    getPendingForAsset,
    getDebitsForAsset,
    getCreditsForAsset,
  };
};

