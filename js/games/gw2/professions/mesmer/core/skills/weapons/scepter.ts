/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** At impact, full clones or notes replace the resource reward with torment; blades keep their own reward. */
function atEtherCloneLimit(runtime: MechanicQueryContext<MesmerRuntimeState>): boolean {
  const definition = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime);

  if (definition.singular === 'note') return runtime.resourceController.value('notes') >= definition.maximum;

  return definition.singular === 'clone' && runtime.profession.core.clones.length >= definition.maximum;
}

export const MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> =
  Object.freeze({
    [ID.ETHER_BOLT]: {
      name: 'Ether Bolt',
      description: 'Chain. Shoot a bolt of energy at your target.',
      icon: 'https://render.guildwars2.com/file/D86BE93CF7CF021ABF757410EC52E038B15F1BB8/103770.png',
      type: 'Weapon',
      weapon: 'Scepter',
      slot: 'Weapon_1',
      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      castTimeMs: 440,
      effects: [
        {
          type: 'strike',
          ticks: [{ atMs: 400, coefficient: 0.5 }],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SCEPTER.toLowerCase(),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 4,
          stacks: 1
        }
      ]
    },
    [ID.ETHER_BLAST]: {
      name: 'Ether Blast',
      description: 'Chain. Shoot a second bolt of energy at your target.',
      icon: 'https://render.guildwars2.com/file/09C73FBE6CFA6AEFEF9A440AC162F2F5E8227867/103557.png',
      type: 'Weapon',
      weapon: 'Scepter',
      slot: 'Weapon_1',
      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      castTimeMs: 520,
      effects: [
        {
          type: 'strike',
          ticks: [{ atMs: 480, coefficient: 0.5 }],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SCEPTER.toLowerCase(),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 6,
          stacks: 1
        }
      ]
    },
    [ID.ETHER_CLONE]: {
      name: 'Ether Clone',
      description:
        'Clone. Deliver a damaging attack directly to your target. Summon a clone that casts Ether Bolt. Inflict torment instead if you have the maximum number of illusions.',
      icon: 'https://render.guildwars2.com/file/66D5114144D3A271C72F48A124CCB70E040F3EE6/103771.png',
      type: 'Weapon',
      weapon: 'Scepter',
      slot: 'Weapon_1',

      cooldown: 0,
      autoattack: true,
      // Ordinary repeatable attack; excluded from player-input metrics.
      castTimeMs: 840,
      interruptCommitMs: 440,
      effects: [
        {
          type: 'strike',
          // Resolve the replacement before granting a resource so reaching the cap never grants both rewards.
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              when: (runtime, { event }) => Number(event.coefficient) > 0 && atEtherCloneLimit(runtime),
              do: {
                id: 'clone-limit',
                type: 'mesmer.core.clone-limit',
                effects: [
                  { name: CONDITION.TORMENT, type: 'condition', condition: CONDITION.TORMENT, duration: 9, stacks: 1 }
                ]
              }
            },
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              when: (runtime, { event }) => Number(event.coefficient) > 0 && !atEtherCloneLimit(runtime),
              do: { type: 'mesmer.illusion-gain', amount: 1 }
            }
          ],
          ticks: [{ atMs: 440, coefficient: 0.75 }],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SCEPTER.toLowerCase(),
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        }
      ]
    },
    [ID.ILLUSIONARY_COUNTER]: {
      name: 'Illusionary Counter',
      description:
        'Clone. Block the next attack, and counter by inflicting torment and creating clones that cast Ether Bolt.',
      icon: 'https://render.guildwars2.com/file/C1135A9C6D504426132CCB6200DAB6C66A756709/103766.png',
      type: 'Weapon',
      weapon: 'Scepter',
      slot: 'Weapon_2',

      cooldown: 6,
      // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
      flipArm: { skillId: ID.COUNTERSPELL, duration: 2, delay: 0, anchor: 'castStart' },
      castTimeMs: 1200,
      defaultInterruptMs: 120,
      interruptCommitMs: 80,
      effects: [],
      sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
    },
    // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
    [ID.COUNTERSPELL]: {
      name: 'Counterspell',
      description:
        'Flip skill for Illusionary Counter. Fire a blinding bolt, inflict confusion, and summon one clone on hit.',
      icon: 'https://render.guildwars2.com/file/33B7ADCA30B5EF4C1B52F71F39596FDEE9ECD8EB/103776.png',
      type: 'Weapon',
      weapon: 'Scepter',
      slot: 'Weapon_2',
      cooldown: 0,
      resource: {
        mode: 'add',
        count: 1,
        timingAnchor: 'castStart',
        atMs: 360
      },
      castTimeMs: 600,
      // The projectile and clone commit on the 360 ms Quickness frame, but weapon-swap cancellation retains the full cast lane.
      interruptCommitMs: 360,
      retainsCastLockoutAfterInterrupt: true,
      // Blind and Confusion land with the projectile, including after committed animation cancellation.
      effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 5,
          source: 'Player',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'strike',
          coefficient: 0.1,
          hits: 1,
          name: 'Projectile',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SCEPTER.toLowerCase()
        },
        {
          type: 'condition',
          condition: CONDITION.CONFUSION,
          stacks: 5,
          duration: 7
        }
      ]),
      sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.COUNTERSPELL } }]
    },
    [ID.CONFUSING_IMAGES]: {
      name: 'Confusing Images',
      description: 'Channel a beam of energy that damages and confuses your foe.',
      icon: 'https://render.guildwars2.com/file/6CD969007198CB02410C0999A870300AADACABDC/103622.png',
      type: 'Weapon',
      weapon: 'Scepter',
      slot: 'Weapon_3',
      cooldown: 9,
      castTimeMs: 1920,
      interruptMode: 'per-packet',
      effects: [
        {
          type: 'strike',
          ticks: [
            { atMs: 920, coefficient: 0.76 },
            { atMs: 1080, coefficient: 0.76 },
            { atMs: 1200, coefficient: 0.76 },
            { atMs: 1440, coefficient: 0.76 },
            { atMs: 1560, coefficient: 0.76 },
            { atMs: 1680, coefficient: 0.76 },
            { atMs: 1840, coefficient: 0.76 }
          ],
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SCEPTER.toLowerCase(),
          timingAnchor: 'castStart',
          timingScale: 'cast'
        },
        {
          type: 'condition',
          // Confusion applies once per channel pulse, independently of the strike packet cadence.
          ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
            atMs,
            condition: CONDITION.CONFUSION,
            duration: 7,
            stacks: 1
          })),
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      ]
    }
  });
