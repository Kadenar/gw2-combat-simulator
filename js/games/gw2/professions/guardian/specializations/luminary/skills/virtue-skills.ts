import { AURA, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { AURA_GRANT } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { radiantVirtueArmed } from '#gw2/professions/guardian/specializations/luminary/mechanics/trigger-points.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/**
 * Owns Luminary Radiant Virtue skill definitions.
 * Persistent virtue state and behavior remain under Core and Luminary mechanics.
 */

export const LUMINARY_VIRTUE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.RADIANT_COURAGE]: {
    name: 'Radiant Courage',
    description:
      "Virtue: Gain aegis periodically.\nActivate: Grant aegis, resistance, and Luminary's Blessing to yourself and nearby allies. \nThe next time you use Gleaming Blade, it deals increased damage and immobilizes enemies. The next time you use Radiant Bulwark, it grants barrier to nearby allies.",
    icon: 'https://render.guildwars2.com/file/61FA2B39C018F8930B38D1FC0FE5CE9C49BA681A/3713156.png',
    type: 'Profession',
    slot: 'Profession_3',
    virtue: 'courage',
    cooldown: 45,
    castTimeMs: 0,
    // Courage's activation grants these boons to the player and nearby allies.
    effects: [
      { type: 'boon', boon: BOON.AEGIS, duration: 20, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESISTANCE, duration: 4, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Commitment arms this virtue's next weapon entitlement, then fires the arming point.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-radiant-courage' } }]
  },
  [ID.RADIANT_RESOLVE]: {
    name: 'Radiant Resolve',
    description:
      'Virtue: Regenerates health.\nActivate: Heal yourself and nearby allies while granting light aura. The next time you use Luminous Staff, it heals allies and grants them regeneration.',
    icon: 'https://render.guildwars2.com/file/FA9E0C3E1024084F9E0F5505DAD826E242580C58/3713158.png',
    type: 'Profession',
    slot: 'Profession_2',
    virtue: 'resolve',
    cooldown: 30,
    castTimeMs: 0,
    effects: [{ type: 'aura', name: AURA.LIGHT, aura: AURA.LIGHT, duration: 4 }],
    // Resolve's scheduled grant owns its aura separately from its staff empowerment.
    effectVariants: [{ when: () => true, transform: () => [] }],
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.resolve-aura' } },
      // Commitment arms this virtue's next weapon entitlement, then fires the arming point.
      { on: 'castCommit', do: { type: 'guardian.arm-radiant-resolve' } }
    ]
  },
  [ID.RADIANT_JUSTICE]: {
    name: 'Radiant Justice',
    description:
      'Virtue: Burn foes every few attacks.\nActivate: Gain quickness. The next time you use Dazzling Hammer, it creates a delayed secondary impact.',
    icon: 'https://render.guildwars2.com/file/4AA777300AE7D0681907353CA69FBAFD7E649253/3713157.png',
    type: 'Profession',
    slot: 'Profession_1',
    virtue: 'justice',
    cooldown: 20,
    castTimeMs: 0,
    effects: [],
    // Commitment arms this virtue's next weapon entitlement, then fires the arming point.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-radiant-justice' } }]
  }
});

const luminaryVirtueActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  // Resolve's intrinsic aura replaces an old aura after any Sovereign detonation at the same boundary.
  'guardian.resolve-aura'(runtime, context) {
    if (context.kind !== 'cast') return;

    runtime.schedule(
      AURA_GRANT,
      context.cast.start,
      {
        cause: { ...guardianCastCause(runtime, context.cast), offTarget: context.cast.command.offTarget === true },
        skillId: context.cast.skill.id
      },
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

/** Registers Luminary virtue actions with the Luminary hook assembly. */
export const luminaryVirtueLifecycle = {
  sideEffectHandlers: luminaryVirtueActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
