/**
 * Spin & Win reward selection domain module for ByteBites.
 *
 * Pure, framework-agnostic reward drawing. `spin` selects exactly one reward
 * from the allowed set (SPIN_REWARDS) using an injected random number
 * generator. Injecting the rng keeps the function deterministic and testable.
 *
 * The rng returns a float in the half-open interval [0, 1). The interval is
 * partitioned into equal-width buckets, one per reward, so every reward is
 * drawable and the result is always a member of the allowed set.
 *
 * Validates: Requirements 13.2
 */

import type { SpinReward } from "../types/index.js";
import { SPIN_REWARDS } from "../types/index.js";

/**
 * Draw a single spin reward from the allowed set using the injected rng.
 *
 * @param rng a function returning a float in [0, 1)
 * @returns one of the rewards in SPIN_REWARDS
 */
export function spin(rng: () => number): SpinReward {
  const raw = rng();
  // Defensive clamp so an out-of-range rng value still maps to a valid index.
  const r = Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0;
  const index = Math.floor(r * SPIN_REWARDS.length);
  const safeIndex = Math.min(SPIN_REWARDS.length - 1, Math.max(0, index));
  return SPIN_REWARDS[safeIndex];
}
