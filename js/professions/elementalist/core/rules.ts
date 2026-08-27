import { emitSkillControl, emitSkillDamage } from '../../../platform/gw2/scheduler/skill-events.js';
import { elementalistCoreAvailability } from './availability.js';
import { elementalistAttunementRechargeDuration, onAttunementComplete, targetAttunement } from './attunements.js';
import { AURA_TRANSMUTE_SKILLS, DODGE_ENDURANCE_COST, ETCHING_CHAINS } from './constants.js';
import { applyConjureState } from './conjures.js';
import { prepareElementalistHitboxEvent } from './events.js';
import { applyHammerState, scheduleGrandFinaleProfile } from './hammer.js';
import {
  applyElementalistAura,
  etchingChain,
  emitProfiledCondition,
  profiledEffect,
  skillWeapon
} from './mechanics.js';
import { applyPistolState } from './pistol.js';
import { updateEndurance } from './resources.js';
import {
  applyGenericPostCast,
  extendPersistingFlamesField,
  extendPersistingFlamesPackets,
  observeElementalistTraitEvent,
  processFreshAirCandidates,
  triggerEvasiveArcana
} from './traits.js';
import { elementalistWeaponStateTaskHandlers, shareAttunementVariantRecharge } from './weapon-state.js';
import { resetAutoattackChains } from '../../../platform/gw2/skills/autoattack-chains.js';

export { elementalistCoreAvailability } from './availability.js';
export { elementalistAlacrityAdjustedDuration, elementalistAttunementRechargeDuration } from './attunements.js';
export { applyElementalistAura, emitElementalistProc } from './mechanics.js';
export {
  grantElementalistRockSolid,
  triggerBountifulPower,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerFlameExpulsion,
  triggerSunspot
} from './traits.js';

import { criticalChance } from '../../../platform/gw2/combat/damage/calculations.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { produceGw2OwnedComboEvents } from '../../../platform/gw2/scheduler/combo-materializer.js';
import { prepareGw2BuffCompanionCandidates } from '../../../platform/gw2/combat/state/allied-players.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '../data/ids.js';
export { elementalistCoreAttributeRules } from './modifiers.js';
import type {
  AvailabilityResult,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  SimulationEventInput,
  Skill
} from '../../../platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext,
  ElementalistSchedulerContext
} from '../types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  resetElementalistAttunementCooldowns,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement,
  type ElementalistAuraState,
  type ElementalistCoreState
} from './state.js';
import {
  beginElementalistGlyphCast,
  completeElementalistElementalCommand,
  completeElementalistGlyphCast,
  elementalistElementalCompanionId,
  elementalistElementalAvailability,
  elementalistElementalTaskHandlers,
  observeElementalistElementalEvent
} from './elementals.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue,
  elementalistEffectValue
} from './profiles.js';

function scheduleElementalistSkill(context: ElementalistLifecycleContext, skill: Skill): boolean {
  return scheduleGrandFinaleProfile(context, skill);
}

function applySkillAura(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!skill.aura) return;
  const [element, rawDuration] = String(skill.aura).split('|');
  const duration = Number(rawDuration || 0);
  if (!element || !(duration > 0)) return;
  applyElementalistAura(context, {
    at: context.effectiveEnd,
    aura: `${element} Aura`,
    duration,
    skillName: skill.name,
    sourceId: skill.id
  });
}

export function elementalistOnCastStart(context: ElementalistLifecycleContext, skill: Skill): void {
  // Aura-bearing skills grant their aura before same-time strike/condition
  // packets, so aura-triggered modifiers can affect the skill that granted it.
  applySkillAura(context, skill);
  beginElementalistGlyphCast(context, skill);
  const state = professionCoreState(context);
  const chain = etchingChain(skill.name);
  if (chain && skill.name === chain.etching && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = { stage: 'lesser', otherCasts: 0 };
  }

  if (skill.name === 'Grand Finale') {
    const activations = new Set(
      Object.values(state.hammerOrbActivationIds).filter((value): value is string => Boolean(value))
    );
    for (const event of [...context.events]) {
      if (
        activations.has(String(event.activationId || '')) &&
        event.at >= context.start &&
        (event.type === 'damage' || event.type === 'condition')
      ) {
        context.replaceEvent(event, {
          type: 'marker',
          cancelled: true,
          detail: 'cancelled by Grand Finale'
        });
      }
    }
  }

  if (skillWeapon(skill) === 'Spear' && String(skill.slot || '') !== 'Weapon_1') {
    const followup = {
      damage: state.spearNextDamageBonus,
      critical: state.spearNextGuaranteedCritical,
      control: state.spearNextControlHit
    };
    if (followup.damage || followup.critical || followup.control) {
      state.spearFollowups[context.reservationId] = followup;
      state.spearNextDamageBonus = false;
      state.spearNextGuaranteedCritical = false;
      state.spearNextControlHit = false;
    }
  }
}

// Decorate packets only after the base skill has materialized so combo chances
// and one-shot spear empowerments modify the exact activation they belong to.
export function elementalistAfterCast(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  extendPersistingFlamesPackets(context, skill);
  const activationEvents = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId && event.type === 'damage' && Number(event.coefficient || 0) > 0
    )
    .sort((left, right) => left.at - right.at);

  if (skill.name === 'Frigid Flurry' && state.pistolBullets.Water === true) {
    for (const [index, event] of activationEvents.entries()) {
      const replacement = context.replaceEvent(event, {
        comboFinishers: [
          {
            ownerId: 'elementalist',
            attemptGroup: `runtime:${index + 1}`,
            finisherType: 'Projectile',
            chance: elementalistBalanceValue(context, PROFILE.frigidFlurry, 'procChance', 0.2),
            ambiguousFieldSelection: 'oldest'
          }
        ]
      });
      produceGw2OwnedComboEvents(context as unknown as SchedulerContext, replacement);
    }
  }

  const followup = state.spearFollowups[context.reservationId];
  if (!followup) return;
  for (const event of activationEvents) {
    context.replaceEvent(event, {
      ...(followup.damage
        ? {
            coefficient:
              Number(event.coefficient || 0) *
              elementalistBalanceValue(context, PROFILE.spearEmpowerments, 'damageMultiplier', 1.2)
          }
        : {}),
      ...(followup.critical ? { forceCrit: true } : {})
    });
  }

  if (followup.control && activationEvents[0]) {
    const first = activationEvents[0];
    emitSkillControl(context, {
      at: first.at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      skillId: skill.id,
      controlKind: 'crowd-control'
    });
  }

  delete state.spearFollowups[context.reservationId];
}

// Commit stateful flipovers and chain progress at cast completion, including
// aura transmutation, pistol bullets, etchings, orbs, and conjured weapons.
function applySpecialSkillProgression(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;

  const aura = AURA_TRANSMUTE_SKILLS[Number(skill.id)];
  if (aura) {
    state.activeAuras = state.activeAuras.filter((candidate) => candidate.type !== aura || candidate.expiresAt <= at);
  }

  const chain = etchingChain(skill.name);
  if (chain && skill.name !== chain.etching && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = null;
  } else if (!chain || skill.name === chain.etching) {
    for (const candidate of ETCHING_CHAINS) {
      const progress = state.etchings[candidate.etching];
      if (!progress || progress.stage !== 'lesser') continue;
      if (skill.name === candidate.etching) continue;
      const otherCasts = progress.otherCasts + 1;
      state.etchings[candidate.etching] = {
        stage:
          otherCasts >= elementalistBalanceValue(context, PROFILE.spearEmpowerments, 'maximumStacks', 3)
            ? 'full'
            : 'lesser',
        otherCasts
      };
    }
  }

  if (Number(skill.resourceGain || 0) > 0) {
    updateEndurance(
      context as unknown as ElementalistSchedulerContext,
      state,
      at,
      Boolean(context.config.boons?.vigor)
    );
    state.endurance = Math.min(
      elementalistBalanceValue(context, PROFILE.resources, 'maximumStacks', 100),
      state.endurance + Number(skill.resourceGain)
    );
  }
}

/** Runs Core Elementalist mechanics owned by one completed skill activation. */
export const elementalistCoreSkillMechanicHandlers = Object.freeze({
  'elementalist.core.open-rock-barrier': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    professionCoreState(context).rockBarrierExpiresAt =
      at + elementalistBalanceValue(context, PROFILE.rockBarrier, 'durationMultiplier', 30);
  },
  'elementalist.core.release-rock-barrier': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    professionCoreState(context).rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsByName.get('Rock Barrier');
    if (root) {
      context.state.cooldowns.set(root.id, at + context.rechargeDurationFor(root, at, { rockBarrierRelease: true }));
    }
  },
  'elementalist.core.consume-elemental-explosion': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => {
    const state = professionCoreState(context);
    const auraByAttunement: Readonly<Record<ElementalistAttunement, readonly [string, number]>> = {
      Fire: ['Fire Aura', 4],
      Water: ['Frost Aura', 4],
      Air: ['Shocking Aura', 3],
      Earth: ['Magnetic Aura', 3]
    };
    const [fallbackAura, fallbackDuration] = auraByAttunement[state.primaryAttunement];
    const auraEffect = profiledEffect(context, PROFILE.elementalExplosion, 'buff', state.primaryAttunement);
    applyElementalistAura(context, {
      at,
      aura: String(auraEffect?.kind || fallbackAura),
      duration: Number(auraEffect?.duration ?? fallbackDuration),
      skillName: skill.name,
      sourceId: skill.id
    });
    for (const element of ELEMENTALIST_ATTUNEMENTS) state.pistolBullets[element] = false;
  },
  'elementalist.core.arm-spear-damage': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextDamageBonus = true;
  },
  'elementalist.core.arm-spear-recharge': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextRechargeReduction = true;
  },
  'elementalist.core.arm-spear-critical': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextGuaranteedCritical = true;
  },
  'elementalist.core.arm-spear-control': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextControlHit = true;
  },
  'elementalist.core.disable-signet-of-fire-passive': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => {
    if (hasTrait(context, 'Written in Stone')) return;
    const state = professionCoreState(context);
    state.signetOfFireDisabledUntil = Number(context.state.cooldowns.get(skill.id) || at);
    context.emit({
      type: 'elementalist.signet-fire',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      disabledUntil: state.signetOfFireDisabledUntil
    });
  }
});

export function elementalistOnCastComplete(context: ElementalistLifecycleContext, skill: Skill): void {
  completeElementalistGlyphCast(context, skill);
  completeElementalistElementalCommand(context, skill);
  const target = targetAttunement(skill);
  if (target) {
    const lifecycle = context as unknown as SchedulerRecord;
    if (lifecycle.elementalistAttunementHandled !== true) {
      onAttunementComplete(context, skill, target);
    }

    delete lifecycle.elementalistAttunementHandled;
    // Elementalist spear etchings count attunement swaps among the three
    // completed casts required to upgrade their release skill.
    applySpecialSkillProgression(context, skill);
    return;
  }

  const state = professionCoreState(context);
  applyConjureState(context, skill);
  applySpecialSkillProgression(context, skill);
  shareAttunementVariantRecharge(context, skill);
  if (skill.name === 'Dodge') {
    updateEndurance(
      context as unknown as ElementalistSchedulerContext,
      state,
      context.effectiveEnd,
      Boolean(context.config.boons?.vigor)
    );
    state.endurance = Math.max(
      0,
      state.endurance - elementalistBalanceValue(context, PROFILE.resources, 'resourceCost', DODGE_ENDURANCE_COST)
    );
    triggerEvasiveArcana(context, skill);
  }

  if (skill.name === 'Arcane Echo') {
    state.arcaneEchoUntil =
      context.effectiveEnd + elementalistBalanceValue(context, PROFILE.arcaneEcho, 'durationMultiplier', 10);
  } else if (
    state.arcaneEchoUntil >= context.effectiveEnd &&
    skill.type === 'Weapon' &&
    Number(skill.cooldown || 0) > 0
  ) {
    state.arcaneEchoUntil = 0;
    context.state.cooldowns.set(
      skill.id,
      context.effectiveEnd + elementalistBalanceValue(context, PROFILE.arcaneEcho, 'recharge', 1)
    );
    const arcaneEcho = context.catalog.skillsByName.get('Arcane Echo');
    if (arcaneEcho) {
      const currentReadyAt = Number(context.state.cooldowns.get(arcaneEcho.id) || context.effectiveEnd);
      context.state.cooldowns.set(arcaneEcho.id, currentReadyAt + context.rechargeDuration);
    }
  }

  if (skill.name === 'Fulgor') {
    const pulse = profiledEffect(context, PROFILE.fulgor, 'strike');
    const hits = Math.max(0, Math.trunc(Number(pulse?.hits ?? 6)));
    const delay = elementalistBalanceValue(context, PROFILE.fulgor, 'initialDelay', 0.32);
    const interval = elementalistBalanceValue(context, PROFILE.fulgor, 'pulseInterval', 1);
    // Fulgor owns one secondary action at a time, so a recast replaces only
    // the prior action's pulses that had not occurred when the recast began.
    for (const event of [...context.events]) {
      if (
        event.type !== 'damage' ||
        event.fulgorSecondary !== true ||
        event.cancelled === true ||
        event.at < context.start - context.epsilon
      ) {
        continue;
      }

      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'replaced by a later Fulgor secondary action'
      });
    }

    for (let index = 0; index < hits; index += 1) {
      emitSkillDamage(context, {
        at: context.start + delay + index * interval,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'effect',
        skillName: skill.name,
        skillId: skill.id,
        coefficient: Number(pulse?.coefficient ?? 0),
        flatStrikeBase: Number(pulse?.flatStrikeBase ?? 200),
        flatStrikePowerCoeff: Number(pulse?.flatStrikePowerCoeff ?? 0.4),
        fulgorSecondary: true,
        noCrit: true
      });
    }
  }

  applyPistolState(context, skill);
  applyHammerState(context, skill);
  applyGenericPostCast(context, skill);
}

// Observe scheduled combat packets to update aura, attunement, and trait state
// that depends on the canonical event timeline.
export function observeElementalistEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  observeElementalistElementalEvent(context, event);
  extendPersistingFlamesField(context, event);
  const state = professionCoreState(context);
  if (
    event.type === 'damage' &&
    event.actorType !== 'summon' &&
    Number(event.coefficient || 0) > 0 &&
    state.shatteringStoneHitsRemaining > 0 &&
    event.at <= state.shatteringStoneUntil + context.epsilon
  ) {
    state.shatteringStoneHitsRemaining -= 1;
    if (state.shatteringStoneHitsRemaining === 0) {
      state.shatteringStoneUntil = 0;
    }

    emitProfiledCondition(
      context,
      event.at + context.epsilon,
      PROFILE.shatteringStone,
      'Triggered Bleeding',
      'Bleeding',
      1,
      5,
      'Shattering Stone',
      event.skillId ?? event.sourceId
    );
  }

  observeElementalistTraitEvent(context, event);
}

// Advance probabilistic trait progress and endurance, then expire transient
// auras, orbs, chains, and conjures at the requested scheduler timestamp.
export function advanceElementalistState(context: ElementalistSchedulerContext, at: number): void {
  const state = professionCoreState(context);
  processFreshAirCandidates(context, at);
  updateEndurance(context, state, at, Boolean(context.config.boons?.vigor));
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    if (Number(state.hammerOrbs[element] || 0) < at) {
      state.hammerOrbs[element] = null;
      state.hammerOrbGrantedBy[element] = null;
      state.hammerOrbActivationIds[element] = null;
    }
  }

  for (const [weapon, expiresAt] of Object.entries(state.conjurePickups)) {
    if (expiresAt < at) delete state.conjurePickups[weapon];
  }

  if (state.shatteringStoneUntil < at) {
    state.shatteringStoneUntil = 0;
    state.shatteringStoneHitsRemaining = 0;
  }

  if (state.dazingDischargeUntil < at) state.dazingDischargeUntil = 0;
  if (state.rockBarrierExpiresAt > 0 && state.rockBarrierExpiresAt <= at) {
    const expiresAt = state.rockBarrierExpiresAt;
    state.rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsByName.get('Rock Barrier');
    if (root) {
      context.state.cooldowns.set(
        root.id,
        expiresAt +
          context.rechargeDurationFor(root, expiresAt, {
            rockBarrierRelease: true
          })
      );
      resetAutoattackChains(context, [root.id]);
    }
  }
}

// Consume one-shot weapon recharge modifiers before applying persistent
// attunement training and skill-specific recharge rules.
export function modifyElementalistRechargeDuration(
  context: ElementalistSchedulerContext & { skill?: Skill },
  duration: number
): number {
  const skill = context.skill;
  if (!skill) return duration;
  if (skill.name === 'Glyph of Elementals') return 0;
  const state = professionCoreState(context);
  const at = Number((context as unknown as SchedulerRecord).start ?? context.state.time ?? 0);
  if (skill.name === 'Rock Barrier' && !(context as unknown as SchedulerRecord).rockBarrierRelease) {
    return 0;
  }

  if (skill.type !== 'Weapon') {
    return duration;
  }

  let adjustedDuration = duration;
  let weaponRechargeMultiplier = 1;
  if (state.spearNextRechargeReduction && skillWeapon(skill) === 'Spear' && String(skill.slot || '') !== 'Weapon_1') {
    weaponRechargeMultiplier *= elementalistBalanceValue(
      context,
      PROFILE.spearEmpowerments,
      'rechargeMultiplier',
      0.67
    );
    state.spearNextRechargeReduction = false;
  }

  if (state.dazingDischargeUntil > at && skillWeapon(skill) === 'Pistol' && String(skill.slot || '') !== 'Weapon_1') {
    weaponRechargeMultiplier *= elementalistBalanceValue(context, PROFILE.dazingDischarge, 'rechargeMultiplier', 0.67);
    state.dazingDischargeUntil = 0;
  }

  adjustedDuration *= Math.max(0, weaponRechargeMultiplier);
  if (skill.name === 'Ride the Lightning') {
    adjustedDuration *= elementalistBalanceValue(context, PROFILE.rideTheLightning, 'rechargeMultiplier', 0.5);
  }

  const attunement = String(skill.attunement || '');
  if (
    (attunement === 'Fire' && hasTrait(context, "Pyromancer's Training")) ||
    (attunement === 'Air' && hasTrait(context, "Aeromancer's Training")) ||
    (attunement === 'Earth' && hasTrait(context, "Geomancer's Training")) ||
    (attunement === 'Water' && hasTrait(context, "Aquamancer's Training"))
  ) {
    const profileId =
      attunement === 'Fire'
        ? PROFILE.pyromancersTraining
        : attunement === 'Air'
          ? PROFILE.aeromancersTraining
          : attunement === 'Earth'
            ? PROFILE.geomancersTraining
            : PROFILE.aquamancersTraining;
    adjustedDuration *= elementalistBalanceValue(context, profileId, 'rechargeMultiplier', 0.8);
  }

  return adjustedDuration;
}

export const elementalistCoreCastRules = Object.freeze({
  availability: {
    id: 'elementalist.core-availability',
    order: 10,
    handler: elementalistCoreAvailability
  },
  modifyRechargeDuration: modifyElementalistRechargeDuration
});

export const elementalistCoreSchedulerHooks = Object.freeze({
  taskHandlers: Object.freeze({
    ...elementalistElementalTaskHandlers,
    ...elementalistWeaponStateTaskHandlers
  }),
  prepareEvent: Object.freeze([
    {
      id: 'elementalist.boon-companion-candidates',
      order: 5,
      // The active glyph elemental is a concrete candidate, never an anonymous summon slot.
      handler(context: ElementalistSchedulerContext, event: SimulationEventInput): SimulationEventInput {
        const elemental = professionCoreState(context).summonedElemental;
        const active =
          elemental.element !== null &&
          elemental.activeUntil > Number(event.at ?? context.state.time) - context.epsilon;
        return prepareGw2BuffCompanionCandidates(
          event,
          active ? [elementalistElementalCompanionId(elemental.summonGeneration)] : []
        );
      }
    },
    {
      id: 'elementalist.hitbox',
      order: 10,
      handler: prepareElementalistHitboxEvent
    }
  ]),
  onCastStart: {
    id: 'elementalist.core-cast-start',
    order: 10,
    handler: elementalistOnCastStart
  },
  scheduleSkill: {
    id: 'elementalist.special-skill-profile',
    order: 10,
    handler: scheduleElementalistSkill
  },
  afterCast: {
    id: 'elementalist.core-after-cast',
    order: 10,
    handler: elementalistAfterCast
  },
  advance: {
    id: 'elementalist.core-state',
    order: 10,
    handler: advanceElementalistState
  },
  onEventScheduled: {
    id: 'elementalist.combos-and-fresh-air',
    order: 10,
    handler: observeElementalistEvent
  },
  onCastComplete: {
    id: 'elementalist.core-cast-complete',
    order: 10,
    handler: elementalistOnCastComplete
  },
  onCooldownReset: {
    id: 'elementalist.attunement-cooldown-reset',
    order: 10,
    handler: resetElementalistAttunementCooldowns
  }
});
