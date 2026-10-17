import { BOON } from '#gw2/platform/effects/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type {
  ElementalistRuntimeState,
  ElementalistSkill,
  ElementalistRuntime
} from '#gw2/professions/elementalist/types.js';

/** Augments retain their declarations, conditional effects, and weapon-recharge actions together. */
export const CATALYST_AUGMENT_SKILLS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RELENTLESS_FIRE]: {
    name: 'Relentless Fire',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Catalyst',
    categories: ['Augment'],
    castTimeMs: 240,
    cooldown: 20,
    skillFamily: 'Augment',
    // Select the authored window from live sphere state when the cast commits.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.catalyst.augment-window' } }],
    effects: [
      {
        type: 'buff',
        name: 'Base window',
        kind: 'relentless fire',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => !(catalystState.from(runtime).sphereExpiry.Fire > runtime.time)
      },
      {
        type: 'buff',
        name: 'Window with Fire sphere',
        kind: 'relentless fire',
        duration: 8,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => catalystState.from(runtime).sphereExpiry.Fire > runtime.time
      }
    ]
  },
  [ID.SHATTERING_ICE]: {
    name: 'Shattering Ice',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Catalyst',
    categories: ['Augment'],
    castTimeMs: 240,
    cooldown: 20,
    skillFamily: 'Augment',
    // Select the authored window from live sphere state when the cast commits.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.catalyst.augment-window' } }],
    effects: [
      {
        type: 'buff',
        name: 'Base window',
        kind: 'shattering ice',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => !(catalystState.from(runtime).sphereExpiry.Water > runtime.time)
      },
      {
        type: 'buff',
        name: 'Window with Water sphere',
        kind: 'shattering ice',
        duration: 8,
        stacks: 1,
        audience: { recipients: 'self' },
        when: (runtime) => catalystState.from(runtime).sphereExpiry.Water > runtime.time
      }
    ]
  },
  [ID.ELEMENTAL_CELERITY]: {
    name: 'Elemental Celerity',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Catalyst',
    categories: ['Augment'],
    castTimeMs: 240,
    cooldown: 90,
    skillFamily: 'Augment',
    // The active catalog selects reset targets; each surviving sphere gates its own authored boon.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.catalyst.refresh-weapons' } }],
    effects: [
      {
        type: 'boon',
        name: 'Fire',
        boon: BOON.MIGHT,
        stacks: 5,
        duration: 6,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Fire > cast.effectiveEnd
      },
      {
        type: 'boon',
        name: 'Water',
        boon: BOON.VIGOR,
        stacks: 1,
        duration: 6,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Water > cast.effectiveEnd
      },
      {
        type: 'boon',
        name: 'Air',
        boon: BOON.FURY,
        stacks: 1,
        duration: 6,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Air > cast.effectiveEnd
      },
      {
        type: 'boon',
        name: 'Earth',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 4,
        when: (runtime, cast) => catalystState.from(runtime).sphereExpiry.Earth > cast.effectiveEnd
      }
    ]
  }
});

/** Relentless Fire grants strike and condition bonuses for its accepted buff window. */
export const relentlessFireModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.relentless-fire',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuffStacks(context, 'relentless fire', 1) > 0
  },
  {
    id: 'elementalist.relentless-fire-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuffStacks(context, 'relentless fire', 1) > 0
  }
]);

// Reset weapon cooldowns matching Catalyst's single active attunement while
// preserving exclusions and active ammo-recharge contracts.
function activateElementalCelerity(
  context: ElementalistRuntime,
  actionContext: ActionContext<ElementalistSkill>
): void {
  const core = professionCoreState(context);
  for (const candidate of context.helpers.skills) {
    if (
      candidate.type === 'Weapon' &&
      (candidate.cooldown || 0) > 0 &&
      candidate.attunement === core.primaryAttunement
    ) {
      if (Number(candidate.ammo) > 0)
        applySideEffect(context, actionContext, {
          type: 'ammoRestore',
          skillIds: [candidate.id],
          count: Number(candidate.ammo)
        });
      else applySideEffect(context, actionContext, { type: 'rechargeReset', skillIds: [candidate.id] });
    }
  }
}

/** Augments sample sphere windows at commitment; Elemental Celerity resets only eligible weapon recharges. */
const catalystAugmentActions = {
  'elementalist.catalyst.refresh-weapons': activateElementalCelerity,
  // A sphere can deploy during an augment's cast; select and emit its authored window only on commitment.
  'elementalist.catalyst.augment-window'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Catalyst augment windows require a cast trigger.');

    const { skill, cast } = context;
    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      effects: (skill.effects ?? []).filter((effect) => !effect.when || effect.when(runtime, cast)),
      attribution: {
        source: 'elementalist',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id
      },
      transform: (event) => ({ ...event, offTarget: cast.command.offTarget })
    });
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['sideEffectHandlers']>;

/** Registers augment windows and recharge resets with the Catalyst hook assembly. */
export const catalystAugmentLifecycle = {
  sideEffectHandlers: catalystAugmentActions
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
