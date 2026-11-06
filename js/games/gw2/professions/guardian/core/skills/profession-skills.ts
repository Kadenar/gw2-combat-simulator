/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

export const GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<GuardianSkill>>> = {
  [ID.JUSTICE]: {
    name: 'Virtue of Justice',
    icon: 'https://render.guildwars2.com/file/0E4C27902671FBCB33713E3677604B0880EF0D60/103034.png',
    type: 'Profession',
    slot: 'Profession_1',
    virtue: 'justice',
    cooldown: 20,
    castTimeMs: 0,
    // Justice owns the shared burn recipes; activation only arms the next eligible hit.
    threshold: 5,
    effects: [],
    // Activation arms the next hit; its helper burns are never cast effects.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'guardian.arm-justice',
          id: 'justice',
          effects: [
            {
              type: 'condition',
              name: 'Burning (active)',
              condition: CONDITION.BURNING,
              stacks: 1,
              duration: 2,
              actorType: ACTOR.PLAYER,
              packetLabel: 'active'
            },
            {
              type: 'condition',
              name: 'Burning (passive)',
              condition: CONDITION.BURNING,
              stacks: 1,
              duration: 1.2,
              actorType: ACTOR.PLAYER,
              packetLabel: 'passive'
            }
          ]
        }
      }
    ]
  },
  [ID.COURAGE]: {
    name: 'Virtue of Courage',
    icon: 'https://render.guildwars2.com/file/1B55CBCB3E1165FD5D0C7BC3CBEEB65C5BD9D07C/103258.png',
    type: 'Profession',
    slot: 'Profession_3',
    virtue: 'courage',
    cooldown: 45,
    castTimeMs: 0,
    effects: []
  },
  [ID.RESOLVE]: {
    name: 'Virtue of Resolve',
    icon: 'https://render.guildwars2.com/file/F12B07B5466A51AB2BFD2C0CB8F3994D3F9E610C/103652.png',
    type: 'Profession',
    slot: 'Profession_2',
    virtue: 'resolve',
    cooldown: 30,
    castTimeMs: 0,
    effects: []
  }
};

const guardianJusticeActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.arm-justice'(runtime) {
    const skill = requireSkill(runtime.helpers, ID.JUSTICE);
    runtime.profession.core.justiceActiveArmed = Boolean(
      requireEffect(skill, 'condition', 'Burning (active)', requireSkillAction(skill, 'justice'))
    );
  }
};

/** Registers Justice profession actions with the Core hook assembly. */
export const guardianJusticeLifecycle = {
  sideEffectHandlers: guardianJusticeActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
