import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';

function galeshotRuntimeState(context: RangerModifierContext) {
  return readProfessionSpecializationState<{ windForce?: number; galeForceUntil?: number }>(
    context.runtime?.profession,
    'Galeshot'
  );
}

function windForce(context: RangerModifierContext): number {
  return Number(galeshotRuntimeState(context)?.windForce || 0);
}

function galeForceAmount(context: RangerModifierContext, parameters: Readonly<Record<string, number>>): number {
  const galeForce =
    Number(galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time ? parameters.galeForceBonus : 0;
  // Hawkeye converts the five existing stacks into a 25% flat bonus (galeForce),
  // but Wind Force earned while Gale Force is active still adds 3% per stack on top.
  return galeForce + windForce(context) * parameters.windForcePerStack;
}

function activePetIsFeathered(context: RangerModifierContext): boolean {
  const name = String(
    readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet ||
      context.config?.selectedPet ||
      ''
  );
  return ['avian', 'moa', 'phoenix', 'raptor swiftwing'].includes(rangerPetByName(name).family);
}

function eventSkillId(context: RangerModifierContext): number {
  return Number(context.event?.skillId ?? context.skillId);
}

// Galeshot player modifiers follow outgoing ownership without changing explicit pet-only branches.
export const galeshotModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.bird-of-prey',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    // Either movement buff activates the player bonus, including generated buffs until they expire.
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BIRD_OF_PREY) &&
      (boonActive(context, 'swiftness') || boonActive(context, 'superspeed'))
  },
  {
    id: 'ranger.gale-force',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      galeForceBonus: 0.25,
      windForcePerStack: 0.03
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => galeForceAmount(context, parameters),
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.GALE_FORCE) &&
      (Number(galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time || windForce(context) > 0)
  },
  {
    id: 'ranger.flock-together',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      context.event?.actorType === 'summon' &&
      context.event?.source === 'ranger-pet' &&
      hasTrait(context, TRAIT.FLOCK_TOGETHER) &&
      activePetIsFeathered(context)
  },
  {
    id: 'ranger.piercing-gales-vulnerability',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // Piercing Gales applies its own doubled vulnerability multiplier (2% per
    // stack) in addition to the standard vulnerability already baked into the
    // platform strikeMultiplier, effectively tripling the vulnerability bonus
    // for this skill.
    parameters: {
      baseFactor: 1,
      vulnerabilityPerStack: 0.02
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) *
        parameters.vulnerabilityPerStack,
    when: (context) => eventSkillId(context) === ID.PIERCING_GALES
  }
]);
