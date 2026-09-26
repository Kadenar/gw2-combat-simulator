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
    Math.min(state.maximumEnergy, Number(context.config.initialCatalystEnergy ?? state.maximumEnergy))
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
function onCastStart(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (skill.skillFamily !== 'Jade Sphere') return;
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
      emitElementalistBuff(context, {
        at: cast.start,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        kind: String(quickness.boon).toLowerCase(),
        stacks: Number(quickness.stacks),
        duration: Number(quickness.duration) * durationMultiplier,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        sphereSpecialistScaled: true
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
        duration: Number(profiledBoon.duration) * durationMultiplier,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        sphereSpecialistScaled: true
      });
    }
  }
}

// Relentless Fire's damage window is the longer profile duration while the Fire
// Jade Sphere is still active, and the shorter one otherwise.
function activateRelentlessFire(context: ElementalistRuntime, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const relentlessFireProfile = requireBalanceProfileFromContext(context, PROFILE.relentlessFire);
  emitElementalistBuff(context, {
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
function activateShatteringIce(context: ElementalistRuntime, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const shatteringIceProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringIce);
  const duration =
    state.sphereExpiry.Water > at
      ? balanceProfileNumber(shatteringIceProfile, 'durationPerTier')
      : balanceProfileNumber(shatteringIceProfile, 'durationMultiplier');
  // Scheduler and resolver use the emitted buff's tick-aligned expiry.

  // Refreshing the buff rearms its first strike; subsequent strikes use the canonical strict ICD.

  emitElementalistBuff(context, {
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
function activateElementalCelerity(context: ElementalistRuntime, skill: Skill, at: number): void {
  const state = catalystState.from(context);
  const core = professionCoreState(context);
  for (const candidate of context.helpers.skills) {
    if (
      candidate.type === 'Weapon' &&
      Number(candidate.cooldown || 0) > 0 &&
      candidate.attunement === core.primaryAttunement
    ) {
      if (Number(candidate.ammo) > 0)
        context.cooldownController.restoreAmmo(candidate, Number(candidate.ammo), at, 'reset');
      else context.cooldownController.clear(candidate.id);
    }
  }

  // Each element contributes its boon only while that element's sphere is still active.
  for (const element of ['Fire', 'Water', 'Air', 'Earth'] as const) {
    if (state.sphereExpiry[element] <= at) continue;
    const elementalCelerityProfile = requireBalanceProfileFromContext(context, PROFILE.elementalCelerity);
    const effect = requireEffect(elementalCelerityProfile, 'boon', element);
    if (effect) {
      emitElementalistBuff(context, {
        skill: skill,
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

function applyEnergizedElements(context: ElementalistRuntime, event: SimulationEvent): boolean {
  // Energized Elements refunds energy and grants fury on every attunement swap.
  if (event.type === 'elementalist.attunement' && hasTrait(context, 'Energized Elements')) {
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

/** Baseline stacks are granted by actual buff application; one task renews their profile window. */
function renewBaseEmpowerment(runtime: ElementalistRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.elementalEmpowerment);
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
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
  runtime.schedule(CATALYST_BASE_EMPOWERMENT_TASK, runtime.time + duration, null);
}

/** Only accepted non-summon strikes grant energy, using the sphere window at impact. */
function gainEnergy(runtime: ElementalistRuntime, event: SimulationEvent): void {
  const state = catalystState.from(runtime);
  if (
    event.actorType === 'summon' ||
    !(Number(event.coefficient) > 0) ||
    (runtime.time < state.sphereActiveUntil && !hasTrait(runtime, 'Sphere Specialist'))
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

/** Sphere spending, augment tasks, and accepted-hit traits operate on the same live state. */
export const catalystHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
  initialize,
  availability,
  rechargeWork(runtime, skill, work) {
    return skill.skillFamily === 'Jade Sphere' && hasTrait(runtime, 'Elemental Enchantment')
      ? work *
          balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, CORE_PROFILE.elementalEnchantment),
            'rechargeMultiplier'
          )
      : work;
  },
  onCombatStart(runtime) {
    const state = catalystState.from(runtime);
    if (!hasTrait(runtime, 'Elemental Empowerment') || state.elementalEmpowermentRefreshStarted) return;
    state.elementalEmpowermentRefreshStarted = true;
    renewBaseEmpowerment(runtime);
  },
  onCastStart(runtime, cast) {
    withElementalistCast(runtime, cast, () => onCastStart(runtime, cast, cast.skill));
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.skillFamily !== 'Jade Sphere' || !hasTrait(runtime, 'Sphere Specialist')) return effects;
    const multiplier = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.sphereSpecialist),
      'durationMultiplier'
    );
    return effects.map((effect) =>
      effect.type === 'boon' || effect.type === 'buff'
        ? { ...effect, duration: Number(effect.duration) * multiplier }
        : effect
    );
  },
  tasks: {
    [CATALYST_BASE_EMPOWERMENT_TASK]: renewBaseEmpowerment,
    'elementalist.catalyst.relentless-fire'(runtime, data) {
      activateRelentlessFire(runtime, (data as RuntimeCast).skill, runtime.time);
    },
    'elementalist.catalyst.shattering-ice'(runtime, data) {
      activateShatteringIce(runtime, (data as RuntimeCast).skill, runtime.time);
    },
    'elementalist.catalyst.elemental-celerity'(runtime, data) {
      activateElementalCelerity(runtime, (data as RuntimeCast).skill, runtime.time);
    }
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
