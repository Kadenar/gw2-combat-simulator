/**
 * Spear weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 spear position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every definition names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Each instant activation grants its self benefits and arms a five-second buff.
 * The additional strike and its conditions resolve on the next player strike.
 */
import { ACTOR, AURA, BOON, COMBO_FINISHER, CONDITION, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Stable buff identities keep six independently armed follow-ups separate. */
export const WEAVER_SPEAR_BUFFS: Readonly<Record<number, string>> = Object.freeze({
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
// Ordinary effects apply immediately; each action owns its arming buff and deferred strike/condition payload.
export const WEAVER_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  // Fire+Water. The only spear dual that grants an aura: its declared effect
  // grants the three-second Fire Aura on cast end.
  [ID.FROSTFIRE_WARD]: {
    name: 'Frostfire Ward',
    icon: 'https://render.guildwars2.com/file/DD1B9616EB330DC50729663B497B31D40104290C/3379105.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire+Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.FIRE, duration: 3 }],
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-spear-followup',
          id: 'additional-strike',
          effects: [
            {
              type: 'buff',
              kind: WEAVER_SPEAR_BUFFS[ID.FROSTFIRE_WARD],
              name: 'Frostfire Ward',
              stacks: 1,
              duration: 5
            },
            {
              type: 'strike',
              name: 'Frostfire Ward - Additional Strike',
              ticks: [{ atMs: 0, coefficient: 1 }],
              timingAnchor: 'castStart',
              timingScale: 'cast'
            }
          ]
        }
      }
    ]
  },
  // Fire+Air. Heaviest single spear packet, paired with self superspeed and
  // three stacks of Might rather than any condition.
  [ID.GALVANIZE]: {
    name: 'Galvanize',
    icon: 'https://render.guildwars2.com/file/14A70A6CE40336397DAA5C0F03940C08C7622376/3379106.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire+Air',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'buff', kind: STATUS.SUPERSPEED, stacks: 1, duration: 3 },
      { type: 'boon', boon: BOON.MIGHT, stacks: 3, duration: 6 }
    ]),
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-spear-followup',
          id: 'additional-strike',
          effects: [
            {
              type: 'buff',
              kind: WEAVER_SPEAR_BUFFS[ID.GALVANIZE],
              name: 'Galvanize',
              stacks: 1,
              duration: 5
            },
            ...impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
              { type: 'strike', name: 'Galvanize - Additional Strike', coefficient: 2.6 }
            ])
          ]
        }
      }
    ]
  },
  // Fire+Earth. Blast finisher into the oldest eligible field, plus Burning
  // and three stacks of Bleeding.
  [ID.FIERY_IMPACT]: {
    name: 'Fiery Impact',
    icon: 'https://render.guildwars2.com/file/69FB136A0D3615BBBE1B04DCBE09407D7E9297F3/3379107.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Fire+Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [],
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-spear-followup',
          id: 'additional-strike',
          effects: [
            {
              type: 'buff',
              kind: WEAVER_SPEAR_BUFFS[ID.FIERY_IMPACT],
              name: 'Fiery Impact',
              stacks: 1,
              duration: 5
            },
            ...impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
              {
                type: 'strike',
                name: 'Fiery Impact - Additional Strike',
                coefficient: 1.75,
                comboFinishers: [
                  { attemptGroup: 'effect:1:tick:1', ownerId: 'elementalist', finisherType: COMBO_FINISHER.BLAST }
                ]
              },
              {
                type: 'condition',
                name: 'Fiery Impact - Additional Strike — Burning',
                condition: CONDITION.BURNING,
                stacks: 1,
                duration: 5
              },
              {
                type: 'condition',
                name: 'Fiery Impact - Additional Strike — Bleeding',
                condition: CONDITION.BLEEDING,
                stacks: 3,
                duration: 6
              }
            ])
          ]
        }
      }
    ]
  },
  [ID.ELUTRIATE]: {
    name: 'Elutriate',
    icon: 'https://render.guildwars2.com/file/1EF742E5936B0D160F3869511D2EBEC6745EEA18/3379108.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Air+Water',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [],
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-spear-followup',
          id: 'additional-strike',
          effects: [
            {
              type: 'buff',
              kind: WEAVER_SPEAR_BUFFS[ID.ELUTRIATE],
              name: 'Elutriate',
              stacks: 1,
              duration: 5
            },
            ...impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
              { type: 'strike', name: 'Elutriate - Additional Strike', coefficient: 1.25 },
              {
                type: 'condition',
                name: 'Elutriate - Additional Strike — Vulnerability',
                condition: CONDITION.VULNERABILITY,
                stacks: 5,
                duration: 8
              },
              {
                type: 'condition',
                name: 'Elutriate - Additional Strike — Chilled',
                condition: CONDITION.CHILLED,
                stacks: 1,
                duration: 4
              }
            ])
          ]
        }
      }
    ]
  },
  // Water+Earth. Modelled purely as a Blast finisher: one strike, no conditions
  // and no boons.
  [ID.SOOTHING_BURST]: {
    name: 'Soothing Burst',
    icon: 'https://render.guildwars2.com/file/110F9A310F3A6D0E999B36DAB4F5390F70727DEB/3379109.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Water+Earth',

    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [],
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-spear-followup',
          id: 'additional-strike',
          effects: [
            {
              type: 'buff',
              kind: WEAVER_SPEAR_BUFFS[ID.SOOTHING_BURST],
              name: 'Soothing Burst',
              stacks: 1,
              duration: 5
            },
            {
              type: 'strike',
              name: 'Soothing Burst - Additional Strike',
              ticks: [
                {
                  atMs: 0,
                  coefficient: 1,
                  comboFinishers: [{ ownerId: 'elementalist', finisherType: COMBO_FINISHER.BLAST }]
                }
              ],
              timingAnchor: 'castStart',
              timingScale: 'cast'
            }
          ]
        }
      }
    ]
  },
  [ID.SHALE_STORM]: {
    name: 'Shale Storm',
    icon: 'https://render.guildwars2.com/file/53AD3D92123744A13D0D2434661EFA3608213D06/3379110.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SPEAR,
    attunement: 'Air+Earth',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [],
    // Different live hand elements make the current primary immediately re-attunable on commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'elementalist.weaver.refresh-primary-attunement' } },
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-spear-followup',
          id: 'additional-strike',
          effects: [
            {
              type: 'buff',
              kind: WEAVER_SPEAR_BUFFS[ID.SHALE_STORM],
              name: 'Shale Storm',
              stacks: 1,
              duration: 5
            },
            ...impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
              { type: 'strike', name: 'Shale Storm - Additional Strike', coefficient: 1.5 },
              {
                type: 'condition',
                name: 'Shale Storm - Additional Strike — Blindness',
                condition: CONDITION.BLINDNESS,
                stacks: 1,
                duration: 3
              },
              {
                type: 'condition',
                name: 'Shale Storm - Additional Strike — Crippled',
                condition: CONDITION.CRIPPLED,
                stacks: 1,
                duration: 5
              }
            ])
          ]
        }
      }
    ]
  }
};

/** Activation grants only the arming buff; the next qualifying hit emits the action's hostile payload. */
export const weaverSpearLifecycle = {
  sideEffectHandlers: {
    'elementalist.weaver.arm-spear-followup'(context, trigger, action) {
      if (trigger.kind !== 'cast') throw new TypeError('Spear follow-ups require a cast trigger.');

      const { cast, skill } = trigger;
      const grant = requireEffect(skill, 'buff', skill.name, action);

      if (!grant) return;

      context.effects.emit({
        kind: 'profile',
        profile: skill,
        effects: [grant],
        at: cast.effectiveEnd,
        fullEnd: cast.effectiveEnd,
        cast: { activationId: cast.id, skillId: skill.id, offTarget: cast.command.offTarget },
        attribution: {
          source: 'elementalist',
          sourceId: skill.id,
          actorType: ACTOR.PLAYER,
          skillId: skill.id,
          skillName: skill.name
        }
      });
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
