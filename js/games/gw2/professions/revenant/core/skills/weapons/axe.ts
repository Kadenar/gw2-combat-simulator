/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const REVENANT_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.FRIGID_BLITZ]: {
    name: 'Frigid Blitz',
    icon: 'https://render.guildwars2.com/file/CF6305B8CDF2C70DDAC7709919A75C3554B09169/961462.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_4',
    cooldown: 10,
    energyCost: 10,
    shadowstepSkill: true,
    // The November 10 log shows one impact after teleporting, with both conditions applied together.
    castTimeMs: 440,
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Retain the previous final-strike coefficient until the new coefficient is confirmed.
        coefficient: 1.5,
        hits: 1,
        name: 'Frigid Blitz',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.TEMPORAL_RIFT]: {
    name: 'Temporal Rift',
    icon: 'https://render.guildwars2.com/file/BECD56D7BA6A9175F804305A4B4EB369079AEB1F/961478.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_5',
    cooldown: 15,
    energyCost: 10,
    castTimeMs: 560,
    // Once opened at 480 ms, the rift retains its delayed effects and the remaining cast lockout.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 640, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Temporal Rift',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      }
    ])
  }
};
