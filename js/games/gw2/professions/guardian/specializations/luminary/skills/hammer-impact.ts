import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { Runtime } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Justice is sampled at hammer impact, allowing a concurrent virtue to empower an already accepted cast. */
export function hammerImpact(runtime: Runtime, data: unknown): void {
  const state = luminaryState.from(runtime);
  if (!state.radiantJusticeArmed) return;
  state.radiantJusticeArmed = false;
  const { cast } = data as { cast: RuntimeCast<GuardianSkill> };
  const cause = guardianCastCause(runtime, cast);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.radiantJusticeImpact);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  if (strike)
    runtime.effects.emit({
      kind: 'packet',
      cause: cause,
      event: buildGuardianStrike({
        at: canonicalTime(runtime.time + effectNumber(profile, strike, 'atMs') / 1000),
        sourceId: cast.skill.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        name: 'Dazzling Hammer — Radiant Justice Impact',
        // The empowered impact retains its accepted Forge strength across bar changes.
        weaponStrengthProfileId: 'transform.radiant-forge',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        offTarget: cast.command.offTarget === true
      })
    });
  if (condition)
    runtime.effects.emit({
      kind: 'packet',
      cause: cause,
      event: buildResolverCondition({
        at: canonicalTime(runtime.time + effectNumber(profile, condition, 'atMs') / 1000),
        source: 'guardian',
        sourceId: cast.skill.id,
        actorType: 'effect',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        condition: 'Vulnerability',
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration'),
        offTarget: cast.command.offTarget === true
      })
    });
}
