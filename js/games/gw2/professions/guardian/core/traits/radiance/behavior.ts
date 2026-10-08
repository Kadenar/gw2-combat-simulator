import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

// Apply Guardian's Burning-specific skill and trait multipliers before general
// condition-duration scaling.
export function modifyGuardianConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  if (context.condition !== 'Burning') return duration;
  let result = duration;
  if (
    (context.sourceId === ID.ZEALOTS_FLAME || context.event?.skillId === ID.ZEALOTS_FLAME) &&
    hasTrait(context, TRAIT.RADIANT_FIRE)
  ) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE);
    result *= balanceProfileNumber(radiantFireProfile, 'durationMultiplier');
  }

  if (
    (context.sourceId === 'guardian.justice-passive' || context.event?.sourceId === 'guardian.justice-passive') &&
    hasTrait(context, TRAIT.AMPLIFIED_WRATH)
  ) {
    const amplifiedWrathProfile = requireBalanceProfileFromContext(context, TRAIT.AMPLIFIED_WRATH);
    result *= balanceProfileNumber(amplifiedWrathProfile, 'durationMultiplier');
  }

  return result;
}

/** A committed heal claims Resolution's interval only when its selected boon can emit. */
export function completeHealersResolution(runtime: Runtime, cast: RuntimeCast<GuardianSkill>): void {
  if (cast.skill.type !== 'Heal') return;
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };

  if (hasTrait(runtime, TRAIT.HEALERS_RESOLUTION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HEALERS_RESOLUTION);
    const effect = requireEffect(profile, 'boon', 'resolution');
    // Only a surviving Resolution packet consumes this trait's interval.
    if (effect && runtime.procs.claim(TRAIT.HEALERS_RESOLUTION, 'guardian.core.healersResolution', runtime.time)) {
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...cause,
          type: 'buff',
          sourceId: TRAIT.HEALERS_RESOLUTION,
          name: profile.name,
          kind: 'resolution',
          stacks: effectNumber(profile, effect, 'stacks'),
          duration: effectNumber(profile, effect, 'duration')
        }
      });
    }
  }
}

/** Signet passives keep their ordinary cooldown rule unless Perfect Inscriptions retains them. */
export function guardianSignetPassiveActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS) || !context.timeline?.skillOnCooldownAt(skillId, context.time);
}

/** Build and live signet grants read the same selected multiplier, including disabled-trait previews. */
export function perfectInscriptionsMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.PERFECT_INSCRIPTIONS)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERFECT_INSCRIPTIONS), 'attributeMultiplier')
    : 1;
}

/** Torch recharge keeps the common compiler's live lookup and numeric validation. */
export const radiantFireRecharge = compileRechargeRules<GuardianRuntimeState>([
  {
    trait: TRAIT.RADIANT_FIRE,
    when: (_runtime, skill) => skill.weapon === 'Torch',
    multiplier: { profile: TRAIT.RADIANT_FIRE, field: 'rechargeMultiplier' }
  }
]);

/** Select the same duration multiplier for the torch flip window and its Burning packets. */
export function radiantFireDurationMultiplier(context: unknown): number {
  return hasTrait(context, TRAIT.RADIANT_FIRE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RADIANT_FIRE), 'durationMultiplier')
    : 1;
}

/** Selected Radiant Fire raises Zealot's Flame capacity without reducing a larger authored capacity. */
export function radiantFireMaximumAmmo(context: MaximumAmmoContext<object>, skill: Skill, maximum: number): number {
  return skill.id === ID.ZEALOTS_FLAME && context.hasTrait(TRAIT.RADIANT_FIRE)
    ? Math.max(maximum, balanceProfileNumber(context.requireBalanceProfile(TRAIT.RADIANT_FIRE), 'maximumStacks'))
    : maximum;
}

/** Luminary checks this Core trait at its existing aura-grant boundary. */
export function justiceIsBlindEligible(runtime: Runtime, skill: Skill): boolean {
  return Boolean(
    skill.categories?.includes('Virtue') && skill.slot === 'Profession_1' && hasTrait(runtime, TRAIT.JUSTICE_IS_BLIND)
  );
}

/** Emit the surviving Blind packet after Luminary schedules its independent aura grant. */
export function emitJusticeIsBlind(runtime: Runtime, event: Gw2ResolverEvent, skill: Skill): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.JUSTICE_IS_BLIND);
  const blind = requireEffect(profile, 'condition', 'Blind');
  if (blind)
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...event,
        type: 'condition',
        condition: 'Blindness',
        stacks: effectNumber(profile, blind, 'stacks'),
        duration: effectNumber(profile, blind, 'duration'),
        sourceId: TRAIT.JUSTICE_IS_BLIND,
        skillId: TRAIT.JUSTICE_IS_BLIND,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Justice is Blind',
        triggeredBy: skill.name
      }
    });
}

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
