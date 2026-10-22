import { ACTOR, BOON, CONTROL } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceNumberFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  PRIMORDIAL_STANCE_EFFECTS,
  WEAVER_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Shares stance timing while retaining independent effect arrays and stable patch selectors for each variant. */
function primordialStance(attunement: ElementalistAttunement): Partial<Skill> {
  const offsets = [0, 1000, 2000, 3000, 4000, 5000];
  const { condition, stacks, duration } = PRIMORDIAL_STANCE_EFFECTS[attunement];
  return {
    // Each pulse reads the live hands; these effects supply editable timing without emitting a second stream.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: { type: 'elementalist.weaver.start-primordial-stance' }
      }
    ],
    name: `Primordial Stance (${attunement})`,
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement,
    categories: ['Stance'],
    castTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    skillFamily: 'Stance',

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
        timingScale: 'cast',
        metadata: {}
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
    castTimeMs: 640,
    cooldown: 20,
    resourceGain: 50,
    // Committed activations restore endurance using this skill's editable amount.
    sideEffects: [
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ],
    skillFamily: 'Stance',
    effects: []
  },
  [ID.PRIMORDIAL_STANCE_FIRE]: primordialStance('Fire'),
  [ID.PRIMORDIAL_STANCE_WATER]: primordialStance('Water'),
  [ID.PRIMORDIAL_STANCE_AIR]: primordialStance('Air'),
  [ID.PRIMORDIAL_STANCE_EARTH]: primordialStance('Earth'),
  // Weave Self and Tailored Victory chain into each other: completing Weave Self
  // opens the Perfect Weave flipover, and Tailored Victory consumes it.
  [ID.WEAVE_SELF]: {
    // Schedule the profiled mid-cast activation; interruption before it grants no window.
    sideEffects: [{ on: 'castStart', do: { type: 'elementalist.weaver.start-weave-self' } }],
    name: 'Weave Self',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 800,
    cooldown: 90,
    nextChainId: ID.TAILORED_VICTORY,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.TAILORED_VICTORY]: {
    name: 'Tailored Victory',
    // Weave Self exposes this follow-up; it cannot be equipped as an independent elite skill.
    slotSelectable: false,
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 560,
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
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.75, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.FLOAT }
    ])
  },
  [ID.UNRAVEL]: {
    // After completion traits, unify the live hands, clear attunement recharge, and grant the current element's boon.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.weaver.unravel' } }],
    name: 'Unravel',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Weaver',
    categories: ['Stance'],
    mechanicSlot: 5,
    castTimeMs: 0,
    cooldown: 25,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.FERVENT_STANCE]: {
    name: 'Fervent Stance',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Stance',
    // Fervent Stance arms its dual-attack might window after completion.
    tasks: [
      {
        type: 'elementalist.weaver.arm-fervent-stance',
        timingAnchor: 'castCommit'
      }
    ],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 6, metadata: {} },
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 6, metadata: {} },
      { type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 6, metadata: {} }
    ])
  }
});

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
    const ferventStanceProfile = requireBalanceProfileFromContext(context, PROFILE.ferventStance);
    const might = requireEffect(ferventStanceProfile, 'boon', BOON.MIGHT);

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

/** Fervent Stance activation and its dual-attack reward share the same expiry state. */
const ferventStanceTasks = {
  'elementalist.weaver.arm-fervent-stance'(runtime) {
    weaverState.from(runtime).ferventStanceUntil =
      runtime.time + balanceNumberFromContext(runtime, PROFILE.ferventStance, 'duration');
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['tasks']>;

/** Registers Fervent Stance tasks with the Weaver hook assembly. */
export const ferventStanceLifecycle = {
  tasks: ferventStanceTasks
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
