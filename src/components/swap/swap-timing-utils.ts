/**
 * Swap Timing Utilities
 *
 * Formatting and calculation utilities for swap progress timing display
 */

/**
 * Format seconds to human-readable time string
 * @param seconds - Time in seconds
 * @returns Formatted string like "3m 42s" or "45s"
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Calculate percentage progress from elapsed/expected seconds
 * @param elapsed - Elapsed seconds
 * @param expected - Expected total seconds
 * @returns Percentage (0-100), clamped and rounded
 */
export function calculatePercentage(
  elapsed: number | undefined,
  expected: number | undefined
): number {
  if (!expected || expected <= 0) return 0;

  const percentage = ((elapsed || 0) / expected) * 100;
  return Math.min(100, Math.max(0, Math.round(percentage)));
}

/**
 * Get performance label based on actual vs expected ratio
 * @param ratio - Ratio string from timingData (e.g., "1.2")
 * @returns Human-readable performance label
 */
export function getPerformanceLabel(ratio: string | undefined): string {
  if (!ratio) return 'Unknown';

  const ratioNum = parseFloat(ratio);

  if (ratioNum < 0.8) return 'Ahead of schedule';
  if (ratioNum < 1.2) return 'On track';
  if (ratioNum < 1.5) return 'Slightly delayed';
  return 'Behind schedule';
}

/**
 * Get icon for swap stage
 * @param stage - Stage number (1-3)
 * @returns Emoji icon for stage
 */
export function getStageIcon(stage: number): string {
  const icons = ['↗', '⚡', '↙'];
  return icons[stage - 1] || '●';
}

/**
 * Get title for swap stage
 * @param stage - Stage number (1-3)
 * @returns Human-readable stage title
 */
export function getStageTitle(stage: number): string {
  const titles = [
    'Input Transaction',
    'Protocol Processing',
    'Output Transaction'
  ];
  return titles[stage - 1] || 'Unknown Stage';
}

/**
 * Get description for swap stage
 * @param stage - Stage number (1-3)
 * @returns Description of what happens in this stage
 */
export function getStageDescription(stage: number): string {
  const descriptions = [
    'Confirming your transaction',
    'Processing swap via THORChain',
    'Receiving your assets'
  ];
  return descriptions[stage - 1] || 'Processing...';
}
