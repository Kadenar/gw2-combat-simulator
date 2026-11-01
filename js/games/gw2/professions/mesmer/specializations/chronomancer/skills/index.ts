/**
 * Owns Chronomancer well, profession-skill, and Continuum action catalog data.
 * Continuum Split, Time Bomb, and shatter behavior live under `mechanics/` and `traits/`.
 */
import { ACTOR, BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { shatterSkill } from '#gw2/professions/mesmer/core/skills/shatter.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_CHRONOMANCER_SKILL_MECHANICS: Readonly<Record<SkillId, SkillDefinition<MesmerSkill>>> =
  Object.freeze({
    [ID.WELL_OF_PRECOGNITION]: {
      name: 'Well of Precognition',
      description:
        'Well. Create a well that gives allies the ability to see the future, allowing them to block incoming attacks. When the well ends, allies within the well regain endurance.',
      icon: 'https://render.guildwars2.com/file/C91EEC3C35FE97B349C77B2403400DDCB17F5606/1012904.png',
      type: 'Utility',
      slot: 'Utility',
      skillFamily: 'Well',
      cooldown: 60,
      castTimeMs: 800,
      // Protect allies during the well's three-second lifetime, then refund endurance when it ends.
      comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 3, startAnchor: 'castEnd' }],
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: [
        {
          type: 'boon',
          boon: BOON.AEGIS,
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          duration: 3,
          applications: 3,
          intervalMs: 1000,
          timingAnchor: 'castEnd',
          timingScale: 'fixed'
        },
        // The immediate stun-break stability is personal; the well's later grant protects allies.
        { type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 1, audience: { recipients: RECIPIENT.SELF } },
        ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
          {
            type: 'boon',
            boon: BOON.STABILITY,
            stacks: 3,
            audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
            duration: 5,
            atMs: 1000
          },
          {
            type: 'custom',
            eventType: 'resource',
            event: { resource: 'endurance', amount: 30, name: 'Well of Precognition' },
            atMs: 3000
          }
        ])
      ]
    },
    [ID.CONTINUUM_SPLIT]: {
      name: 'Continuum Split',
      description:
        "Destroy all your clones and create a rift in the space-time continuum. When it expires, you will revert back to your original point with your previous health, endurance, and skill recharges. Duration increases with each illusion shattered.\nThis skill's recharge cannot be reset by other mesmer skills.",
      icon: 'https://render.guildwars2.com/file/9E7CE10D0E447973F2D9175CF16A103BD076D04B/1012882.png',
      type: 'Profession',
      slot: 'Profession_5',
      cooldown: 105,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill(
        {
          slot: 5,
          kind: 'continuum',
          resolver: 'mesmer.chronomancer.continuum',
          consumesResources: false,
          resetBySignetOfIllusions: false,
          coefficients: [0, 0, 0, 0],
          durationPerTier: 1.5
        },
        'mesmer.chronomancer.begin-continuum'
      ),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: []
    },
    [ID.WELL_OF_SENILITY]: {
      name: 'Well of Senility',
      description:
        'Well. Creates a well that steals memories from foes, damaging and chilling them. When it expires, foes still inside the well have boons removed from them.',
      icon: 'https://render.guildwars2.com/file/4FF0FDC3406A5C01B5D2B419A67922AE4E9FF4D6/1012905.png',
      type: 'Utility',
      slot: 'Utility',
      skillFamily: 'Well',
      cooldown: 20,
      castTimeMs: 760,
      effects: [
        {
          type: 'strike',
          coefficient: 4.5,
          hits: 3,
          atMs: 0,
          name: 'Pulse damage',
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        }
      ]
    },
    [ID.WELL_OF_ETERNITY]: {
      name: 'Well of Eternity',
      description:
        'Well. Create a well that rewinds time, removing conditions from allies. When it expires, the well heals all allies in the area.',
      icon: 'https://render.guildwars2.com/file/514CB00E741027E03B525103A1D494620279FC61/1012884.png',
      type: 'Heal',
      slot: 'Heal',
      skillFamily: 'Well',
      cooldown: 30,
      castTimeMs: 400,
      effects: []
    },
    [ID.GRAVITY_WELL]: {
      name: 'Gravity Well',
      description:
        'Well. Create a powerful well that warps space in an area, knocking down, floating, and pulling foes caught in its event horizon. When it expires, foes still inside the well take heavy damage.',
      icon: 'https://render.guildwars2.com/file/636CBDAB7A6026B62FF2317CD610D7414FDEC99C/1012881.png',
      type: 'Elite',
      slot: 'Elite',
      skillFamily: 'Well',
      cooldown: 60,
      castTimeMs: 1080,
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: [0, 1000, 2000].map((atMs) => ({ atMs, coefficient: 1.1 })),
          name: 'Pulse damage',
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        },
        {
          type: 'strike',
          ticks: [{ atMs: 2000, coefficient: 2.1 }],
          name: 'Final damage',
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          atMs: 0,
          controlKind: CONTROL.KNOCKDOWN
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          atMs: 1000,
          controlKind: CONTROL.PULL
        },
        {
          type: 'control',
          actorType: ACTOR.PLAYER,
          atMs: 2000,
          controlKind: CONTROL.FLOAT
        }
      ])
    },
    [ID.WELL_OF_CALAMITY]: {
      name: 'Well of Calamity',
      description:
        'Well. Create a well that rends time, damaging, weakening, and crippling foes in the area. When the final pulse of Well of Calamity triggers, it deals massive damage to foes in the area.',
      icon: 'https://render.guildwars2.com/file/0EB4E57F0F26799F80727E3DFDD0470E72FB10A3/1012903.png',
      type: 'Utility',
      slot: 'Utility',
      skillFamily: 'Well',
      cooldown: 20,
      castTimeMs: 800,
      // The well is created on its first observed pulse, so later pulses survive an interrupted cast after that point.
      interruptCommitMs: 560,
      comboFields: [
        {
          ownerId: 'mesmer',
          fieldType: COMBO_FIELD.ETHEREAL,
          duration: 3,
          startMs: 560,
          startAnchor: 'castStart'
        }
      ],
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          ticks: [560, 1560, 2560].map((atMs) => ({ atMs, coefficient: 1.3 })),
          name: 'Pulse damage',
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        },
        {
          type: 'strike',
          ticks: [{ atMs: 3560, coefficient: 2.1 }],
          name: 'Final damage',
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        },
        {
          type: 'condition',
          ticks: [560, 1560, 2560, 3560].map((atMs) => ({
            atMs,
            condition: CONDITION.CRIPPLED,
            stacks: 1,
            duration: 2
          }))
        },
        {
          type: 'condition',
          ticks: [560, 1560, 2560, 3560].map((atMs) => ({
            atMs,
            condition: CONDITION.WEAKNESS,
            stacks: 1,
            duration: 2
          }))
        }
      ])
    },
    [ID.WELL_OF_ACTION]: {
      name: 'Well of Action',
      description:
        'Well. Create a well of delayed time, damaging and slowing foes. When the well expires, time snaps back, granting boons to allies.',
      icon: 'https://render.guildwars2.com/file/7F48A218D60E55A56DC14C4E660F56F72A472105/1012902.png',
      type: 'Utility',
      slot: 'Utility',
      skillFamily: 'Well',
      cooldown: 20,
      // Store the measured Quickness duration so the catalog derives the corresponding base cast consistently.
      castTimeMs: 800,
      // The first pulse commits the well before its animation can be shortened by a shatter or another instant action.
      interruptCommitMs: 520,
      comboFields: [
        {
          ownerId: 'mesmer',
          fieldType: COMBO_FIELD.ETHEREAL,
          duration: 3,
          startMs: 520,
          startAnchor: 'castStart'
        }
      ],
      effects: [
        {
          type: 'strike',
          ticks: [
            { atMs: 520, coefficient: 1.5 },
            { atMs: 1520, coefficient: 1.5 },
            { atMs: 2520, coefficient: 1.5 }
          ],
          name: 'Pulse damage',
          actorType: ACTOR.PLAYER,
          weapon: 'utility',
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: true
        }
      ]
    },
    [ID.TIME_SINK]: {
      name: 'Time Sink',
      description: 'Shatter. Destroy all your clones, dazing and slowing their targets.',
      icon: 'https://render.guildwars2.com/file/3A0CF805A4359A10766D1DD04FF0E7D20A05BD17/2175060.png',
      type: 'Profession',
      slot: 'Profession_3',
      cooldown: 38,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 3,
        kind: 'control',
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [0, 0, 0, 0]
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: [
        {
          type: 'control',
          source: 'Player',
          controlKind: CONTROL.DAZE,
          actorType: ACTOR.PLAYER,
          atMs: 0,
          timingAnchor: 'castEnd',
          timingScale: 'fixed'
        },
        { type: 'condition', condition: CONDITION.SLOW, stacks: 1, duration: 2 }
      ]
    },
    [ID.REWINDER]: {
      name: 'Rewinder',
      description:
        'Shatter. Destroy all your clones, confusing nearby foes and recharging this skill for each clone shattered.',
      icon: 'https://render.guildwars2.com/file/F59775A05108441C09AC03C30CAD98CC049CCC28/2175058.png',
      type: 'Profession',
      slot: 'Profession_2',
      cooldown: 30,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 2,
        kind: CONDITION.CONFUSION.toLowerCase(),
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [0.38, 0.76, 1.14, 1.52],
        rechargeReductionPerSource: 3,
        effects: [
          { name: CONDITION.CONFUSION, type: 'condition', condition: CONDITION.CONFUSION, duration: 3, stacks: 1 }
        ]
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: []
    },
    [ID.SPLIT_SECOND]: {
      name: 'Split Second',
      description:
        'Shatter. Destroy all your clones, damaging nearby foes. Strikes again after a delay.\nShatter traits only affect the first strike of this skill.',
      icon: 'https://render.guildwars2.com/file/14090D7A6472AB06125662EB12E6EC51EDE2EEBB/2175059.png',
      type: 'Profession',
      slot: 'Profession_1',
      cooldown: 12,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 1,
        kind: 'power',
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [1.53, 3.07, 3.68, 4.3],
        // Each resource tier owns both Split Second packets and their full formulas.
        ticks: [1.53, 3.07, 3.68, 4.3].map((coefficient) => [
          { atMs: 0, coefficient: coefficient / 2 },
          { atMs: 1000, coefficient: coefficient / 2 }
        ])
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: []
    }
  });

export const MESMER_CHRONOMANCER_EXTRA_SKILLS: readonly MesmerSkill[] = Object.freeze([
  {
    name: 'Continuum Shift',
    description: 'End Continuum Split early and restore the cooldown state captured when the split began.',
    // Use official skill 30747's CDN artwork while retaining the simulator's synthetic action identity.
    icon: 'https://render.guildwars2.com/file/4BD3BEF1DE31476B3E40002708049EA1026F1F0B/1012895.png',
    id: ID.CONTINUUM_SHIFT,
    // The return face occupies the same profession control as Continuum Split.
    inputControl: 'profession-5',
    type: 'Action',
    slot: 'Action',
    rechargeAnchor: 'castStart',
    cooldown: 0,
    // Manual Continuum Shift restores the captured state when the action completes.
    tasks: [
      {
        type: 'mesmer.chronomancer.restore-continuum',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 0,
    effects: []
  }
] satisfies readonly MesmerSkill[]);

// Profile and runtime registries project the same skill-owned recipe.
export const MESMER_CHRONOMANCER_SHATTERS: Readonly<Record<number, MesmerShatterDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_CHRONOMANCER_SKILL_MECHANICS).flatMap(([id, skill]) =>
      skill.shatter ? [[Number(id), skill.shatter]] : []
    )
  )
);
