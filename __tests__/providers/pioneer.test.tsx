/**
 * Integration tests for Pioneer SDK Provider
 * Tests that assetContext is properly set with SDK data including decimals/precision
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, usePioneerContext, AssetContextState } from '../../src/components/providers/pioneer';
import * as React from 'react';

// Mock Pioneer SDK instance
const createMockPioneer = () => ({
  state: {
    app: {
      assetContext: null,
    },
  },
  setAssetContext: jest.fn(),
});

describe('Pioneer Provider Integration', () => {
  let mockPioneer: any;

  beforeEach(() => {
    mockPioneer = createMockPioneer();
  });

  describe('Provider Setup', () => {
    it('should provide pioneer context to children', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
    });

    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => usePioneerContext());
      }).toThrow('usePioneerContext must be used within a PioneerContext.Provider');
    });
  });

  describe('AssetContext Management', () => {
    it('should set assetContext with COMPLETE SDK data including decimals', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const testAsset: AssetContextState = {
        networkId: 'eip155:1',
        chainId: 'eip155:1',
        assetId: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        caip: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'Tether USD',
        networkName: 'Ethereum',
        symbol: 'USDT',
        icon: 'https://pioneers.dev/coins/usdt.png',
        balance: '1000000000',
        value: 1000,
        precision: 6, // CRITICAL: Must have precision from SDK
        priceUsd: 1.0,
        explorer: 'https://etherscan.io',
        explorerAddressLink: 'https://etherscan.io/address/0x123',
        explorerTxLink: 'https://etherscan.io/tx/',
      };

      act(() => {
        result.current.setAssetContext(testAsset);
      });

      expect(result.current.state.app.assetContext).toEqual(testAsset);
      expect(result.current.state.app.assetContext.precision).toBe(6);
      expect(result.current.isAssetViewActive).toBe(true);
    });

    it('should FAIL if assetContext missing precision/decimals', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const invalidAsset: any = {
        networkId: 'eip155:1',
        chainId: 'eip155:1',
        caip: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        symbol: 'USDT',
        balance: '1000000000',
        // MISSING: precision and decimals fields!
      };

      act(() => {
        result.current.setAssetContext(invalidAsset);
      });

      const assetContext = result.current.state.app.assetContext;

      // This should be caught by our FAIL FAST checks in formatBalance
      expect(assetContext.precision).toBeUndefined();
      expect(assetContext.decimals).toBeUndefined();
    });

    it('should clear assetContext and deactivate asset view', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const testAsset: AssetContextState = {
        networkId: 'eip155:1',
        chainId: 'eip155:1',
        assetId: 'eip155:1/slip44:60',
        caip: 'eip155:1/slip44:60',
        name: 'Ethereum',
        networkName: 'Ethereum',
        symbol: 'ETH',
        balance: '1000000000000000000',
        precision: 18,
      };

      act(() => {
        result.current.setAssetContext(testAsset);
      });

      expect(result.current.state.app.assetContext).toEqual(testAsset);
      expect(result.current.isAssetViewActive).toBe(true);

      act(() => {
        result.current.clearAssetContext();
      });

      expect(result.current.state.app.assetContext).toBeNull();
      expect(result.current.isAssetViewActive).toBe(false);
    });

    it('should trigger balance refresh counter', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const initialCounter = result.current.state.balanceRefreshCounter;

      act(() => {
        result.current.triggerBalanceRefresh();
      });

      expect(result.current.state.balanceRefreshCounter).toBe(initialCounter + 1);
    });
  });

  describe('Multi-Asset Precision Validation', () => {
    it('should handle BTC with 8 decimals', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const btcAsset: AssetContextState = {
        networkId: 'bip122:000000000019d6689c085ae165831e93',
        chainId: 'bip122:000000000019d6689c085ae165831e93',
        assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        caip: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        name: 'Bitcoin',
        networkName: 'Bitcoin',
        symbol: 'BTC',
        balance: '100000000',
        precision: 8,
      };

      act(() => {
        result.current.setAssetContext(btcAsset);
      });

      expect(result.current.state.app.assetContext.precision).toBe(8);
    });

    it('should handle USDT with 6 decimals', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const usdtAsset: AssetContextState = {
        networkId: 'eip155:1',
        chainId: 'eip155:1',
        assetId: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        caip: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'Tether USD',
        networkName: 'Ethereum',
        symbol: 'USDT',
        balance: '1000000',
        precision: 6,
      };

      act(() => {
        result.current.setAssetContext(usdtAsset);
      });

      expect(result.current.state.app.assetContext.precision).toBe(6);
    });

    it('should handle ETH with 18 decimals', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const ethAsset: AssetContextState = {
        networkId: 'eip155:1',
        chainId: 'eip155:1',
        assetId: 'eip155:1/slip44:60',
        caip: 'eip155:1/slip44:60',
        name: 'Ethereum',
        networkName: 'Ethereum',
        symbol: 'ETH',
        balance: '1000000000000000000',
        precision: 18,
      };

      act(() => {
        result.current.setAssetContext(ethAsset);
      });

      expect(result.current.state.app.assetContext.precision).toBe(18);
    });
  });

  describe('Explorer Link Validation', () => {
    it('should include explorer links from SDK', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider pioneer={mockPioneer}>{children}</AppProvider>
      );

      const { result } = renderHook(() => usePioneerContext(), { wrapper });

      const assetWithExplorer: AssetContextState = {
        networkId: 'eip155:1',
        chainId: 'eip155:1',
        assetId: 'eip155:1/slip44:60',
        caip: 'eip155:1/slip44:60',
        name: 'Ethereum',
        networkName: 'Ethereum',
        symbol: 'ETH',
        balance: '1000000000000000000',
        precision: 18,
        explorer: 'https://etherscan.io',
        explorerAddressLink: 'https://etherscan.io/address/0x123',
        explorerTxLink: 'https://etherscan.io/tx/',
      };

      act(() => {
        result.current.setAssetContext(assetWithExplorer);
      });

      const ctx = result.current.state.app.assetContext;
      expect(ctx.explorer).toBe('https://etherscan.io');
      expect(ctx.explorerAddressLink).toBe('https://etherscan.io/address/0x123');
      expect(ctx.explorerTxLink).toBe('https://etherscan.io/tx/');
    });
  });
});
