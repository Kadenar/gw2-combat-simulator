import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import { type AvailabilityResult, denyCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { sphereDeployed } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/trigger-points.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { applySphereSpecialistDurations } from '#gw2/professions/elementalist/specializations/catalyst/traits/spheres.js';
import type {
  ElementalistRuntimeState,
  ElementalistSkill,
  ElementalistRuntime
} from '#gw2/professions/elementalist/types.js';

const JADE_SPHERE_TICKS = Object.freeze([0, 1000, 2000, 3000, 4000, 5000]);

// One multi-tick strike plus one party boon effect per tick, all anchored to cast
// start and scaled with cast time so the pulses stay aligned; keep their separate packet indices.
function jadeSphereEffects(boon: string, duration: number): readonly SkillEffect[] {
  return impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
    {
      type: 'strike',
      ticks: JADE_SPHERE_TICKS.map((atMs) => ({
        atMs,
        coefficient: 0.25,
        damageKind: 'field-tick'
      }))
    },
    ...JADE_SPHERE_TICKS.map((atMs) => ({
      type: 'boon' as const,
      boon,
      stacks: 1,
      duration,
      atMs,
      audience: { recipients: 'party' as const, maximumRecipients: 5 },
      metadata: {}
    }))
  ]);
}

/** Per-attunement sphere pulse effects consumed by the Catalyst skill fragments. */
const CATALYST_JADE_SPHERE_EFFECTS: Readonly<Record<number, readonly SkillEffect[]>> = Object.freeze({
  [ID.DEPLOY_JADE_SPHERE_FIRE]: jadeSphereEffects('Might', 10),
  [ID.DEPLOY_JADE_SPHERE_WATER]: jadeSphereEffects('Resolution', 1),
  [ID.DEPLOY_JADE_SPHERE_AIR]: jadeSphereEffects('Fury', 1),
  [ID.DEPLOY_JADE_SPHERE_EARTH]: jadeSphereEffects('Protection', 1)
});

/** Jade Sphere declarations and execution share one owner for attunement, energy spending, and field windows. */
export const CATALYST_JADE_SPHERE_SKILLS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DEPLOY_JADE_SPHERE_FIRE]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Fire)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_FIRE]
  },
  [ID.DEPLOY_JADE_SPHERE_WATER]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Water)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_WATER]
  },
  [ID.DEPLOY_JADE_SPHERE_AIR]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Air)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_AIR]
  },
  [ID.DEPLOY_JADE_SPHERE_EARTH]: {
    // Spend energy once and record this field's live window before deployment traits and pulses.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.catalyst.deploy-sphere' } }],
    name: 'Deploy Jade Sphere (Earth)',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Catalyst',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Jade Sphere'],
    castTimeMs: 0,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Poison',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Jade Sphere',
    effects: CATALYST_JADE_SPHERE_EFFECTS[ID.DEPLOY_JADE_SPHERE_EARTH]
  }
});

// Jade Sphere deployment requires the matching attunement and the profile energy
// cost; every other skill passes through untouched.
export function catalystSphereAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult {
  if (skill.skillFamily !== 'Jade Sphere') return { ready: true };

  const core = professionCoreState(context);

  if (skill.attunement !== core.primaryAttunement) {
    return denyCast(
      'elementalist.catalyst-attunement',
      `${skill.name} is unavailable - requires ${String(skill.attunement)} attunement.`
    );
  }

  const sphereCost = balanceNumberFromContext(context, PROFILE.resources, 'resourceCost');
  return context.resourceController.readyAt('catalystEnergy', sphereCost) === context.time
    ? { ready: true }
    : denyCast('elementalist.catalyst-energy', `${skill.name} is unavailable - requires ${sphereCost} energy.`);
}

// Spend sphere energy and schedule its attunement-specific field, pulses, and
// boons from cast start so later attunement swaps cannot change the sphere.
function deployJadeSphere(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = catalystState.from(context);
  const sphereCost = balanceNumberFromContext(context, PROFILE.resources, 'resourceCost');
  // Keep spending at deployment, before sphere traits and fields, rather than moving it to cast acceptance.
  context.resourceController.spend('catalystEnergy', sphereCost);
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
      value: context.resourceController.value('catalystEnergy'),
      maximum: state.catalystEnergy.maximum,
      change: -sphereCost
    }
  });
}

/** Sphere spending and field windows settle before deployment traits and effects. */
export const catalystSphereActions = {
  'elementalist.catalyst.deploy-sphere'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Jade Sphere requires a cast trigger.');

    deployJadeSphere(runtime, context.cast, context.skill);
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['sideEffectHandlers']>;

/** Sphere traits adjust the selected deployment effects without resampling the active attunement. */
export const modifyJadeSphereEffects: NonNullable<
  RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['modifyEffects']
> = (runtime, cast, effects) => {
  if (cast.skill.skillFamily !== 'Jade Sphere') return effects;

  runtime.fireTrigger(sphereDeployed, { cast });
  return applySphereSpecialistDurations(runtime, effects);
};
