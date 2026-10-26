import { ACTOR, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber, requireSkillFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
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
function primordialStance(attunement: ElementalistAttunement): Partial<Skill> {
  const offsets = [0, 1000, 2000, 3000, 4000, 5000];
  const { condition, stacks, duration } = PRIMORDIAL_STANCE_EFFECTS[attunement];
  return {
    name: `Primordial Stance (${attunement})`,
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement,
    categories: ['Stance'],
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
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
export const WEAVER_SLOT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.AQUATIC_STANCE]: {
    name: 'Aquatic Stance',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Weaver',
    categories: ['Stance'],
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
  [ID.PRIMORDIAL_STANCE_FIRE]: primordialStance('Fire'),
  [ID.PRIMORDIAL_STANCE_WATER]: primordialStance('Water'),
  [ID.PRIMORDIAL_STANCE_AIR]: primordialStance('Air'),
  [ID.PRIMORDIAL_STANCE_EARTH]: primordialStance('Earth'),
  // Weave Self and Tailored Victory chain into each other: completing Weave Self
  // opens the Perfect Weave flipover, and Tailored Victory consumes it.
  [ID.WEAVE_SELF]: {
    name: 'Weave Self',
    // Weave Self lasts `duration`; completing every attunement opens Tailored Victory for `flipDuration`.
    duration: 20,
    flipDuration: 10,
    // The form activates, and recharge starts, at this fraction of the cast.
    rechargeProgress: 0.65,
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    cooldown: 90,
    nextChainId: ID.TAILORED_VICTORY,
    skillFamily: 'Stance',
    castTimeMs: 800,
    effects: [],
    // Schedule the mid-cast activation at the recharge point; interruption before it grants no window.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.weaver.start-weave-self' } }]
  },
  [ID.TAILORED_VICTORY]: {
    name: 'Tailored Victory',
    // Weave Self exposes this follow-up; it cannot be equipped as an independent elite skill.
    slotSelectable: false,
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    cooldown: 0,
    nextChainId: ID.WEAVE_SELF,
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
    duration: 5,
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Weaver',
    categories: ['Stance'],
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
    // The committed stance arms this window; later dual attacks read the action's Might reward.
    duration: 8,
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    categories: ['Stance'],
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
