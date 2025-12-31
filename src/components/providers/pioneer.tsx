'use client'

import * as React from 'react'
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
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
  setAssetContext: (assetData: AssetContextState, chatId?: string) => void;
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
    const [isAssetViewActive, setIsAssetViewActive] = useState<boolean>(false);
    // Add refresh counter to force re-renders when balances update
    const [balanceRefreshCounter, setBalanceRefreshCounter] = useState<number>(0);

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

    // Create wrapper for pioneer with added asset context
    const pioneerWithAssetContext = {
        ...pioneer,
        state: {
            ...pioneer?.state,
            app: {
                ...pioneer?.state?.app,
                assetContext,
            },
            balanceRefreshCounter, // Include counter in state
        },
        // Add methods for asset management
        setAssetContext: (assetData: AssetContextState) => {
            console.log('🔄 Setting asset context:', assetData);
            setAssetContext(assetData);
            setIsAssetViewActive(true);
        },
        clearAssetContext: () => {
            console.log('🔄 Clearing asset context');
            setAssetContext(null);
            setIsAssetViewActive(false);
        },
        // Add method to trigger balance refresh (forces re-render)
        triggerBalanceRefresh: () => {
            console.log('🔄 Triggering balance refresh counter');
            setBalanceRefreshCounter(prev => prev + 1);
        },
        isAssetViewActive,
        setIsAssetViewActive
    };

    return (
        <PioneerContext.Provider value={pioneerWithAssetContext}>
            {children}
        </PioneerContext.Provider>
    )
}
