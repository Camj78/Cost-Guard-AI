/**
 * Formatting helpers for numbers and currency.
 */

/**
 * Format a cost value in USD.
 * - 0: shows "$0.0000"
 * - < $0.01: shows 6 decimal places (e.g., "$0.002500")
 * - < $1: shows 4 decimal places (e.g., "$0.0025")
 * - >= $1: shows 2 decimal places (e.g., "$1.50")
 */
export function formatCost(amount: number): string {
  if (amount === 0) return "$0.0000";
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Format a number with locale-aware separators (e.g., 128,000).
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format a percentage (e.g., 85.3%).
 */
export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}
