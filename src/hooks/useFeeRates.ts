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
  
  const [feeOptions, setFeeOptions] = useState<FeeRatesData>({
    slow: '0.0001',
    average: '0.0002', 
    fastest: '0.0005'
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
    switch (networkId) {
      case 'bip122:000000000019d6689c085ae165831e93': // Bitcoin
        return {
          slow: '0.00000500',    // 2 sat/byte
          average: '0.00001250', // 5 sat/byte  
          fastest: '0.00002500'  // 10 sat/byte
        };
      
      case 'bip122:000000000000000000651ef99cb9fcbe': // Bitcoin Cash
        return {
          slow: '0.00000625',    // 2.5 sat/byte
          average: '0.00001000', // 4 sat/byte
          fastest: '0.00001500'  // 6 sat/byte
        };
      
      default:
        switch (networkType) {
          case 'EVM':
            return {
              slow: '0.000000020',   // 20 gwei
              average: '0.000000025', // 25 gwei
              fastest: '0.000000030' // 30 gwei
            };
          case 'UTXO':
            return {
              slow: '0.00000500',
              average: '0.00001000',
              fastest: '0.00002000'
            };
          case 'TENDERMINT':
            return {
              slow: '0.000001',
              average: '0.000002', 
              fastest: '0.000003'
            };
          default:
            return {
              slow: '0.0001',
              average: '0.0002',
              fastest: '0.0005'
            };
        }
    }
  };

  const fetchFeeRates = useCallback(async () => {
    if (!app?.pioneer || !networkId) return;
    
    setLoading(true);
    setError(null);

    try {
      const networkType = getNetworkType(networkId);
      let defaultFees = getNetworkDefaults(networkId, networkType);

      console.log(`Fetching fee rates for network: ${networkId}`);
      
      // Try to get fee rates from the API
      try {
        if (app?.pioneer) {
          const apiResult = await (app.pioneer.GetFeeRateByNetwork 
            ? app.pioneer.GetFeeRateByNetwork({ networkId }) 
            : app.pioneer.GetFeeRate({ networkId }));
          
          console.log('Fee rates from API:', apiResult);
          
          // Store the complete fee rates data for use in the UI
          setFeeRates(apiResult);
          
          if (apiResult?.data && 
              apiResult.data.slow && 
              apiResult.data.average && 
              apiResult.data.fastest) {
            
            // Use API data
            defaultFees = {
              slow: apiResult.data.slow.toString(),
              average: apiResult.data.average.toString(), 
              fastest: apiResult.data.fastest.toString()
            };
            
            console.log('Updated fees from API:', defaultFees);
          } else if (apiResult?.data && 
                     apiResult.data.average && 
                     apiResult.data.fast && 
                     apiResult.data.fastest) {
            
            // Handle different API format (fastest, fast, average)
            defaultFees = {
              slow: apiResult.data.average.toString(),
              average: apiResult.data.fast.toString(),
              fastest: apiResult.data.fastest.toString()
            };
            
            console.log('Updated fees from alternative API format:', defaultFees);
          } else {
            console.warn('API returned incomplete fee data, using defaults');
          }
          
          // Log fee unit if provided
          if (apiResult?.data?.unit) {
            console.log('Fee unit:', apiResult.data.unit);
            console.log('Fee description:', apiResult.data.description);
          }
        }
      } catch (apiError) {
        console.warn('Failed to fetch fee rates from API, using network-specific defaults', apiError);
      }

      setFeeOptions(defaultFees);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch fee rates';
      setError(errorMessage);
      console.error('Error fetching fee rates:', err);
    } finally {
      setLoading(false);
    }
  }, [app, networkId]);

  useEffect(() => {
    fetchFeeRates();
  }, [fetchFeeRates]);

  return {
    feeOptions,
    feeRates,
    loading,
    error,
    refetch: fetchFeeRates
  };
};