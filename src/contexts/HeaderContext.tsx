'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface HeaderActions {
  onSettingsClick?: () => void
  onRefreshClick?: () => void
  isRefreshing?: boolean
}

interface HeaderContextType {
  actions: HeaderActions
  setActions: (actions: HeaderActions) => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<HeaderActions>({})

  return (
    <HeaderContext.Provider value={{ actions, setActions }}>
      {children}
    </HeaderContext.Provider>
  )
}

export function useHeader() {
  const context = useContext(HeaderContext)
  if (!context) {
    throw new Error('useHeader must be used within HeaderProvider')
  }
  return context
}
