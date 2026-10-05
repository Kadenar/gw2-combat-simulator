import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { strikeTimeline } from '#gw2/platform/effects/authoring.js';
import { quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WAIL_OF_DOOM]: {
    castTimeMs: 1000,
    effects: [
      {
        type: 'condition',
        condition: 'Fear',
        stacks: 1,
        duration: 1
      }
    ]
  },
  [ID.LOCUST_SWARM]: {
    castTimeMs: 440,
    // Each half-second siphon grants life force only when its impact lands.
    effects: [
      strikeTimeline(
        Array.from({ length: 10 }, (_, index) => ({ atMs: quantizeGw2ActionDurationUp(index * 500), coefficient: 0 })),
        {
          name: 'Locust Swarm — Life Siphon',
          flatStrikeBase: 117,
          flatStrikePowerCoeff: 0.08,
          reactions: [
            {
              on: 'damage.resolved',
              actor: 'player',
              packets: 'each',
              do: lifeForceGrant({ id: 'life-force', unit: 'pulse', grant: { percent: 1.5 } })
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
        boon: 'swiftness',
        stacks: 1,
        duration: 15,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  }
});
