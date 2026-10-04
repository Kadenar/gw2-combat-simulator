import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { type ActionContext } from '#gw2/platform/effects/actions.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import {
  applyCatalystResolvedDamage,
  applyShatteringIce
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import {
  applyEnergizedElements,
  applySphereSpecialistDurations,
  applySphereStartTraits,
  sphereSpecialistAllowsEnergy
} from '#gw2/professions/elementalist/specializations/catalyst/traits/spheres.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Owns sphere execution and energy accounting; trait owners run at their original mechanic boundaries. */
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { denyCast } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
function maximumEnergy(context: unknown): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return balanceProfileNumber(resourcesProfile, 'maximumStacks');
}

// Adopt the balance-profile energy cap before the fight and clamp any seeded energy to it.
function initialize(context: ElementalistRuntime, emissionCast?: EffectDelivery['cast']): void {
  registerElementalistEliteEvents(context, (runtime, event) => {
    applyEnergizedElements(runtime, event, emissionCast);
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
function availability(context: MechanicQueriesOf<ElementalistRuntime>, skill: Skill): AvailabilityResult {
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
function deployJadeSphere(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
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

  context.effects.emit({
    kind: 'packet',
    event: {
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
    }
  });
}

// Reset weapon cooldowns matching Catalyst's single active attunement while
// preserving exclusions and active ammo-recharge contracts.
function activateElementalCelerity(
  context: ElementalistRuntime,
  actionContext: ActionContext<ElementalistSkill>
): void {
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

/** Only accepted non-summon strikes grant energy, using the sphere window at impact. */
function gainEnergy(runtime: ElementalistRuntime, event: SimulationEvent): void {
  const state = catalystState.from(runtime);
  if (
    event.actorType === 'summon' ||
    !(Number(event.coefficient) > 0) ||
    (runtime.time < state.sphereActiveUntil && !sphereSpecialistAllowsEnergy(runtime))
  )
    return;
  const before = state.energy;
  state.energy = Math.min(
    maximumEnergy(runtime),
    before + balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'resourceGain')
  );
  if (state.energy !== before)
    runtime.effects.emit({
      kind: 'packet',
      cause: event,
      event: {
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
      }
    });
}

/** Sphere spending, weapon refreshes, and accepted-hit traits operate on the same live state. */
export const catalystHooks: Partial<RuntimeProfession<ElementalistRuntimeState, ElementalistSkill>> = {
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
      runtime.effects.emit({
        kind: 'profile',
        profile: skill,
        effects: (skill.effects ?? []).filter((effect) => !effect.when || effect.when(runtime, cast)),
        attribution: {
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
  modifyEffects(runtime, cast, effects) {
    // The commit action owns augment emission so cast-start materialization cannot freeze the sphere choice.
    if (cast.skill.sideEffects?.some((effect) => effect.do.type === 'elementalist.catalyst.augment-window')) return [];
    if (cast.skill.skillFamily !== 'Jade Sphere') return effects;
    applySphereStartTraits(runtime, cast, cast.skill);
    return applySphereSpecialistDurations(runtime, effects);
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      gainEnergy(runtime, event);
      applyCatalystResolvedDamage(runtime, event);
    },
    'buff.applied': applyShatteringIce
  }
};
