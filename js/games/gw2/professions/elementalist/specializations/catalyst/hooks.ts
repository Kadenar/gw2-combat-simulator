import { applySideEffect, type ActionContext } from '#gw2/platform/simulation/side-effects.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import {
  applyCatalystEmpowerment,
  applyCatalystComboTraits,
  applyCatalystResolverAura,
  applyCatalystResolvedDamage,
  applyViciousEmpowerment
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
/**
 * Catalyst hooks.
 *
 * Owns Jade Sphere energy (spent on deployment, regained from damaging hits), the
 * per-attunement sphere windows and their Spectacular Sphere / Sphere Specialist
 * payouts, Elemental Empowerment stack bookkeeping and the attribute bonus it
 * grants, the augment mechanic handlers, and actual cast trait procs.
 *
 * Accepted-impact handlers live in `mechanics/reactions.ts`.
 */
import { denyCast } from '#gw2/platform/engine/skills/availability.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';

import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

const CATALYST_BASE_EMPOWERMENT_TASK = 'elementalist.catalyst-base-empowerment';

function maximumEnergy(context: unknown): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return balanceProfileNumber(resourcesProfile, 'maximumStacks');
}

// Adopt the balance-profile energy cap before the fight and clamp any seeded energy to it.
function initialize(context: ElementalistRuntime): void {
  registerElementalistEliteEvents(context, (runtime, event) => {
    applyEnergizedElements(runtime, event);
  });
  const state = catalystState.from(context);
  state.maximumEnergy = maximumEnergy(context);
  state.energy = Math.max(
    0,
    Math.min(state.maximumEnergy, context.config.initialCatalystEnergy ?? state.maximumEnergy)
  );
}

// Jade Sphere deployment requires the matching attunement and the profile energy
// cost; every other skill passes through untouched.
function availability(context: ElementalistRuntime, skill: Skill): AvailabilityResult {
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
function deployJadeSphere(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = catalystState.from(context);
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const sphereCost = balanceProfileNumber(resourcesProfile, 'resourceCost');
  state.energy = Math.max(0, state.energy - sphereCost);
  // The sphere field owns its active window; removing it leaves the energy cost intact.
  const field = skill.comboFields?.find((entry) => entry.ownerId === 'elementalist');
  if (field) {
    const duration = requireBalanceNumber(field.duration, `skill=${skill.id} combo-field duration`);
    state.sphereActiveUntil = Math.max(state.sphereActiveUntil, cast.effectiveEnd + duration);
    state.sphereExpiry[String(skill.attunement)] = cast.effectiveEnd + duration;
  }

  context.emit({
    type: 'resource',
    at: cast.start,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    kind: 'catalyst-energy',
    value: state.energy,
    maximum: maximumEnergy(context),
    change: -sphereCost
  });
}

/** Sphere traits observe the deployment after its intrinsic start action and before ordinary packet emission. */
function applySphereStartTraits(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  // Spectacular Sphere pays party quickness plus the attunement's boon on deployment.
  // Both are stretched by Sphere Specialist here and flagged so afterCast does not
  // scale them a second time.
  if (hasTrait(context, TRAIT.SPECTACULAR_SPHERE)) {
    const durationMultiplier = hasTrait(context, TRAIT.SPHERE_SPECIALIST)
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.sphereSpecialist), 'durationMultiplier')
      : 1;
    const spectacularSphereProfile = requireBalanceProfileFromContext(context, PROFILE.spectacularSphere);
    const quickness = requireEffect(spectacularSphereProfile, 'boon', 'Quickness');
    if (quickness) {
      emitElementalistBuff(context, {
        at: cast.start,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        kind: String(quickness.boon).toLowerCase(),
        stacks: Number(quickness.stacks),
        duration: quickness.duration * durationMultiplier,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      });
    }

    const profiledBoon = requireEffect(spectacularSphereProfile, 'boon', String(skill.attunement));
    if (profiledBoon) {
      emitElementalistBuff(context, {
        at: cast.start,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        kind: String(profiledBoon.boon),
        stacks: Number(profiledBoon.stacks),
        duration: profiledBoon.duration * durationMultiplier,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      });
    }
  }
}

// Reset weapon cooldowns matching Catalyst's single active attunement while
// preserving exclusions and active ammo-recharge contracts.
function activateElementalCelerity(context: ElementalistRuntime, actionContext: ActionContext): void {
  const core = professionCoreState(context);
  for (const candidate of context.helpers.skills) {
    if (
      candidate.type === 'Weapon' &&
      (candidate.cooldown || 0) > 0 &&
      candidate.attunement === core.primaryAttunement
    ) {
      if (Number(candidate.ammo) > 0)
        applySideEffect(context, actionContext, {
          type: 'ammoRestore',
          skillIds: [candidate.id],
          count: Number(candidate.ammo)
        });
      else applySideEffect(context, actionContext, { type: 'rechargeReset', skillIds: [candidate.id] });
    }
  }
}

function applyEnergizedElements(context: ElementalistRuntime, event: SimulationEvent): boolean {
  // Energized Elements refunds energy and grants fury on every attunement swap.
  if (event.type === 'elementalist.attunement' && hasTrait(context, TRAIT.ENERGIZED_ELEMENTS)) {
    const state = catalystState.from(context);
    const before = state.energy;
    const energizedElementsProfile = requireBalanceProfileFromContext(context, PROFILE.energizedElements);
    const energyGain = balanceProfileNumber(energizedElementsProfile, 'resourceGain');
    state.energy = Math.min(maximumEnergy(context), state.energy + energyGain);
    const fury = requireEffect(energizedElementsProfile, 'boon', 'Fury');
    if (fury) {
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, 'Energized Elements', event.sourceId),
        at: event.at,
        source: 'Energized Elements',
        sourceId: event.sourceId,
        actorType: 'player',
        kind: String(fury.boon).toLowerCase(),
        stacks: Number(fury.stacks),
        duration: fury.duration,
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

/** Baseline stacks are granted by actual buff application; one task renews their profile window. */
function renewBaseEmpowerment(runtime: ElementalistRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.elementalEmpowerment);
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // Recurring work must advance the canonical clock, including sub-microsecond profile overrides.
  const renewAt = canonicalTime(runtime.time + duration);
  if (renewAt <= runtime.time) throw new RangeError('Elemental Empowerment renewal must advance the simulation clock.');
  emitElementalistBuff(runtime, {
    at: runtime.time,
    source: 'Elemental Empowerment',
    sourceId: 'Elemental Empowerment',
    actorType: 'player',
    skillName: 'Elemental Empowerment',
    kind: 'elemental empowerment',
    stacks: balanceProfileNumber(profile, 'playerStacks'),
    duration
  });
  runtime.schedule(CATALYST_BASE_EMPOWERMENT_TASK, renewAt, null);
}

/** Only accepted non-summon strikes grant energy, using the sphere window at impact. */
function gainEnergy(runtime: ElementalistRuntime, event: SimulationEvent): void {
  const state = catalystState.from(runtime);
  if (
    event.actorType === 'summon' ||
    !(Number(event.coefficient) > 0) ||
    (runtime.time < state.sphereActiveUntil && !hasTrait(runtime, TRAIT.SPHERE_SPECIALIST))
  )
    return;
  const before = state.energy;
  state.energy = Math.min(
    maximumEnergy(runtime),
    before + balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'resourceGain')
  );
  if (state.energy !== before)
    runtime.emitDerived(event, {
      type: 'resource',
      at: runtime.time,
      source: 'Catalyst Energy',
      sourceId: event.sourceId,
      actorType: 'player',
      skillName: event.skillName,
      kind: 'catalyst-energy',
      value: state.energy,
      maximum: maximumEnergy(runtime),
      change: state.energy - before
    });
}

/** Sphere spending, weapon refreshes, and accepted-hit traits operate on the same live state. */
export const catalystHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
  initialize,
  availability,
  sideEffectHandlers: {
    'elementalist.catalyst.deploy-sphere'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Jade Sphere requires a cast trigger.');
      deployJadeSphere(runtime, context.cast, context.skill);
    },
    'elementalist.catalyst.refresh-weapons': activateElementalCelerity,
    // A sphere can deploy during an augment's cast; select and emit its authored window only on commitment.
    'elementalist.catalyst.augment-window'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Catalyst augment windows require a cast trigger.');
      const { skill, cast } = context;
      emitEffects(runtime, {
        owner: skill,
        effects: (skill.effects ?? []).filter((effect) => !effect.when || effect.when(runtime, cast)),
        baseEvent: {
          source: 'elementalist',
          sourceId: skill.id,
          actorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          activationId: cast.id
        },
        transform: (event) => ({ ...event, offTarget: cast.command.offTarget })
      });
    }
  },
  // Sphere recharge uses the selected Core trait profile.
  rechargeRules: [
    {
      trait: TRAIT.ELEMENTAL_ENCHANTMENT,
      when: (_runtime, skill) => skill.skillFamily === 'Jade Sphere',
      multiplier: { profile: CORE_PROFILE.elementalEnchantment, field: 'rechargeMultiplier' }
    }
  ],
  onCombatStart(runtime) {
    const state = catalystState.from(runtime);
    if (!hasTrait(runtime, TRAIT.ELEMENTAL_EMPOWERMENT) || state.elementalEmpowermentRefreshStarted) return;
    state.elementalEmpowermentRefreshStarted = true;
    renewBaseEmpowerment(runtime);
  },
  modifyEffects(runtime, cast, effects) {
    // The commit action owns augment emission so cast-start materialization cannot freeze the sphere choice.
    if (cast.skill.sideEffects?.some((effect) => effect.do.type === 'elementalist.catalyst.augment-window')) return [];
    if (cast.skill.skillFamily !== 'Jade Sphere') return effects;
    withElementalistCast(runtime, cast, () => applySphereStartTraits(runtime, cast, cast.skill));
    if (!hasTrait(runtime, TRAIT.SPHERE_SPECIALIST)) return effects;
    const multiplier = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.sphereSpecialist),
      'durationMultiplier'
    );
    return effects.map((effect) =>
      effect.type === 'boon' || effect.type === 'buff' ? { ...effect, duration: effect.duration * multiplier } : effect
    );
  },
  tasks: {
    [CATALYST_BASE_EMPOWERMENT_TASK]: renewBaseEmpowerment
  },

  reactions: {
    'damage.resolved'(runtime, event) {
      gainEnergy(runtime, event);
      applyCatalystResolvedDamage(runtime, event);
    },
    'buff.applied': applyCatalystEmpowerment,
    'aura.applied': applyCatalystResolverAura,
    'control.resolved': applyViciousEmpowerment,
    'condition.applied': applyViciousEmpowerment,
    'combo.resolved': applyCatalystComboTraits
  }
};
/** Attribute reads count the currently active timed stacks. */
