/**
 * Maintenance Mode Configuration for Next.js
 *
 * To enable maintenance mode, set NEXT_PUBLIC_MAINTENANCE_MODE=true in your .env file
 * or set maintenanceMode to true below for a hardcoded setting.
 */

// Hardcoded maintenance mode (set to true to enable)
const HARDCODED_MAINTENANCE_MODE = false

// Check environment variable (takes precedence over hardcoded value)
const envMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

export const maintenanceConfig = {
  // Maintenance mode is enabled if either env var is true or hardcoded is true
  enabled: envMaintenanceMode || HARDCODED_MAINTENANCE_MODE,

  // Message to display (can be customized)
  message: process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ||
    "KeepKey Vault is currently undergoing maintenance",

  // Estimated downtime
  estimatedDowntime: process.env.NEXT_PUBLIC_MAINTENANCE_ETA || "TBD",
}

/**
 * Quick enable/disable maintenance mode
 *
 * Usage:
 * 1. Set HARDCODED_MAINTENANCE_MODE = true (above)
 * 2. Or create .env.local file with: NEXT_PUBLIC_MAINTENANCE_MODE=true
 * 3. Restart the dev server or rebuild the app
 */
export const isMaintenanceMode = (): boolean => {
  return maintenanceConfig.enabled
}
