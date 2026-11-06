// Amounts stay decimal strings end to end; arithmetic uses BigInt so nothing is rounded.

export const CURRENCIES = ['EUR', 'USD', 'JPY'] as const;
export const DECIMALS: Record<string, number> = { EUR: 2, USD: 2, JPY: 0 };

const SCALE = 18;

/** A decimal string as an integer count of 10^-18 units, or null if it isn't one. */
export function toUnits(amount: string): bigint | null {
  const m = /^(-?)(\d{1,15})(?:\.(\d{1,18}))?$/.exec(amount.trim());
  if (!m) return null;
  const units = BigInt(m[2] + (m[3] ?? '').padEnd(SCALE, '0'));
  return m[1] ? -units : units;
}

export function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(SCALE + 1, '0');
  const whole = digits.slice(0, -SCALE);
  const fraction = digits.slice(-SCALE).replace(/0+$/, '');
  return (negative ? '-' : '') + whole + (fraction ? `.${fraction}` : '');
}

/** "-1234.50" → "−1,234.50 EUR". Works on the string; never goes through a float. */
export function formatAmount(amount: string, currency?: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!m) return amount;
  const whole = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${m[1] ? '−' : ''}${whole}${m[3] ? `.${m[3]}` : ''}${currency ? ` ${currency}` : ''}`;
}

export function isNegative(amount: string): boolean {
  return amount.startsWith('-');
}
