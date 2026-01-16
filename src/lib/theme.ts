/**
 * Shared theme constants for the KeepKey Vault application
 */
export const theme = {
  // Background colors
  bg: '#000000',
  cardBg: '#111111',

  // Accent colors
  gold: '#FFD700',
  goldHover: '#FFE135',

  // Border colors
  border: '#222222',
  borderAlt: '#3A4A5C', // Alternative border color

  // Layout
  formPadding: '16px',
  borderRadius: '12px',
} as const;

export type Theme = typeof theme;
