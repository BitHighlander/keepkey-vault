/**
 * Centralized logging configuration for Vault
 *
 * Environment-based logging control:
 * - Production: Only errors and critical warnings
 * - Development: Configurable via DEBUG_MODE flag
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Component mounted', { caip });
 *   logger.info('Balance updated', { balance });
 *   logger.warn('Missing data', { field });
 *   logger.error('Operation failed', error);
 */

// Global debug mode - set to false to reduce console noise in development
const DEBUG_MODE = typeof window !== 'undefined'
  ? (window.localStorage?.getItem('VAULT_DEBUG') === 'true')
  : false;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Feature-specific debug flags (can be enabled individually)
const DEBUG_FLAGS = {
  ASSET: false,         // Asset component verbose logs
  PIONEER: false,       // Pioneer SDK logs
  CUSTOM_TOKENS: false, // Custom token operations
  BALANCES: false,      // Balance calculations
  TRANSACTIONS: false,  // Transaction operations
  NETWORK: false,       // Network requests
  STORAGE: false,       // Local storage operations
  STAKING: false,       // Staking operations
  SWAP: false,          // Swap operations
};

// Allow runtime override via localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  Object.keys(DEBUG_FLAGS).forEach(key => {
    const value = window.localStorage.getItem(`VAULT_DEBUG_${key}`);
    if (value !== null) {
      DEBUG_FLAGS[key as keyof typeof DEBUG_FLAGS] = value === 'true';
    }
  });
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type DebugCategory = keyof typeof DEBUG_FLAGS;

class Logger {
  private shouldLog(level: LogLevel, category?: DebugCategory): boolean {
    // Always log errors
    if (level === 'error') return true;

    // In production, only log warnings and errors
    if (IS_PRODUCTION) {
      return level === 'warn';
    }

    // In development, respect DEBUG_MODE
    if (!DEBUG_MODE) {
      return level === 'warn' || level === 'error';
    }

    // If a category is specified, check if that category is enabled
    if (category) {
      return DEBUG_FLAGS[category];
    }

    // If DEBUG_MODE is on and no category specified, allow all logs
    return true;
  }

  debug(message: string, data?: any, category?: DebugCategory): void {
    if (this.shouldLog('debug', category)) {
      console.log(message, data || '');
    }
  }

  info(message: string, data?: any, category?: DebugCategory): void {
    if (this.shouldLog('info', category)) {
      console.log(message, data || '');
    }
  }

  warn(message: string, data?: any, category?: DebugCategory): void {
    if (this.shouldLog('warn', category)) {
      console.warn(message, data || '');
    }
  }

  error(message: string, error?: any, category?: DebugCategory): void {
    if (this.shouldLog('error', category)) {
      console.error(message, error || '');
    }
  }

  // Helper to enable debug mode at runtime
  enableDebug(category?: DebugCategory): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (category) {
        window.localStorage.setItem(`VAULT_DEBUG_${category}`, 'true');
        DEBUG_FLAGS[category] = true;
        console.log(`✅ Enabled debug logging for: ${category}`);
      } else {
        window.localStorage.setItem('VAULT_DEBUG', 'true');
        console.log('✅ Enabled global debug logging');
      }
      console.log('🔄 Refresh the page to apply changes');
    }
  }

  // Helper to disable debug mode at runtime
  disableDebug(category?: DebugCategory): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (category) {
        window.localStorage.removeItem(`VAULT_DEBUG_${category}`);
        DEBUG_FLAGS[category] = false;
        console.log(`❌ Disabled debug logging for: ${category}`);
      } else {
        window.localStorage.removeItem('VAULT_DEBUG');
        console.log('❌ Disabled global debug logging');
      }
      console.log('🔄 Refresh the page to apply changes');
    }
  }

  // Show current debug status
  status(): void {
    console.log('🔍 Vault Debug Status:');
    console.log('  Global DEBUG_MODE:', DEBUG_MODE);
    console.log('  Production:', IS_PRODUCTION);
    console.log('  Category Flags:', DEBUG_FLAGS);
    console.log('\n💡 To enable debug logging:');
    console.log('  logger.enableDebug() - Enable all');
    console.log('  logger.enableDebug("ASSET") - Enable specific category');
    console.log('\n💡 To disable debug logging:');
    console.log('  logger.disableDebug() - Disable all');
    console.log('  logger.disableDebug("ASSET") - Disable specific category');
  }
}

export const logger = new Logger();

// Make logger available in browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).vaultLogger = logger;
  console.log('💡 Vault logger available via: vaultLogger.status()');
}
