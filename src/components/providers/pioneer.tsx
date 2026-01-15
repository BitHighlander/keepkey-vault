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

    // Balance snapshot tracking for amount-only comparison (prevents price update re-renders)
    // Using useRef to avoid re-renders and prevent infinite loop
    const balanceSnapshotRef = useRef<Map<string, { caip: string; balance: string }>>(new Map());

    // Helper function to detect REAL balance changes (amount-only, ignores price updates)
    const hasRealBalanceChange = useCallback((caip: string, newBalance: string): boolean => {
        const previous = balanceSnapshotRef.current.get(caip);
        if (!previous) return true; // New asset

        // Compare as numbers with 8-decimal precision (1 satoshi threshold)
        const oldAmount = parseFloat(previous.balance);
        const newAmount = parseFloat(newBalance);
        const threshold = 0.00000001;

        return Math.abs(newAmount - oldAmount) >= threshold;
    }, []);

    // Memoize triggerBalanceRefresh to prevent recreating on every render
    // MUST be defined before useEffect that uses it (hoisting requirement)
    const triggerBalanceRefreshMemoized = useCallback(() => {
        setBalanceRefreshCounter(prev => prev + 1);
    }, []);

    // Listen for granular balance update events (real-time balance changes)
    useEffect(() => {
        if (!pioneer?.state?.app?.events) {
            return;
        }

        // Individual balance change (single asset)
        const handleBalanceUpdate = (data: { caip: string; balance: any; previousValueUsd?: number; newValueUsd?: number }) => {
            // Filter: Only react to REAL balance amount changes
            if (!hasRealBalanceChange(data.caip, data.balance.balance)) {
                console.debug('[AppProvider] Filtered: Price update only');
                return;
            }

            // Filter: Ignore optimistic updates (SDK will send real data)
            if (data.balance.optimistic) {
                console.debug('[AppProvider] Filtered: Optimistic update');
                return;
            }

            console.log('[AppProvider] Real balance change:', data.caip, data.balance.balance);

            // Update snapshot
            balanceSnapshotRef.current.set(data.caip, {
                caip: data.caip,
                balance: data.balance.balance
            });

            // Trigger React re-render
            triggerBalanceRefreshMemoized();
        };

        // Batch balance changes (multiple assets, swap completion)
        const handleBalancesUpdated = (balances: any[]) => {
            console.log('[AppProvider] Batch balance update:', balances.length, 'assets');

            // Rebuild snapshot map
            balances.forEach(b => {
                if (b.caip && b.balance) {
                    balanceSnapshotRef.current.set(b.caip, {
                        caip: b.caip,
                        balance: b.balance
                    });
                }
            });

            triggerBalanceRefreshMemoized();
        };

        // Pending balance created (swap initiated)
        const handlePendingCreated = (balance: any) => {
            console.log('[AppProvider] Pending balance created:', balance.symbol, balance.pending?.swapTxHash);
            triggerBalanceRefreshMemoized();
        };

        // Pending balance removed (swap completed/failed)
        const handlePendingRemoved = (data: { swapTxHash: string; balance: any }) => {
            console.log('[AppProvider] Pending balance removed:', data.swapTxHash);
            triggerBalanceRefreshMemoized();
        };

        // Register subscriptions
        pioneer.state.app.events.on('BALANCE_UPDATE', handleBalanceUpdate);
        pioneer.state.app.events.on('BALANCES_UPDATED', handleBalancesUpdated);
        pioneer.state.app.events.on('PENDING_BALANCE_CREATED', handlePendingCreated);
        pioneer.state.app.events.on('PENDING_BALANCE_REMOVED', handlePendingRemoved);

        console.log('[AppProvider] Subscribed to balance update events');

        // Initialize snapshot with current balances
        const currentBalances = pioneer.state.app.balances || [];
        currentBalances.forEach((b: any) => {
            if (b.caip && b.balance) {
                balanceSnapshotRef.current.set(b.caip, {
                    caip: b.caip,
                    balance: b.balance
                });
            }
        });

        // Cleanup subscription on unmount
        return () => {
            pioneer.state.app.events.off('BALANCE_UPDATE', handleBalanceUpdate);
            pioneer.state.app.events.off('BALANCES_UPDATED', handleBalancesUpdated);
            pioneer.state.app.events.off('PENDING_BALANCE_CREATED', handlePendingCreated);
            pioneer.state.app.events.off('PENDING_BALANCE_REMOVED', handlePendingRemoved);
            console.log('[AppProvider] Unsubscribed from balance update events');
        };
    }, [pioneer?.state?.app?.events, hasRealBalanceChange, triggerBalanceRefreshMemoized]);

    // Listen for pioneer:tx events (actual blockchain transactions)
    // NOTE: This is the ONLY notification system currently enabled
    // Only shows toasts for confirmed transactions with txids (reliable, proven)
    // Dashboard-based balance change notifications are DISABLED (see above)
    useEffect(() => {
        if (!pioneer?.state?.app?.events) {
            return;
        }

        const handleTransactionEvent = (txData: any) => {
            console.log('🔔 [PIONEER-PROVIDER] Received pioneer:tx event, forwarding to TransactionEventManager:', {
                type: txData.type,
                networkId: txData.networkId,
                txid: txData.txid?.substring(0, 16) + '...',
                address: txData.address?.substring(0, 10) + '...',
            });

            // Process actual transaction events with txids (ONLY active notification system)
            transactionEventManager.processTransactionEvent(txData);

            console.log('✅ [PIONEER-PROVIDER] TransactionEventManager.processTransactionEvent() completed');
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
