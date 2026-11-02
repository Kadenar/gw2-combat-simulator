import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
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

// One authored payload supplies the stance action and its non-emitting timing templates.
const PRIMORDIAL_STANCE_OFFSETS = [0, 1000, 2000, 3000, 4000, 5000];
const PRIMORDIAL_STANCE_EFFECTS = {
  strike: { type: 'strike', name: 'Primordial Stance', coefficient: 0.33, hits: 1 },
  Fire: { type: 'condition', name: 'Fire', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
  Water: { type: 'condition', name: 'Water', condition: CONDITION.CHILLED, stacks: 1, duration: 1 },
  Air: { type: 'condition', name: 'Air', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 3 },
  Earth: { type: 'condition', name: 'Earth', condition: CONDITION.BLEEDING, stacks: 2, duration: 6 }
} satisfies Record<string, SkillEffect>;

/** Declares Weaver-owned non-weapon skills for composition by `index.ts`. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SLOT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.AQUATIC_STANCE]: {
    name: 'Aquatic Stance',
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
  // One input and ammunition pool remain stable while pulses follow both live attunements.
  [ID.PRIMORDIAL_STANCE]: {
    name: 'Primordial Stance',
    icon: 'https://render.guildwars2.com/file/9A03F9CFBBE6154A41B1B5CAC4060092C11FABDA/1770332.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    ammo: 2,

    skillFamily: 'Stance',
    castTimeMs: 0,

    // Timing-only templates: `when: () => false` keeps them from emitting. The condition ticks set the pulse times
    // and the strike ticks describe expected hit times for readers of authored strikes, such as log import. Their
    // coefficient, stacks, and duration copy the defaults and are never read for output: pulse amounts come from the
    // stance's `pulses` action, so patches that change pulse output edit that action, not these effects.
    effects: [
      {
        type: 'strike',
        when: () => false,
        ticks: PRIMORDIAL_STANCE_OFFSETS.map((atMs) => ({
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
        ticks: PRIMORDIAL_STANCE_OFFSETS.map((atMs) => ({
          atMs,
          condition: PRIMORDIAL_STANCE_EFFECTS.Fire.condition,
          stacks: PRIMORDIAL_STANCE_EFFECTS.Fire.stacks,
          duration: PRIMORDIAL_STANCE_EFFECTS.Fire.duration
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Each pulse reads the live hands; these effects supply editable timing without emitting a second stream.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        // The stance owns all elemental payloads; each pulse chooses from the live hands.
        do: {
          type: 'elementalist.weaver.start-primordial-stance',
          id: 'pulses',
          effects: Object.values(PRIMORDIAL_STANCE_EFFECTS)
        }
      }
    ]
  },
  // Weave Self and Tailored Victory chain into each other: completing Weave Self
  // opens the Perfect Weave flipover, and Tailored Victory consumes it.
  [ID.WEAVE_SELF]: {
    name: 'Weave Self',
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
    // Each elemental window strengthens outgoing damage while its buff is active.
    modifiers: [
      {
        id: 'elementalist.weave-self-air',
        scope: 'profession',
        label: 'Weave Self',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'damage-additive',
        amount: 0.1,
        when: (context) => activeBuffStacks(context, 'weave self air', 1) > 0
      },
      {
        id: 'elementalist.weave-self-fire',
        scope: 'profession',
        label: 'Weave Self',
        target: MODIFIER_TARGET.CONDITION_DAMAGE,
        operation: 'damage-additive',
        amount: 0.2,
        when: (context) => activeBuffStacks(context, 'weave self fire', 1) > 0
      }
    ],
    effects: [],
    // Schedule the mid-cast activation at the recharge point; interruption before it grants no window.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.weaver.start-weave-self' } }]
  },
  [ID.TAILORED_VICTORY]: {
    name: 'Tailored Victory',
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
    icon: 'https://render.guildwars2.com/file/A3E26A4A4FF0C974B4AAACA6B310060CFBC2D007/1770330.png',
    duration: 5,
    type: 'Profession',
    slot: 'Profession_5',

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
};

/** Runtime and tooltips read the same patched stance payload. */
export function primordialStancePayload(context: unknown) {
  const skill = requireSkillFromContext(context, ID.PRIMORDIAL_STANCE);
  return { skill, action: requireSkillAction(skill, 'pulses') };
}

/** Dual attacks grant the stance reward only while its committed window remains active. */
export function applyFerventStance(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  dualAttunements: readonly ElementalistAttunement[] | null
): void {
  const state = weaverState.from(context.profession);
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
      weaverState.from(runtime.profession).ferventStanceUntil = runtime.time + skillNumber(trigger.skill, 'duration');
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
