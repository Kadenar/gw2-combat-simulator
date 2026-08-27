import { emitSkillBuff } from '../../../../platform/gw2/scheduler/skill-events.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import type {
  AvailabilityResult,
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  Skill
} from '../../../../platform/engine/types.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import type { Gw2ModifierContext } from '../../../../platform/gw2/combat/modifiers/types.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '../../../../platform/gw2/scheduler/policy.js';
import { applyElementalistAura } from '../../core/rules.js';
import { elementalistEventSkill } from '../../core/mechanics.js';
import type { ElementalistAttunement } from '../../core/state.js';
import type { CatalystEmpowermentPool } from '../../types.js';
import type { ElementalistCastContext, ElementalistPrecastContext, ElementalistSchedulerContext } from '../../types.js';
import {
  CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS,
  CATALYST_MAXIMUM_ENERGY,
  catalystState,
  grantCatalystElementalEmpowerment
} from './state.js';
import { catalystModifierRules } from './modifiers.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue
} from '../../core/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

const SPHERE_COST = 10;
const SPHERE_SPECIALIST_DURATION_MULTIPLIER = 1.5;
const SPECTACULAR_SPHERE_QUICKNESS_DURATION = 2;
const CATALYST_ENERGY_HIT_TASK = 'elementalist.catalyst-energy-hit';
const CATALYST_EMPOWERMENT_TASK = 'elementalist.catalyst-empowerment';
const CATALYST_BASE_EMPOWERMENT_TASK = 'elementalist.catalyst-base-empowerment';
const CATALYST_VICIOUS_EMPOWERMENT_TASK = 'elementalist.catalyst-vicious-empowerment';
const CATALYST_BASE_EMPOWERMENT_STACKS = 3;
const CATALYST_BASE_EMPOWERMENT_DURATION = 15;

function maximumEnergy(context: unknown): number {
  return elementalistBalanceValue(context, PROFILE.resources, 'maximumStacks', CATALYST_MAXIMUM_ENERGY);
}

function maximumEmpowerment(context: unknown): number {
  return elementalistBalanceValue(
    context,
    PROFILE.elementalEmpowerment,
    'maximumStacks',
    CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS
  );
}

function initialize(context: ElementalistSchedulerContext): void {
  const state = catalystState.from(context);
  state.maximumEnergy = maximumEnergy(context);
  state.energy = Math.min(state.maximumEnergy, state.energy);
}

function catalystModifierState(context: Gw2ModifierContext): CatalystStateLike {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: CatalystStateLike;
        };
      }
    | undefined;
  return profession?.specialization?.kind === 'Catalyst' ? profession.specialization.state || {} : {};
}

interface CatalystStateLike {
  readonly elementalEmpowermentExpiries?: readonly number[];
}

// Apply live Elemental Empowerment stacks as an all-attribute multiplier without
// mutating the shared resolved-stat object.
function modifyCatalystAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  if (!hasTrait(context, 'Elemental Empowerment')) return attributes;

  const timedStacks = (catalystModifierState(context).elementalEmpowermentExpiries || []).filter(
    (expiresAt) => expiresAt > context.time
  ).length;
  const maximumStacks = elementalistBalanceValue(
    context,
    PROFILE.elementalEmpowerment,
    'maximumStacks',
    CATALYST_MAXIMUM_ELEMENTAL_EMPOWERMENT_STACKS
  );
  const stacks = Math.min(maximumStacks, timedStacks);
  const multiplier = hasTrait(context, 'Empowered Empowerment')
    ? stacks === maximumStacks
      ? elementalistBalanceValue(context, PROFILE.elementalEmpowerment, 'attributeConversion', 0.2)
      : stacks * elementalistBalanceValue(context, PROFILE.elementalEmpowerment, 'coefficientMultiplier', 0.015)
    : stacks * elementalistBalanceValue(context, PROFILE.elementalEmpowerment, 'attributePerStack', 0.01);
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

function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
  if (skill.skillFamily !== 'Jade Sphere') return { ready: true };
  const state = catalystState.from(context);
  const core = professionCoreState(context);
  if (skill.attunement !== core.primaryAttunement) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.catalyst-attunement',
      reason: `${skill.name} is unavailable - requires ${String(skill.attunement)} attunement.`
    };
  }

  const sphereCost = elementalistBalanceValue(context, PROFILE.resources, 'resourceCost', SPHERE_COST);
  return state.energy >= sphereCost
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: 'elementalist.catalyst-energy',
        reason: `${skill.name} is unavailable - requires ${sphereCost} energy.`
      };
}

// Spend sphere energy and schedule its attunement-specific field, pulses, and
// boons from cast start so later attunement swaps cannot change the sphere.
function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (skill.skillFamily !== 'Jade Sphere') return;
  const state = catalystState.from(context);
  const sphereCost = elementalistBalanceValue(context, PROFILE.resources, 'resourceCost', SPHERE_COST);
  state.energy = Math.max(0, state.energy - sphereCost);
  const duration = Math.max(
    0,
    Number(skill.comboFields?.find((field) => field.ownerId === 'elementalist')?.duration || 5)
  );
  state.sphereActiveUntil = Math.max(state.sphereActiveUntil, context.effectiveEnd + duration);
  state.sphereExpiry[String(skill.attunement)] = context.effectiveEnd + duration;
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
  if (hasTrait(context, 'Spectacular Sphere')) {
    const durationMultiplier = hasTrait(context, 'Sphere Specialist')
      ? elementalistBalanceValue(
          context,
          PROFILE.sphereSpecialist,
          'durationMultiplier',
          SPHERE_SPECIALIST_DURATION_MULTIPLIER
        )
      : 1;
    const quickness = elementalistBalanceEffect(context, PROFILE.spectacularSphere, 'boon', 'Quickness');
    emitSkillBuff(context, {
      at: context.start,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      kind: 'quickness',
      stacks: Number(quickness?.stacks ?? 1),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        'quickness',
        Number(quickness?.duration ?? SPECTACULAR_SPHERE_QUICKNESS_DURATION) * durationMultiplier
      ),
      recipients: 'party',
      maximumRecipients: 5,
      sphereSpecialistScaled: true
    });
    const boon =
      skill.attunement === 'Fire'
        ? (['Fire', 'might', 5, 10] as const)
        : skill.attunement === 'Water'
          ? (['Water', 'vigor', 1, 5] as const)
          : skill.attunement === 'Air'
            ? (['Air', 'fury', 1, 5] as const)
            : (['Earth', 'aegis', 1, 3] as const);
    const profiledBoon = elementalistBalanceEffect(context, PROFILE.spectacularSphere, 'boon', boon[0]);
    emitSkillBuff(context, {
      at: context.start,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      kind: String(profiledBoon?.boon || boon[1]),
      stacks: Number(profiledBoon?.stacks ?? boon[2]),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        String(profiledBoon?.boon || boon[1]),
        Number(profiledBoon?.duration ?? boon[3]) * durationMultiplier
      ),
      recipients: 'party',
      maximumRecipients: 5,
      sphereSpecialistScaled: true
    });
  }
}

// Extend the just-created Jade Sphere field for Sphere Specialist after its base
// cast has committed and the owned field can be identified safely.
function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (skill.skillFamily !== 'Jade Sphere' || !hasTrait(context, 'Sphere Specialist')) {
    return;
  }

  for (const event of context.events) {
    if (
      event.activationId === context.reservationId &&
      event.type === 'buff' &&
      event.sphereSpecialistScaled !== true
    ) {
      context.replaceEvent(event, {
        duration:
          Number(event.duration || 0) *
          elementalistBalanceValue(
            context,
            PROFILE.sphereSpecialist,
            'durationMultiplier',
            SPHERE_SPECIALIST_DURATION_MULTIPLIER
          )
      });
    }
  }
}

function activateRelentlessFire(context: ElementalistSchedulerContext, skill: Skill, at: number): void {
  const state = catalystState.from(context);
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
        ? elementalistBalanceValue(context, PROFILE.relentlessFire, 'durationPerTier', 8)
        : elementalistBalanceValue(context, PROFILE.relentlessFire, 'durationMultiplier', 5)
  });
}

function activateShatteringIce(context: ElementalistSchedulerContext, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const duration =
    state.sphereExpiry.Water > at
      ? elementalistBalanceValue(context, PROFILE.shatteringIce, 'durationPerTier', 8)
      : elementalistBalanceValue(context, PROFILE.shatteringIce, 'durationMultiplier', 5);
  state.shatteringIceUntil = at + duration;
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

// Reset attunement-matching weapon cooldowns for Elemental Celerity while
// preserving exclusions and active ammo-recharge contracts.
function activateElementalCelerity(context: ElementalistSchedulerContext, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const core = professionCoreState(context);
  for (const candidate of context.catalog.skills) {
    if (
      candidate.type === 'Weapon' &&
      Number(candidate.cooldown || 0) > 0 &&
      String(candidate.attunement || '')
        .split('+')
        .includes(core.primaryAttunement)
    ) {
      context.state.cooldowns.set(candidate.id, at);
    }
  }

  const boons: readonly (readonly [ElementalistAttunement, string, number, number])[] = [
    ['Fire', 'might', 5, 6],
    ['Water', 'vigor', 1, 6],
    ['Air', 'fury', 1, 6],
    ['Earth', 'protection', 1, 4]
  ];
  for (const [element, kind, stacks, duration] of boons) {
    if (state.sphereExpiry[element] <= at) continue;
    const effect = elementalistBalanceEffect(context, PROFILE.elementalCelerity, 'boon', element);
    emitSkillBuff(context, skill, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(effect?.boon || kind).toLowerCase(),
      stacks: Number(effect?.stacks ?? stacks),
      duration: Number(effect?.duration ?? duration),
      skillName: skill.name
    });
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

// Consume the canonical event stream to update Catalyst energy and trait state,
// filtering packet ownership so multi-hit and generated effects do not double-proc.
function onEventScheduled(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const state = catalystState.from(context);
  const core = professionCoreState(context);
  if (event.type === 'elementalist.aura' && hasTrait(context, 'Empowering Auras')) {
    const duration = elementalistBalanceValue(context, PROFILE.empoweringAuras, 'durationMultiplier', 10);
    const source = String(event.skillName || event.source || 'Aura');
    const sourceId = event.skillId ?? event.sourceId;
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at: event.at,
      source,
      sourceId,
      actorType: 'player',
      kind: 'empowering auras',
      stacks: 1,
      duration,
      skillName: source
    });
  }

  const implicitCombatEvent =
    !context.hasExplicitCombatStart &&
    ['player', 'summon'].includes(String(event.actorType || '')) &&
    ['damage', 'condition', 'control', 'blind'].includes(event.type);
  const startsCombat = event.type === 'combat_start' || implicitCombatEvent;
  if (startsCombat && hasTrait(context, 'Elemental Empowerment') && !state.elementalEmpowermentRefreshStarted) {
    state.elementalEmpowermentRefreshStarted = true;
    context.tasks.schedule({
      type: CATALYST_BASE_EMPOWERMENT_TASK,
      at: Math.max(context.state.time, event.at),
      payload: { applicationAt: event.at }
    });
  }

  if (
    event.type === 'buff' &&
    String(event.kind || '').toLowerCase() === 'elemental empowerment' &&
    event.affectsSelf !== false &&
    event.elementalEmpowermentTracked !== true
  ) {
    context.tasks.schedule({
      type: CATALYST_EMPOWERMENT_TASK,
      at: Math.max(context.state.time, event.at),
      payload: {
        applicationAt: event.at,
        duration: Number(event.duration || 0),
        stacks: Number(event.stacks || 1)
      }
    });
    return;
  }

  if (event.type === 'elementalist.aura' && hasTrait(context, 'Elemental Epitome')) {
    const empowerment = elementalistBalanceEffect(context, PROFILE.elementalEpitome, 'buff', 'Empowerment');
    const source = String(event.skillName || event.source || 'Elemental Epitome');
    const sourceId = event.skillId ?? event.sourceId;
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at: event.at,
      source,
      sourceId,
      actorType: 'player',
      kind: 'elemental empowerment',
      stacks: Number(empowerment?.stacks ?? 1),
      duration: Number(empowerment?.duration ?? 15),
      skillName: source
    });
    return;
  }

  if (event.type === 'elementalist.attunement' && hasTrait(context, 'Energized Elements')) {
    const before = state.energy;
    const energyGain = elementalistBalanceValue(context, PROFILE.energizedElements, 'resourceGain', 2);
    state.energy = Math.min(maximumEnergy(context), state.energy + energyGain);
    const fury = elementalistBalanceEffect(context, PROFILE.energizedElements, 'boon', 'Fury');
    emitSkillBuff(context, elementalistEventSkill(context, 'Energized Elements', event.sourceId), {
      at: event.at,
      source: 'Energized Elements',
      sourceId: event.sourceId,
      actorType: 'player',
      kind: String(fury?.boon || 'Fury').toLowerCase(),
      stacks: Number(fury?.stacks ?? 1),
      duration: Number(fury?.duration ?? 2),
      skillName: 'Energized Elements'
    });
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

    return;
  }

  if (event.type === 'combo') {
    const attunement = String(event.attunement || core.primaryAttunement) as ElementalistAttunement;
    if (
      hasTrait(context, 'Elemental Epitome') &&
      isInternalCooldownReady(event.at, Number(state.elementalEpitomeReadyAt[attunement] || 0))
    ) {
      state.elementalEpitomeReadyAt[attunement] =
        event.at + elementalistBalanceValue(context, PROFILE.elementalEpitome, 'internalCooldown', 10);
      const aura =
        attunement === 'Fire'
          ? (['Fire Aura', 4] as const)
          : attunement === 'Water'
            ? (['Frost Aura', 4] as const)
            : attunement === 'Air'
              ? (['Shocking Aura', 3] as const)
              : (['Magnetic Aura', 3] as const);
      const profiledAura = elementalistBalanceEffect(context, PROFILE.elementalEpitome, 'buff', attunement);
      applyElementalistAura(context as never, {
        at: event.at,
        aura: String(profiledAura?.kind || aura[0]),
        duration: Number(profiledAura?.duration ?? aura[1]),
        skillName: 'Elemental Epitome',
        sourceId: event.sourceId
      });
    }

    if (
      hasTrait(context, 'Elemental Synergy') &&
      isInternalCooldownReady(event.at, Number(state.elementalSynergyReadyAt[attunement] || 0))
    ) {
      state.elementalSynergyReadyAt[attunement] =
        event.at + elementalistBalanceValue(context, PROFILE.elementalSynergy, 'internalCooldown', 10);
      if (attunement === 'Fire' || attunement === 'Earth') {
        const effect = elementalistBalanceEffect(context, PROFILE.elementalSynergy, 'boon', attunement);
        emitSkillBuff(context, elementalistEventSkill(context, 'Elemental Synergy', event.sourceId), {
          at: event.at,
          source: 'Elemental Synergy',
          sourceId: event.sourceId,
          actorType: 'player',
          kind: String(effect?.boon || (attunement === 'Fire' ? 'Might' : 'Stability')).toLowerCase(),
          stacks: Number(effect?.stacks ?? (attunement === 'Fire' ? 6 : 2)),
          duration: Number(effect?.duration ?? (attunement === 'Fire' ? 10 : 6)),
          skillName: 'Elemental Synergy'
        });
      } else if (attunement === 'Air') {
        core.endurance = Math.min(
          elementalistBalanceValue(context, CORE_PROFILE.resources, 'maximumStacks', 100),
          core.endurance + elementalistBalanceValue(context, PROFILE.elementalSynergy, 'resourceGain', 50)
        );
      }
    }

    return;
  }

  const immobilize =
    event.type === 'condition' && ['Immobilize', 'Immobilized'].includes(String(event.condition || ''));
  if (
    hasTrait(context, 'Vicious Empowerment') &&
    event.actorType === 'player' &&
    (event.type === 'control' || immobilize)
  ) {
    context.tasks.schedule({
      type: CATALYST_VICIOUS_EMPOWERMENT_TASK,
      at: Math.max(context.state.time, event.at),
      payload: { applicationAt: event.at }
    });
  }

  if (event.type !== 'damage' || event.actorType === 'summon' || !(Number(event.coefficient) > 0)) {
    return;
  }

  context.tasks.schedule({
    type: CATALYST_ENERGY_HIT_TASK,
    at: event.at,
    ownerId: String(event.activationId || event.sourceId || event.skillName),
    payload: {
      sourceId: event.skillId ?? event.sourceId,
      skillName: String(event.skillName || 'Catalyst Energy')
    }
  });
}

function handleCatalystEnergyHit(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const state = catalystState.from(context);
  if (task.at < state.sphereActiveUntil && !hasTrait(context, 'Sphere Specialist')) {
    return;
  }

  const before = state.energy;
  const energyGain = elementalistBalanceValue(context, PROFILE.resources, 'resourceGain', 1);
  state.energy = Math.min(maximumEnergy(context), state.energy + energyGain);
  if (state.energy === before) return;
  context.emit({
    type: 'resource',
    at: task.at,
    source: 'Catalyst Energy',
    sourceId: String(task.payload?.sourceId || 'catalyst-energy'),
    actorType: 'player',
    skillName: String(task.payload?.skillName || 'Catalyst Energy'),
    kind: 'catalyst-energy',
    value: state.energy,
    maximum: maximumEnergy(context),
    change: energyGain
  });
}

function handleCatalystEmpowerment(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  grantCatalystElementalEmpowerment(
    catalystState.from(context),
    Number(task.payload?.applicationAt ?? task.at),
    Number(task.payload?.duration || 0),
    Number(task.payload?.stacks || 1),
    context.epsilon,
    maximumEmpowerment(context)
  );
}

// Apply a scheduled base Elemental Empowerment stack with its original
// application timestamp and profile duration.
function handleBaseEmpowerment(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const at = Number(task.payload?.applicationAt ?? task.at);
  const duration = elementalistBalanceValue(
    context,
    PROFILE.elementalEmpowerment,
    'durationMultiplier',
    CATALYST_BASE_EMPOWERMENT_DURATION
  );
  const stacks = elementalistBalanceValue(
    context,
    PROFILE.elementalEmpowerment,
    'playerStacks',
    CATALYST_BASE_EMPOWERMENT_STACKS
  );
  grantCatalystElementalEmpowerment(
    catalystState.from(context),
    at,
    duration,
    stacks,
    context.epsilon,
    maximumEmpowerment(context)
  );
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
  context.tasks.schedule({
    type: CATALYST_BASE_EMPOWERMENT_TASK,
    at: at + duration,
    payload: {
      applicationAt: at + duration
    }
  });
}

function handleViciousEmpowerment(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const at = Number(task.payload?.applicationAt ?? task.at);
  if (context.combatStartTime != null && at < context.combatStartTime) return;
  const state = catalystState.from(context);
  if (!isInternalCooldownReady(at, state.viciousEmpowermentReadyAt)) return;
  state.viciousEmpowermentReadyAt =
    at + elementalistBalanceValue(context, PROFILE.viciousEmpowerment, 'internalCooldown', 0.25);
  const empowerment = elementalistBalanceEffect(context, PROFILE.viciousEmpowerment, 'buff', 'Empowerment');
  grantCatalystElementalEmpowerment(
    state,
    at,
    Number(empowerment?.duration ?? 15),
    Number(empowerment?.stacks ?? 2),
    context.epsilon,
    maximumEmpowerment(context)
  );
}

export const catalystCastRules = Object.freeze({
  availability: {
    id: 'elementalist.catalyst-availability',
    order: 30,
    handler: availability
  },
  modifyRechargeDuration: (context: ElementalistPrecastContext, duration: number): number =>
    context.skill.skillFamily === 'Jade Sphere' && hasTrait(context, 'Elemental Enchantment')
      ? duration * elementalistBalanceValue(context, CORE_PROFILE.elementalEnchantment, 'rechargeMultiplier', 0.85)
      : duration
});

export const catalystAttributeRules = Object.freeze({
  modifyAttributes: modifyCatalystAttributes,
  modifierRules: catalystModifierRules
});

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
    [CATALYST_ENERGY_HIT_TASK]: handleCatalystEnergyHit,
    [CATALYST_EMPOWERMENT_TASK]: handleCatalystEmpowerment,
    [CATALYST_BASE_EMPOWERMENT_TASK]: handleBaseEmpowerment,
    [CATALYST_VICIOUS_EMPOWERMENT_TASK]: handleViciousEmpowerment
  })
});
