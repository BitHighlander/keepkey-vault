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

  // Fetch custom tokens from server via Pioneer SDK
  const fetchCustomTokens = useCallback(async () => {
    if (!userAddress || !app?.pioneer) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Fetching custom tokens for:', userAddress);

      // GetCustomTokens requires { networkId, address } for each network
      // Fetch custom tokens for all supported EVM networks
      const evmNetworks = ['eip155:1', 'eip155:10', 'eip155:56', 'eip155:137', 'eip155:8453'];
      const allTokens: CustomToken[] = [];

      for (const networkId of evmNetworks) {
        try {
          const response = await app.pioneer.GetCustomTokens({
            networkId,
            address: userAddress
          });

          console.log(`📦 GetCustomTokens response for ${networkId}:`, response);

          // Check both response.tokens and response.data.tokens for compatibility
          const tokens = response?.data?.tokens || response?.tokens || [];
          allTokens.push(...tokens);
        } catch (networkErr: any) {
          // Log but don't fail - some networks might not have custom tokens
          console.log(`ℹ️ No custom tokens for ${networkId}:`, networkErr.message);
        }
      }

      setCustomTokens(allTokens);
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
    console.log('📝 addCustomToken called with:', token);
    console.log('User address:', userAddress);
    console.log('Pioneer client available:', !!app?.pioneer);

    if (!userAddress || !app?.pioneer) {
      const errorMsg = 'No user address or Pioneer client available';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return { success: false, hasBalance: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🌐 Calling app.pioneer.AddCustomToken');

      // Call the Pioneer SDK method
      const response = await app.pioneer.AddCustomToken({
        userAddress,
        token,
      });

      console.log('✅ Response data:', response);

      // Fix: Check response.data.tokens instead of response.tokens
      const tokens = response?.data?.tokens || response?.tokens;

      if (response && (response.success || response?.data?.success) && tokens) {
        setCustomTokens(tokens);
        console.log('✅ Token added successfully! Total tokens:', tokens.length);

        // Now check if the token has a balance
        console.log('🔍 Checking token balance for:', token.caip);
        try {
          const balanceResult = await app.getBalance(token.networkId);
          console.log('💰 Balance result:', balanceResult);

          // Find the specific token in the balance results
          const tokenBalance = balanceResult?.find((b: any) =>
            b.caip?.toLowerCase() === token.caip?.toLowerCase() ||
            b.address?.toLowerCase() === token.address?.toLowerCase()
          );

          if (tokenBalance && parseFloat(tokenBalance.balance || '0') > 0) {
            console.log('✅ Token has balance:', tokenBalance.balance);
            return {
              success: true,
              hasBalance: true,
              balance: tokenBalance.balance
            };
          } else {
            console.log('⚠️ Token added but no balance found');
            return {
              success: true,
              hasBalance: false
            };
          }
        } catch (balanceErr: any) {
          console.error('❌ Error checking balance:', balanceErr);
          // Still return success since the token was added
          return {
            success: true,
            hasBalance: false
          };
        }
      }

      console.warn('⚠️ API call succeeded but no tokens returned');
      return { success: false, hasBalance: false };
    } catch (err: any) {
      console.error('❌ Error adding custom token:', err);
      setError(err.message || 'Failed to add custom token');
      return { success: false, hasBalance: false };
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, app]);

  // Remove a custom token
  const removeCustomToken = useCallback(async (networkId: string, tokenAddress: string) => {
    if (!userAddress || !app?.pioneer) {
      setError('No user address or Pioneer client available');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🗑️ Removing custom token:', networkId, tokenAddress);

      // Call the Pioneer SDK method
      const response = await app.pioneer.RemoveCustomToken({
        userAddress,
        networkId,
        tokenAddress,
      });

      if (response && response.success && response.tokens !== undefined) {
        setCustomTokens(response.tokens);
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
  }, [userAddress, app]);

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
