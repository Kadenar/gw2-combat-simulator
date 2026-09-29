import { denySkillCast as deny } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { emitRangerDamage, rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import {
  applyShrike,
  perilousSkiesAvailability
} from '#gw2/professions/ranger/specializations/galeshot/traits/behavior.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Accepted player projectile impacts independently trigger Mistral and advance Shrike. */
export function reactToGaleshotMissile(context: RangerRuntime, event: Gw2ResolverEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    event.projectile !== true
  )
    return;
  applyMistral(context, event);
  applyShrike(context, event);
}

/** Path of Scars keeps the outgoing contact's enhancement on its return, without extending other projectiles' window. */
function applyMistral(context: RangerRuntime, event: Gw2ResolverEvent): void {
  const at = event.at;
  const state = galeshotState.from(context);
  // An armed Mistral includes missiles landing at expiry; zero never arms it.
  let enhanced = state.mistralUntil > 0 && at <= state.mistralUntil;
  if ((event.skillId === ID.PATH_OF_SCARS || event.skillId === ID.PATH_OF_SCARS_MAX_RANGE) && event.activationId) {
    if (event.hitIndex === 1 && enhanced) state.mistralPathOfScars[event.activationId] = true;
    if (event.hitIndex === event.totalHits) {
      enhanced ||= state.mistralPathOfScars[event.activationId];
      delete state.mistralPathOfScars[event.activationId];
    }
  }

  if (!enhanced) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.mistral);
  const strike = requireEffect(profile, 'strike', 'Strike');
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  // Each missile-triggered Mistral is its own effect activation while its
  // strike and condition packets remain grouped under one identity.
  const activationId = strike || chilled ? 'mistral:' + event.eventOrder : undefined;
  if (strike)
    emitRangerDamage(
      context,
      rangerEvent(
        {
          at: at,
          source: 'ranger',
          sourceId: ID.MISTRAL,
          actorType: 'player',
          skillId: ID.MISTRAL,
          skillName: 'Mistral',
          name: 'Mistral',
          coefficient: effectNumber(profile, strike, 'coefficient'),
          hits: effectNumber(profile, strike, 'hits'),
          canCrit: true,
          damageKind: 'galeshot-mistral',
          triggeredBy: event.skillName,
          activationId
        },
        'damage'
      )
    );
  if (chilled)
    context.emit(
      rangerEvent(
        {
          at: at,
          skillId: ID.MISTRAL,
          skillName: 'Mistral',
          name: 'Mistral - Chilled',
          condition: String(chilled.condition),
          duration: effectNumber(profile, chilled, 'duration'),
          stacks: effectNumber(profile, chilled, 'stacks'),
          triggeredBy: event.skillName,
          activationId
        },
        'condition'
      )
    );
}
// Gate Galeshot casts by Cyclone Bow ownership, arrows, Wind Force, and the
// Perilous Skies replacement before the shared Ranger checks run.

export function galeshotCastAvailability(context: RangerRuntime, skill: RangerSkill): AvailabilityResult {
  const state = galeshotState.from(context);
  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'summon the Cyclone Bow first.');
  }

  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-active', 'the Cyclone Bow is already active.');
  }

  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'the Cyclone Bow is not active.');
  }

  if ((skill.arrowCost || 0) > state.arrows.value) {
    return deny(skill, 'ranger.arrows', `requires ${skill.arrowCost} arrows.`);
  }

  const maximumWindForce = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.resources),
    'minimumStacks'
  );
  if (skill.id === ID.HAWKEYE && state.windForce < maximumWindForce) {
    return deny(skill, 'ranger.wind-force', `requires ${maximumWindForce} Wind Force.`);
  }

  if (skill.id === ID.KEEN_SHOT && state.windForce >= maximumWindForce) {
    return deny(skill, 'ranger.hawkeye-ready', `Hawkeye replaces Keen Shot at ${maximumWindForce} Wind Force.`);
  }

  const replacement = perilousSkiesAvailability(context, skill);
  if (replacement) return replacement;

  if (state.cycloneBowActive && skill.type === 'Weapon' && !skill.cycloneBowSkill) {
    return deny(skill, 'ranger.cyclone-bow-weapon-bar', 'the Cyclone Bow replaces weapon skills.');
  }

  return { ready: true };
}
