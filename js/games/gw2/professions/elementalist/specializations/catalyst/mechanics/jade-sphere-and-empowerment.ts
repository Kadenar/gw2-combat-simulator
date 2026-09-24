import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { scheduledReaction, timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
/**
 * Scheduler-side Catalyst mechanics.
 *
 * Owns Jade Sphere energy (spent on deployment, regained from damaging hits), the
 * per-attunement sphere windows and their Spectacular Sphere / Sphere Specialist
 * payouts, Elemental Empowerment stack bookkeeping and the attribute bonus it
 * grants, the augment mechanic handlers, and the scheduler-side trait procs.
 *
 * The resolver counterparts live in `mechanics/reactions.ts`.
 */
import { denyCast } from '#gw2/platform/engine/skills/availability.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/index.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';

import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import {
  catalystState,
  grantCatalystElementalEmpowerment
} from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystModifierRules } from '#gw2/professions/elementalist/specializations/catalyst/traits/modifiers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import {
  empoweringAurasParameters,
  elementalEpitomeEmpowerment,
  elementalEpitomeAura,
  elementalSynergyBoon
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/aura-parameters.js';
import type { CatalystEmpowermentPool } from '#gw2/professions/elementalist/build/types.js';

const CATALYST_BASE_EMPOWERMENT_TASK = 'elementalist.catalyst-base-empowerment';

function maximumEnergy(context: unknown): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return balanceProfileNumber(resourcesProfile, 'maximumStacks');
}

function maximumEmpowerment(context: unknown): number {
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.elementalEmpowerment);
  return balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
}

// Adopt the balance-profile energy cap before the fight and clamp any seeded energy to it.
function initialize(context: ElementalistSchedulerContext): void {
  const state = catalystState.from(context);
  state.maximumEnergy = maximumEnergy(context);
  state.energy = Math.max(
    0,
    Math.min(state.maximumEnergy, Number(context.config.initialCatalystEnergy ?? state.maximumEnergy))
  );
}

function catalystModifierState(context: ElementalistModifierContext): CatalystStateLike {
  return readProfessionSpecializationState<CatalystStateLike>(context.runtime?.profession, 'Catalyst') || {};
}

interface CatalystStateLike {
  readonly elementalEmpowermentExpiries?: readonly number[];
}

// Apply live Elemental Empowerment stacks as an all-attribute multiplier without
// mutating the shared resolved-stat object.
function modifyCatalystAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  if (!hasTrait(context, 'Elemental Empowerment')) return attributes;

  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedStacks = activeStackCount(catalystModifierState(context).elementalEmpowermentExpiries || [], context.time);
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.elementalEmpowerment);
  const maximumStacks = balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
  const stacks = Math.min(maximumStacks, timedStacks);
  // Empowered Empowerment replaces flat per-stack scaling with a coefficient ramp,
  // paying the full conversion only once every stack is up.
  const multiplier = hasTrait(context, 'Empowered Empowerment')
    ? stacks === maximumStacks
      ? balanceProfileNumber(elementalEmpowermentProfile, 'attributeConversion')
      : stacks * balanceProfileNumber(elementalEmpowermentProfile, 'coefficientMultiplier')
    : stacks * balanceProfileNumber(elementalEmpowermentProfile, 'attributePerStack');
  // The build may pin the attribute pool the bonus is computed from; otherwise the
  // incoming resolved attributes are used.
  const pool = context.config?.catalystEmpowermentPool as Partial<CatalystEmpowermentPool> | undefined;
  const modified = { ...attributes };

  for (const stat of ['power', 'precision', 'ferocity', 'conditionDamage', 'expertise', 'concentration'] as const) {
    const eligible = Number(pool?.[stat] ?? modified[stat] ?? 0);
    const bonus = eligible * multiplier;
    modified[stat] =
      Number(modified[stat] || 0) + (['power', 'conditionDamage'].includes(stat) ? Math.round(bonus) : bonus);
  }

  return modified;
}

// Jade Sphere deployment requires the matching attunement and the profile energy
// cost; every other skill passes through untouched.
function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
  if (skill.skillFamily !== 'Jade Sphere') return { ready: true };
  const state = catalystState.from(context);
  const core = professionCoreState(context);
  if (skill.attunement !== core.primaryAttunement) {
    return denyCast(
      'elementalist.catalyst-attunement',
      `${skill.name} is unavailable - requires ${String(skill.attunement)} attunement.`
    );
  }

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const sphereCost = balanceProfileNumber(resourcesProfile, 'resourceCost');
  return state.energy >= sphereCost
    ? { ready: true }
    : denyCast('elementalist.catalyst-energy', `${skill.name} is unavailable - requires ${sphereCost} energy.`);
}

// Spend sphere energy and schedule its attunement-specific field, pulses, and
// boons from cast start so later attunement swaps cannot change the sphere.
function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (skill.skillFamily !== 'Jade Sphere') return;
  const state = catalystState.from(context);
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const sphereCost = balanceProfileNumber(resourcesProfile, 'resourceCost');
  state.energy = Math.max(0, state.energy - sphereCost);
  // The sphere field owns its active window; removing it leaves the energy cost intact.
  const field = skill.comboFields?.find((entry) => entry.ownerId === 'elementalist');
  if (field) {
    const duration = requireBalanceNumber(field.duration, `skill=${skill.id} combo-field duration`);
    state.sphereActiveUntil = Math.max(state.sphereActiveUntil, context.effectiveEnd + duration);
    state.sphereExpiry[String(skill.attunement)] = context.effectiveEnd + duration;
  }

  context.emit({
    type: 'resource',
    at: context.start,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    kind: 'catalyst-energy',
    value: state.energy,
    maximum: maximumEnergy(context),
    change: -sphereCost
  });
  // Spectacular Sphere pays party quickness plus the attunement's boon on deployment.
  // Both are stretched by Sphere Specialist here and flagged so afterCast does not
  // scale them a second time.
  if (hasTrait(context, 'Spectacular Sphere')) {
    const durationMultiplier = hasTrait(context, 'Sphere Specialist')
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.sphereSpecialist), 'durationMultiplier')
      : 1;
    const spectacularSphereProfile = requireBalanceProfileFromContext(context, PROFILE.spectacularSphere);
    const quickness = requireEffect(spectacularSphereProfile, 'boon', 'Quickness');
    if (quickness) {
      emitSkillBuff(context, {
        at: context.start,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        kind: String(quickness.boon).toLowerCase(),
        stacks: Number(quickness.stacks),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          'quickness',
          Number(quickness.duration) * durationMultiplier
        ),
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        sphereSpecialistScaled: true
      });
    }

    const profiledBoon = requireEffect(spectacularSphereProfile, 'boon', String(skill.attunement));
    if (profiledBoon) {
      emitSkillBuff(context, {
        at: context.start,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        kind: String(profiledBoon.boon),
        stacks: Number(profiledBoon.stacks),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          String(profiledBoon.boon),
          Number(profiledBoon.duration) * durationMultiplier
        ),
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        sphereSpecialistScaled: true
      });
    }
  }
}

// Extend the just-created Jade Sphere field for Sphere Specialist after its base
// cast has committed and the owned field can be identified safely.
function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (skill.skillFamily !== 'Jade Sphere' || !hasTrait(context, 'Sphere Specialist')) {
    return;
  }

  // Only this activation's unflagged buffs are stretched; anything already scaled at
  // cast start is skipped.
  for (const event of context.events) {
    if (
      event.activationId === context.reservationId &&
      event.type === 'buff' &&
      event.sphereSpecialistScaled !== true
    ) {
      const sphereSpecialistProfile = requireBalanceProfileFromContext(context, PROFILE.sphereSpecialist);
      context.replaceEvent(event, {
        duration: Number(event.duration || 0) * balanceProfileNumber(sphereSpecialistProfile, 'durationMultiplier')
      });
    }
  }
}

// Relentless Fire's damage window is the longer profile duration while the Fire
// Jade Sphere is still active, and the shorter one otherwise.
function activateRelentlessFire(context: ElementalistSchedulerContext, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const relentlessFireProfile = requireBalanceProfileFromContext(context, PROFILE.relentlessFire);
  emitSkillBuff(context, {
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    kind: 'relentless fire',
    stacks: 1,
    duration:
      state.sphereExpiry.Fire > at
        ? balanceProfileNumber(relentlessFireProfile, 'durationPerTier')
        : balanceProfileNumber(relentlessFireProfile, 'durationMultiplier')
  });
}

// Opens the Shattering Ice proc window, extended while the Water Jade Sphere is up.
function activateShatteringIce(context: ElementalistSchedulerContext, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const shatteringIceProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringIce);
  const duration =
    state.sphereExpiry.Water > at
      ? balanceProfileNumber(shatteringIceProfile, 'durationPerTier')
      : balanceProfileNumber(shatteringIceProfile, 'durationMultiplier');
  // Scheduler and resolver use the emitted buff's tick-aligned expiry.
  state.shatteringIceUntil = gw2EffectExpiresAt(at, duration);
  // Refreshing the buff rearms its first strike; subsequent strikes use the canonical strict ICD.
  state.shatteringIceReadyAt = 0;
  emitSkillBuff(context, {
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    kind: 'shattering ice',
    stacks: 1,
    duration
  });
}

// Reset weapon cooldowns matching Catalyst's single active attunement while
// preserving exclusions and active ammo-recharge contracts.
function activateElementalCelerity(context: ElementalistSchedulerContext, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const core = professionCoreState(context);
  for (const candidate of context.catalog.skills) {
    if (
      candidate.type === 'Weapon' &&
      Number(candidate.cooldown || 0) > 0 &&
      candidate.attunement === core.primaryAttunement
    ) {
      context.cooldownController.setReadyAt(candidate.id, at);
    }
  }

  // Each element contributes its boon only while that element's sphere is still active.
  for (const element of ['Fire', 'Water', 'Air', 'Earth'] as const) {
    if (state.sphereExpiry[element] <= at) continue;
    const elementalCelerityProfile = requireBalanceProfileFromContext(context, PROFILE.elementalCelerity);
    const effect = requireEffect(elementalCelerityProfile, 'boon', element);
    if (effect) {
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: Number(effect.duration),
        skillName: skill.name
      });
    }
  }
}

/** Runs Catalyst mechanics owned by one completed skill activation. */
export const catalystSkillMechanicHandlers = Object.freeze({
  'elementalist.catalyst.relentless-fire': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => activateRelentlessFire(context, skill, at),
  'elementalist.catalyst.shattering-ice': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => activateShatteringIce(context, skill, at),
  'elementalist.catalyst.elemental-celerity': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => activateElementalCelerity(context, skill, at)
});

// Each event handler owns one Catalyst contract; the dispatcher below preserves
// their scheduler order and the events that intentionally stop further handling.
function applyEmpoweringAuras(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  // Every aura gained adds an Empowering Auras stack buff.
  if (event.type === 'elementalist.aura' && hasTrait(context, 'Empowering Auras')) {
    const { duration } = empoweringAurasParameters(context);
    const source = String(event.skillName || event.source || 'Aura');
    const sourceId = event.skillId ?? event.sourceId;
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at: event.at,
      source,
      sourceId,
      actorType: 'player',
      kind: 'empowering auras',
      schedulerPrediction: event.schedulerPrediction,
      stacks: 1,
      duration,
      skillName: source
    });
  }
}

function scheduleBaseElementalEmpowerment(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  // Elemental Empowerment's baseline stacks begin at combat start; without an explicit
  // combat_start the first offensive player/summon event stands in for it.
  const state = catalystState.from(context);
  const implicitCombatEvent =
    !context.hasExplicitCombatStart &&
    ['player', 'summon'].includes(String(event.actorType || '')) &&
    ['damage', 'condition', 'control', 'blind'].includes(event.type);
  const startsCombat = event.type === 'combat_start' || implicitCombatEvent;
  if (startsCombat && hasTrait(context, 'Elemental Empowerment') && !state.elementalEmpowermentRefreshStarted) {
    state.elementalEmpowermentRefreshStarted = true;
    baseEmpowerment.start(context, {
      at: Math.max(context.state.time, event.at),
      captured: { applicationAt: event.at }
    });
  }
}

// Folds an observed empowerment buff into the timed stack list at its original
// application time rather than the time the task runs.
const externalEmpowermentReaction = scheduledReaction<
  ElementalistSchedulerContext,
  SimulationEvent,
  { readonly applicationAt: number; readonly duration: number; readonly stacks: number }
>({
  id: 'elementalist.catalyst-empowerment',
  order: 0,
  select(context, event) {
    // Untracked empowerment buffs are folded into the timed stack list; buffs already
    // flagged as tracked were counted when this module emitted them.
    if (
      event.type === 'buff' &&
      String(event.kind || '').toLowerCase() === 'elemental empowerment' &&
      event.resolvedAudience?.includesSelf &&
      event.elementalEmpowermentTracked !== true
    ) {
      return {
        at: Math.max(context.state.time, event.at),
        payload: {
          applicationAt: event.at,
          duration: Number(event.duration || 0),
          stacks: Number(event.stacks || 1)
        }
      };
    }

    return null;
  },
  execute(context, _at, payload) {
    grantCatalystElementalEmpowerment(
      catalystState.from(context),
      payload.applicationAt,
      payload.duration,
      payload.stacks,
      maximumEmpowerment(context)
    );
  }
});

function applyElementalEpitomeAura(context: ElementalistSchedulerContext, event: SimulationEvent): boolean {
  // Elemental Epitome's other half: an aura gain also grants an empowerment stack.
  if (event.type === 'elementalist.aura' && hasTrait(context, 'Elemental Epitome')) {
    const empowerment = elementalEpitomeEmpowerment(context);
    if (!empowerment) return false;
    const source = String(event.skillName || event.source || 'Elemental Epitome');
    const sourceId = event.skillId ?? event.sourceId;
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at: event.at,
      source,
      sourceId,
      actorType: 'player',
      kind: 'elemental empowerment',
      schedulerPrediction: event.schedulerPrediction,
      ...empowerment,
      skillName: source
    });
    return true;
  }

  return false;
}

function applyEnergizedElements(context: ElementalistSchedulerContext, event: SimulationEvent): boolean {
  // Energized Elements refunds energy and grants fury on every attunement swap.
  if (event.type === 'elementalist.attunement' && hasTrait(context, 'Energized Elements')) {
    const state = catalystState.from(context);
    const before = state.energy;
    const energizedElementsProfile = requireBalanceProfileFromContext(context, PROFILE.energizedElements);
    const energyGain = balanceProfileNumber(energizedElementsProfile, 'resourceGain');
    state.energy = Math.min(maximumEnergy(context), state.energy + energyGain);
    const fury = requireEffect(energizedElementsProfile, 'boon', 'Fury');
    if (fury) {
      emitSkillBuff(context, elementalistEventSkill(context, 'Energized Elements', event.sourceId), {
        at: event.at,
        source: 'Energized Elements',
        sourceId: event.sourceId,
        actorType: 'player',
        kind: String(fury.boon).toLowerCase(),
        stacks: Number(fury.stacks),
        duration: Number(fury.duration),
        skillName: 'Energized Elements'
      });
    }

    if (state.energy !== before) {
      context.emitDerived(event, {
        type: 'resource',
        at: event.at,
        source: 'Energized Elements',
        sourceId: event.sourceId,
        actorType: 'player',
        skillName: 'Energized Elements',
        kind: 'catalyst-energy',
        value: state.energy,
        maximum: maximumEnergy(context),
        change: state.energy - before
      });
    }

    return true;
  }

  return false;
}

function applyCatalystComboTraits(context: ElementalistSchedulerContext, event: SimulationEvent): boolean {
  // Combo finishers drive Elemental Epitome's aura and Elemental Synergy's payout,
  // each on its own per-attunement internal cooldown.
  if (event.type === 'combo') {
    // Predicted combo payouts inform scheduling, then the resolver produces the
    // actual aura and boons. Keep every synchronous payout in the prediction.
    if (event.schedulerPrediction === 'combo-result') {
      const emit = context.emit;
      context = {
        ...context,
        emit: (output) => emit({ ...output, schedulerPrediction: event.schedulerPrediction })
      };
    }

    const state = catalystState.from(context);
    const core = professionCoreState(context);
    const attunement = String(event.attunement || core.primaryAttunement) as ElementalistAttunement;
    if (
      hasTrait(context, 'Elemental Epitome') &&
      tryConsumeProcCooldown(
        state.elementalEpitomeReadyAt,
        attunement,
        event.at,
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.elementalEpitome), 'internalCooldown')
      )
    ) {
      const aura = elementalEpitomeAura(context, attunement);
      if (aura)
        applyElementalistAura(context as never, {
          at: event.at,
          aura: aura.aura,
          duration: aura.duration,
          skillName: 'Elemental Epitome',
          sourceId: event.sourceId
        });
    }

    if (
      hasTrait(context, 'Elemental Synergy') &&
      tryConsumeProcCooldown(
        state.elementalSynergyReadyAt,
        attunement,
        event.at,
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.elementalSynergy), 'internalCooldown')
      )
    ) {
      if (attunement === 'Fire' || attunement === 'Earth') {
        const boon = elementalSynergyBoon(context, attunement);
        if (boon)
          emitSkillBuff(context, elementalistEventSkill(context, 'Elemental Synergy', event.sourceId), {
            at: event.at,
            source: 'Elemental Synergy',
            sourceId: event.sourceId,
            actorType: 'player',
            ...boon,
            skillName: 'Elemental Synergy'
          });
      } else if (attunement === 'Air') {
        Object.assign(
          core,
          grantEndurance(
            core,
            balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.elementalSynergy), 'resourceGain'),
            event.at,
            balanceProfileNumber(requireBalanceProfileFromContext(context, CORE_PROFILE.resources), 'maximumStacks')
          )
        );
      }
    }

    return true;
  }

  return false;
}

// Grants the Vicious Empowerment stacks for a control or immobilize proc, ignoring
// pre-combat events and honouring the shared internal cooldown.
const viciousEmpowermentReaction = scheduledReaction<
  ElementalistSchedulerContext,
  SimulationEvent,
  { readonly applicationAt: number }
>({
  id: 'elementalist.catalyst-vicious-empowerment',
  order: 0,
  select(context, event) {
    // Player control effects and immobilize feed Vicious Empowerment through a task so
    // the internal cooldown is evaluated in scheduler order.
    const immobilize =
      event.type === 'condition' && ['Immobilize', 'Immobilized'].includes(String(event.condition || ''));
    if (
      hasTrait(context, 'Vicious Empowerment') &&
      event.actorType === 'player' &&
      (event.type === 'control' || immobilize)
    ) {
      return {
        at: Math.max(context.state.time, event.at),
        payload: { applicationAt: event.at }
      };
    }

    return null;
  },
  execute(context, _at, payload) {
    const at = payload.applicationAt;
    if (context.combatStartTime != null && at < context.combatStartTime) return;
    const state = catalystState.from(context);
    if (!isInternalCooldownReady(at, state.viciousEmpowermentReadyAt)) return;
    const viciousEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.viciousEmpowerment);
    state.viciousEmpowermentReadyAt = at + balanceProfileNumber(viciousEmpowermentProfile, 'internalCooldown');
    const empowerment = requireEffect(viciousEmpowermentProfile, 'buff', 'Empowerment');
    if (empowerment) {
      grantCatalystElementalEmpowerment(
        state,
        at,
        Number(empowerment.duration),
        Number(empowerment.stacks),
        maximumEmpowerment(context)
      );
    }
  }
});

// Damaging hits restore energy, but an active Jade Sphere suppresses the gain unless
// Sphere Specialist is taken.
const catalystEnergyReaction = scheduledReaction<
  ElementalistSchedulerContext,
  SimulationEvent,
  { readonly sourceId: SimulationEvent['sourceId']; readonly skillName: string }
>({
  id: 'elementalist.catalyst-energy-hit',
  order: 0,
  select(_context, event) {
    // Anything left that is a damaging non-summon hit earns energy; the task is attributed
    // to the owning activation.
    if (event.type !== 'damage' || event.actorType === 'summon' || !(Number(event.coefficient) > 0)) {
      return null;
    }

    return {
      at: event.at,
      ownerId: String(event.activationId || event.sourceId || event.skillName),
      payload: {
        sourceId: event.skillId ?? event.sourceId,
        skillName: String(event.skillName || 'Catalyst Energy')
      }
    };
  },
  execute(context, taskAt, payload) {
    const state = catalystState.from(context);
    if (taskAt < state.sphereActiveUntil && !hasTrait(context, 'Sphere Specialist')) {
      return;
    }

    const before = state.energy;
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const energyGain = balanceProfileNumber(resourcesProfile, 'resourceGain');
    state.energy = Math.min(maximumEnergy(context), state.energy + energyGain);
    if (state.energy === before) return;
    context.emit({
      type: 'resource',
      at: taskAt,
      source: 'Catalyst Energy',
      sourceId: String(payload.sourceId || 'catalyst-energy'),
      actorType: 'player',
      skillName: String(payload.skillName || 'Catalyst Energy'),
      kind: 'catalyst-energy',
      value: state.energy,
      maximum: maximumEnergy(context),
      change: energyGain
    });
  }
});

// Consume the canonical event stream to update Catalyst energy and trait state,
// filtering packet ownership so multi-hit and generated effects do not double-proc.
function onEventScheduled(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  applyEmpoweringAuras(context, event);
  scheduleBaseElementalEmpowerment(context, event);
  if (externalEmpowermentReaction.onEventScheduled.handler(context, event)) return;
  if (applyElementalEpitomeAura(context, event)) return;
  if (applyEnergizedElements(context, event)) return;
  if (applyCatalystComboTraits(context, event)) return;
  viciousEmpowermentReaction.onEventScheduled.handler(context, event);
  catalystEnergyReaction.onEventScheduled.handler(context, event);
}

// Apply a scheduled base Elemental Empowerment stack with its original
// application timestamp and profile duration.
const baseEmpowerment = timedEffect<ElementalistSchedulerContext, { applicationAt: number }>({
  id: CATALYST_BASE_EMPOWERMENT_TASK,
  nextAt: (context, _at, captured) =>
    captured.applicationAt +
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.elementalEmpowerment), 'durationMultiplier'),
  effectsAt(context, taskAt, captured, occurrence) {
    const at = occurrence === 0 ? captured.applicationAt : taskAt;
    captured.applicationAt = at;
    const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, PROFILE.elementalEmpowerment);
    const duration = balanceProfileNumber(elementalEmpowermentProfile, 'durationMultiplier');
    const stacks = balanceProfileNumber(elementalEmpowermentProfile, 'playerStacks');
    grantCatalystElementalEmpowerment(catalystState.from(context), at, duration, stacks, maximumEmpowerment(context));
    emitSkillBuff(context, {
      at,
      source: 'Elemental Empowerment',
      sourceId: 'Elemental Empowerment',
      actorType: 'player',
      skillName: 'Elemental Empowerment',
      kind: 'elemental empowerment',
      stacks,
      duration,
      elementalEmpowermentTracked: true
    });
  }
});

/**
 * Cast-time Catalyst rules: the Jade Sphere availability gate and the Elemental
 * Enchantment recharge reduction applied to sphere cooldowns.
 */
export const catalystCastRules = Object.freeze({
  availability: {
    id: 'elementalist.catalyst-availability',
    order: 30,
    handler: availability
  },
  modifyRechargeDuration: (context: ElementalistPrecastContext, duration: number): number =>
    context.skill.skillFamily === 'Jade Sphere' && hasTrait(context, 'Elemental Enchantment')
      ? duration *
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, CORE_PROFILE.elementalEnchantment),
          'rechargeMultiplier'
        )
      : duration
});

/** Catalyst attribute contributions: the Elemental Empowerment bonus plus the trait damage modifiers. */
export const catalystAttributeRules = Object.freeze({
  modifyAttributes: modifyCatalystAttributes,
  modifierRules: catalystModifierRules
});

/**
 * Scheduler wiring for Catalyst: energy setup, sphere spend and Sphere Specialist
 * scaling around a cast, the event listener that drives energy and trait procs, and
 * the deferred task handlers those procs schedule.
 */
export const catalystSchedulerHooks = Object.freeze({
  initialize: {
    id: 'elementalist.catalyst-initialize',
    order: 30,
    handler: initialize
  },
  onCastStart: {
    id: 'elementalist.catalyst-spend',
    order: 30,
    handler: onCastStart
  },
  afterCast: {
    id: 'elementalist.catalyst-after-cast',
    order: 30,
    handler: afterCast
  },
  onEventScheduled: {
    id: 'elementalist.catalyst-gain',
    order: 30,
    handler: onEventScheduled
  },
  taskHandlers: Object.freeze({
    ...catalystEnergyReaction.taskHandlers,
    ...externalEmpowermentReaction.taskHandlers,
    ...baseEmpowerment.taskHandlers,
    ...viciousEmpowermentReaction.taskHandlers
  })
});
