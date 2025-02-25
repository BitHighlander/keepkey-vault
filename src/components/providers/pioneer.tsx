'use client'

import * as React from 'react'
import { createContext, useContext } from 'react'

type ColorMode = 'light' | 'dark'

// Create Pioneer Context
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

    return (
        <PioneerContext.Provider value={pioneer}>
            {children}
        </PioneerContext.Provider>
    )
}
