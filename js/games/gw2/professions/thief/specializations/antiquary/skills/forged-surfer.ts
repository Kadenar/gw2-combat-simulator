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
import { canonicalTime } from '#kernel/core/clock.js';

export const FORGED_SURFER = 'thief.forged-surfer';

// One owner for every Forged Surfer occurrence: a new dash cancels the whole prior sequence.
const FORGED_SURFER_OWNER = Object.freeze({ id: FORGED_SURFER, generation: 0 });

/** The dash starts a resettable bomb cadence; the live buff deadline determines its additional explosions. */
export function forgedSurfer(runtime: ThiefRuntime, data: unknown): void {
  const { skillId, occurrence } = data as { skillId: SkillId; occurrence: number };
  if (occurrence > 0 && runtime.time > antiquaryState.from(runtime).forgedSurferBombDropUntil) return;
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
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer),
    'pulseInterval'
  );
  const nextAt = canonicalTime(runtime.time + interval);
  // A duration-driven sequence must advance its clock even when authoring a patched profile.
  if (nextAt <= runtime.time) throw new RangeError('Forged Surfer bomb interval must advance time.');
  if (nextAt <= canonicalTime(antiquaryState.from(runtime).forgedSurferBombDropUntil))
    runtime.schedule(FORGED_SURFER, nextAt, { skillId, occurrence: occurrence + 1 }, FORGED_SURFER_OWNER);
}

/** Recasting resets pending bomb timing while the separately refreshed buff retains its capped duration. */
export function startForgedSurfer(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer);
  runtime.cancelOwner(FORGED_SURFER_OWNER);
  runtime.schedule(
    FORGED_SURFER,
    runtime.time + balanceProfileNumber(profile, 'initialDelay'),
    {
      skillId: skill.id,
      occurrence: 0
    },
    FORGED_SURFER_OWNER
  );
}
