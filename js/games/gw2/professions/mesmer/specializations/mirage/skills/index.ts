/**
 * Owns Mirage axe, slot-skill, ambush, and simulator-action catalog data.
 * Mirage Cloak, mirror, and ambush runtime behavior lives under `mechanics/`.
 */
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { DODGE_ICON } from '#gw2/platform/skills/shared-actions.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { ambushSkill } from '#gw2/professions/mesmer/specializations/mirage/skills/ambush.js';
import type { MesmerAmbushAttack } from '#gw2/professions/mesmer/types.js';

export const MESMER_MIRAGE_SKILL_MECHANICS: Readonly<Record<SkillId, Partial<MesmerSkill>>> = Object.freeze({
  [ID.LINGERING_THOUGHTS]: {
    cooldown: 0.25,
    ammo: 2,
    ammoRecharge: 6,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castEnd',
      atMs: 160
    },
    castTimeMs: 920,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: COMBO_FINISHER.WHIRL,
        applications: 2
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        duration: 4,
        stacks: 3
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        duration: 1,
        stacks: 3
      }
    ]
  },
  [ID.AXES_OF_SYMMETRY]: {
    shadowstepSkill: true,
    peithaImpactDelayMs: 520,
    castTimeMs: 1000,
    // Both weapon variants are shadowsteps and use the same movement-relic projectile timing.
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1,
        atMs: 920,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.AXE.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 6,
        stacks: 5,
        atMs: -80
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.axes-clones' } }]
  },
  [ID.FALSE_OASIS]: {
    // The oasis starts pulsing during the cast; its mirror appears three seconds after that first pulse.
    tasks: [
      {
        type: 'mesmer.mirage.create-mirror',
        count: 1,
        atMs: 3240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Use the observed Quickness cast as the timing reference.
    castTimeMs: 960,
    effects: []
  },
  [ID.CRYSTAL_SANDS]: {
    // The ground mirror appears when the sand projectiles converge, after their damage packets.
    tasks: [
      {
        type: 'mesmer.mirage.create-mirror',
        count: 1,
        atMs: 1160,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 400,
    // The launched sand and its mirror survive cancellation of the remaining animation.
    interruptCommitMs: 320,
    // Keep the six simultaneous hits together and apply Confusion at the same impact.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 6,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 4
      }
    ])
  },
  [ID.MIRAGE_ADVANCE]: {
    shadowstepSkill: true,
    castTimeMs: 500,
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
      { type: 'condition', condition: CONDITION.BLINDNESS, stacks: 1, duration: 5 },

      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      }
    ]
  },
  [ID.SAND_THROUGH_GLASS]: {
    rechargeAnchor: 'castStart',
    // These instant Deceptions grant Mirage Cloak when their cast completes.
    tasks: [
      {
        type: 'mesmer.mirage.grant-cloak',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.ILLUSIONARY_AMBUSH]: {
    shadowstepSkill: true,
    rechargeAnchor: 'castStart',
    tasks: [
      {
        type: 'mesmer.mirage.grant-cloak',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.JAUNT]: {
    shadowstepSkill: true,
    rechargeAnchor: 'castStart',
    cooldown: 0.5,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        duration: 6,
        stacks: 3
      }
    ]
  }
});

/** Select player packets at acceptance; status schedules remain independent of whether strikes are removed. */
function playerAmbushEffects(party = false): NonNullable<MesmerSkill['effectVariants']> {
  return [
    {
      when: () => true,
      transform: (_runtime, cast, effects) => {
        const player = (cast.skill as MesmerAmbushAttack).player;
        const damageAtMs = player.damageAtMs;
        const statusAtMs = player.statusAtMs;
        const impact =
          damageAtMs == null
            ? { timingAnchor: 'castEnd' as const, atMs: 0 }
            : { timingAnchor: 'castStart' as const, atMs: damageAtMs };
        return [
          ...effects
            .filter((effect) => effect.source !== 'Clone')
            .flatMap((effect): SkillEffect[] => {
              // Ordinary skill additions keep their own delivery; only ambush templates use the actor projection.
              if (effect.type === 'control' || (effect.source !== 'Player' && effect.name !== CONDITION.VULNERABILITY))
                return [effect];

              const repeated = effect.type === 'boon' || effect.name === CONDITION.VULNERABILITY;
              const times =
                repeated && statusAtMs?.length
                  ? statusAtMs.map((atMs) => ({ timingAnchor: 'castStart' as const, atMs }))
                  : [impact];

              if (effect.type === 'strike' && effect.ticks?.length)
                return [
                  {
                    ...effect,
                    name: cast.skill.name,
                    actorType: ACTOR.PLAYER,
                    source: 'Player',
                    timingAnchor: 'castStart',
                    timingScale: 'fixed'
                  }
                ];

              if (effect.type === 'condition' && effect.ticks && damageAtMs != null)
                effect = { ...effect, ticks: effect.ticks.map((tick) => ({ ...tick, atMs: damageAtMs + tick.atMs })) };

              return times.map((timing) => ({
                ...effect,
                ...timing,
                // Compact strike/condition delays remain relative to their authored impact.
                atMs:
                  timing.atMs +
                  (effect.type === 'strike' || (effect.type === 'condition' && !repeated) ? (effect.atMs ?? 0) : 0),
                timingScale: 'fixed' as const,
                source: 'Player',
                actorType: ACTOR.PLAYER,
                ...(effect.type === 'strike'
                  ? { name: cast.skill.name }
                  : effect.type === 'condition'
                    ? { name: `${cast.skill.name} — ${effect.condition}` }
                    : {}),
                ...(effect.type === 'boon'
                  ? {
                      audience: party
                        ? { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
                        : { recipients: RECIPIENT.SELF }
                    }
                  : {})
              }));
            })
        ];
      }
    }
  ];
}

/** One skill record owns catalog metadata and both actor variants; profiles and runtime reuse it. */
export const MESMER_MIRAGE_AMBUSH_SKILLS: Readonly<Record<string, MesmerAmbushAttack>> = Object.freeze({
  [WEAPON.AXE]: ambushSkill({
    name: 'Imaginary Axes',
    id: ID.IMAGINARY_AXES,
    icon: 'https://render.guildwars2.com/file/38ED6AA595AEF00C0F704D0565DB7DD24B623850/1770513.png',
    description: 'Ambush. Release phantasmal axes that seek out the nearest target after a short delay.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.AXE,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      coefficient: 1,
      hits: 2,
      atMs: 0,
      damageAtMs: 360,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 3.5,
          stacks: 3,
          applications: 2
        }
      ]
    },
    clone: {
      coefficient: 3.7,
      hits: 2,
      atMs: 0,
      castTimeMs: 1110,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 4,
          stacks: 1
        }
      ]
    },
    castTimeMs: 440,
    // Cancelling the aftercast preserves axes already released at the player packet's impact frame.
    interruptCommitMs: 360,
    effects: [],
    effectVariants: playerAmbushEffects()
  }),
  [WEAPON.DAGGER]: ambushSkill({
    name: 'Phantom Razor',
    id: ID.PHANTOM_RAZOR,
    icon: 'https://render.guildwars2.com/file/45D4ADDEDD740AFDD1AF1EB9632BFCB3FFACE75F/3098873.png',
    description: 'Ambush. Slice your foe with a flurry of blades. Each blade inflicts different conditions.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.DAGGER,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      coefficient: 3,
      hits: 3,
      atMs: 0,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          duration: 5,
          stacks: 2
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 5,
          stacks: 2
        }
      ]
    },
    clone: {
      // Clone blades land after their windup; shattering the owner cancels unreleased damage and conditions.
      ticks: [
        { atMs: 880, coefficient: 1 },
        { atMs: 960, coefficient: 1 },
        { atMs: 1000, coefficient: 1 }
      ],
      castTimeMs: 880,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          // PvE's duration reduction applies to clone blades as well as player blades.
          duration: 5,
          stacks: 1,
          atMs: 80
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 5,
          stacks: 1,
          atMs: 120
        }
      ]
    },
    castTimeMs: 600,
    effects: [],
    effectVariants: playerAmbushEffects()
  }),
  [WEAPON.GREATSWORD]: ambushSkill({
    name: 'Split Surge',
    id: ID.SPLIT_SURGE,
    icon: 'https://render.guildwars2.com/file/66067CFD182ED01761DC5992E679BFA2057B5954/1770507.png',
    description: 'Ambush. Shoot a beam at a targeted foe, and secondary beams at foes near your target.',
    cooldown: 0.5,
    type: 'Weapon',
    weapon: WEAPON.GREATSWORD,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      ticks: [
        { atMs: 360, coefficient: 3.1875 / 3 },
        { atMs: 520, coefficient: 3.1875 / 3 },
        { atMs: 680, coefficient: 3.1875 / 3 }
      ],
      boons: [
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 5,
          stacks: 2
        }
      ]
    },
    clone: {
      coefficient: 3.1875,
      hits: 3,
      atMs: 0
    },
    vulnerability: {
      duration: 5,
      stacks: 2
    },
    castTimeMs: 960,
    // Each beam and its statuses survive only if they land before the channel is interrupted.
    interruptMode: 'per-packet',
    effects: [],
    effectVariants: playerAmbushEffects()
  }),
  [WEAPON.RIFLE]: ambushSkill({
    name: 'Effervescence',
    id: ID.EFFERVESCENCE,
    icon: 'https://render.guildwars2.com/file/4F0FBD163F2F996D1292B90193C356402BF7554D/3256357.png',
    description: 'Ambush. Spray invigorating magic, damaging enemies and healing allies.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.RIFLE,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      coefficient: 2.6,
      hits: 4,
      atMs: 0,
      boons: [
        {
          type: 'boon',
          boon: BOON.VIGOR,
          duration: 4,
          stacks: 1
        }
      ]
    },
    clone: {
      coefficient: 1.2,
      hits: 4,
      atMs: 0
    },
    castTimeMs: 166.666666667,
    effects: [],
    effectVariants: playerAmbushEffects()
  }),
  [WEAPON.SCEPTER]: ambushSkill({
    name: 'Ether Barrage',
    id: ID.ETHER_BARRAGE,
    icon: 'https://render.guildwars2.com/file/26CCD4729A4E32E75704E50F6B35DB70040680B8/1770508.png',
    description: 'Ambush. Launch a barrage of chaos orbs at your foe, inflicting confusion and torment.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.SCEPTER,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      coefficient: 1.25,
      hits: 5,
      atMs: 0,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.CONFUSION,
          duration: 4,
          stacks: 2
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 4,
          stacks: 3
        }
      ]
    },
    clone: {
      coefficient: 3.75,
      hits: 5,
      atMs: 0,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.CONFUSION,
          duration: 2,
          stacks: 2
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 2,
          stacks: 3
        }
      ]
    },
    castTimeMs: 1000,
    effects: [],
    effectVariants: playerAmbushEffects()
  }),
  [WEAPON.SPEAR]: ambushSkill({
    name: 'Fractured Glass',
    id: ID.FRACTURED_GLASS,
    icon: 'https://render.guildwars2.com/file/5169DEF67A777AA8023122EDCFCEE9A548DCF599/3379151.png',
    description: 'Ambush. Pierce targets in front of you in a flurry of blows, leaving them vulnerable.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.SPEAR,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      // Fractured Glass applies one strike and one Vulnerability stack at each measured packet.
      ticks: [400, 480, 520, 560, 640, 720, 760].map((atMs) => ({ atMs, coefficient: 3.15 / 7 }))
    },
    clone: {
      coefficient: 3.15,
      hits: 7,
      atMs: 0
    },
    vulnerability: {
      duration: 6,
      stacks: 1
    },
    castTimeMs: 880,
    interruptMode: 'per-packet',
    effects: [],
    effectVariants: playerAmbushEffects()
  }),
  [WEAPON.STAFF]: ambushSkill({
    name: 'Chaos Vortex',
    id: ID.CHAOS_VORTEX,
    icon: 'https://render.guildwars2.com/file/0E2D7DB6FB4C0A9F681759099DE5D794A04914BF/1770510.png',
    description:
      'Ambush. Release a vortex of chaos energy that inflicts damaging conditions on foes and grants boons to allies.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.STAFF,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      coefficient: 0.6,
      hits: 1,
      atMs: 0,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          duration: 10,
          stacks: 1
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 10,
          stacks: 1
        },
        {
          type: 'condition',
          condition: CONDITION.CONFUSION,
          duration: 10,
          stacks: 1
        }
      ],
      boons: [
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 15,
          stacks: 2
        },
        {
          type: 'boon',
          boon: BOON.FURY,
          duration: 2,
          stacks: 1
        }
      ]
    },
    clone: {
      coefficient: 1.12,
      hits: 1,
      atMs: 0,
      conditions: [
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          duration: 4,
          stacks: 1
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          duration: 4,
          stacks: 1
        },
        {
          type: 'condition',
          condition: CONDITION.CONFUSION,
          duration: 3,
          stacks: 1
        }
      ],
      boons: [
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 15,
          stacks: 2
        },
        {
          type: 'boon',
          boon: BOON.FURY,
          duration: 2,
          stacks: 1
        }
      ]
    },
    castTimeMs: 720,
    effects: [],
    effectVariants: playerAmbushEffects(true)
  }),
  [WEAPON.SWORD]: ambushSkill({
    name: 'Mirage Thrust',
    id: ID.MIRAGE_THRUST,
    icon: 'https://render.guildwars2.com/file/609505304F1D0AB548710E92335E5F550D7E396E/1770511.png',
    description: 'Ambush. Lunge at your foe, briefly daze them, and leave behind a clone.',
    cooldown: 1,
    type: 'Weapon',
    weapon: WEAPON.SWORD,
    slot: 'Weapon_1',
    specialization: 'Mirage',
    ambush: true,
    player: {
      coefficient: 3,
      hits: 1,
      atMs: 0
    },
    clone: {
      coefficient: 3,
      hits: 1,
      atMs: 0
    },
    // Clone creation is a scheduled application, independent of the player strike landing.
    tasks: [{ type: 'mesmer.mirage.ambush-clone', timingAnchor: 'castEnd' }],
    castTimeMs: 500,
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: CONTROL.DAZE,
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    effectVariants: playerAmbushEffects()
  })
});

export const MESMER_MIRAGE_EXTRA_SKILLS: readonly MesmerSkill[] = Object.freeze([
  ...Object.values(MESMER_MIRAGE_AMBUSH_SKILLS),
  // One canonical mirror owns the shared ground lifetime and independently removable pickup rewards.
  {
    id: ID.MIRAGE_MIRROR_DAMAGE,
    name: 'Mirage Mirror',
    type: 'Proc',
    specialization: 'Mirage',
    simulatorExcluded: true,
    castTimeMs: 0,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 0.6, hits: 1 },
      { name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 },
      { name: 'mirage-mirror', type: 'buff', kind: 'mirage-mirror', duration: 8, stacks: 1 }
    ]
  },
  {
    name: 'Dodge / Mirage Cloak',
    id: ID.DODGE_MIRAGE_CLOAK,
    // Mirage replaces the dodge effect without changing its physical input.
    inputControl: 'dodge',
    description:
      'Spend 50 endurance. Mirage gains Mirage Cloak and an ambush window; Infinite Horizon commands active clones to ambush.',
    icon: DODGE_ICON,
    type: 'Action',
    slot: 'Action',
    specialization: 'Mirage',
    cooldown: 0,
    cost: { resource: 'endurance', amount: ENDURANCE.dodgeCost, spendOn: 'castCommit' },
    // Mirage dodge spends endurance, grants cloak, and resolves dodge-triggered traits at completion.
    tasks: [
      {
        type: 'mesmer.mirage.dodge',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 0,
    effects: []
  },
  {
    name: 'Pick Up Mirage Mirror',
    id: ID.PICK_UP_MIRAGE_MIRROR,
    mirrorPayloadSkillId: ID.MIRAGE_MIRROR_DAMAGE,
    // Pickup is a movement mechanic, not an additional skill-bar key press.
    description: 'Pick up an available Mirage Mirror, damaging nearby enemies and gaining Mirage Cloak.',
    icon: 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Mirage',
    cooldown: 0,
    // Picking up the action consumes the available ground mirror at cast completion.
    tasks: [
      {
        type: 'mesmer.mirage.pick-up-mirror',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 0,
    effects: []
  }
] satisfies readonly MesmerSkill[]);
