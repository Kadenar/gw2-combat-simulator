/** Virtue eligibility reads its owning timer; Renewed Focus resets cooldowns, ammunition, and Firebrand dormancy. */
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue,
  GuardianVirtueContext
} from '#gw2/professions/guardian/types.js';

/** Core hooks use the same virtue identities as readiness queries. */
export const CORE_VIRTUES = [
  [ID.JUSTICE, 'justice'],
  [ID.RESOLVE, 'resolve'],
  [ID.COURAGE, 'courage']
] as const;

const VIRTUES = {
  Core: CORE_VIRTUES,
  Dragonhunter: [
    [ID.SPEAR_OF_JUSTICE, 'justice'],
    [ID.WINGS_OF_RESOLVE, 'resolve'],
    [ID.SHIELD_OF_COURAGE, 'courage']
  ],
  Willbender: [
    [ID.RUSHING_JUSTICE, 'justice'],
    [ID.FLOWING_RESOLVE, 'resolve'],
    [ID.CRASHING_COURAGE, 'courage']
  ],
  Luminary: [
    [ID.RADIANT_JUSTICE, 'justice'],
    [ID.RADIANT_RESOLVE, 'resolve'],
    [ID.RADIANT_COURAGE, 'courage']
  ]
} as const;

/** Settle live recharge work before reading ammo availability or the tick-rounded ordinary deadline. */
export function guardianVirtueReadyAt(context: GuardianVirtueContext, virtue: GuardianVirtue): number {
  const specialization = context.profession.specialization;

  if (specialization.kind === 'Firebrand') return specialization.state.tomeDormantReadyAt[virtue];

  context.cooldownController.refresh(context.time);
  const [id] = VIRTUES[specialization.kind].find(([, candidate]) => candidate === virtue)!;
  return gw2CooldownReadyAt(context.cooldownController.readyAt(id) ?? 0);
}

/** Ordinary cooldown resets leave dormancy alone; only the authored virtue reset restores both authorities. */
export const guardianVirtueActions = {
  'guardian.refresh-virtues'(runtime, context) {
    const virtues = runtime.helpers.skills.filter((skill) => skill.virtue);
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
