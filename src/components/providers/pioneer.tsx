'use client'

import * as React from 'react'
import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { paymentEventManager, createBalancesMap } from '@/lib/notifications/PaymentEventManager'
import { transactionEventManager } from '@/lib/notifications/TransactionEventManager'

type ColorMode = 'light' | 'dark'

// Define asset context interface
export interface AssetContextState {
  networkId: string;
  chainId: string;
  assetId: string;
  caip: string;
  name: string;
  networkName: string;
  symbol: string;
  icon?: string;
  color?: string;
  balance: string;
  value?: number;
  precision: number;
  priceUsd?: number;
  explorer?: string;
  explorerAddressLink?: string;
  explorerTxLink?: string;
  pubkeys?: any[];
}

// Create Pioneer Context with asset state
export interface PioneerContextValue {
  state: any;
  setAssetContext: (assetData: AssetContextState, chatId?: string) => Promise<void>;
  setOutboundAssetContext: (assetData: AssetContextState) => Promise<void>;
  clearAssetContext: (chatId?: string) => void;
  triggerBalanceRefresh: () => void;
  isAssetViewActive: boolean;
  setIsAssetViewActive: (isActive: boolean) => void;
}

export const PioneerContext = createContext<any>(null)
export const usePioneerContext = () => {
    const context = useContext(PioneerContext)
    if (!context) {
        throw new Error('usePioneerContext must be used within a PioneerContext.Provider')
    }
    return context
}

export interface AppProviderProps {
    onError?: (error: Error, info: any) => void
    initialColorMode?: ColorMode
    children: React.ReactNode
    pioneer?: any // The Pioneer instance
}

export function AppProvider({
    children,
    // onError,
    // initialColorMode = 'dark',
    pioneer,
}: AppProviderProps) {
    // Add state for asset context
    const [assetContext, setAssetContext] = useState<AssetContextState | null>(null);
    const [outboundAssetContext, setOutboundAssetContext] = useState<AssetContextState | null>(null);
    const [isAssetViewActive, setIsAssetViewActive] = useState<boolean>(false);
    // Add refresh counter to force re-renders when balances update
    const [balanceRefreshCounter, setBalanceRefreshCounter] = useState<number>(0);

    // Memoize setter functions to prevent infinite loops in useEffect dependencies
    const setAssetContextMemoized = useCallback((assetData: AssetContextState) => {
        console.log('🔄 [Provider] Setting asset context:', assetData);
        setAssetContext(assetData);
        setIsAssetViewActive(true);
        return Promise.resolve();
    }, []);

    const setOutboundAssetContextMemoized = useCallback(async (assetData: AssetContextState) => {
        console.log('🔄 [Provider] Setting outbound asset context:', assetData);

        // Call the actual SDK method to let it populate address from pubkeys
        if (pioneer?.state?.app && typeof pioneer.state.app.setOutboundAssetContext === 'function') {
            await pioneer.state.app.setOutboundAssetContext(assetData);
            const sdkResult = pioneer.state.app.outboundAssetContext;
            console.log('✅ [Provider] SDK result:', {
                symbol: sdkResult?.symbol,
                address: sdkResult?.address,
                pathMaster: sdkResult?.pathMaster,
                caip: sdkResult?.caip
            });

            // Only update React state if the CAIP actually changed (prevent infinite loops)
            if (sdkResult?.caip !== outboundAssetContext?.caip) {
                setOutboundAssetContext(sdkResult);
            } else {
                console.log('⏭️ [Provider] Skipping state update - CAIP unchanged');
            }
        } else {
            console.warn('⚠️ [Provider] SDK setOutboundAssetContext not available, using fallback');
            // Fallback if SDK not available
            if (assetData?.caip !== outboundAssetContext?.caip) {
                setOutboundAssetContext(assetData);
            }
        }
    }, [pioneer, outboundAssetContext]);

    // Payment notification system - track balance snapshots for event detection
    // Using useRef to avoid re-renders and prevent infinite loop
    const balancesSnapshotRef = useRef<Map<string, any>>(new Map());

    // Listen for DASHBOARD_UPDATE events and detect payment events
    useEffect(() => {
        if (!pioneer?.state?.app?.events) {
            console.log('[PioneerProvider] No events object available yet');
            return;
        }

        const handleDashboardUpdate = (data: any) => {
            console.log('[PioneerProvider] DASHBOARD_UPDATE event received');

            // Get current balances from Pioneer SDK
            const newBalances = pioneer.state.app.balances || [];

            // Process balance changes to detect payment events
            paymentEventManager.processBalanceUpdate(balancesSnapshotRef.current, newBalances);

            // Update snapshot for next comparison (doesn't trigger re-render)
            balancesSnapshotRef.current = createBalancesMap(newBalances);
        };

        // Subscribe to DASHBOARD_UPDATE events
        pioneer.state.app.events.on('DASHBOARD_UPDATE', handleDashboardUpdate);
        console.log('[PioneerProvider] Subscribed to DASHBOARD_UPDATE events');

        // Initialize snapshot with current balances
        const currentBalances = pioneer.state.app.balances || [];
        balancesSnapshotRef.current = createBalancesMap(currentBalances);

        // Cleanup subscription on unmount
        return () => {
            pioneer.state.app.events.off('DASHBOARD_UPDATE', handleDashboardUpdate);
            console.log('[PioneerProvider] Unsubscribed from DASHBOARD_UPDATE events');
        };
    }, [pioneer?.state?.app?.events]);

    // Listen for pioneer:tx events (actual blockchain transactions)
    useEffect(() => {
        if (!pioneer?.state?.app?.events) {
            return;
        }

        const handleTransactionEvent = (txData: any) => {
            console.log('[PioneerProvider] pioneer:tx event received:', {
                chain: txData.chain,
                address: txData.address,
                txid: txData.txid,
                value: txData.value,
            });

            // Process actual transaction events (NOT balance updates)
            transactionEventManager.processTransactionEvent(txData);
        };

        pioneer.state.app.events.on('pioneer:tx', handleTransactionEvent);
        console.log('[PioneerProvider] Subscribed to pioneer:tx events');

        return () => {
            pioneer.state.app.events.off('pioneer:tx', handleTransactionEvent);
            console.log('[PioneerProvider] Unsubscribed from pioneer:tx events');
        };
    }, [pioneer?.state?.app?.events]);

    // Memoize clearAssetContext to prevent recreating on every render
    const clearAssetContextMemoized = useCallback(() => {
        console.log('🔄 Clearing asset context');
        setAssetContext(null);
        setOutboundAssetContext(null);
        setIsAssetViewActive(false);
    }, []);

    // Memoize triggerBalanceRefresh to prevent recreating on every render
    const triggerBalanceRefreshMemoized = useCallback(() => {
        console.log('🔄 Triggering balance refresh counter');
        setBalanceRefreshCounter(prev => prev + 1);
    }, []);

    // Create wrapper for pioneer with added asset context
    // Memoize to prevent unnecessary re-renders
    const pioneerWithAssetContext = useMemo(() => ({
        ...pioneer,
        state: {
            ...pioneer?.state,
            app: {
                ...pioneer?.state?.app,
                assetContext,
                outboundAssetContext,
                // Override SDK methods with React state setters (memoized to prevent infinite loops)
                setAssetContext: setAssetContextMemoized,
                setOutboundAssetContext: setOutboundAssetContextMemoized,
            },
            balanceRefreshCounter, // Include counter in state
        },
        // Also add methods at top level for backward compatibility
        setAssetContext: setAssetContextMemoized,
        setOutboundAssetContext: setOutboundAssetContextMemoized,
        clearAssetContext: clearAssetContextMemoized,
        triggerBalanceRefresh: triggerBalanceRefreshMemoized,
        isAssetViewActive,
        setIsAssetViewActive
    }), [pioneer, assetContext, outboundAssetContext, balanceRefreshCounter, setAssetContextMemoized, setOutboundAssetContextMemoized, clearAssetContextMemoized, triggerBalanceRefreshMemoized, isAssetViewActive, setIsAssetViewActive]);

    return (
        <PioneerContext.Provider value={pioneerWithAssetContext}>
            {children}
        </PioneerContext.Provider>
    )
}
