import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { elementalistBuffRequest, elementalistControlRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistConditionEffectRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { weaverDualAttunements } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import { ACTOR, CONTROL, WEAPON, COMBO_FINISHER, BOON, CONDITION, AURA, STATUS } from '#gw2/platform/constants.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
/**
 * Pistol weapon-skill mechanics owned by the Weaver module.
 *
 * Weaver occupies the slot-3 pistol position with a dual attack selected by the
 * unordered pair of attunements held across its two hands; every fragment names
 * its pair in `attunement`, and Weaver availability only offers the skill when
 * both of those elements are currently attuned.
 *
 * Definitions select the enhanced payloads and declare the final shared bullet settlement.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * The six pistol dual attacks, keyed by skill id and merged into
 * `WEAVER_SKILL_MECHANICS`: one entry per attunement pair.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Fire+Water. Three-shot burst at 280/440/640 ms; the opening shot chills and
  // the two follow-ups each stack Burning.
  [ID.FROSTFIRE_FLURRY]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Fire,
        do: {
          type: 'elementalist.weaver.pistol.frostfire-fire',
          id: 'frostfire-fire',
          effects: [{ type: 'aura', name: 'Fire', aura: AURA.FIRE, duration: 3 }]
        }
      },
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Water,
        do: {
          type: 'elementalist.weaver.pistol.frostfire-water',
          id: 'frostfire-water',
          effects: [
            {
              type: 'condition',
              name: 'Water',
              condition: CONDITION.VULNERABILITY,
              stacks: 4,
              duration: 8
            }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Frostfire Flurry',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire+Water',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2.5 }
      ]),
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 5 }
      ]),
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 5 }
      ])
    ],
    specialization: 'Weaver'
  },
  // Fire+Air. Single Projectile finisher carrying the blind and five stacks of
  // Vulnerability.
  [ID.PURBLINDING_PLASMA]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Fire,
        do: {
          type: 'elementalist.weaver.pistol.plasma-fire',
          id: 'plasma-fire',
          effects: [{ type: 'condition', name: 'Fire', condition: CONDITION.BURNING, stacks: 3, duration: 4 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Purblinding Plasma',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire+Air',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 12,
    // Only a loaded Air bullet applies this factor when recharge work is reserved.
    airBulletRechargeMultiplier: 2 / 3,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 2,
        applications: 1
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 5 }
    ]),
    specialization: 'Weaver'
  },
  [ID.MOLTEN_METEOR]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Earth,
        do: {
          type: 'elementalist.weaver.pistol.meteor-earth',
          id: 'meteor-earth',
          effects: [
            {
              type: 'condition',
              name: 'Earth',
              condition: CONDITION.BLEEDING,
              stacks: 3,
              duration: 8
            }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Molten Meteor',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 }
    ]),
    specialization: 'Weaver'
  },
  // Air+Water. The one dual with no offensive packet at all: it only self-boons
  // (Regeneration and Stability) at cast start.
  [ID.FLOWING_FINESSE]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Water,
        do: {
          type: 'elementalist.weaver.pistol.finesse-water',
          id: 'finesse-water',
          effects: [{ type: 'aura', name: 'Water', aura: AURA.FROST, duration: 3 }]
        }
      },
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Air,
        do: {
          type: 'elementalist.weaver.pistol.finesse-air',
          id: 'finesse-air',
          effects: [{ type: 'buff', name: 'Air', kind: STATUS.SUPERSPEED, stacks: 1, duration: 4 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Flowing Finesse',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air+Water',
    categories: ['Weapon skill'],
    castTimeMs: 880,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: BOON.REGENERATION, stacks: 1, duration: 5 },
      { type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 5 }
    ]),
    specialization: 'Weaver'
  },
  // Water+Earth. Two shots at 280/480 ms, each applying two Bleeding stacks.
  [ID.ECHOING_EROSION]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }],
    name: 'Echoing Erosion',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Water+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 }
      ]),
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 }
      ])
    ],
    specialization: 'Weaver'
  },
  // Air+Earth. Single Projectile finisher carrying Weakness and Cripple.
  [ID.ENERVATING_EARTH]: {
    // Read matching bullets at commitment before consuming them; with none loaded, stock the live primary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Air,
        do: { type: 'elementalist.weaver.pistol.enervating-air' }
      },
      {
        on: 'castCommit',
        when: (runtime) => readProfessionCoreState<ElementalistCoreState>(runtime.profession).pistolBullets!.Earth,
        do: {
          type: 'elementalist.weaver.pistol.enervating-earth',
          id: 'enervating-earth',
          effects: [
            {
              type: 'condition',
              name: 'Earth',
              condition: CONDITION.BLEEDING,
              stacks: 4,
              duration: 8
            }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.weaver.pistol.settle' } }
    ],
    name: 'Enervating Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air+Earth',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 }
    ]),
    specialization: 'Weaver'
  }
});

/** Payload declarations run before this shared all-matching-bullets settlement. */
const weaverPistolSideEffects: RuntimeProfession<ElementalistRuntimeState, ElementalistSkill>['sideEffectHandlers'] = {
  'elementalist.weaver.pistol.settle'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol settlement requires a cast trigger.');

    const state = professionCoreState(context);
    const active = weaverDualAttunements(trigger.skill)!.filter((element) => state.pistolBullets[element]);

    if (!active.length) state.pistolBullets[state.primaryAttunement] = true;
    else for (const element of active) state.pistolBullets[element] = false;
  },
  'elementalist.weaver.pistol.frostfire-fire'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    const aura = requireEffect(skill, 'aura', 'Fire', action);

    if (aura) {
      applyElementalistAura(context, {
        at,
        aura: aura.aura,
        duration: aura.duration,
        skillName: skill.name,
        sourceId: skill.id
      });
    }
  },
  'elementalist.weaver.pistol.frostfire-water'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistConditionEffectRequest(context, at, { skill, action }, 'Water', skill.name, skill.id, {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      })
    );
  },
  'elementalist.weaver.pistol.plasma-fire'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistConditionEffectRequest(context, at, { skill, action }, 'Fire', skill.name, skill.id, {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      })
    );
  },
  'elementalist.weaver.pistol.meteor-earth'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistConditionEffectRequest(context, at, { skill, action }, 'Earth', skill.name, skill.id, {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      })
    );
  },
  'elementalist.weaver.pistol.finesse-water'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    const aura = requireEffect(skill, 'aura', 'Water', action);

    if (aura) {
      applyElementalistAura(context, {
        at,
        aura: aura.aura,
        duration: aura.duration,
        skillName: skill.name,
        sourceId: skill.id
      });
    }
  },
  'elementalist.weaver.pistol.finesse-air'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    // Superspeed is a buff, so resolve its authored kind without treating it as a boon.
    const effect = requireEffect(skill, 'buff', 'Air', action);

    if (effect)
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            kind: String(effect.kind),
            stacks: Number(effect.stacks),
            duration: effect.duration
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
  },
  'elementalist.weaver.pistol.enervating-air'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistControlRequest(
        {
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: ACTOR.PLAYER,
          skillName: skill.name,
          skillId: skill.id,
          controlKind: CONTROL.DAZE
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  },
  'elementalist.weaver.pistol.enervating-earth'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistConditionEffectRequest(context, at, { skill, action }, 'Earth', skill.name, skill.id, {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      })
    );
  }
};

/** Registers dual-attunement pistol bullet actions with the Weaver hook assembly. */
export const weaverPistolLifecycle = {
  sideEffectHandlers: weaverPistolSideEffects
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
