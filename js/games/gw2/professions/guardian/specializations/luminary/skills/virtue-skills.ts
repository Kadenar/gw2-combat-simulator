import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { AURA_GRANT } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { masterAtArmsRecharges } from '#gw2/professions/guardian/specializations/luminary/traits/behavior.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';

/**
 * Owns Luminary Radiant Virtue skill fragments.
 * Persistent virtue state and behavior remain under Core and Luminary mechanics.
 */

export const LUMINARY_VIRTUE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RADIANT_COURAGE]: {
    // Master-at-Arms recharges the matching radiant weapons once the virtue commits.
    sideEffects: [
      // Commitment arms this virtue's next weapon entitlement.
      { on: 'castCommit', do: { type: 'guardian.arm-radiant-courage' } },
      masterAtArmsRecharges[ID.RADIANT_COURAGE]
    ],
    castTimeMs: 0,
    // Courage's activation grants these boons to the player and nearby allies.
    effects: [
      { type: 'boon', boon: 'aegis', duration: 20, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'resistance', duration: 4, audience: { recipients: 'party' } }
    ]
  },
  [ID.RADIANT_RESOLVE]: {
    // Master-at-Arms recharges the matching radiant weapons once the virtue commits.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.resolve-aura' } },
      // Commitment arms this virtue's next weapon entitlement.
      { on: 'castCommit', do: { type: 'guardian.arm-radiant-resolve' } },
      masterAtArmsRecharges[ID.RADIANT_RESOLVE]
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.RADIANT_JUSTICE]: {
    // Master-at-Arms recharges the matching radiant weapons once the virtue commits.
    sideEffects: [
      // Commitment arms this virtue's next weapon entitlement.
      { on: 'castCommit', do: { type: 'guardian.arm-radiant-justice' } },
      masterAtArmsRecharges[ID.RADIANT_JUSTICE]
    ],
    castTimeMs: 0,
    effects: []
  }
});

export const luminaryVirtueActions: RuntimeProfession<GuardianRuntimeState>['sideEffectHandlers'] = {
  // Resolve's intrinsic aura replaces an old aura after any Sovereign detonation at the same boundary.
  'guardian.resolve-aura'(runtime, context) {
    if (context.kind !== 'cast') return;
    runtime.schedule(
      AURA_GRANT,
      context.cast.start,
      { ...guardianCastCause(runtime, context.cast), offTarget: context.cast.command.offTarget === true },
      undefined,
      -10
    );
  },
  'guardian.arm-radiant-justice'(runtime, context) {
    if (context.kind !== 'cast') return;
    luminaryState.from(runtime).radiantJusticeArmed = true;
    runtime.recordProc(
      'skill',
      'Empowered Hammer',
      runtime.time,
      context.skill.name,
      'Next Dazzling Hammer creates a delayed secondary impact',
      context.skill.icon
    );
  },
  'guardian.arm-radiant-resolve'(runtime) {
    luminaryState.from(runtime).radiantResolveArmed = true;
  },
  'guardian.arm-radiant-courage'(runtime, context) {
    if (context.kind !== 'cast') return;
    luminaryState.from(runtime).radiantCourageSwordArmed = true;
    runtime.recordProc(
      'skill',
      'Empowered Sword',
      runtime.time,
      context.skill.name,
      'Next Gleaming Blade deals 50% more damage',
      context.skill.icon
    );
  }
};
