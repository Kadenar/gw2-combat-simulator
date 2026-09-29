import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import {
  applyEmpoweringAura,
  applyEpitomeAura,
  applyEpitomeCombo,
  applySynergyCombo
} from '#gw2/professions/elementalist/specializations/catalyst/traits/auras.js';
import {
  CATALYST_BASE_EMPOWERMENT_TASK,
  applyCatalystEmpowerment,
  applyViciousEmpowerment,
  renewBaseEmpowerment
} from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';

const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

const aura = (name: string, auraName: string, duration: number): SkillEffect => ({
  type: 'buff',
  name,
  kind: auraName,
  stacks: 1,
  duration
});

/** Owns Empowering Auras tuning and its existing execution behavior. */
export const empoweringAuras = defineTrait({
  id: TRAIT.EMPOWERING_AURAS,
  name: 'Empowering Auras',
  hooks: { reactions: { 'aura.applied': applyEmpoweringAura } },
  balance: {
    maximumStacks: 5,
    durationMultiplier: 10,
    damageIncreasePerStack: 0.01
  },
  modifierRules: [
    {
      id: 'elementalist.empowering-auras-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: { maximumStacks: 5, damagePerStack: 0.01 },
      amount: (context, _target, parameters) =>
        elementalistTimedBuffStacks(context, 'empowering auras', parameters.maximumStacks) * parameters.damagePerStack
    },
    {
      id: 'elementalist.empowering-auras-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      parameters: { maximumStacks: 5, damagePerStack: 0.01 },
      amount: (context, _target, parameters) =>
        elementalistTimedBuffStacks(context, 'empowering auras', parameters.maximumStacks) * parameters.damagePerStack
    }
  ]
});

/** Owns Elemental Epitome tuning and its existing execution behavior. */
export const elementalEpitome = defineTrait({
  id: TRAIT.ELEMENTAL_EPITOME,
  name: 'Elemental Epitome',
  hooks: { reactions: { 'aura.applied': applyEpitomeAura, 'combo.resolved': applyEpitomeCombo } },
  balance: {
    internalCooldown: 10,
    effects: [
      aura('Fire', 'Fire Aura', 4),
      aura('Water', 'Frost Aura', 4),
      aura('Air', 'Shocking Aura', 3),
      aura('Earth', 'Magnetic Aura', 3),
      {
        type: 'buff',
        name: 'Empowerment',
        kind: 'elemental empowerment',
        stacks: 1,
        duration: 15
      }
    ]
  }
});

/** Owns Elemental Synergy tuning and its existing execution behavior. */
export const elementalSynergy = defineTrait({
  id: TRAIT.ELEMENTAL_SYNERGY,
  name: 'Elemental Synergy',
  hooks: { reactions: { 'combo.resolved': applySynergyCombo } },
  balance: {
    internalCooldown: 10,
    resourceGain: 50,
    effects: [boon('Fire', 'might', 6, 10), boon('Earth', 'stability', 2, 6)]
  }
});

/** Shares the existing Elemental Empowerment profile's scaling fields without duplicating patch targets. */
export const empoweredEmpowerment = defineTrait({ id: TRAIT.EMPOWERED_EMPOWERMENT, name: 'Empowered Empowerment' });

/** Owns Elemental Empowerment tuning and its existing execution behavior. */
export const elementalEmpowerment = defineTrait({
  id: TRAIT.ELEMENTAL_EMPOWERMENT,
  name: 'Elemental Empowerment',
  balance: {
    maximumStacks: 10,
    playerStacks: 3,
    durationMultiplier: 15,
    attributePerStack: 0.01,
    coefficientMultiplier: 0.015,
    attributeConversion: 0.2
  },
  hooks: {
    reactions: { 'buff.applied': applyCatalystEmpowerment },
    onCombatStart(runtime) {
      const state = catalystState.from(runtime);
      if (!hasTrait(runtime, TRAIT.ELEMENTAL_EMPOWERMENT) || state.elementalEmpowermentRefreshStarted) return;
      state.elementalEmpowermentRefreshStarted = true;
      renewBaseEmpowerment(runtime);
    },
    tasks: { [CATALYST_BASE_EMPOWERMENT_TASK]: renewBaseEmpowerment }
  }
});

/** Owns Vicious Empowerment tuning and its existing execution behavior. */
export const viciousEmpowerment = defineTrait({
  id: TRAIT.VICIOUS_EMPOWERMENT,
  name: 'Vicious Empowerment',
  hooks: { reactions: { 'control.resolved': applyViciousEmpowerment, 'condition.applied': applyViciousEmpowerment } },
  balance: {
    internalCooldown: 0.25,
    effects: [
      {
        type: 'buff',
        name: 'Empowerment',
        kind: 'elemental empowerment',
        stacks: 2,
        duration: 15
      },
      boon('Might', 'might', 2, 10)
    ]
  }
});

/** Owns Depth of Elements tuning and its existing execution behavior. */
export const depthOfElements = defineTrait({
  id: TRAIT.DEPTH_OF_ELEMENTS,
  name: 'Depth of Elements',
  balance: {
    maximumStacks: 30
  }
});

/** Owns Energized Elements tuning and its existing execution behavior. */
export const energizedElements = defineTrait({
  id: TRAIT.ENERGIZED_ELEMENTS,
  name: 'Energized Elements',
  balance: {
    resourceGain: 2,
    effects: [boon('Fury', 'fury', 1, 2)]
  }
});

/** Owns Spectacular Sphere tuning and its existing execution behavior. */
export const spectacularSphere = defineTrait({
  id: TRAIT.SPECTACULAR_SPHERE,
  name: 'Spectacular Sphere',
  balance: {
    effects: [
      boon('Quickness', 'quickness', 1, 2),
      boon('Fire', 'might', 5, 10),
      boon('Water', 'vigor', 1, 5),
      boon('Air', 'fury', 1, 5),
      boon('Earth', 'aegis', 1, 3)
    ]
  }
});

/** Owns Sphere Specialist tuning and its existing execution behavior. */
export const sphereSpecialist = defineTrait({
  id: TRAIT.SPHERE_SPECIALIST,
  name: 'Sphere Specialist',
  balance: {
    durationMultiplier: 1.5
  }
});
/** Register catalyst traits in their existing execution order. */
export const catalystTraits = [
  depthOfElements,
  viciousEmpowerment,
  energizedElements,
  elementalEmpowerment,
  empoweringAuras,
  spectacularSphere,
  elementalEpitome,
  elementalSynergy,
  empoweredEmpowerment,
  sphereSpecialist
];
