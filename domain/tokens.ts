/**
 * Order token domain module for ByteBites.
 *
 * Pure, framework-agnostic token issuance. When a payment succeeds, the
 * Ordering_System issues a unique Order_Token that the Customer uses to track
 * and collect their order.
 *
 * Tokens are short, human-friendly, and sequential — a single letter prefix
 * plus a zero-padded 4-digit counter, e.g. `A-0001`, `A-0002`, … `A-9999`,
 * then rolling over to `B-0001`. The next token is derived from the tokens
 * already issued (the `existingTokens` set), so callers don't need to track a
 * separate counter, and the result is always unique against that set.
 *
 * Validates: Requirements 5.2
 */

/** Matches a well-formed sequential token like `A-0001` (capture: letter, number). */
const TOKEN_PATTERN = /^([A-Z])-(\d{4,})$/;

const FIRST_LETTER = "A".charCodeAt(0);
const LAST_LETTER = "Z".charCodeAt(0);
const SEQUENCE_MAX = 9999;

interface TokenParts {
  letter: number; // char code of the prefix letter
  seq: number; // numeric counter
}

/** Parse a token into its letter/sequence parts, or null when it doesn't match. */
function parseToken(token: string): TokenParts | null {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;
  return { letter: match[1].charCodeAt(0), seq: Number(match[2]) };
}

/** Format letter/sequence parts back into a token like `A-0001`. */
function formatToken(parts: TokenParts): string {
  const letter = String.fromCharCode(parts.letter);
  return `${letter}-${String(parts.seq).padStart(4, "0")}`;
}

/** Order tokens for sorting: earlier letter first, then lower sequence. */
function compareParts(a: TokenParts, b: TokenParts): number {
  return a.letter === b.letter ? a.seq - b.seq : a.letter - b.letter;
}

/** The parts immediately following `parts` in the sequence (A-9999 -> B-0001). */
function nextParts(parts: TokenParts): TokenParts {
  if (parts.seq < SEQUENCE_MAX) {
    return { letter: parts.letter, seq: parts.seq + 1 };
  }
  // Roll over to the next letter, restarting the counter at 1.
  return { letter: parts.letter + 1, seq: 1 };
}

/**
 * Issue a new short, sequential Order_Token (e.g. `A-0001`) that is non-empty
 * and guaranteed not to already be present in `existingTokens`.
 *
 * The next token continues from the highest sequential token already issued;
 * if none exist yet, issuance starts at `A-0001`. Any non-sequential tokens in
 * the set are ignored for numbering but still respected for uniqueness — the
 * counter advances past any collision (Req 5.2).
 */
export function issueToken(existingTokens: Set<string>): string {
  // Find the highest sequential token already issued to continue from it.
  let highest: TokenParts | null = null;
  for (const token of existingTokens) {
    const parts = parseToken(token);
    if (parts && (highest === null || compareParts(parts, highest) > 0)) {
      highest = parts;
    }
  }

  let candidate: TokenParts = highest ? nextParts(highest) : { letter: FIRST_LETTER, seq: 1 };

  // Advance past any collision (e.g. a manually-seeded token) so the issued
  // value is always unique against the existing set.
  while (candidate.letter <= LAST_LETTER && existingTokens.has(formatToken(candidate))) {
    candidate = nextParts(candidate);
  }

  return formatToken(candidate);
}
