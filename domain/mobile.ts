/**
 * Mobile-number normalization and validation for ByteBites.
 *
 * The mobile number is the canonical customer identity across orders, wallets,
 * and referrals. This pure, framework-agnostic module provides a single place
 * to normalize a raw mobile string into a canonical form and to validate that
 * it is a plausible phone number, so every part of the system maps the same
 * physical number to the same customer.
 *
 * Normalization rules:
 *   - Strip spaces, dashes, parentheses, and dots (common formatting noise).
 *   - Preserve a single leading "+" (international dialling prefix) when present.
 *
 * Validity rules:
 *   - After normalization the digits must number between 10 and 15 (E.164-ish),
 *     with an optional single leading "+".
 */

/**
 * Normalize a raw mobile string into its canonical form: formatting characters
 * (spaces, dashes, parentheses, dots) are removed and a single optional leading
 * "+" is preserved. Non-string input normalizes to the empty string.
 */
export function normalizeMobile(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  // Keep digits only; drop every other character (spaces, dashes, etc.).
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * True when `raw` normalizes to a plausible mobile number: 10–15 digits with an
 * optional single leading "+".
 */
export function isValidMobile(raw: unknown): boolean {
  const normalized = normalizeMobile(raw);
  return /^\+?\d{10,15}$/.test(normalized);
}
