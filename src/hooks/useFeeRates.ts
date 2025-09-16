import { useState, useEffect, useCallback } from 'react';
import { usePioneerContext } from '@/components/providers/pioneer';

export interface FeeRatesData {
  slow: string;
  average: string;
  fastest: string;
}

export interface FeeRatesResponse {
  data?: {
    unit?: string;
    description?: string;
    average?: number;
    fast?: number;
    fastest?: number;
    slow?: number;
  };
}

export interface UseFeeRatesResult {
  feeOptions: FeeRatesData;
  feeRates: FeeRatesResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const UTXO_NETWORKS = [
  'bip122:000000000019d6689c085ae165831e93', // Bitcoin
  'bip122:12a765e31ffd4059bada1e25190f6e98', // Litecoin
  'bip122:000000000933ea01ad0ee984209779ba', // Dogecoin
  'bip122:000000000000000000651ef99cb9fcbe', // Bitcoin Cash
];

const EVM_NETWORKS = [
  'eip155:1',    // Ethereum
  'eip155:56',   // BSC
  'eip155:137',  // Polygon
  'eip155:43114', // Avalanche
  'eip155:8453', // Base
  'eip155:10',   // Optimism
];

export const useFeeRates = (networkId: string, assetId?: string): UseFeeRatesResult => {
  const { app } = usePioneerContext();

  console.log('[useFeeRates] Hook called with:', {
    networkId,
    assetId,
    hasApp: !!app,
    hasFees: !!app?.getFees
  });

  const [feeOptions, setFeeOptions] = useState<FeeRatesData>({
    slow: '0',
    average: '0',
    fastest: '0'
  });

  const [feeRates, setFeeRates] = useState<FeeRatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNetworkType = (networkId: string): 'UTXO' | 'EVM' | 'TENDERMINT' | 'OTHER' => {
    if (UTXO_NETWORKS.includes(networkId)) return 'UTXO';
    if (EVM_NETWORKS.includes(networkId)) return 'EVM';
    if (networkId.startsWith('cosmos:')) return 'TENDERMINT';
    return 'OTHER';
  };

  const getNetworkDefaults = (networkId: string, networkType: string): FeeRatesData => {
    // NO DEFAULTS - must get from API
    return {
      slow: '0',
      average: '0',
      fastest: '0'
    };
  };

  const fetchFeeRates = useCallback(async () => {
    console.log('[useFeeRates] fetchFeeRates called', {
      hasApp: !!app,
      hasFees: !!app?.getFees,
      networkId,
      currentFeeOptions: feeOptions
    });

    if (!app || !app.getFees || !networkId) {
      console.log('[useFeeRates] Missing requirements - skipping fetch:', {
        app: !!app,
        getFees: !!app?.getFees,
        networkId,
        reason: !app ? 'No app context' : !app?.getFees ? 'No getFees method' : 'No networkId'
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[useFeeRates] Fetching fee rates using app.getFees for network: ${networkId}`);

      // Use the new normalized getFees method from SDK
      // This handles all the complexity and returns clean, normalized data
      const normalizedFees = await app.getFees(networkId);

      console.log('[useFeeRates] Got normalized fee rates:', normalizedFees);

      // Extract the simple fee values for the UI
      const fees = {
        slow: normalizedFees.slow.value,
        average: normalizedFees.average.value,
        fastest: normalizedFees.fastest.value
      };

      console.log('[useFeeRates] Extracted fee values for UI:', fees);
      setFeeOptions(fees);

      // Store the complete normalized data for additional UI features
      // This includes labels, descriptions, estimated times, units, etc.
      setFeeRates({
        data: {
          // Keep the raw response if components need it
          ...normalizedFees.raw,
          // Provide the unit and description at the top level for backward compatibility
          unit: normalizedFees.slow.unit,
          description: normalizedFees.average.description,
          // Also include the full normalized data so components can access rich metadata
          normalized: normalizedFees,
          // Map normalized format to expected format for backward compatibility
          slow: parseFloat(normalizedFees.slow.value),
          average: parseFloat(normalizedFees.average.value),
          fastest: parseFloat(normalizedFees.fastest.value)
        }
      });

      // Log rich metadata for debugging
      console.log('[useFeeRates] Fee metadata:', {
        unit: normalizedFees.slow.unit,
        networkType: normalizedFees.networkType,
        labels: {
          slow: normalizedFees.slow.label,
          average: normalizedFees.average.label,
          fastest: normalizedFees.fastest.label
        },
        estimatedTimes: {
          slow: normalizedFees.slow.estimatedTime,
          average: normalizedFees.average.estimatedTime,
          fastest: normalizedFees.fastest.estimatedTime
        },
        priorities: {
          slow: normalizedFees.slow.priority,
          average: normalizedFees.average.priority,
          fastest: normalizedFees.fastest.priority
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch fee rates';
      setError(errorMessage);
      console.error('[useFeeRates] Error fetching fee rates:', err);

      // Fallback to sensible defaults if the SDK fails
      // The SDK already has its own fallback logic, so this is a last resort
      const networkType = getNetworkType(networkId);
      const defaultFees = networkType === 'UTXO'
        ? { slow: '1', average: '2', fastest: '3' }
        : { slow: '1', average: '1.5', fastest: '2' };

      console.log('[useFeeRates] Using last-resort fallback fees:', defaultFees);
      setFeeOptions(defaultFees);
    } finally {
      setLoading(false);
    }
  }, [app, networkId]);

  useEffect(() => {
    console.log('[useFeeRates] useEffect triggered - checking conditions', {
      networkId,
      hasApp: !!app,
      hasFees: !!app?.getFees,
      willFetch: !!(app && app.getFees && networkId)
    });

    if (app && app.getFees && networkId) {
      console.log('[useFeeRates] Conditions met, calling fetchFeeRates');
      fetchFeeRates();
    } else {
      console.log('[useFeeRates] Conditions not met, skipping fetch');
    }
  }, [fetchFeeRates, app, networkId]);

  return {
    feeOptions,
    feeRates,
    loading,
    error,
    refetch: fetchFeeRates
  };
};