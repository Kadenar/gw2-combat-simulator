/**
 * Dagger weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 dagger position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every definition names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Declarative data only - no handler logic lives here. Effect offsets are
 * authored against castTimeMs and follow runtime skill variants through the shared scheduler policy.
 */
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/**
 * The six dagger dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair (Fire+Water,
 * Fire+Air, Fire+Earth, Air+Water, Water+Earth, Air+Earth).
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Fire+Water. The only dagger dual that lays a combo field: a four-second
  // Water field opening at cast end. Its own strike declares no finisher.
  [ID.STEAM_SURGE]: {
    name: 'Steam Surge',
    description: 'Dual Attack. Slide to an area, blasting foes with steam while healing nearby allies.',
    icon: 'https://render.guildwars2.com/file/02376E4B64491D9842F04A7997937D6AA1A7EFB9/1770339.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire+Water',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 1.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Fire+Air. Single hit that doubles as a Blast finisher into the oldest
  // eligible field.
  [ID.PLASMA_BURST]: {
    name: 'Plasma Burst',
    description: 'Dual Attack. Burn your foes within a plasma blast.',
    icon: 'https://render.guildwars2.com/file/9853BF3A56733715F59BA3F29492013A28240968/1770337.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire+Air',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 6 }
    ])
  },
  // Fire+Earth. Two stages: a token 0.1 packet at 440 ms that exists to carry
  // the blind, then the real 1.4 hit plus Burning at 920 ms.
  [ID.ASHEN_BLAST]: {
    name: 'Ashen Blast',
    description: 'Dual Attack. Blind your foes with burning ashes.',
    icon: 'https://render.guildwars2.com/file/ADADFB4DA96E625C446269DDAEB1DF77DEBDA52D/1770338.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Fire+Earth',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 920,
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.1 },
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 3,
          applications: 1
        }
      ]),
      ...impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.4 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 }
      ])
    ]
  },
  // Air+Water. Two crowd-control applications far apart on the timeline: the
  // opening 0.1 packet at 240 ms carries the Blast finisher, Chilled,
  // Regeneration and the first control, while the 1.25 payoff hit and second
  // control land at 1520 ms - long after the 280 ms cast has ended.
  [ID.KATABATIC_WIND]: {
    name: 'Katabatic Wind',
    description: 'Dual Attack. Release a frigid wind that damages foes, then damages them again after a short delay.',
    icon: 'https://render.guildwars2.com/file/5897FEF03F0759D065BAAAE69EA9F26D2E3F51B8/1770341.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Air+Water',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 280,
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 0.1,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.BLAST
            }
          ],

          canCrit: true
        },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 },
        { type: 'boon', boon: BOON.REGENERATION, stacks: 1, duration: 4 },
        { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
      ]),
      ...impactEffects({ atMs: 1520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 1.25, canCrit: true },
        { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
      ])
    ]
  },
  // Water+Earth. Effectively a pure control skill: the 0.15 packet exists to
  // deliver the crowd-control application, not damage.
  [ID.MUD_SLIDE]: {
    name: 'Mud Slide',
    description: 'Dual Attack. Trip your foes with mud as you slide past them.',
    icon: 'https://render.guildwars2.com/file/22B60F9EA76A153B11A73698CEE5BA0471F51445/1770335.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Water+Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 1000,
    effects: impactEffects({ atMs: 960, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.15, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.KNOCKDOWN }
    ])
  },
  // Air+Earth. Six 0.275 pulses on a 520 ms cadence from 920 ms to 3520 ms,
  // each stacking Bleeding; the damage keeps running well past the 600 ms cast.
  // Stability is granted once, on the first pulse only.
  [ID.GRINDING_STONES]: {
    name: 'Grinding Stones',
    description: 'Dual Attack. Shred foes with a storm of stones. Take reduced damage while the storm is active.',
    icon: 'https://render.guildwars2.com/file/1D3206560916B0ADD3AD2B3242732F4F1E4EE496/1770334.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.DAGGER,
    attunement: 'Air+Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
    effects: [
      ...impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 },
        { type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 5 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 1960, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 2480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 3000, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ]),
      ...impactEffects({ atMs: 3520, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.275 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 6 }
      ])
    ]
  }
});
