import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { emitSoulbeastStance } from '#gw2/professions/ranger/specializations/soulbeast/traits/behavior.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/**
 * Owns Soulbeast stance skill fragments and their handler selection.
 * Stance runtime windows remain under `hooks.ts` and specialization mechanics.
 */

export const SOULBEAST_STANCE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VULTURE_STANCE]: {
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.vulture-stance' } }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.BEAR_STANCE]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.ONE_WOLF_PACK]: {
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [{ on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.one-wolf-pack' } }],
    // The stance commits before recovery ends, so cancelling after activation retains its proc window.
    interruptCommitMs: 280,
    effects: [],
    castTimeMs: 360
  }
});

/** The stance owns its activation; Leader of the Pack still owns duration and ally sharing. */
export function activateSoulbeastStance(runtime: RangerRuntime, skill: Skill, kind: string, profileId: string): number {
  return emitSoulbeastStance(
    runtime,
    skill,
    kind,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, profileId), 'durationMultiplier')
  );
}
