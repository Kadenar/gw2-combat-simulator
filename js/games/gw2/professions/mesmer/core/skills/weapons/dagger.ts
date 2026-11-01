/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { bladecallEffects } from '#gw2/professions/mesmer/core/skills/weapons/bladecall.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> =
  Object.freeze({
    [ID.FLYING_CUTTER]: {
      name: 'Flying Cutter',
      description:
        'Send a blade of energy at your target. Hitting the same target multiple times invokes a flurry of blades on your target.',
      icon: 'https://render.guildwars2.com/file/B0FE6EA92A310363CD26DA5CD81DCAB23A071D3A/2479385.png',
      type: 'Weapon',
      weapon: 'Dagger',
      slot: 'Weapon_1',
      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      blade: true,
      trackedHitDamage: {
        hitsRequired: 3,
        duration: 5,
        skillId: ID.CUTTER_BURST,
        name: 'Cutter Burst',
        actorType: ACTOR.PLAYER,
        // A third landed projectile commits Cutter Burst even when Flying Cutter's remaining animation is interrupted.
        persistsAfterInterrupt: true,
        ticks: [
          {
            atMs: 200,
            coefficient: 0.2
          },
          {
            atMs: 240,
            coefficient: 0.2
          },
          {
            atMs: 400,
            coefficient: 0.2
          }
        ]
      },
      castTimeMs: 440,
      interruptCommitMs: 360,
      effects: [
        {
          type: 'strike',
          // Only native accepted projectiles contribute to the persistent three-hit burst ledger.
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'each',
              when: (_runtime, { event, skill }) => event.sourceId === skill.id,
              do: { type: 'mesmer.tracked-hit' }
            }
          ],
          coefficient: 0.5,
          hits: 1,
          name: 'Projectile',
          actorType: ACTOR.PLAYER,
          // Preserve the measured Quickness projectile while the shared scheduler scales slower casts.
          atMs: 320,
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      ]
    },
    [ID.BLADECALL_NON_VIRTUOSO]: {
      name: 'Bladecall',
      description:
        'Throw a fan of daggers that return to you. If your target is in range, the returning daggers will lock on to that target. Create a clone if this attack hits at least one target.',
      icon: 'https://render.guildwars2.com/file/45B04E5D30ADD8D1B3086A98D40BE506E313B646/2479379.png',
      type: 'Weapon',
      weapon: 'Dagger',
      slot: 'Weapon_2',
      cooldown: 5,
      resource: {
        mode: 'add',
        count: 1
      },
      castTimeMs: 440,
      // Launched daggers survive cancellation while the committed cast keeps its recovery lockout.
      interruptCommitMs: 200,
      retainsCastLockoutAfterInterrupt: true,
      effects: bladecallEffects()
    },
    [ID.UNSTABLE_BLADESTORM]: {
      name: 'Unstable Bladestorm',
      description:
        'Create a telekinetic storm of daggers that damages foes. With each interval, the bladestorm will fire blades at nearby enemies.',
      icon: 'https://render.guildwars2.com/file/449039B4B74B133D226BEED819B7C408AF2B61BB/2479391.png',
      type: 'Weapon',
      weapon: 'Dagger',
      slot: 'Weapon_3',
      cooldown: 12,
      blade: true,
      castTimeMs: 440,
      // The storm commits 200ms into a Quickness cast; its four pulse pairs then persist after interruption.
      interruptCommitMs: 200,
      effects: [
        {
          type: 'strike',
          ticks: [
            { atMs: 1160, coefficient: 0.25 },
            { atMs: 2160, coefficient: 0.25 },
            { atMs: 3160, coefficient: 0.25 },
            { atMs: 4160, coefficient: 0.25 }
          ],
          name: 'Storm pulses',
          actorType: ACTOR.PLAYER,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: true
        },
        {
          type: 'strike',
          ticks: [
            { atMs: 1200, coefficient: 0.5 },
            { atMs: 2200, coefficient: 0.5 },
            { atMs: 3200, coefficient: 0.5 },
            { atMs: 4200, coefficient: 0.5 }
          ],
          name: 'Launched blades',
          actorType: ACTOR.PLAYER,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: true
        }
      ]
    }
  });
