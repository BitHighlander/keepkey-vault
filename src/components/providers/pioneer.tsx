'use client'

import * as React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'

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
    
    // Create wrapper for pioneer with added asset context
    const pioneerWithAssetContext = {
        ...pioneer,
        state: {
            ...pioneer?.state,
            app: {
                ...pioneer?.state?.app,
                assetContext,
            }
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
        isAssetViewActive,
        setIsAssetViewActive
    };

    return (
        <PioneerContext.Provider value={pioneerWithAssetContext}>
            {children}
        </PioneerContext.Provider>
    )
}
