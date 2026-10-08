import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefCondition, buildThiefStrikes } from '#gw2/professions/thief/core/events.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { forgedSurferProfile } from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const FORGED_SURFER = 'thief.forged-surfer';

// One owner for every Forged Surfer occurrence: a new dash cancels the whole prior sequence.
const FORGED_SURFER_OWNER = Object.freeze({ id: FORGED_SURFER, generation: 0 });

/** The first Forged Surfer occurrence is the dash; later occurrences drop bombs until the assumed hit count. */
export function forgedSurfer(runtime: ThiefRuntime, data: unknown): void {
  const { skillId, occurrence, count } = data as { skillId: SkillId; occurrence: number; count: number };
  const profile = forgedSurferProfile(runtime);
  // Dash and bomb identities survive deletion of either strike or condition.
  const packet = occurrence === 0 ? 'Dash' : 'Bomb';
  const strike = requireEffect(profile, 'strike', packet);
  const burning = requireEffect(profile, 'condition', packet);
  const name = occurrence === 0 ? 'Forged Surfer Dash' : 'Forged Surfer Dash — Bomb';
  if (strike)
    buildThiefStrikes(null, {
      at: runtime.time,
      sourceId: skillId,
      skillId,
      skillName: 'Forged Surfer Dash',
      name,
      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits: effectNumber(profile, strike, 'hits')
    }).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  if (burning)
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefCondition(null, {
        at: runtime.time,
        skillId,
        skillName: 'Forged Surfer Dash',
        name: `${name} — Burning`,
        condition: String(burning.condition),
        stacks: effectNumber(profile, burning, 'stacks'),
        duration: effectNumber(profile, burning, 'duration')
      })
    });
  if (occurrence + 1 < count)
    runtime.schedule(
      FORGED_SURFER,
      runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer), 'pulseInterval'),
      { skillId, occurrence: occurrence + 1, count },
      FORGED_SURFER_OWNER
    );
}

/** A new dash replaces any running sequence and starts after the authored delay. */
export function startForgedSurfer(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer);
  runtime.cancelOwner(FORGED_SURFER_OWNER);
  runtime.schedule(
    FORGED_SURFER,
    runtime.time + balanceProfileNumber(profile, 'initialDelay'),
    {
      skillId: skill.id,
      occurrence: 0,
      count:
        1 +
        Math.ceil(
          Math.min(
            balanceProfileNumber(profile, 'maximumStacks'),
            antiquaryState.from(runtime).forgedSurferMaximumBombHits
          )
        )
    },
    FORGED_SURFER_OWNER
  );
}
