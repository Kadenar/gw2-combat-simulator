import { WEAPON, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
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
        '10267': { placement: { type: 'Weapon', weapon: WEAPON.FOCUS, slot: 'Weapon_5' } },
        '10282': { placement: { type: 'Utility', weapon: '', slot: 'Utility' } }
      },
      // Apply the confirmed strike reduction independently of the still-pending condition-duration change.
      balanceProfiles: {
        '1890': { fields: { damageMultiplier: { from: 1.05, to: 1 } } }
      }
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
              condition: CONDITION.BURNING,
              duration: {
                from: 6,
                to: 8
              }
            }
          ]
        }
      }
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
              condition: CONDITION.BURNING,
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
              condition: CONDITION.BURNING,
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
              condition: CONDITION.TORMENT,
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
              condition: CONDITION.BURNING,
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
              condition: CONDITION.BURNING,
              duration: {
                from: 4.5,
                to: 2
              }
            }
          ]
        }
      }
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
            durationExtension: {
              from: 2,
              to: 0
            },
            immobilizeDurationExtension: {
              from: 1,
              to: 0
            }
          },
          removeEffects: [
            {
              type: 'condition',
              condition: CONDITION.VULNERABILITY
            }
          ]
        },
        '1935': {
          effects: [
            {
              type: 'condition',
              condition: CONDITION.BLEEDING,
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
              condition: CONDITION.POISONED,
              duration: {
                from: 8,
                to: 6
              }
            },
            {
              type: 'condition',
              name: 'Natural Convergence',
              condition: CONDITION.BURNING,
              duration: {
                from: 5,
                to: 4
              }
            },
            {
              type: 'condition',
              name: 'Natural Convergence final pulse',
              condition: CONDITION.BURNING,
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
              boon: BOON.ALACRITY,
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
              boon: BOON.MIGHT,
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
              condition: CONDITION.TORMENT,
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
      }
    },
    guardian: {
      reworks: ['firebrand-rework'],
      // Session controls expose only unsettled values, in canonical units; percent inputs display these fractions x100.
      provisional: [
        {
          id: 'imbuedHaste',
          traitId: '2148',
          label: 'Imbued Haste: condition damage',
          specialization: 'Firebrand',
          profileId: '2148',
          field: 'conditionDamageIncrease',
          minimum: 0,
          maximum: 1,
          step: 0.01,
          unit: '%'
        },
        {
          id: 'bleedingDamage',
          traitId: '2075',
          label: 'Unrelenting Criticism: bleeding damage',
          specialization: 'Firebrand',
          profileId: '2075',
          field: 'conditionDamageIncrease',
          minimum: 0,
          maximum: 1,
          step: 0.01,
          unit: '%'
        },
        {
          id: 'bleedingDuration',
          traitId: '2075',
          label: 'Unrelenting Criticism: bleeding duration',
          specialization: 'Firebrand',
          profileId: '2075',
          field: 'conditionDurationBonus',
          minimum: 0,
          maximum: 1,
          step: 0.01,
          unit: '%'
        },
        {
          id: 'ashesDuration',
          traitId: '2179',
          label: 'Righteous Flames: Ashes base burning duration',
          specialization: 'Firebrand',
          profileId: '2179',
          field: 'duration',
          effect: { type: 'condition', name: CONDITION.BURNING },
          minimum: 2,
          maximum: 10,
          step: 0.5,
          unit: 's'
        },
        {
          id: 'ashesStacks',
          traitId: '2179',
          label: 'Righteous Flames: Burning stacks per Ashes charge',
          specialization: 'Firebrand',
          profileId: '2179',
          field: 'stacks',
          effect: { type: 'condition', name: CONDITION.BURNING },
          minimum: 1,
          maximum: 10,
          step: 1,
          unit: 'stacks'
        },
        {
          id: 'fervidCharges',
          traitId: 'guardian.firebrand.fervid-conviction',
          label: 'Fervid Conviction: Ashes charges',
          specialization: 'Firebrand',
          profileId: 'guardian.firebrand.fervid-conviction',
          field: 'stacks',
          effect: { type: 'buff', name: 'ashes-of-the-just' },
          minimum: 1,
          maximum: 10,
          step: 1,
          unit: 'charges'
        },
        {
          id: 'stalwartQuickness',
          traitId: '2076',
          label: 'Stalwart Speed: Quickness duration',
          specialization: 'Firebrand',
          profileId: '2076',
          field: 'duration',
          effect: { type: 'boon', name: boonKey(BOON.QUICKNESS) },
          minimum: 0,
          maximum: 30,
          step: 0.5,
          unit: 's'
        },
        {
          id: 'stoicReduction',
          traitId: '2105',
          label: 'Stoic Demeanor: recharge reduction',
          specialization: 'Firebrand',
          profileId: '2105',
          field: 'rechargeReduction',
          minimum: 0,
          maximum: 30,
          step: 0.5,
          unit: 's'
        }
      ],
      balanceProfiles: {
        // Purity of Word increases capacity in PvE; the six-second interval is PvP-only.
        'guardian.firebrand.tome-pages': { fields: { maximumStacks: { from: 5, to: 8 } } },
        '2075': {
          // Use illustrative condition-specific bonuses until the published values are available.
          assumption:
            'Provisional: +10% bleeding damage and +33% bleeding duration are illustrative assumptions; final values unknown.',
          fields: { conditionDamageIncrease: { from: 0, to: 0.1 }, conditionDurationBonus: { from: 0, to: 0.33 } }
        },
        '2148': {
          assumption:
            'Provisional: +10% outgoing condition damage while Quickness is active. Amount and continued Quickness requirement are assumptions. Removes all old attribute bonuses; healing and incoming damage are outside simulation scope.',
          fields: { conditionDamageIncrease: { from: 0, to: 0.1 } }
        },
        '2179': {
          // Model the unknown improvement through the charge's payload, independently of charge grants.
          assumption:
            'Provisional: each Ashes charge applies 1 Burning stack for 3 seconds base. Base duration and Burning stacks per charge are configurable assumptions; the final improvement is unknown.',
          effects: [{ type: 'condition', name: CONDITION.BURNING, duration: { from: 2, to: 3 }, stacks: 1 }]
        },
        'guardian.firebrand.fervid-conviction': {
          assumption:
            'Provisional: 1 Ashes charge per Swift Scholar refund, lasting 10 seconds, up to 5 recipients including self, with no additional internal cooldown. Final grant values unknown.',
          effects: [{ type: 'buff', name: 'ashes-of-the-just', stacks: 1 }]
        },
        '2076': {
          assumption:
            'Provisional: 2 seconds of Quickness per Swift Scholar refund, up to 5 recipients including self, with no additional internal cooldown. Final duration unknown.',
          effects: [{ type: 'boon', name: boonKey(BOON.QUICKNESS), duration: 2 }]
        },
        '2105': {
          assumption:
            'Unknown: Unbroken Lines recharge reduction defaults to 0 seconds; edit rechargeReduction to experiment. No additional internal cooldown assumed. Only disables and Immobilized qualify.',
          fields: { rechargeReduction: 0 }
        },
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
              name: boonKey(BOON.ALACRITY)
            },
            {
              type: 'boon',
              name: 'alacrity (triggered)'
            }
          ],
          addEffects: [
            {
              type: 'boon',
              name: boonKey(BOON.ALACRITY),
              boon: BOON.ALACRITY,
              stacks: 1,
              duration: 5,
              audience: {
                recipients: RECIPIENT.PARTY
              }
            },
            {
              type: 'boon',
              name: 'alacrity (triggered)',
              boon: BOON.ALACRITY,
              stacks: 1,
              duration: 1,
              packetLabel: 'triggered',
              audience: {
                recipients: RECIPIENT.PARTY
              }
            }
          ]
        }
      }
    },
    elementalist: {
      skills: {
        '30336': {
          // Replace the overlapping offensive pulses while retaining the independent Resistance grant.
          removeEffects: [
            { type: 'strike' },
            { type: 'condition', condition: CONDITION.BLEEDING },
            { type: 'condition', condition: CONDITION.BLINDNESS, all: true }
          ],
          addEffects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
            strikeTimeline(DUST_STORM_PREVIEW_TICKS.map((tick) => ({ ...tick, coefficient: 0.3 }))),
            conditionTimeline(
              DUST_STORM_PREVIEW_TICKS.map((tick) => ({
                ...tick,
                condition: CONDITION.BLEEDING,
                stacks: 2,
                duration: 10
              }))
            ),
            ...DUST_STORM_PREVIEW_TICKS.map((tick) => ({
              ...tick,
              type: 'condition' as const,
              condition: CONDITION.BLINDNESS,
              stacks: 1,
              duration: 2,
              applications: 1
            }))
          ])
        },
        '29533': {
          effects: [
            {
              // Wildfire's regular Burning pulses and its large-target overlap timeline share one duration change.
              type: 'condition',
              condition: CONDITION.BURNING,
              all: true,
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
            [BOON.FURY]: {
              duration: {
                from: 25,
                to: 10
              }
            },
            [BOON.MIGHT]: {
              duration: {
                from: 25,
                to: 10
              },
              stacks: {
                from: 5,
                to: 20
              }
            },
            [BOON.SWIFTNESS]: {
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
      }
    },
    engineer: {
      // Expose the unknown explosion bonus as a fraction, matching other percentage-based preview controls.
      provisional: [
        {
          id: 'grenadierExplosionDamage',
          label: 'Grenadier: explosion damage bonus',
          specialization: 'Explosives',
          traitId: '514',
          profileId: '514',
          field: 'damageIncrease',
          minimum: 0,
          maximum: 1,
          step: 0.01,
          unit: '%'
        }
      ],
      balanceProfiles: {
        '514': {
          assumption: 'TBD: final Grenadier explosion-damage percentage pending; 10% assumed for this preview.',
          fields: {
            damageIncrease: {
              from: 0,
              to: 0.1
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
        '2334': {
          fields: {
            coefficientMultiplier: {
              from: 1.2,
              to: 1.15
            }
          }
        }
      }
    }
  }
};
