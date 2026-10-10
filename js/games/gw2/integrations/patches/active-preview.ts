import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import { impactEffects, strikeTimeline, conditionTimeline } from '#gw2/platform/effects/authoring.js';

// A target receives one Dust Storm pulse per two-second interval across both storms;
// the fourth pulse overlaps only large hitboxes, with every offensive payload sharing that restriction.
const DUST_STORM_PREVIEW_TICKS = [1560, 3560, 5560, 7560].map((atMs, index) => ({
  atMs,
  metadata: { hitboxIndex: index + 1, smallHitboxCap: 3 }
}));

/**
 * Apply requested balance changes while preserving live data. Phoenix boon
 * replacements share with the party; Custodian retains its existing scaling.
 * Augury retains melee damage doubling; healing is outside simulation scope.
 */
export const activePatchPreview: PatchPreview = {
  id: 'nov-10-balance-preview',
  label: 'Balance Preview',
  // These reworks need updated implementations and rotations before their preview DPS can be compared.
  pendingBenchmarks: [
    { profession: 'revenant', specialization: 'Vindicator', reason: 'Vindicator rework pending.' },
    { profession: 'guardian', specialization: 'Firebrand', reason: 'Firebrand rework pending.' },
    {
      profession: 'warrior',
      specialization: 'Berserker',
      build: 'data/gw2/builds/warrior/b-condi-berserker-longbow-sword-torch.json',
      reason: 'Longbow weapon rework pending.'
    },
    {
      profession: 'mesmer',
      specialization: 'Chronomancer',
      damage: 'condi',
      reason: 'Chronophantasma resummoned-phantasm condition-duration reduction pending.'
    },
    {
      // The role swap invalidates these power presets until their loadouts and rotations are updated.
      profession: 'mesmer',
      specialization: 'Chronomancer',
      damage: 'power',
      reason: 'Disenchanter/Warden rework: updated builds and rotations pending.'
    },
    {
      profession: 'mesmer',
      specialization: 'Virtuoso',
      damage: 'power',
      reason: 'Disenchanter/Warden rework: updated builds and rotations pending.'
    },
    {
      profession: 'engineer',
      specialization: 'Amalgam',
      build: 'data/gw2/builds/engineer/b-power-amalgam-rifle-double-helix.json',
      reason: 'Rifle weapon rework pending.'
    },
    {
      profession: 'ranger',
      specialization: 'Soulbeast',
      reason: 'Oppressive Superiority rework pending.'
    },
    {
      // Artifact reworks invalidate saved Antiquary rotations, so their captured losses are not useful comparisons.
      profession: 'thief',
      specialization: 'Antiquary',
      reason: 'Artifact reworks break the current rotation; updated rotations pending.'
    }
  ],
  professions: {
    mesmer: {
      // Swap the phantasms' loadout roles only in the preview; their identities retain their summon mechanics.
      skills: {
        '10267': { placement: { type: 'Weapon', weapon: 'Focus', slot: 'Weapon_5' } },
        '10282': { placement: { type: 'Utility', weapon: '', slot: 'Utility' } }
      },
      // Apply the confirmed strike reduction independently of the still-pending condition-duration change.
      balanceProfiles: {
        '1890': { fields: { damageMultiplier: { from: 1.05, to: 1 } } }
      },
      overview: [
        { subject: 'Phantasmal Disenchanter', text: 'Moved to Focus 5.', source: 'skill-diff' },
        { subject: 'Phantasmal Warden', text: 'Moved to a utility slot.', source: 'skill-diff' },
        {
          subject: 'Chronophantasma',
          text: 'Resummoned phantasm strike damage reduced from 105% to 100%.',
          source: 'profile-diff'
        }
      ]
    },
    revenant: {
      skills: {
        '28253': {
          removeEffects: [
            {
              type: 'strike',
              name: 'Coalescence of Ruin - Second Cascade'
            }
          ]
        },
        '76805': {
          effects: [
            {
              type: 'strike',
              name: 'Beguiling Haze',
              tickIndex: 'all',
              coefficient: {
                from: 2.2,
                to: 1
              }
            }
          ]
        },
        '77141': {
          effects: [
            {
              type: 'strike',
              name: 'Beguiling Haze',
              tickIndex: 'all',
              coefficient: {
                from: 2.2,
                to: 1
              }
            }
          ]
        },
        '78661': {
          effects: [
            {
              type: 'strike',
              name: 'Release Potential: Dervish',
              coefficient: {
                from: 1.8,
                to: 2.4
              }
            }
          ]
        },
        '78845': {
          effects: [
            {
              type: 'strike',
              name: 'Release Potential: Assassin',
              tickIndex: 'all',
              coefficient: {
                from: 0.6,
                to: 0.9
              }
            }
          ]
        }
      },
      balanceProfiles: {
        '1788': {
          fields: {
            damagePerBoon: {
              from: 0.01,
              to: 0.02
            },
            maximumBoons: {
              from: 12,
              to: 5
            }
          }
        },
        'revenant.renegade.kallas-fervor-lasting-legacy': {
          fields: {
            damageIncreasePerStack: {
              from: 0.05,
              to: 0.04
            }
          }
        },
        'revenant.conduit.beguiling-haze-follow-up': {
          effects: [
            {
              type: 'strike',
              tickIndex: 'all',
              coefficient: {
                from: 0.6,
                to: 0.3
              }
            }
          ]
        },
        'revenant.conduit.mistfire': {
          effects: [
            {
              type: 'condition',
              condition: 'Burning',
              duration: {
                from: 6,
                to: 8
              }
            }
          ]
        }
      },
      overview: [
        {
          subject: 'Coalescence of Ruin',
          text: 'Removed Coalescence of Ruin - Second Cascade.',
          source: 'skill-diff'
        },
        {
          subject: 'Beguiling Haze',
          text: 'Beguiling Haze tick all coefficient 2.2 → 1.',
          source: 'skill-diff'
        },
        {
          subject: 'Beguiling Haze',
          text: 'Beguiling Haze tick all coefficient 2.2 → 1.',
          source: 'skill-diff'
        },
        {
          subject: 'Release Potential: Dervish',
          text: 'Release Potential: Dervish coefficient 1.8 → 2.4.',
          source: 'skill-diff'
        },
        {
          subject: 'Release Potential: Assassin',
          text: 'Release Potential: Assassin tick all coefficient 0.6 → 0.9.',
          source: 'skill-diff'
        },
        {
          subject: 'Beguiling Haze (Follow-Up)',
          text: 'Strike tick all coefficient 0.6 → 0.3.',
          source: 'profile-diff'
        },
        {
          subject: 'Mistfire',
          text: 'Burning duration 6 → 8.',
          source: 'profile-diff'
        },
        {
          subject: 'Reinforced Potency',
          text: 'damage per boon 0.01 → 0.02; maximum boons 12 → 5.',
          source: 'profile-diff'
        },
        {
          subject: 'Lasting Legacy',
          text: 'Strike damage increase per stack 0.05 → 0.04.',
          source: 'profile-diff'
        }
      ]
    },
    thief: {
      skills: {
        '44695': {
          effects: [
            {
              type: 'strike',
              tickIndex: 'all',
              coefficient: {
                from: 0.75,
                to: 0.85
              }
            }
          ]
        },
        '76733': {
          effects: [
            {
              type: 'condition',
              condition: 'Burning',
              stacks: {
                from: 2,
                to: 1
              }
            }
          ]
        },
        '76895': {
          effects: [
            {
              type: 'condition',
              condition: 'Burning',
              tickIndex: 'all',
              stacks: {
                from: 2,
                to: 1
              }
            }
          ]
        },
        '77192': {
          effects: [
            {
              type: 'condition',
              condition: 'Torment',
              tickIndex: 'all',
              duration: {
                from: 4,
                to: 2
              }
            }
          ]
        }
      },
      balanceProfiles: {
        '1257': {
          fields: {
            damagePerCondition: {
              from: 0.02,
              to: 0.03
            },
            maximumConditions: {
              from: 14,
              to: 5
            }
          }
        },
        '2160': {
          fields: {
            damagePerBoon: {
              from: 0.01,
              to: 0.02
            },
            maximumBoons: {
              from: 12,
              to: 5
            }
          }
        },
        'thief.antiquary.artifact-windows': {
          fields: {
            resourceGain: {
              from: 3,
              to: 2
            }
          }
        },
        'thief.antiquary.forged-surfer': {
          effects: [
            {
              type: 'condition',
              name: 'Bomb',
              condition: 'Burning',
              duration: {
                from: 3.5,
                to: 1
              }
            }
          ]
        },
        'thief.antiquary.forged-surfer-meticulous': {
          effects: [
            {
              type: 'condition',
              name: 'Bomb',
              condition: 'Burning',
              duration: {
                from: 4.5,
                to: 2
              }
            }
          ]
        }
      },
      overview: [
        {
          subject: 'Three Round Burst',
          text: 'Strike tick all coefficient 0.75 → 0.85.',
          source: 'skill-diff'
        },
        {
          subject: 'Zephyrite Sun Crystal',
          text: 'Burning stacks 2 → 1.',
          source: 'skill-diff'
        },
        {
          subject: 'Zephyrite Sun Crystal',
          text: 'Burning tick all stacks 2 → 1.',
          source: 'skill-diff'
        },
        {
          subject: 'Summon Kryptis Turret',
          text: 'Torment tick all duration 4 → 2.',
          source: 'skill-diff'
        },
        {
          subject: 'Antiquary Artifact Windows',
          text: 'Resource gain 3 → 2.',
          source: 'profile-diff'
        },
        {
          subject: 'Forged Surfer Dash',
          text: 'Bomb duration 3.5 → 1.',
          source: 'profile-diff'
        },
        {
          subject: 'Forged Surfer Dash - Meticulous',
          text: 'Bomb duration 4.5 → 2.',
          source: 'profile-diff'
        },
        {
          subject: 'Premeditation',
          text: 'damage per boon 0.01 → 0.02; maximum boons 12 → 5.',
          source: 'profile-diff'
        },
        {
          subject: 'Exposed Weakness',
          text: 'damage per condition 0.02 → 0.03; maximum conditions 14 → 5.',
          source: 'profile-diff'
        }
      ]
    },
    ranger: {
      balanceProfiles: {
        '1062': {
          fields: {
            damagePerBoon: {
              from: 0.01,
              to: 0.02
            },
            maximumBoons: {
              from: 12,
              to: 5
            }
          }
        },
        '2274': {
          fields: {
            damageIncreasePerStack: {
              from: 0.05,
              to: 0.04
            }
          }
        },
        '1912': {
          fields: {
            rechargeMultiplier: {
              from: 0.8,
              to: 1
            },
            durationPerTier: {
              from: 2,
              to: 0
            },
            minimumStacks: {
              from: 1,
              to: 0
            }
          },
          removeEffects: [
            {
              type: 'condition',
              condition: 'Vulnerability'
            }
          ]
        },
        '1935': {
          effects: [
            {
              type: 'condition',
              condition: 'Bleeding',
              duration: {
                from: 4,
                to: 3
              }
            }
          ]
        },
        '2055': {
          effects: [
            {
              type: 'condition',
              name: 'Seed of Life',
              condition: 'Poisoned',
              duration: {
                from: 8,
                to: 6
              }
            },
            {
              type: 'condition',
              name: 'Natural Convergence',
              condition: 'Burning',
              duration: {
                from: 5,
                to: 4
              }
            },
            {
              type: 'condition',
              name: 'Natural Convergence final pulse',
              condition: 'Burning',
              duration: {
                from: 5,
                to: 4
              }
            }
          ]
        },
        '2056': {
          fields: {
            conditionDamageIncrease: {
              from: 0.05,
              to: 0.15
            }
          }
        }
      },

      overview: [
        {
          subject: 'Poison Volley',
          text: 'Cooldown 8 → 6; Poisoned duration 5 → 7.',
          source: 'skill-diff'
        },
        {
          subject: 'Crossfire',
          text: 'Bleeding duration 2 → 5.',
          source: 'skill-diff'
        },
        {
          subject: 'Crippling Shot',
          text: 'Cooldown 12 → 10; Immobilized duration 1.5 → 2.',
          source: 'skill-diff'
        },
        {
          subject: 'Concussion Shot',
          text: 'Cooldown 20 → 16.',
          source: 'skill-diff'
        },
        {
          subject: 'Quick Shot',
          text: 'Cooldown 8 → 6.',
          source: 'skill-diff'
        },
        {
          subject: 'Light on Your Feet',
          text: 'Recharge multiplier 0.8 → 1; duration per tier 2 → 0; minimum stacks 1 → 0; removed Vulnerability.',
          source: 'profile-diff'
        },
        {
          subject: 'Blood Moon',
          text: 'Bleeding duration 4 → 3.',
          source: 'profile-diff'
        },
        {
          subject: 'Eclipse',
          text: 'Seed of Life duration 8 → 6; Natural Convergence duration 5 → 4; Natural Convergence final pulse duration 5 → 4.',
          source: 'profile-diff'
        },
        {
          subject: 'Natural Balance',
          text: 'Condition damage increase 0.05 → 0.15.',
          source: 'profile-diff'
        },
        {
          subject: 'Ferocious Symbiosis',
          text: 'damage per stack 0.05 → 0.04.',
          source: 'profile-diff'
        },
        {
          subject: 'Bountiful Hunter',
          text: 'Player and pet damage per boon 0.01 → 0.02; maximum boons 12 → 5.',
          source: 'profile-diff'
        }
      ],
      skills: {
        '12468': {
          fields: {
            cooldown: {
              from: 8,
              to: 6
            }
          },
          conditions: {
            Poisoned: {
              duration: {
                from: 5,
                to: 7
              }
            }
          }
        },
        '12470': {
          conditions: {
            Bleeding: {
              duration: {
                from: 2,
                to: 5
              }
            }
          }
        },
        '12507': {
          fields: {
            cooldown: {
              from: 12,
              to: 10
            }
          },
          conditions: {
            Immobilized: {
              duration: {
                from: 1.5,
                to: 2
              }
            }
          }
        },
        '12508': {
          fields: {
            cooldown: {
              from: 20,
              to: 16
            }
          }
        },
        '12517': {
          fields: {
            cooldown: {
              from: 8,
              to: 6
            }
          }
        }
      }
    },
    necromancer: {
      balanceProfiles: {
        '810': {
          fields: {
            criticalChancePerCondition: {
              from: 0.02,
              to: 0.04
            },
            maximumConditions: {
              from: 14,
              to: 5
            }
          }
        },
        '1974': {
          effects: [
            {
              type: 'strike',
              name: 'Strike',
              flatStrikeBase: {
                from: 344,
                to: 1500
              }
            }
          ]
        },
        '2080': {
          effects: [
            {
              type: 'boon',
              boon: 'alacrity',
              duration: {
                from: 1.5,
                to: 2
              }
            }
          ]
        },
        '2167': {
          effects: [
            {
              type: 'boon',
              boon: 'might',
              duration: {
                from: 6,
                to: 8
              }
            }
          ]
        },
        '2218': {
          effects: [
            {
              type: 'condition',
              condition: 'Torment',
              stacks: {
                from: 6,
                to: 3
              }
            }
          ],
          fields: {
            damageIncrease: {
              from: 0.1,
              to: 0.07
            },
            conditionDamageIncrease: {
              from: 0.1,
              to: 0.07
            }
          }
        },
        '2421': {
          fields: {
            damageMultiplier: {
              from: 1.5,
              to: 1.33
            }
          }
        }
      },

      overview: [
        {
          subject: 'Target the Weak',
          text: 'Critical chance per condition 0.02 → 0.04; maximum conditions 14 → 5.',
          source: 'profile-diff'
        },
        {
          subject: 'Augury of Death',
          text: 'Strike flat strike base 344 → 1500.',
          source: 'profile-diff'
        },
        {
          subject: 'Desert Empowerment',
          text: 'Alacrity duration 1.5 → 2.',
          source: 'profile-diff'
        },
        {
          subject: 'Abrasive Grit',
          text: 'Might duration 6 → 8.',
          source: 'profile-diff'
        },
        {
          subject: 'Cascading Corruption',
          text: 'Torment stacks 6 → 3.',
          source: 'profile-diff'
        },
        {
          subject: "Spirits' Strength",
          text: 'Damage multiplier 1.5 → 1.33.',
          source: 'profile-diff'
        },
        {
          subject: 'Cascading Corruption',
          text: 'Strike and condition damage increases 0.1 → 0.07.',
          source: 'profile-diff'
        }
      ]
    },
    guardian: {
      balanceProfiles: {
        '621': {
          fields: {
            damagePerBoon: {
              from: 0.005,
              to: 0.015
            },
            maximumBoons: {
              from: 12,
              to: 5
            }
          }
        },
        '2419': {
          fields: {
            damageIncrease: {
              from: 0.1,
              to: 0.13
            }
          }
        },
        '2195': {
          removeEffects: [
            {
              type: 'boon',
              name: 'alacrity'
            },
            {
              type: 'boon',
              name: 'alacrity (triggered)'
            }
          ],
          addEffects: [
            {
              type: 'boon',
              name: 'alacrity',
              boon: 'alacrity',
              stacks: 1,
              duration: 5,
              audience: {
                recipients: 'party'
              }
            },
            {
              type: 'boon',
              name: 'alacrity (triggered)',
              boon: 'alacrity',
              stacks: 1,
              duration: 1,
              packetLabel: 'triggered',
              audience: {
                recipients: 'party'
              }
            }
          ]
        }
      },

      overview: [
        {
          subject: 'Phoenix Protocol',
          text: 'Added boon alacrity effect; added boon alacrity (triggered) effect; removed alacrity; removed alacrity (triggered).',
          source: 'profile-diff'
        },
        {
          subject: 'Empowered Armaments',
          text: 'Damage increase 0.1 → 0.13.',
          source: 'profile-diff'
        },
        {
          subject: 'Inspired Virtue',
          text: 'damage per boon 0.005 → 0.015; maximum boons 12 → 5.',
          source: 'profile-diff'
        }
      ]
    },
    elementalist: {
      skills: {
        '30336': {
          // Replace the overlapping offensive pulses while retaining the independent Resistance grant.
          removeEffects: [
            { type: 'strike' },
            { type: 'condition', condition: 'Bleeding' },
            { type: 'condition', condition: 'Blindness', all: true }
          ],
          addEffects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
            strikeTimeline(DUST_STORM_PREVIEW_TICKS.map((tick) => ({ ...tick, coefficient: 0.3 }))),
            conditionTimeline(
              DUST_STORM_PREVIEW_TICKS.map((tick) => ({ ...tick, condition: 'Bleeding', stacks: 2, duration: 10 }))
            ),
            ...DUST_STORM_PREVIEW_TICKS.map((tick) => ({
              ...tick,
              type: 'condition' as const,
              condition: 'Blindness',
              stacks: 1,
              duration: 2,
              applications: 1
            }))
          ])
        },
        '29533': {
          effects: [
            {
              type: 'condition',
              condition: 'Burning',
              tickIndex: 'all',
              duration: {
                from: 3,
                to: 2.5
              }
            }
          ]
        },
        '72988': {
          effects: [
            {
              type: 'strike',
              tickIndex: 'all',
              coefficient: {
                from: 2.7,
                to: 3
              }
            }
          ]
        }
      },
      overview: [
        {
          subject: 'Wildfire',
          text: 'Burning tick all duration 3 → 2.5.',
          source: 'skill-diff'
        },
        {
          subject: 'Dust Storm',
          text: 'Hits once per 2-second interval across both storms: small hitboxes 6 → 3 hits; large hitboxes 8 → 4 hits. Bleeding and Blindness follow the same limit.',
          source: 'skill-diff'
        },
        {
          subject: 'Shale Storm - Additional Strike',
          text: 'Strike coefficient 1.5 → 2.',
          source: 'profile-diff'
        },
        {
          subject: 'Fiery Impact - Additional Strike',
          text: 'Strike coefficient 1.75 → 2.25.',
          source: 'profile-diff'
        },
        {
          subject: 'Meteor',
          text: 'Strike tick all coefficient 2.7 → 3.',
          source: 'skill-diff'
        },
        {
          subject: 'Galvanize - Additional Strike',
          text: 'Strike coefficient 2.6 → 3.1.',
          source: 'profile-diff'
        },
        {
          subject: 'Specialized Elements',
          text: 'Recharge multiplier 0.67 → 0.8.',
          source: 'profile-diff'
        },
        {
          subject: '2131',
          text: 'Damage increase 0.15 → 0.12.',
          source: 'profile-diff'
        },
        {
          subject: '2131',
          text: 'Damage increase 0.1 → 0.07.',
          source: 'profile-diff'
        },
        {
          subject: '1891',
          text: 'Damage increase 0.05 → 0.07.',
          source: 'profile-diff'
        },
        {
          subject: '1839',
          text: 'Damage increase 0.2 → 0.25.',
          source: 'profile-diff'
        },
        {
          subject: "Familiar's Focus",
          text: 'Damage increase 0.1 → 0.12.',
          source: 'profile-diff'
        }
      ],

      balanceProfiles: {
        '1839': {
          fields: {
            conditionDamageIncrease: {
              from: 0.2,
              to: 0.25
            }
          }
        },
        '1891': {
          fields: {
            conditionDamageIncrease: {
              from: 0.05,
              to: 0.07
            }
          }
        },
        '2131': {
          fields: {
            damageIncrease: {
              from: 0.15,
              to: 0.12
            },
            conditionDamageIncrease: {
              from: 0.1,
              to: 0.07
            }
          }
        },
        // Focus owns the Air bonus that replaces Prowess's base damage increase.
        '2342': {
          fields: { damageIncrease: { from: 0.1, to: 0.12 } }
        },
        // Spear dual skills arm buffs; patch the profiles that supply their deferred strikes.
        'elementalist.weaver.spear.shale-storm': {
          effects: [
            {
              type: 'strike',
              coefficient: {
                from: 1.5,
                to: 2
              }
            }
          ]
        },
        'elementalist.weaver.spear.fiery-impact': {
          effects: [
            {
              type: 'strike',
              coefficient: {
                from: 1.75,
                to: 2.25
              }
            }
          ]
        },
        'elementalist.weaver.spear.galvanize': {
          effects: [
            {
              type: 'strike',
              coefficient: {
                from: 2.6,
                to: 3.1
              }
            }
          ]
        },
        '2437': {
          fields: {
            empoweredRechargeMultiplier: {
              from: 0.67,
              to: 0.8
            }
          }
        }
      }
    },
    warrior: {
      balanceProfiles: {
        '1485': {
          fields: {
            damagePerBoon: {
              from: 0.01,
              to: 0.02
            },
            maximumBoons: {
              from: 12,
              to: 5
            }
          }
        }
      },

      skills: {
        '14355': {
          fields: {
            cooldown: {
              from: 40,
              to: 30
            },
            resourceGain: {
              from: 0,
              to: 10
            }
          },
          boons: {
            fury: {
              duration: {
                from: 25,
                to: 10
              }
            },
            might: {
              duration: {
                from: 25,
                to: 10
              },
              stacks: {
                from: 5,
                to: 20
              }
            },
            swiftness: {
              duration: {
                from: 25,
                to: 10
              }
            }
          }
        },
        '43123': {
          fields: {
            ammo: {
              from: 0,
              to: 2
            },
            ammoRecharge: {
              from: 0,
              to: 15
            },
            castTimeMs: {
              from: 167,
              to: 600
            }
          }
        }
      },
      overview: [
        {
          subject: 'Signet of Rage',
          text: 'Cooldown 40 → 30; resource gain 0 → 10; fury duration 25 → 10; might duration 25 → 10; might stacks 5 → 20; swiftness duration 25 → 10.',
          source: 'skill-diff'
        },
        {
          subject: 'Break Enchantments',
          text: 'Ammo 0 → 2; ammo recharge 0 → 15; cast time 167 → 600.',
          source: 'skill-diff'
        },
        {
          subject: 'Empowered',
          text: 'damage per boon 0.01 → 0.02; maximum boons 12 → 5.',
          source: 'profile-diff'
        }
      ]
    },
    engineer: {
      balanceProfiles: {
        '514': {
          assumption: 'TBD: final Grenadier explosion-damage percentage pending; 10% assumed for this preview.',
          fields: {
            damageMultiplier: {
              from: 1,
              to: 1.1
            }
          }
        },
        '516': {
          fields: {
            damagePerCondition: {
              from: 0.01,
              to: 0.02
            },
            maximumConditions: {
              from: 14,
              to: 5
            }
          }
        },
        'engineer.amalgam.evolve': {
          fields: {
            coefficientMultiplier: {
              from: 1.2,
              to: 1.15
            }
          }
        }
      },
      overview: [
        {
          subject: 'Evolved',
          text: 'Coefficient multiplier 1.2 → 1.15.',
          source: 'profile-diff'
        },
        {
          subject: 'Grenadier',
          text: 'Factor 1 → 1.1. TBD: final Grenadier explosion-damage percentage pending; 10% assumed for this preview.',
          source: 'profile-diff'
        },
        {
          subject: 'Modified Ammunition',
          text: 'Parameter damage per condition 0.01 → 0.02; parameter maximum conditions 14 → 5.',
          source: 'profile-diff'
        }
      ]
    }
  }
};
