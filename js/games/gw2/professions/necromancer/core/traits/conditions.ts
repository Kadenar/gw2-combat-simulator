import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { transfer } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import {
  applyTraitCondition,
  emitNecromancerShroudTrait
} from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Lets player and Ritualist spirit critical hits advance Barbed Precision, while excluding minions. */
export const necromancerBarbedPrecisionReaction = criticalProcHandler<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'necromancer.barbed-precision',
  actorTypes: ['player', 'summon', 'unknown'],
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BARBED_PRECISION),
  randomStream: 'necromancer.barbed-precision',
  when: (context, event) =>
    Number(event.coefficient) > 0 &&
    hasTrait(context, TRAIT.BARBED_PRECISION) &&
    (event.actorType !== 'summon' || event.summonKind === 'spirit'),
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const profile = requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION);
      const effect = requireEffect(profile, 'condition', 'Bleeding');
      if (!effect) return;
      applyTraitCondition(context, event, {
        name: 'Barbed Precision',
        procCount: 1,
        traitId: TRAIT.BARBED_PRECISION,
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration')
      });
    }
  }
});

export function applyChillingDarkness(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILLING_DARKNESS)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILLING_DARKNESS);
  const effect = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // Chill, so a removed packet leaves it ready.
  if (!effect || !context.procs.claimCooldown('chillingDarkness', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;
  applyTraitCondition(context, event, {
    name: 'Chilling Darkness',
    traitId: TRAIT.CHILLING_DARKNESS,
    condition: effect.condition || 'Chilled',
    stacks: effect.stacks ?? 1,
    duration: effect.duration ?? 2
  });
}

export function applyTerror(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if ((event.controlKind !== 'fear' && event.kind !== 'fear') || !hasTrait(context, TRAIT.TERROR)) return;
  applyTraitCondition(context, event, {
    name: 'Terror',
    traitId: TRAIT.TERROR,
    condition: 'Fear',
    duration: event.duration ?? 1
  });
}

export function applyInsidiousDisruption(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.INSIDIOUS_DISRUPTION);
  const effect = requireEffect(profile, 'condition', 'Torment');
  if (!effect) return;
  applyTraitCondition(context, event, {
    name: 'Insidious Disruption',
    traitId: TRAIT.INSIDIOUS_DISRUPTION,
    condition: String(effect.condition),
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
  });
}

/** Applies Furious Demise at the original attribute-conversion position. */
export function modifyFuriousDemiseAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    const furiousDemiseProfile = requireBalanceProfileFromContext(context, TRAIT.FURIOUS_DEMISE);
    result.precision += balanceProfileNumber(furiousDemiseProfile, 'attributeBonus');
  }
}

/** Applies Target the Weak at the original attribute-conversion position. */
export function modifyTargetTheWeakAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
    const targetTheWeakProfile = requireBalanceProfileFromContext(context, TRAIT.TARGET_THE_WEAK);
    // Flat Precision from Furious Demise is present before the conversion.
    result.conditionDamage += Math.floor(
      result.precision * balanceProfileNumber(targetTheWeakProfile, 'attributeConversion')
    );
  }
}

/** Applies Lingering Curse at the original attribute-conversion position. */
export function modifyLingeringCurseAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.LINGERING_CURSE)) {
    const lingeringCurseProfile = requireBalanceProfileFromContext(context, TRAIT.LINGERING_CURSE);
    result.conditionDamage += balanceProfileNumber(lingeringCurseProfile, 'attributeBonus');
  }
}

export function modifyNecromancerConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  return eventSkill(context)?.weapon === 'Scepter' &&
    context.event?.skillId !== ID.DEVOURING_DARKNESS &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
    ? duration *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_CURSE), 'durationMultiplier')
    : duration;
}

/** Emits furious demise at the ordered post-entry boundary. */
export function enterFuriousDemise(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.FURIOUS_DEMISE);
}

/** Emits weakening shroud at the ordered post-entry boundary. */
export function enterWeakeningShroud(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitNecromancerShroudTrait(runtime, cast, TRAIT.WEAKENING_SHROUD);
}

/** Shroud variants decide when to arm; the trait owns selection while a granted transfer survives until consumed. */
export function armPlagueSending(runtime: NecromancerRuntime, hasConditions: boolean): void {
  runtime.profession.core.plagueSendingArmed = hasTrait(runtime, TRAIT.PLAGUE_SENDING) && hasConditions;
}

export function reactToNecromancerConditions(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = runtime.helpers.skillsById.get(event.skillId ?? event.sourceId);
  if (!skill) return;
  const work = { skillId: skill.id, activationId: event.activationId };
  const state = runtime.profession.core;
  if (
    state.plagueSendingArmed &&
    transfer(
      runtime,
      skill,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PLAGUE_SENDING), 'maximumConditions'),
      work,
      true
    )
  ) {
    state.plagueSendingArmed = false;
  }
}

/** Resolves the scepter trait replacement before other Core availability gates. */
export function lingeringCurseAvailability(runtime: NecromancerRuntime, skill: NecromancerSkill) {
  if (skill.id === ID.DEVOURING_DARKNESS && !hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');
  if (skill.id === ID.FEAST_OF_CORRUPTION && hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(
      skill,
      'necromancer.trait-replacement',
      'Devouring Darkness replaces it while Lingering Curse is selected.'
    );
  return undefined;
}

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionBloodIsPower: SkillEffect = {
  name: 'Self Torment',
  type: 'condition',
  condition: 'Torment',
  stacks: 2,
  duration: 10,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionConsumeConditions: SkillEffect = {
  name: 'Master of Corruption Vulnerability',
  type: 'condition',
  condition: 'Vulnerability',
  stacks: 5,
  duration: 4,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionPlaguelands: SkillEffect = {
  name: 'Self Poisoned',
  type: 'condition',
  condition: 'Poisoned',
  stacks: 1,
  duration: 4,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionCorrosivePoisonCloud: SkillEffect = {
  name: 'Self Crippled',
  type: 'condition',
  condition: 'Crippled',
  stacks: 1,
  duration: 2,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Scourge shroud-like casts arm the existing transfer without resetting an already armed unselected grant. */
export function armScourgePlagueSending(runtime: NecromancerRuntime): void {
  if (hasTrait(runtime, TRAIT.PLAGUE_SENDING)) runtime.profession.core.plagueSendingArmed = true;
}
