import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildGuardianStrike, guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';

import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianRuntime } from '#gw2/professions/guardian/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { canonicalTime } from '#kernel/core/clock.js';

const HAMMER = 'guardian.luminary.hammer';

/** Justice is sampled at hammer impact, allowing a concurrent virtue to empower an already accepted cast. */
function hammerImpact(runtime: GuardianRuntime, data: unknown): void {
  const state = luminaryState.from(runtime);

  if (!state.radiantJusticeArmed) return;

  state.radiantJusticeArmed = false;
  const { cast } = data as { cast: RuntimeCast<GuardianSkill> };
  const cause = guardianCastCause(runtime, cast);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.radiantJusticeImpact);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const condition = requireEffect(profile, 'condition', CONDITION.VULNERABILITY);

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
        actorType: ACTOR.EFFECT,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        condition: CONDITION.VULNERABILITY,
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration'),
        offTarget: cast.command.offTarget === true
      })
    });
}

/**
 * Radiant Justice empowers the first committed Dazzling Hammer impact after activation. Sampling at impact rather than
 * at acceptance lets a virtue used mid-cast empower that hammer, and lets a missed hammer still spend the entitlement.
 */
export const luminaryHammerLifecycle = {
  sideEffectHandlers: {
    'guardian.empower-hammer'(runtime, context) {
      if (context.kind === 'cast') runtime.scheduleForCast(HAMMER, luminaryImpactAt(context.cast), context.cast);
    }
  },
  tasks: { [HAMMER]: hammerImpact }
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
