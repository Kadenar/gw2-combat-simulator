import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireEffect, requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

// One authored payload supplies the canonical action and the variants' non-emitting timing templates.
const PRIMORDIAL_STANCE_EFFECTS = {
  strike: { type: 'strike', name: 'Primordial Stance', coefficient: 0.33, hits: 1 },
  Fire: { type: 'condition', name: 'Fire', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
  Water: { type: 'condition', name: 'Water', condition: CONDITION.CHILLED, stacks: 1, duration: 1 },
  Air: { type: 'condition', name: 'Air', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 3 },
  Earth: { type: 'condition', name: 'Earth', condition: CONDITION.BLEEDING, stacks: 2, duration: 6 }
} satisfies Record<string, SkillEffect>;

/** Shares stance timing while retaining independent timing edits for each casting variant. */
function primordialStance(attunement: ElementalistAttunement): Partial<SkillDefinition> {
  const offsets = [0, 1000, 2000, 3000, 4000, 5000];
  const { condition, stacks, duration } = PRIMORDIAL_STANCE_EFFECTS[attunement];
  return {
    type: 'Utility',
    slot: 'Utility',
    attunement,

    cooldown: 20,
    ammo: 2,

    skillFamily: 'Stance',
    castTimeMs: 0,

    // Timing-only templates: `when: () => false` keeps them from emitting. The condition ticks set the pulse times
    // and the strike ticks describe expected hit times for readers of authored strikes, such as log import. Their
    // coefficient, stacks, and duration copy the defaults and are never read for output: pulse amounts come from the
    // Fire variant's `pulses` action, so patches that change pulse output edit that action, not these effects.
    effects: [
      {
        type: 'strike',
        when: () => false,
        ticks: offsets.map((atMs) => ({
          atMs,
          coefficient: PRIMORDIAL_STANCE_EFFECTS.strike.coefficient,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        when: () => false,
        ticks: offsets.map((atMs) => ({ atMs, condition, stacks, duration })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Each pulse reads the live hands; these effects supply editable timing without emitting a second stream.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        // Every variant reads the selected Fire skill's payload, so balance edits have one owner.
        do:
          attunement === 'Fire'
            ? {
                type: 'elementalist.weaver.start-primordial-stance',
                id: 'pulses',
                effects: Object.values(PRIMORDIAL_STANCE_EFFECTS)
              }
            : { type: 'elementalist.weaver.start-primordial-stance' }
      }
    ]
  };
}

/** Declares Weaver-owned non-weapon skills for composition by `index.ts`. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SLOT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.AQUATIC_STANCE]: {
    name: 'Aquatic Stance',
    description:
      'Stance. Flow like water, gaining endurance. While this stance is active, restore some endurance when you dodge.',
    icon: 'https://render.guildwars2.com/file/9C99AE9FFAFE0EFE34F52377D7DAE3375A2F989B/1770328.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Stance',
    castTimeMs: 640,
    effects: [],
    // Committed activations restore endurance using this skill's editable amount.
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ]
  },
  [ID.PRIMORDIAL_STANCE_FIRE]: {
    name: 'Primordial Stance (Fire)',
    description:
      'Stance. Channel the prime elements at their core, dealing damage based on your current attunements. Fully attuning deals the same condition twice.',
    icon: 'https://render.guildwars2.com/file/9A03F9CFBBE6154A41B1B5CAC4060092C11FABDA/1770332.png',

    loadoutSkillId: 40183,
    displayName: 'Primordial Stance',
    paletteTileId: 40183,

    ...primordialStance('Fire')
  },
  [ID.PRIMORDIAL_STANCE_WATER]: {
    name: 'Primordial Stance (Water)',
    description:
      'Stance. Channel the prime elements at their core, dealing damage based on your current attunements. Fully attuning deals the same condition twice.',
    icon: 'https://render.guildwars2.com/file/9A03F9CFBBE6154A41B1B5CAC4060092C11FABDA/1770332.png',

    loadoutSkillId: 40183,
    displayName: 'Primordial Stance',
    paletteTileId: 40183,

    ...primordialStance('Water')
  },
  [ID.PRIMORDIAL_STANCE_AIR]: {
    name: 'Primordial Stance (Air)',
    description:
      'Stance. Channel the prime elements at their core, dealing damage based on your current attunements. Fully attuning deals the same condition twice.',
    icon: 'https://render.guildwars2.com/file/9A03F9CFBBE6154A41B1B5CAC4060092C11FABDA/1770332.png',

    loadoutSkillId: 40183,
    displayName: 'Primordial Stance',
    paletteTileId: 40183,

    ...primordialStance('Air')
  },
  [ID.PRIMORDIAL_STANCE_EARTH]: {
    name: 'Primordial Stance (Earth)',
    description:
      'Stance. Channel the prime elements at their core, dealing damage based on your current attunements. Fully attuning deals the same condition twice.',
    icon: 'https://render.guildwars2.com/file/9A03F9CFBBE6154A41B1B5CAC4060092C11FABDA/1770332.png',

    loadoutSkillId: 40183,
    displayName: 'Primordial Stance',
    paletteTileId: 40183,

    ...primordialStance('Earth')
  },
  // Weave Self and Tailored Victory chain into each other: completing Weave Self
  // opens the Perfect Weave flipover, and Tailored Victory consumes it.
  [ID.WEAVE_SELF]: {
    name: 'Weave Self',
    description:
      'Stance. Temporarily reduce the recharge time of attunements while gaining bonuses for attuning to new elements. Successfully attuning to all elements ends this stance and grants Perfect Weave.',
    icon: 'https://render.guildwars2.com/file/E656D3A8B1339603A70BBB7237F2BA004258ED55/1770326.png',
    // Weave Self lasts `duration`; completing every attunement opens Tailored Victory for `flipDuration`.
    duration: 20,
    flipDuration: 10,
    // The form activates, and recharge starts, at this fraction of the cast.
    rechargeProgress: 0.65,
    type: 'Elite',
    slot: 'Elite',

    cooldown: 90,
    skillFamily: 'Stance',
    castTimeMs: 800,
    effects: [],
    // Schedule the mid-cast activation at the recharge point; interruption before it grants no window.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.weaver.start-weave-self' } }]
  },
  [ID.TAILORED_VICTORY]: {
    name: 'Tailored Victory',
    description:
      'Release all of your woven elements and end your Weave Self stance, causing gravity itself to unravel around you.',
    icon: 'https://render.guildwars2.com/file/33DBB3D7536A4D4E4A3B0CB60CB1FEE2E8F20A15/1770327.png',
    // Weave Self exposes this follow-up; it cannot be equipped as an independent elite skill.
    slotSelectable: false,
    type: 'Elite',
    slot: 'Elite',

    cooldown: 0,
    skillFamily: 'Stance',
    // Tailored Victory consumes the Perfect Weave flip window when it completes.
    tasks: [
      {
        type: 'elementalist.weaver.consume-perfect-weave',
        timingAnchor: 'castCommit'
      }
    ],
    castTimeMs: 560,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.75, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.FLOAT }
    ])
  },
  [ID.UNRAVEL]: {
    name: 'Unravel',
    description:
      'Stance. For a period of time, you forego your weaver training, choosing to fully attune to elements instead. Gain boons based on your primary attunement, and reduce all attunement cooldowns.',
    icon: 'https://render.guildwars2.com/file/A3E26A4A4FF0C974B4AAACA6B310060CFBC2D007/1770330.png',
    duration: 5,
    type: 'Profession',
    slot: 'Profession_5',

    mechanicSlot: 5,
    cooldown: 25,
    skillFamily: 'Stance',
    castTimeMs: 0,
    effects: [],
    // After completion traits, unify the live hands, clear attunement recharge, and grant the current element's boon.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.unravel',
          id: 'unravel',
          effects: [
            { type: 'boon', name: 'Fire', boon: BOON.MIGHT, stacks: 5, duration: 5 },
            { type: 'boon', name: 'Water', boon: BOON.VIGOR, stacks: 1, duration: 5 },
            { type: 'boon', name: 'Air', boon: BOON.FURY, stacks: 1, duration: 5 },
            { type: 'boon', name: 'Earth', boon: BOON.PROTECTION, stacks: 1, duration: 5 }
          ]
        }
      }
    ]
  },
  [ID.FERVENT_STANCE]: {
    name: 'Fervent Stance',
    description: 'Stance. Gain quickness, fury, and swiftness. Gain might when you use a Dual Attack.',
    icon: 'https://render.guildwars2.com/file/135DA468DA3BB26834AC52426AA36D2CC93BA30A/3790490.png',
    // The committed stance arms this window; later dual attacks read the action's Might reward.
    duration: 8,
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    skillFamily: 'Stance',
    castTimeMs: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 6 },
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 6 },
      { type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 6 }
    ]),
    // Fervent Stance arms its dual-attack might window after completion.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.weaver.arm-fervent-stance',
          id: 'dual-attack-might',
          effects: [{ type: 'boon', name: BOON.MIGHT, boon: BOON.MIGHT, stacks: 3, duration: 8 }]
        }
      }
    ]
  }
});

/** Runtime and tooltips share the selected canonical payload while casts retain their own variant identity. */
export function primordialStancePayload(context: unknown) {
  const skill = requireSkillFromContext(context, ID.PRIMORDIAL_STANCE_FIRE);
  return { skill, action: requireSkillAction(skill, 'pulses') };
}

/** Weave Self buffs later attacks while its elemental windows remain active. */
export const weaveSelfModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.weave-self-air',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuffStacks(context, 'weave self air', 1) > 0
  },
  {
    id: 'elementalist.weave-self-fire',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) => activeBuffStacks(context, 'weave self fire', 1) > 0
  }
]);

/** Dual attacks grant the stance reward only while its committed window remains active. */
export function applyFerventStance(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  dualAttunements: readonly ElementalistAttunement[] | null
): void {
  const state = weaverState.from(context);
  const at = cast.effectiveEnd;
  const skill = cast.skill;

  // Swift Revenge pays out per element of the dual skill that was just cast.
  // Dual attacks claim Superior Elements at completion, before attempting its Weakness packet.
  // Dual attacks grant Might only while the stance is armed and strictly unexpired.
  if (dualAttunements && state.ferventStanceUntil > 0 && state.ferventStanceUntil > at) {
    const stance = requireSkillFromContext(context, ID.FERVENT_STANCE);
    const might = requireEffect(stance, 'boon', BOON.MIGHT, requireSkillAction(stance, 'dual-attack-might'));

    if (might) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: 'Fervent Stance',
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            kind: String(might.boon).toLowerCase(),
            stacks: Number(might.stacks),
            duration: might.duration,
            skillName: 'Fervent Stance'
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
}

/** Fervent Stance's commit action arms the window that later dual attacks read for its Might reward. */
export const ferventStanceLifecycle = {
  sideEffectHandlers: {
    'elementalist.weaver.arm-fervent-stance'(runtime, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Fervent Stance requires a cast trigger.');

      // Arm directly at commitment: only later dual-attack completions read this window, and the stance itself is
      // not a dual attack, so deferring past this cast's completion traits would change nothing.
      weaverState.from(runtime).ferventStanceUntil = runtime.time + skillNumber(trigger.skill, 'duration');
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
