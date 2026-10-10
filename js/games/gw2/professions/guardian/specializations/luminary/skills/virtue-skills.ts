import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { AURA_GRANT } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import { radiantVirtueArmed } from '#gw2/professions/guardian/specializations/luminary/mechanics/activations.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/**
 * Owns Luminary Radiant Virtue skill fragments.
 * Persistent virtue state and behavior remain under Core and Luminary mechanics.
 */

export const LUMINARY_VIRTUE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RADIANT_COURAGE]: {
    // Commitment arms this virtue's next weapon entitlement, then fires the arming point.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-radiant-courage' } }],
    castTimeMs: 0,
    // Courage's activation grants these boons to the player and nearby allies.
    effects: [
      { type: 'boon', boon: 'aegis', duration: 20, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'resistance', duration: 4, audience: { recipients: 'party' } }
    ]
  },
  [ID.RADIANT_RESOLVE]: {
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.resolve-aura' } },
      // Commitment arms this virtue's next weapon entitlement, then fires the arming point.
      { on: 'castCommit', do: { type: 'guardian.arm-radiant-resolve' } }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.RADIANT_JUSTICE]: {
    // Commitment arms this virtue's next weapon entitlement, then fires the arming point.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-radiant-justice' } }],
    castTimeMs: 0,
    effects: []
  }
});

export const luminaryVirtueActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
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
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'skill',
        name: 'Empowered Hammer',
        at: runtime.time,
        sourceSkill: context.skill.name,
        detail: 'Next Dazzling Hammer creates a delayed secondary impact',
        icon: context.skill.icon
      }
    });
    runtime.fireTrigger(radiantVirtueArmed, { context });
  },
  'guardian.arm-radiant-resolve'(runtime, context) {
    luminaryState.from(runtime).radiantResolveArmed = true;
    runtime.fireTrigger(radiantVirtueArmed, { context });
  },
  'guardian.arm-radiant-courage'(runtime, context) {
    if (context.kind !== 'cast') return;
    luminaryState.from(runtime).radiantCourageSwordArmed = true;
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'skill',
        name: 'Empowered Sword',
        at: runtime.time,
        sourceSkill: context.skill.name,
        detail: 'Next Gleaming Blade deals 50% more damage',
        icon: context.skill.icon
      }
    });
    runtime.fireTrigger(radiantVirtueArmed, { context });
  }
};
