/**
 * Virtue eligibility reads the selected specialization's virtue skills. Renewed Focus resets their cooldowns,
 * ammunition, and Firebrand dormancy.
 */
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type {
  GuardianRuntime,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue,
  GuardianVirtueContext
} from '#gw2/professions/guardian/types.js';

type VirtueSelection = Pick<MechanicQueriesOf<GuardianRuntime>, 'helpers' | 'profession'>;
type VirtueSkills = ReadonlyMap<GuardianVirtue, GuardianSkill>;
const catalogVirtues = new WeakMap<readonly GuardianSkill[], Map<string, VirtueSkills>>();

/** Index the selected owner's declarations once so passive hits and cast checks use the same patched skills. */
export function activeGuardianVirtues({ helpers, profession }: VirtueSelection): VirtueSkills {
  const owner = profession.specialization.kind;
  let owners = catalogVirtues.get(helpers.skills);

  if (!owners) {
    owners = new Map();
    catalogVirtues.set(helpers.skills, owners);
  }

  const existing = owners.get(owner);

  if (existing) return existing;

  const virtues = new Map<GuardianVirtue, GuardianSkill>();
  for (const skill of helpers.skills) {
    if (!skill.virtue || (skill.specialization ?? 'Core') !== owner) continue;

    if (virtues.has(skill.virtue)) throw new Error(`Duplicate ${owner} virtue: ${skill.virtue}.`);

    virtues.set(skill.virtue, skill);
  }

  owners.set(owner, virtues);
  return virtues;
}

/** Core declarations remain in elite catalogs for their passive effects. Only the selected root accepts casts. */
export function activeGuardianVirtueSkill(context: VirtueSelection, virtue: GuardianVirtue): GuardianSkill {
  const skill = activeGuardianVirtues(context).get(virtue);

  if (!skill) throw new Error(`Missing ${context.profession.specialization.kind} virtue: ${virtue}.`);

  return skill;
}

/** Settle live recharge work before reading ammo availability or the tick-rounded ordinary deadline. */
export function guardianVirtueReadyAt(context: GuardianVirtueContext, virtue: GuardianVirtue): number {
  const specialization = context.profession.specialization;

  if (specialization.kind === 'Firebrand') return specialization.state.tomeDormantReadyAt[virtue];

  context.cooldownController.refresh(context.time);
  const skill = activeGuardianVirtueSkill(context, virtue);
  return gw2CooldownReadyAt(context.cooldownController.readyAt(skill.id) ?? 0);
}

/** Ordinary cooldown resets leave dormancy alone; only the authored virtue reset restores both authorities. */
export const guardianVirtueActions = {
  'guardian.refresh-virtues'(runtime, context) {
    // Replaced Core virtues cannot be cast, so only the selected specialization's virtues reset.
    const virtues = [...activeGuardianVirtues(runtime).values()];
    applySideEffect(runtime, context, { type: 'rechargeReset', skillIds: virtues.map((skill) => skill.id) });
    for (const skill of virtues) runtime.cooldownController.restoreAmmo(skill, Infinity, runtime.time);

    const specialization = runtime.profession.specialization;

    if (specialization.kind === 'Firebrand')
      specialization.state.tomeDormantReadyAt = {
        justice: runtime.time,
        resolve: runtime.time,
        courage: runtime.time
      };
  }
} satisfies NonNullable<RuntimeHooks<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers']>;
