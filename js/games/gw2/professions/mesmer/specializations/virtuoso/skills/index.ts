/**
 * Owns Virtuoso dagger, slot-skill, and bladesong catalog definitions.
 * Blade storage and bladesong runtime behavior lives under `mechanics/`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { shatterSkill } from '#gw2/professions/mesmer/core/skills/shatter.js';
import { bladecallEffects } from '#gw2/professions/mesmer/core/skills/weapons/bladecall.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/**
 * Builds each blade tier's timed packets from its total strike coefficient.
 * `coefficients` remains the tier total used by shared shatter profiles, while
 * `ticks` distributes that total across the packets' individual impact times.
 */
function bladePacketTiers(coefficients: readonly number[], atMs: readonly number[]) {
  return coefficients.map((coefficient, spent) =>
    atMs.slice(0, spent).map((packetAtMs) => ({ atMs: packetAtMs, coefficient: coefficient / spent }))
  );
}

export const MESMER_VIRTUOSO_SKILL_MECHANICS: Readonly<Record<SkillId, SkillDefinition<MesmerSkill>>> = Object.freeze({
  [ID.BLADECALL]: {
    name: 'Bladecall',
    description: 'Throw a fan of daggers that return to you. Summon a clone if this attack hits at least one target.',
    icon: 'https://render.guildwars2.com/file/45B04E5D30ADD8D1B3086A98D40BE506E313B646/2479379.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_2',
    cooldown: 5,
    weaponVariantRootId: 62560,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 200
    },
    blade: true,
    castTimeMs: 440,
    // Commit when the daggers launch so their persistent packets and blade gain share the same successful cast.
    interruptCommitMs: 200,
    retainsCastLockoutAfterInterrupt: true,
    effects: bladecallEffects()
  },
  [ID.THOUSAND_CUTS]: {
    name: 'Thousand Cuts',
    description: 'Psionic. Open a portal that devastates targets in a line in front of you with a flurry of blades.',
    icon: 'https://render.guildwars2.com/file/1AF971BFF051CE34DE34437D1A0E0991A92155F4/2479389.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 60,
    blade: true,
    castTimeMs: 0,
    // The portal delivers ten equal impacts at a fixed cadence after its startup delay.
    effects: Array.from({ length: 10 }, (_, index) => 560 + index * 520).flatMap((atMs) =>
      impactEffects({ atMs, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          hits: 1,
          actorType: ACTOR.PLAYER,
          weapon: 'unequipped'
        }
      ])
    )
  },
  [ID.SWORD_OF_DECIMATION]: {
    name: 'Sword of Decimation',
    description:
      'Psionic. Drop a massive blade on a location, immobilizing enemies. This attack deals increased damage against controlled, downed, or defiant foes. Does bonus defiance-bar damage to defiant foes.\nControls include stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.',
    icon: 'https://render.guildwars2.com/file/FD3A260F2B09CA7BE3C8B7E2A17A9D436394D9AA/2479388.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 25,
    blade: true,
    // Resolve the strike after the reviewed activation duration.
    castTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      // The falling blade immobilizes at the same impact as its strike (wiki: Sword_of_Decimation, PvE).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 4 }
    ]
  },
  [ID.BLADE_RENEWAL]: {
    name: 'Blade Renewal',
    description: 'Psionic. Channel to gain distortion and stock up to the maximum number of blades.',
    icon: 'https://render.guildwars2.com/file/F21B401FC2A8736497704B7FFD4773500CA57C37/2479380.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 35,
    resource: {
      mode: 'fill',
      count: 5
    },
    blade: true,
    // Fill stored blades only after the reviewed channel completes.
    castTimeMs: 2040,
    effects: []
  },
  [ID.RAIN_OF_SWORDS]: {
    name: 'Rain of Swords',
    description:
      'Psionic. Create a storm of blades that attacks a large area, damaging and applying vulnerability to targets.',
    icon: 'https://render.guildwars2.com/file/B707CE945A596CC37A5D971EC2EB072A57680CA7/2479387.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 25,
    blade: true,
    castTimeMs: 680,
    // Each delayed pulse owns its strike and vulnerability together so they share the same impact timing.
    effects: Array.from({ length: 5 }, (_, index) => 840 + index * 1000).flatMap((atMs) =>
      impactEffects({ atMs, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 1,
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 3, duration: 10 }
      ])
    )
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    name: 'Twin Blade Restoration',
    description:
      'Psionic. Heal yourself, lose conditions, and throw two blades at your target. If the first blade hits, you gain aegis. If the second blade hits, you gain vigor.',
    icon: 'https://render.guildwars2.com/file/1EB2DEF5C20E4E415698251AE8AFAA5D02A513AC/2479390.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 20,
    blade: true,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'unequipped'
      }
    ]
  },
  [ID.BLADETURN_REQUIEM]: {
    name: 'Bladeturn Requiem',
    description:
      'Bladesong.Send your blades spinning around you to hit nearby foes. Spinning blade duration scales with number of blades consumed.',
    icon: 'https://render.guildwars2.com/file/040192EDDE9D2492D2428027E50DFC12B9044D39/2479384.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 30,
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 5,
      kind: 'blade-requiem',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.5, 1, 1.5, 2, 2.5],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.5, 1, 1.5, 2, 2.5], [1000, 2000, 3000, 4000, 5000])
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.BLADESONG_DISSONANCE]: {
    name: 'Bladesong Dissonance',
    description:
      'Bladesong. Combine all your blades into one large blade that dazes targets based on the number of blades consumed.',
    icon: 'https://render.guildwars2.com/file/D96E115ADAB14D610215EC185C3C21B4611DC292/2479381.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 30,
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 3,
      kind: 'blade-control',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 1, 1, 1, 1, 1],
      minimumResource: 1,
      resourceSpendProgress: 1,
      damageAtMs: 400
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    castTimeMs: 480,
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
    ]
  },
  [ID.BLADESONG_SORROW]: {
    name: 'Bladesong Sorrow',
    description: 'Bladesong. Fire all stocked blades, inflicting your target with conditions.',
    icon: 'https://render.guildwars2.com/file/EF9223543A66B8B5A8FD1C4BC4E7A218277C15C4/2479383.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 2,
      kind: 'blade-confusion',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.42, 0.84, 1.25, 1.67, 2.09], [440, 520, 600, 680, 680]),
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
    blade: true,
    castTimeMs: 480,
    effects: []
  },
  [ID.BLADESONG_HARMONY]: {
    name: 'Bladesong Harmony',
    description: 'Bladesong. Fire all stocked blades at your target.',
    icon: 'https://render.guildwars2.com/file/656A0C59523A4D9D935316EA93F1EA6247C32106/2479382.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 12,
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 1,
      kind: 'blade-power',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.7, 1.4, 2.1, 2.8, 3.5], [40, 200, 360, 520, 680])
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    castTimeMs: 640,
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    effects: []
  },
  [ID.BLADESONG_DISTORTION]: {
    name: 'Bladesong Distortion',
    description:
      'Bladesong. Gain distortion and consume all stocked blades, gaining additional distortion for each consumed blade.',
    icon: 'https://render.guildwars2.com/file/D0969802A76808ACD65A56A6D54F2A40E355F7C3/103284.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 50,
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 4,
      kind: 'blade-defense',
      resolver: 'mesmer.virtuoso.bladesong',
      minimumResource: 1,
      coefficients: [0, 0, 0, 0, 0, 0]
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    blade: true,
    castTimeMs: 0,
    effects: []
  }
});

// Profile and runtime registries project the same skill-owned recipe.
export const MESMER_VIRTUOSO_SHATTERS: Readonly<Record<number, MesmerShatterDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_VIRTUOSO_SKILL_MECHANICS).flatMap(([id, skill]) =>
      skill.shatter ? [[Number(id), skill.shatter]] : []
    )
  )
);
