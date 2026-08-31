/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SCORPION_WIRE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 1,
    ammo: 2,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Scorpion Wire',
        actorType: 'player'
      }
    ]
  },
  [ID.WITHDRAW]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 18,
    initiativeCost: 0,
    effects: []
  },
  [ID.PREPARE_THOUSAND_NEEDLES]: {
    implemented: true,
    handlerId: 'thief.prepare-thousand-needles',
    castTimeMs: 750,
    cooldown: 30,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    effects: []
  },
  [ID.HIDE_IN_SHADOWS]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.CALTROPS]: {
    implemented: true,
    castTimeMs: 1150,
    cooldown: 24,
    initiativeCost: 0,
    durationMultiplier: 3,
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 10,
        applications: 10,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ROLL_FOR_INITIATIVE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SPIDER_VENOM]: {
    implemented: true,
    handlerId: 'thief.spider-venom',
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'spider-venom',
        duration: 24,
        stacks: 6,
        recipients: 'party'
      }
    ]
  },
  [ID.BLINDING_POWDER]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.ASSASSINS_SIGNET]: {
    implemented: true,
    handlerId: 'thief.assassins-signet',
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: []
  },
  [ID.SIGNET_OF_MALICE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 12,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKALE_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.PREPARE_PITFALL]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SIGNET_OF_SHADOWS]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.SIGNET_OF_AGILITY]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: []
  },
  [ID.INFILTRATORS_SIGNET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: []
  },
  [ID.HASTE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.THIEVES_GUILD]: {
    implemented: true,
    handlerId: 'thief.thieves-guild',
    castTimeMs: 1500,
    cooldown: 120,
    initiativeCost: 0,
    effects: [],
    summonAttack: {
      basePower: 1750,
      criticalChance: 0.2,
      criticalDamage: 1.5,
      duration: 24,
      fallbackAttacks: [
        {
          name: 'Basic Attack',
          coefficientPerHit: 1.2,
          hits: 1,
          initialDelay: 1,
          interval: 1
        }
      ],
      summons: [
        {
          name: 'Male Dual-Pistol Thief',
          displayName: 'Thief',
          weapon: 'Pistol',
          weaponStrengthProfileId: 'weapon.pistol',
          attacks: [
            {
              name: 'Black Powder',
              skillId: 3669,
              coefficientPerHit: 0.8,
              hits: 1,
              initialDelay: 1.44
            },
            {
              name: 'Unload',
              skillId: 3666,
              coefficientPerHit: 0.175,
              hits: 12,
              initialDelay: 3.56,
              interval: 5.8
            }
          ]
        },
        {
          name: 'Female Dual-Dagger Thief',
          displayName: 'Thief',
          weapon: 'Dagger',
          weaponStrengthProfileId: 'weapon.dagger',
          attacks: [
            {
              name: 'Scorpion Wire',
              skillId: 3665,
              coefficientPerHit: 1.5,
              hits: 1,
              initialDelay: 1.72,
              conditions: [
                {
                  condition: 'Poisoned',
                  stacks: 2,
                  duration: 10
                },
                {
                  condition: 'Weakness',
                  stacks: 1,
                  duration: 4
                }
              ]
            },
            {
              name: 'Twisting Fang I',
              skillId: 3661,
              coefficientPerHit: 0.6,
              hits: 2,
              initialDelay: 2.52,
              interval: 2.68
            },
            {
              name: 'Twisting Fang II',
              skillId: 3662,
              coefficientPerHit: 1.6,
              hits: 1,
              initialDelay: 3.08,
              interval: 2.68
            },
            {
              name: 'Twisting Fang III',
              skillId: 3663,
              coefficientPerHit: 2.5,
              hits: 1,
              initialDelay: 3.72,
              interval: 2.68
            }
          ]
        },
        {
          name: 'Sword Thief',
          displayName: 'Thief',
          variant: 'Core Thief',
          weapon: 'Sword',
          weaponStrengthProfileId: 'weapon.sword'
        }
      ]
    }
  },
  [ID.DAGGER_STORM]: {
    implemented: true,
    castTimeMs: 2750,
    cooldown: 60,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Dagger Storm',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 7,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.DEVOURER_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 40,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.ICE_DRAKE_VENOM]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 36,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.BASILISK_VENOM]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 40,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKELK_VENOM]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.PITFALL]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 3,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1,
        name: 'Initial Impact Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Pulse Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ]
  },
  [ID.THOUSAND_NEEDLES]: {
    implemented: true,
    handlerId: 'thief.thousand-needles',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 0,
        name: 'Thousand Needles — Initial Strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 1000, coefficient: 0.2 },
          { atMs: 2000, coefficient: 0.2 },
          { atMs: 3000, coefficient: 0.2 },
          { atMs: 4000, coefficient: 0.2 }
        ],
        name: 'Thousand Needles — Pulse',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 8,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 5,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        atMs: 0,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
