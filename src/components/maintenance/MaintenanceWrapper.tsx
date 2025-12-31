'use client'

import { isMaintenanceMode } from '@/config/maintenance'
import { MaintenancePage } from './MaintenancePage'

/**
 * MaintenanceWrapper - Checks maintenance mode before loading the app
 *
 * This wrapper renders BEFORE any heavy providers (Pioneer SDK, etc.)
 * ensuring the maintenance page loads instantly without initialization delays
 */
export function MaintenanceWrapper({ children }: { children: React.ReactNode }) {
  // Check maintenance mode first, before any provider initialization
  if (isMaintenanceMode()) {
    return <MaintenancePage />
  }

  // Only load the full app if not in maintenance mode
  return <>{children}</>
}
