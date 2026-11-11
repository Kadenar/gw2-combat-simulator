/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export const NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<NecromancerSkill>>> = {
  [ID.SOUL_GRASP]: {
    name: 'Soul Grasp',
    icon: 'https://render.guildwars2.com/file/FA5ADFEE0A3C38BC6B9A0E301E6DEFFF9C763A54/103137.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_4',
    cooldown: 12,
    lifeForceGain: 8,

    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        projectile: true,
        // One accepted golem hit starts the projectile's resource return.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: [{ type: 'necromancer.soul-grasp-return' }]
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 6,
        stacks: 8
      }
    ]
  },
  [ID.SPINAL_SHIVERS]: {
    name: 'Spinal Shivers',
    icon: 'https://render.guildwars2.com/file/365608D62CC05CD6030EA30FEFD6D7D52EB002E7/103808.png',
    type: 'Weapon',
    weapon: 'Focus',
    slot: 'Weapon_5',
    cooldown: 12,
    castTimeMs: 800,
    effects: [
      {
        type: 'strike',
        // Use the zero-boon strike until target boon removal is simulated.
        coefficient: 2.5,
        hits: 1,
        name: 'Spinal Shivers'
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 5
      }
    ]
  }
};

/** Approximate projectile return with a short delay; life force becomes spendable only on return. */
export const focusLifecycle = {
  sideEffectHandlers: {
    'necromancer.soul-grasp-return'(runtime, context) {
      // Provisional travel offset until return timing can be measured.
      runtime.schedule(
        'necromancer.soul-grasp-return',
        runtime.time + 0.1,
        skillNumber(context.skill, 'lifeForceGain')
      );
    }
  },
  tasks: {
    'necromancer.soul-grasp-return'(runtime, percent) {
      grantNecromancerLifeForce(runtime, Number(percent));
    }
  }
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
