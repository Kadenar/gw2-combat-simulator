import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/traits/modifiers.js';
import { antiquaryCastAvailability } from '#gw2/professions/thief/specializations/antiquary/mechanics/availability.js';
import {
  handleForgedSurfer,
  handleSkrittScuffle
} from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import {
  advanceAntiquaryResources,
  spendAntiquaryResources
} from '#gw2/professions/thief/specializations/antiquary/mechanics/resources.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { ThiefPrecastContext } from '#gw2/professions/thief/types.js';

import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';

export const antiquaryTaskHandlers = Object.freeze({
  'thief.forged-surfer': handleForgedSurfer,
  'thief.skritt-scuffle': handleSkrittScuffle
});

export const antiquarySchedulerHooks = Object.freeze({
  advance: advanceAntiquaryResources,
  onCastStart: spendAntiquaryResources,
  taskHandlers: antiquaryTaskHandlers
});

// Meticulous Custodian boosts the base strike coefficient of each artifact to its "enhanced" value; factors below are enhanced/base
const METICULOUS_ARTIFACT_STRIKE_IDS = new Set<number>([
  ID.METAL_LEGION_GUITAR,
  ID.MISTBURN_MORTAR,
  ID.CHAK_SHIELD,
  ID.SUMMON_KRYPTIS_TURRET_ID_77192,
  ID.HOLO_DANCER_DECOY
]);

// Return the Meticulous Custodian strike multiplier only for the artifact and
// active identity window that owns the queried packet.
function meticulousArtifactStrikeFactor(
  context: Gw2ModifierContext,
  _target: unknown,
  parameters: Readonly<Record<string, number>>
): number {
  const event = context.event;
  if (event?.skillId === ID.METAL_LEGION_GUITAR) {
    return event.name === 'Final Smash' ? parameters.guitarFinalFactor : parameters.guitarFactor;
  }

  if (event?.skillId === ID.MISTBURN_MORTAR) return parameters.mortarFactor;
  if (event?.skillId === ID.CHAK_SHIELD) return parameters.chakFactor;
  if (event?.skillId === ID.SUMMON_KRYPTIS_TURRET_ID_77192) {
    return parameters.kryptisFactor;
  }

  if (event?.skillId === ID.HOLO_DANCER_DECOY) return parameters.holoFactor;
  return 1;
}

export const antiquaryModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'thief.antiquary-artifact-momentum',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      Number(thiefRuntimeSpecializationState(context, 'Antiquary').antiquaryDamageUntil || 0) > context.time
  },
  {
    id: 'thief.combat-high-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 10,
      stackInterval: 2,
      damagePerStack: 0.03
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      Math.min(
        parameters.maximumStacks,
        Math.ceil(
          Math.max(
            0,
            Number(thiefRuntimeSpecializationState(context, 'Antiquary').combatHighExpiresAt || 0) - context.time
          ) / parameters.stackInterval
        )
      ) * parameters.damagePerStack,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.COMBAT_HIGH)
  },
  {
    id: 'thief.combat-high-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 10,
      stackInterval: 2,
      damagePerStack: 0.02
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      Math.min(
        parameters.maximumStacks,
        Math.ceil(
          Math.max(
            0,
            Number(thiefRuntimeSpecializationState(context, 'Antiquary').combatHighExpiresAt || 0) - context.time
          ) / parameters.stackInterval
        )
      ) * parameters.damagePerStack,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.COMBAT_HIGH)
  },
  {
    id: 'thief.kryptis-turret-damage',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      Number(thiefRuntimeSpecializationState(context, 'Antiquary').kryptisDamageUntil || 0) > context.time
  },
  {
    id: 'thief.meticulous-custodian-artifact-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      guitarFinalFactor: 3 / 2.5,
      guitarFactor: 1.2 / 0.8,
      mortarFactor: 0.6 / 0.5,
      chakFactor: 1,
      kryptisFactor: 3.84 / 2.8,
      holoFactor: 3 / 2
    } as Readonly<Record<string, number>>,
    factor: meticulousArtifactStrikeFactor,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN) &&
      METICULOUS_ARTIFACT_STRIKE_IDS.has(Number(context.event?.skillId))
  },
  {
    id: 'thief.meticulous-custodian-mortar-burning',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 2 / 1.5,
    when: (context) =>
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN) &&
      context.event?.skillId === ID.MISTBURN_MORTAR &&
      context.event?.condition === 'Burning' &&
      context.event?.triggeredBy == null // the Charged Strike bonus burn (emitted by resolver) must not have its duration doubled a second time
  },
  {
    id: 'thief.meticulous-custodian-sun-crystal-burning',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 5 / 4,
    when: (context) =>
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN) &&
      context.event?.skillId === ID.ZEPHYRITE_SUN_CRYSTAL &&
      context.event?.condition === 'Burning'
  }
]);

export const antiquaryAttributeRules = Object.freeze({
  modifierRules: antiquaryModifierRules
});

function modifyAntiquaryRechargeDuration(context: ThiefPrecastContext, duration: number): number {
  const state = antiquaryState.from(context);
  const multiplier = Number(balanceProfileFromContext(context, PROFILE.artifactWindows)?.rechargeMultiplier ?? 0.2);
  const expirations = (state.holoUtilityCooldownReductionExpirations || []).filter(
    (expiresAt) => Number(expiresAt) > context.start
  );
  state.holoUtilityCooldownReductionExpirations = expirations;
  if (context.skill.type !== 'Utility' || expirations.length === 0) {
    return duration;
  }

  // consume the earliest slot; each Holo-Dancer Decoy use adds one entry, so stacking is supported
  expirations.shift();
  state.holoUtilityCooldownReduction = expirations.length ? 1 - multiplier : 0;
  state.holoUtilityCooldownReductionExpiresAt = expirations.length ? Math.max(...expirations) : 0;
  return duration * multiplier;
}

export const antiquaryCastRules = Object.freeze({
  availability: {
    id: 'thief.antiquary-availability',
    order: 20,
    handler: antiquaryCastAvailability
  },
  modifyRechargeDuration: modifyAntiquaryRechargeDuration
});
