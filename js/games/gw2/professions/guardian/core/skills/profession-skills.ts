import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { requireSkillFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

export const GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.JUSTICE]: {
    castTimeMs: 0,
    // Justice owns the shared burn recipes; activation only arms the next eligible hit.
    threshold: 5,
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
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // A committed activation entitles the next eligible hit to the selected active burn.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-justice' } }]
  },
  [ID.COURAGE]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.RESOLVE]: {
    castTimeMs: 0,
    effects: []
  }
});

const guardianJusticeActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.arm-justice'(runtime) {
    runtime.profession.core.justiceActiveArmed = Boolean(
      requireEffect(requireSkillFromContext(runtime, ID.JUSTICE), 'condition', 'Burning (active)')
    );
  }
};

/** Registers Justice profession actions with the Core hook assembly. */
export const guardianJusticeLifecycle = {
  sideEffectHandlers: guardianJusticeActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
