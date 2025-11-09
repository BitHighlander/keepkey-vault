// Utility functions and constants for swap components

// Color constants
export const COLORS = {
  accent: '#23DCC8',
  accentHover: 'rgba(35, 220, 200, 0.3)',
  accentSelection: 'rgba(56, 178, 172, 0.4)',
  error: 'red.400',
  errorBorder: 'red.500',
  gray: {
    50: 'gray.50',
    300: 'gray.300',
    400: 'gray.400',
    500: 'gray.500',
    600: 'gray.600',
    700: 'gray.700',
  },
  border: 'rgba(255, 255, 255, 0.1)',
  bg: 'rgba(30, 30, 30, 0.6)',
} as const;

// Input validation
export const ALLOWED_KEYS = [8, 9, 27, 13, 46, 110, 190]; // backspace, tab, escape, enter, delete, decimal
export const DECIMAL_REGEX = /^\d*\.?\d*$/;

// Calculate appropriate decimal places based on value
export function getDecimalPlaces(value: number, isUsd = false): number {
  if (isUsd) return 2;
  if (value < 1) return 8;
  if (value < 100) return 4;
  return 2;
}

// Format value with appropriate decimals
export function formatValue(value: string | number, isUsd = false): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';

  const decimals = getDecimalPlaces(num, isUsd);
  return num.toFixed(decimals);
}

// Convert between USD and native amounts
export function convertToNative(usdValue: string, priceUsd: number): string {
  if (!usdValue || !priceUsd) return '';
  return (parseFloat(usdValue) / priceUsd).toFixed(8);
}

export function convertToUsd(nativeValue: string, priceUsd: number): string {
  if (!nativeValue || !priceUsd) return '';
  return (parseFloat(nativeValue) * priceUsd).toFixed(2);
}

// Validate input value
export function isValidNumberInput(value: string): boolean {
  if (value === '') return true;
  return DECIMAL_REGEX.test(value) && value.split('.').length <= 2;
}

// Check if key press should be allowed
export function isAllowedKey(e: React.KeyboardEvent): boolean {
  const keyCode = e.keyCode;

  // Allow special keys
  if (ALLOWED_KEYS.includes(keyCode)) return true;

  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if ((keyCode === 65 || keyCode === 67 || keyCode === 86 || keyCode === 88) && e.ctrlKey) {
    return true;
  }

  // Allow: home, end, left, right
  if (keyCode >= 35 && keyCode <= 39) return true;

  // Check if it's a number key
  const isNumber = (keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105);
  return !e.shiftKey && isNumber;
}

// Calculate increment/decrement step
export function getStep(isUsdMode: boolean): number {
  return isUsdMode ? 1 : 0.0001;
}

// Increment value
export function incrementValue(currentValue: string, isUsdMode: boolean): string {
  const num = parseFloat(currentValue || '0');
  const step = getStep(isUsdMode);
  return (num + step).toFixed(isUsdMode ? 2 : 8);
}

// Decrement value
export function decrementValue(currentValue: string, isUsdMode: boolean): string {
  const num = parseFloat(currentValue || '0');
  if (num <= 0) return currentValue;

  const step = getStep(isUsdMode);
  return Math.max(0, num - step).toFixed(isUsdMode ? 2 : 8);
}
