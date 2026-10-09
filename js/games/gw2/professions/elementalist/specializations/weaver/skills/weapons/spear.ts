/**
 * Spear weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 spear position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Each instant activation grants its self benefits and arms a five-second buff.
 * The additional strike and its conditions resolve on the next player strike.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { defineSkillVariantProfile } from '#gw2/platform/profession-definition/profile-authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';

/** Stable buff and payload identities keep six independently armed follow-ups separate. */
export const WEAVER_SPEAR_FOLLOWUPS: Readonly<Record<number, string>> = Object.freeze({
  [ID.FROSTFIRE_WARD]: 'elementalist.weaver.spear.frostfire-ward',
  [ID.GALVANIZE]: 'elementalist.weaver.spear.galvanize',
  [ID.FIERY_IMPACT]: 'elementalist.weaver.spear.fiery-impact',
  [ID.ELUTRIATE]: 'elementalist.weaver.spear.elutriate',
  [ID.SOOTHING_BURST]: 'elementalist.weaver.spear.soothing-burst',
  [ID.SHALE_STORM]: 'elementalist.weaver.spear.shale-storm'
});

/**
 * The six spear dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
const SPEAR_DUAL_DEFINITIONS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Fire+Water. The only spear dual that grants an aura: `aura: 'Fire|3'` is
  // read by the core cast hook as a three-second Fire Aura on cast end.
  [ID.FROSTFIRE_WARD]: {
    name: 'Frostfire Ward',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 15,
    aura: 'Fire|3',
    skillFamily: 'Weapon skill',
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } }],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  // Fire+Air. Heaviest single spear packet, paired with self superspeed and
  // three stacks of Might rather than any condition.
  [ID.GALVANIZE]: {
    name: 'Galvanize',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } }],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.6 },
      { type: 'buff', kind: 'superspeed', stacks: 1, duration: 3, metadata: {} },
      { type: 'boon', boon: 'Might', stacks: 3, duration: 6, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  // Fire+Earth. Blast finisher into the oldest ambiguous field, plus Burning
  // and three stacks of Bleeding.
  [ID.FIERY_IMPACT]: {
    name: 'Fiery Impact',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } }],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.75,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 5, metadata: {} },
      { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 6, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  [ID.ELUTRIATE]: {
    name: 'Elutriate',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } }],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.25 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8, metadata: {} },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 4, metadata: {} }
    ]),
    specialization: 'Weaver'
  },
  // Water+Earth. Modelled purely as a Blast finisher: one strike, no conditions
  // and no boons.
  [ID.SOOTHING_BURST]: {
    name: 'Soothing Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } }],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    specialization: 'Weaver'
  },
  [ID.SHALE_STORM]: {
    name: 'Shale Storm',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } }],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.5 },
      { type: 'condition', condition: 'Blindness', stacks: 1, duration: 3 },
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 5, metadata: {} }
    ]),
    specialization: 'Weaver'
  }
});

/** Hostile payloads belong to the armed buff; activation-time boons and auras remain on the skill. */
function followupEffect(effect: SkillEffect): boolean {
  return effect.type === 'strike' || effect.type === 'condition';
}

export const WEAVER_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SPEAR_DUAL_DEFINITIONS).map(([id, skill]) => [
      id,
      {
        ...skill,
        effects: [
          ...(skill.effects ?? []).filter((effect) => !followupEffect(effect)),
          {
            type: 'buff',
            kind: WEAVER_SPEAR_FOLLOWUPS[Number(id)],
            name: skill.name,
            stacks: 1,
            duration: 5
          }
        ]
      } satisfies Partial<Skill>
    ])
  )
);

/** Keep follow-up coefficients, conditions, and finishers patchable independently of the buff grant. */
export const WEAVER_SPEAR_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze(
  Object.entries(SPEAR_DUAL_DEFINITIONS).map(([id, skill]) =>
    defineSkillVariantProfile(WEAVER_SPEAR_FOLLOWUPS[Number(id)], Number(id), `${skill.name} - Additional Strike`, {
      weapon: 'Spear',
      effects: (skill.effects ?? []).filter(followupEffect)
    })
  )
);
