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
    if (!userAddress || !app?.spec) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Fetching custom tokens from server for:', userAddress);

      // Extract base URL from spec
      const baseUrl = app.spec.replace('/spec/swagger.json', '');

      // Call the server API endpoint directly
      const response = await fetch(`${baseUrl}/custom-tokens/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress })
      });

      const result = await response.json();
      console.log('📦 Server response:', result);

      const tokens = result?.data?.tokens || [];
      setCustomTokens(tokens);

      console.log(`✅ Loaded ${tokens.length} custom tokens from server`);
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

    if (!userAddress || !app?.spec) {
      const errorMsg = 'No user address or app spec available';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return { success: false, hasBalance: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🌐 Adding custom token to server via API');

      // Extract base URL from spec
      const baseUrl = app.spec.replace('/spec/swagger.json', '');

      // Call the server API endpoint directly
      const response = await fetch(`${baseUrl}/custom-tokens/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      });

      const result = await response.json();
      console.log('✅ AddCustomToken response:', result);

      if (result && result.success) {
        // Refresh the token list from the server
        await fetchCustomTokens();

        console.log('✅ Token added successfully!');

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

      console.warn('⚠️ API call succeeded but unexpected response format');
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

      console.log('🗑️ Removing custom token:', networkId, tokenAddress);

      // Call the server API to remove the token
      const response = await app.pioneer.RemoveCustomToken({
        userAddress,
        networkId,
        tokenAddress,
      });

      console.log('✅ RemoveCustomToken response:', response);

      if (response && (response.success || response?.data?.success)) {
        // Refresh the token list from the server
        await fetchCustomTokens();
        console.log('✅ Token removed successfully!');
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
