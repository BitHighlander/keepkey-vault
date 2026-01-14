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
    // Track processing state to prevent infinite loops via re-entry detection
    const isProcessingAssetRef = useRef<boolean>(false);
    const isProcessingOutboundRef = useRef<boolean>(false);

    // Memoize setter functions to prevent infinite loops in useEffect dependencies
    const setAssetContextMemoized = useCallback(async (assetData: AssetContextState) => {
        // Prevent infinite loops via re-entry detection
        if (isProcessingAssetRef.current) {
            return;
        }

        isProcessingAssetRef.current = true;

        try {
            // Call the actual SDK method to let it populate address from pubkeys
            if (pioneer?.state?.app && typeof pioneer.state.app.setAssetContext === 'function') {
                await pioneer.state.app.setAssetContext(assetData);
                const sdkResult = pioneer.state.app.assetContext;

                // Always update React state with SDK's enriched result
                setAssetContext(sdkResult);
                setIsAssetViewActive(true);
            } else {
                // Fallback if SDK not available
                setAssetContext(assetData);
                setIsAssetViewActive(true);
            }
        } finally {
            // Reset processing flag
            isProcessingAssetRef.current = false;
        }
    }, [pioneer]);

    const setOutboundAssetContextMemoized = useCallback(async (assetData: AssetContextState) => {
        // Prevent infinite loops via re-entry detection
        if (isProcessingOutboundRef.current) {
            return;
        }

        isProcessingOutboundRef.current = true;

        try {
            // Call the actual SDK method to let it populate address from pubkeys
            if (pioneer?.state?.app && typeof pioneer.state.app.setOutboundAssetContext === 'function') {
                await pioneer.state.app.setOutboundAssetContext(assetData);
                const sdkResult = pioneer.state.app.outboundAssetContext;

                // Always update React state with SDK's enriched result
                setOutboundAssetContext(sdkResult);
            } else {
                // Fallback if SDK not available
                setOutboundAssetContext(assetData);
            }
        } finally {
            // Reset processing flag
            isProcessingOutboundRef.current = false;
        }
    }, [pioneer]);

    // Payment notification system - track balance snapshots for event detection
    // Using useRef to avoid re-renders and prevent infinite loop
    const balancesSnapshotRef = useRef<Map<string, any>>(new Map());

    // Listen for DASHBOARD_UPDATE events and detect payment events
    useEffect(() => {
        if (!pioneer?.state?.app?.events) {
            //console.log('[PioneerProvider] No events object available yet');
            return;
        }

        const handleDashboardUpdate = (data: any) => {
            //console.log('[PioneerProvider] DASHBOARD_UPDATE event received');

            // Get current balances from Pioneer SDK
            const newBalances = pioneer.state.app.balances || [];

            // DISABLED: Dashboard-based notifications (balance change detection)
            // Reason: Triggers on refresh/price updates, shows stale data, unprofessional UX
            // Only showing txid-based notifications until this system is proven reliable
            // TODO: Re-enable after implementing proper debouncing and state validation
            // paymentEventManager.processBalanceUpdate(balancesSnapshotRef.current, newBalances);

            // Update snapshot for next comparison (doesn't trigger re-render)
            balancesSnapshotRef.current = createBalancesMap(newBalances);
        };

        // Subscribe to DASHBOARD_UPDATE events
        pioneer.state.app.events.on('DASHBOARD_UPDATE', handleDashboardUpdate);
        //console.log('[PioneerProvider] Subscribed to DASHBOARD_UPDATE events');

        // Initialize snapshot with current balances
        const currentBalances = pioneer.state.app.balances || [];
        balancesSnapshotRef.current = createBalancesMap(currentBalances);

        // Cleanup subscription on unmount
        return () => {
            pioneer.state.app.events.off('DASHBOARD_UPDATE', handleDashboardUpdate);
            //console.log('[PioneerProvider] Unsubscribed from DASHBOARD_UPDATE events');
        };
    }, [pioneer?.state?.app?.events]);

    // Listen for pioneer:tx events (actual blockchain transactions)
    // NOTE: This is the ONLY notification system currently enabled
    // Only shows toasts for confirmed transactions with txids (reliable, proven)
    // Dashboard-based balance change notifications are DISABLED (see above)
    useEffect(() => {
        if (!pioneer?.state?.app?.events) {
            return;
        }

        const handleTransactionEvent = (txData: any) => {

            // Process actual transaction events with txids (ONLY active notification system)
            transactionEventManager.processTransactionEvent(txData);
        };

        pioneer.state.app.events.on('pioneer:tx', handleTransactionEvent);

        return () => {
            pioneer.state.app.events.off('pioneer:tx', handleTransactionEvent);
        };
    }, [pioneer?.state?.app?.events]);

    // Memoize clearAssetContext to prevent recreating on every render
    const clearAssetContextMemoized = useCallback(() => {
        setAssetContext(null);
        setOutboundAssetContext(null);
        setIsAssetViewActive(false);
    }, []);

    // Memoize triggerBalanceRefresh to prevent recreating on every render
    const triggerBalanceRefreshMemoized = useCallback(() => {
        setBalanceRefreshCounter(prev => prev + 1);
    }, []);

    // Create wrapper for pioneer with added asset context
    // Memoize to prevent unnecessary re-renders
    const pioneerWithAssetContext = useMemo(() => {
        const result = {
            ...pioneer,
            state: {
                ...pioneer?.state,
                app: {
                    ...pioneer?.state?.app,
                    // ✅ CRITICAL FIX: Explicitly copy dashboard, balances, pubkeys, transactions
                    // These are non-enumerable properties (getters) on the SDK object, so spread doesn't copy them
                    dashboard: pioneer?.state?.app?.dashboard,
                    balances: pioneer?.state?.app?.balances,
                    pubkeys: pioneer?.state?.app?.pubkeys,
                    transactions: pioneer?.state?.app?.transactions, // 🔍 Added for transaction history
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
        };

        return result;
    }, [pioneer, assetContext, outboundAssetContext, balanceRefreshCounter, setAssetContextMemoized, setOutboundAssetContextMemoized, clearAssetContextMemoized, triggerBalanceRefreshMemoized, isAssetViewActive, setIsAssetViewActive]);

    return (
        <PioneerContext.Provider value={pioneerWithAssetContext}>
            {children}
        </PioneerContext.Provider>
    )
}
