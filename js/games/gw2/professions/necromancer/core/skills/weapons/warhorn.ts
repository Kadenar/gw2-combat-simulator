/** Canonical Core necromancer skill definitions grouped by their GW2 owner. */
import { quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.WAIL_OF_DOOM]: {
    name: 'Wail of Doom',
    icon: 'https://render.guildwars2.com/file/41C99E156B3F602C9069E2B838E8BD05D6262EBE/103277.png',
    type: 'Weapon',
    weapon: 'Warhorn',
    slot: 'Weapon_4',
    cooldown: 24,
    castTimeMs: 1000,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 1
      }
    ]
  },
  [ID.LOCUST_SWARM]: {
    name: 'Locust Swarm',
    icon: 'https://render.guildwars2.com/file/1E2D4A00340B96CAE9A1E19F2B07B35A01741B14/103809.png',
    type: 'Weapon',
    weapon: 'Warhorn',
    slot: 'Weapon_5',
    cooldown: 24,
    castTimeMs: 440,
    // Each half-second siphon grants life force only when its impact lands.
    effects: [
      strikeTimeline(
        Array.from({ length: 10 }, (_, index) => ({
          atMs: quantizeGw2ActionDurationUp(index * 500),
          coefficient: 0
        })),
        {
          name: 'Locust Swarm - Life Siphon',
          flatStrikeBase: 117,
          flatStrikePowerCoeff: 0.08,
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'each',
              do: [lifeForceGrant({ id: 'life-force', unit: 'pulse', grant: { percent: 1.5 } })]
            }
          ],
          canCrit: false,
          damageKind: 'life-steal',
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        }
      ),
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        stacks: 1,
        duration: 15,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  }
};
