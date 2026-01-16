import { useState, useEffect, useCallback } from 'react';
import { usePioneerContext } from '@/components/providers/pioneer';

export interface CustomToken {
  symbol: string;
  name: string;
  address: string;
  networkId: string;
  caip: string;
  decimals: number;
  icon?: string;
  coingeckoId?: string;
}

export const useCustomTokens = () => {
  const pioneer = usePioneerContext();
  const { state } = pioneer;
  const { app } = state;
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's primary address
  const userAddress = app?.assetContext?.pubkey ||
    state?.pubkeys?.find((p: any) => p.networks?.includes('eip155:*'))?.address ||
    state?.pubkeys?.find((p: any) => p.networks?.includes('eip155:*'))?.master ||
    '';

  // Fetch custom tokens from Pioneer server
  const fetchCustomTokens = useCallback(async () => {
    if (!userAddress || !app?.pioneer) return;

    try {
      setIsLoading(true);
      setError(null);


      // The Pioneer SDK auto-generates methods from swagger spec
      // If this fails, the SDK was initialized with wrong spec URL
      if (typeof app.pioneer.GetCustomTokens !== 'function') {
        throw new Error('GetCustomTokens method not available - SDK may be using wrong spec URL');
      }

      const response = await app.pioneer.GetCustomTokens({
        userAddress
      });


      // Handle nested response structure: response.data.data.tokens
      const tokens = response?.data?.data?.tokens || response?.data?.tokens || response?.tokens || [];
      setCustomTokens(tokens);

    } catch (err: any) {
      console.error('Error fetching custom tokens:', err);
      setError(err.message || 'Failed to fetch custom tokens');
      setCustomTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, app]);

  // Add a custom token
  const addCustomToken = useCallback(async (token: CustomToken): Promise<{
    success: boolean;
    hasBalance: boolean;
    balance?: string;
  }> => {

    if (!userAddress || !app?.pioneer) {
      const errorMsg = 'No user address or Pioneer SDK available';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return { success: false, hasBalance: false };
    }

    try {
      setIsLoading(true);
      setError(null);


      // The Pioneer SDK auto-generates methods from swagger spec
      // If this fails, the SDK was initialized with wrong spec URL
      if (typeof app.pioneer.AddCustomToken !== 'function') {
        throw new Error('AddCustomToken method not available - SDK may be using wrong spec URL');
      }

      const response = await app.pioneer.AddCustomToken({
        userAddress,
        token: {
          networkId: token.networkId,
          address: token.address,
          caip: token.caip,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          icon: token.icon,
          coingeckoId: token.coingeckoId,
        }
      });


      // Handle nested response structure: response.data.success or response.success
      const isSuccess = response?.success || response?.data?.success;

      if (response && isSuccess) {
        // Refresh the token list from the server
        await fetchCustomTokens();


        // Check token balance using the dedicated endpoint with retry logic

        // Helper function to check balance with retry
        const checkBalanceWithRetry = async (retries = 3, delay = 800): Promise<{
          success: boolean;
          hasBalance: boolean;
          balance?: string;
        }> => {
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {

              // Add delay before retry attempts (but not the first attempt)
              if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }

              // Use the dedicated GetCustomTokenBalances method
              const balanceResult = await app.pioneer.GetCustomTokenBalances({
                networkId: token.networkId,
                address: userAddress
              });


              // Handle nested response structure
              const balanceTokens = balanceResult?.data?.data?.tokens || balanceResult?.data?.tokens || balanceResult?.tokens || [];
              const tokenBalance = balanceTokens.find(
                (t: any) => {
                  // Try matching by CAIP first
                  if (t.assetCaip?.toLowerCase() === token.caip?.toLowerCase()) {
                    return true;
                  }
                  // Fallback: match by symbol and check if address is in assetCaip
                  if ((t.token?.symbol === token.symbol || t.symbol === token.symbol) &&
                      (t.assetCaip?.toLowerCase().includes(token.address.toLowerCase()) ||
                       t.token?.address?.toLowerCase() === token.address.toLowerCase() ||
                       t.address?.toLowerCase() === token.address.toLowerCase())) {
                    return true;
                  }
                  return false;
                }
              );

              if (tokenBalance) {
                const balance = tokenBalance.token?.balance || tokenBalance.balance || '0';

                return {
                  success: true,
                  hasBalance: parseFloat(balance) > 0,
                  balance
                };
              } else if (attempt < retries) {
              } else {
                return {
                  success: true,
                  hasBalance: false
                };
              }
            } catch (err: any) {
              console.error(`❌ Error checking balance (attempt ${attempt}):`, err);
              if (attempt === retries) {
                // Still return success since the token was added
                return {
                  success: true,
                  hasBalance: false
                };
              }
            }
          }

          return {
            success: true,
            hasBalance: false
          };
        };

        return await checkBalanceWithRetry();
      }

      return { success: false, hasBalance: false };
    } catch (err: any) {
      console.error('❌ Error adding custom token:', err);
      setError(err.message || 'Failed to add custom token');
      return { success: false, hasBalance: false };
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, app, fetchCustomTokens]);

  // Remove a custom token
  const removeCustomToken = useCallback(async (networkId: string, tokenAddress: string) => {
    if (!userAddress || !app?.pioneer) {
      setError('No user address or Pioneer client available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);


      // Call the server API to remove the token
      const response = await app.pioneer.RemoveCustomToken({
        userAddress,
        networkId,
        tokenAddress,
      });


      if (response && (response.success || response?.data?.success)) {
        // Refresh the token list from the server
        await fetchCustomTokens();
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('Error removing custom token:', err);
      setError(err.message || 'Failed to remove custom token');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, app, fetchCustomTokens]);

  // Fetch custom tokens on mount and when user address changes
  useEffect(() => {
    fetchCustomTokens();
  }, [fetchCustomTokens]);

  return {
    customTokens,
    isLoading,
    error,
    addCustomToken,
    removeCustomToken,
    refreshCustomTokens: fetchCustomTokens,
  };
};
